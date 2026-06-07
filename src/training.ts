import { RpcClient } from "./rpc";

/**
 * Lifecycle status of a `TrainingRun`. Mirrors the Rust
 * `tenzro_types::training::TrainingRunStatus` enum.
 */
export type TrainingRunStatus =
  | "Pending"
  | "Active"
  | "Completed"
  | "Failed"
  | "Cancelled";

/**
 * Read-side view of a `TrainingRun` — the protocol-side run header
 * the syncer maintains for an in-flight training task. Field shape
 * matches `tenzro_types::training::TrainingRun` verbatim; opaque
 * sub-payloads (current `SyncRound`, aggregator config, attestations)
 * are passed through as `unknown` so this SDK doesn't lock callers to
 * a specific decode shape.
 */
export interface TrainingRun {
  task_id: string;
  task_spec: unknown;
  status: TrainingRunStatus;
  current_round: number;
  state_root: string;
  enrolled_trainers: string[];
  created_at_ms: number;
  updated_at_ms: number;
  /** Present once `status` reaches `Completed` / `Failed` / `Cancelled`. */
  receipt?: unknown;
  /** Aggregator parameters, decay schedule, witness committee config. */
  metadata?: Record<string, unknown>;
}

/**
 * Sealed training receipt — produced when a run reaches its terminal
 * state. The receipt commits to the final state root, the aggregated
 * outer-gradient sequence, the witness committee that finalized each
 * round, and (for Confidential-tier runs) the sealed-shard manifest
 * hash. Persisted under `CF_TRAINING_RECEIPTS`.
 */
export interface TrainingReceipt {
  task_id: string;
  final_state_root: string;
  rounds_completed: number;
  witness_committees: unknown[];
  manifest_hash?: string;
  sealed_at_ms: number;
  [k: string]: unknown;
}

/**
 * Confidential-tier sealed-shard manifest. Each envelope wraps one
 * trainer's encrypted shard along with the HPKE-wrapped data key and
 * the enclave attestation the sponsor sealed to.
 */
export interface SealedDatasetManifest {
  task_id: string;
  manifest_hash: string;
  envelopes: SealedShardEnvelope[];
  created_at_ms: number;
  [k: string]: unknown;
}

export interface SealedShardEnvelope {
  trainer_did: string;
  shard_index: number;
  shard_ciphertext_hash: string;
  shard_ciphertext_bytes: number;
  wrapped_data_key: string;
  /** Always `"hpke-x25519-hkdf-sha256-aes-256-gcm"`. */
  wrap_alg: string;
  enclave_pubkey: string;
  enclave_measurements_hex: string;
  created_at_ms: number;
}

export interface ListTrainingRunsResult {
  runs: TrainingRun[];
}

/**
 * Read-only client for the Tenzro Train protocol-side run state —
 * the surface operators / dashboards / analytics use to inspect
 * in-flight runs, fetch sealed receipts, and audit Confidential-tier
 * sealed-shard manifests.
 *
 * Backed by the `tenzro_training_listRuns` / `tenzro_training_getRun` /
 * `tenzro_training_getReceipt` / `tenzro_training_getSealedManifest`
 * RPCs. Write-side endpoints (`postTask`, `enrollTrainer`,
 * `submitOuterGradient`, `finalizeRound`, `installSealedManifest`)
 * live in a future write-side client — this read client is safe to
 * expose to monitoring agents that should never mutate state.
 */
export class TrainingInspectionClient {
  constructor(private rpc: RpcClient) {}

  /** List every active training run this node is syncing. */
  async listRuns(): Promise<ListTrainingRunsResult> {
    return this.rpc.call("tenzro_training_listRuns", []);
  }

  /**
   * Look up a single training run by `task_id`. Throws JSON-RPC
   * `-32602` if the run is unknown — callers that want a nullable
   * result should catch and translate.
   */
  async getRun(taskId: string): Promise<TrainingRun> {
    return this.rpc.call("tenzro_training_getRun", [{ task_id: taskId }]);
  }

  /**
   * Fetch the sealed receipt for a finalized run. Returns `null`
   * when the run is still active (no receipt has been written yet).
   */
  async getReceipt(taskId: string): Promise<TrainingReceipt | null> {
    return this.rpc.call("tenzro_training_getReceipt", [{ task_id: taskId }]);
  }

  /**
   * Fetch the installed sealed-shard manifest for a Confidential-tier
   * task. Returns `null` when no manifest has been installed (Open
   * and Verified tiers never have a manifest).
   */
  async getSealedManifest(taskId: string): Promise<SealedDatasetManifest | null> {
    return this.rpc.call("tenzro_training_getSealedManifest", [
      { task_id: taskId },
    ]);
  }
}

/**
 * Optional confidential-tier enrollment payload — required when the
 * task being enrolled into has a sealed-shard manifest installed.
 * The attestation proves the trainer is running inside a TEE enclave
 * whose pubkey + measurements were sealed into the manifest by the
 * task sponsor.
 */
export interface ConfidentialEnrollment {
  attestation: string;
  enclave_pubkey: string;
  measurements_hex: string;
}

/**
 * Write-side client for the Tenzro Train protocol. Backed by the
 * `tenzro_training_postTask` / `enrollTrainer` / `submitOuterGradient` /
 * `finalizeRound` / `installSealedManifest` RPCs.
 *
 * The wallet kernel signs every write through the configured custody
 * quorum; this SDK class is the wire surface the wallet's training
 * adapter (or any operator dashboard) routes through.
 */
export class TrainingClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Register a new training run with the local syncer. `taskSpec` is
   * an opaque payload matching `tenzro_types::training::TrainingTaskSpec`
   * — sponsor, tier, dataset_ref, aggregator config, witness committee.
   */
  async postTask(taskSpec: unknown): Promise<{ task_id: string }> {
    return this.rpc.call("tenzro_training_postTask", [{ task_spec: taskSpec }]);
  }

  /**
   * Enroll a trainer DID into an active training run. For
   * Confidential-tier tasks, pass `confidential` carrying the
   * trainer's TEE attestation + enclave pubkey + measurements — the
   * node validates parity against the installed sealed-shard manifest
   * before accepting.
   */
  async enrollTrainer(
    taskId: string,
    trainerDid: string,
    confidential?: ConfidentialEnrollment,
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      task_id: taskId,
      trainer_did: trainerDid,
    };
    if (confidential) {
      params.attestation = confidential.attestation;
      params.enclave_pubkey = confidential.enclave_pubkey;
      params.measurements_hex = confidential.measurements_hex;
    }
    return this.rpc.call("tenzro_training_enrollTrainer", [params]);
  }

  /**
   * Submit an outer gradient for the current round. `gradient` is
   * the opaque protocol-side `OuterGradient` payload (safetensors
   * hash + signature + round + trainer DID).
   */
  async submitOuterGradient(taskId: string, gradient: unknown): Promise<unknown> {
    return this.rpc.call("tenzro_training_submitOuterGradient", [
      { task_id: taskId, gradient },
    ]);
  }

  /**
   * Finalize the current round. Idempotent under the k-of-N witness
   * committee model: redundant submissions for the same
   * `(round, state_root)` return Ok; conflicting state roots return
   * `ConflictingFinalize` for fork detection.
   */
  async finalizeRound(taskId: string, syncRound: unknown): Promise<unknown> {
    return this.rpc.call("tenzro_training_finalizeRound", [
      { task_id: taskId, sync_round: syncRound },
    ]);
  }

  /**
   * Install a sealed-shard manifest for a Confidential-tier task.
   * The manifest binds each trainer's encrypted shard to a TEE
   * attestation; the node enforces parity between the manifest hash
   * recorded here and the `dataset_ref` in the task spec.
   */
  async installSealedManifest(
    taskId: string,
    manifest: SealedDatasetManifest,
  ): Promise<unknown> {
    return this.rpc.call("tenzro_training_installSealedManifest", [
      { task_id: taskId, manifest },
    ]);
  }
}
