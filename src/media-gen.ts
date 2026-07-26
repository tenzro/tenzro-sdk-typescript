import { RpcClient } from "./rpc";

/**
 * Media kind a job asks for. Mirrors the Rust
 * `tenzro_types::media_gen::MediaGenKind` wire spellings.
 */
export type MediaGenKind =
  | "text2image"
  | "image2image"
  | "text2video"
  | "image2video";

/**
 * Which half of a split denoising schedule a worker holds. Pipelines
 * whose schedule crosses a timestep boundary run the high-noise expert
 * first and the low-noise expert second, with one latent handed over
 * between them.
 */
export type MediaGenExpertRole = "high_noise" | "low_noise";

/** Lifecycle status of a job. */
export type MediaGenStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Result of `tenzro_mediaGen_listCatalog`. Entries pass through as
 * `unknown` so a catalog refresh doesn't break compiled callers.
 */
export interface MediaGenCatalog {
  models: unknown[];
  count: number;
}

/**
 * Result of `tenzro_mediaGen_quote`. The work unit is the pixel-step —
 * `width × height × steps × frames`. Every TNZO amount crosses the wire
 * as a decimal string because a u128 does not survive a JSON number.
 */
export interface MediaGenQuote {
  kind: MediaGenKind;
  pixel_steps: number;
  /** attoTNZO per pixel-step, decimal string. */
  per_pixel_step: string;
  /** Flat per-job fee in attoTNZO, decimal string. */
  base_fee: string;
  /** `base_fee + pixel_steps × per_pixel_step`, decimal string. */
  quote: string;
}

/** Result of `tenzro_mediaGen_listJobs`. */
export interface MediaGenJobList {
  jobs: unknown[];
  count: number;
}

/** Result of `tenzro_mediaGen_listWorkers`. */
export interface MediaGenWorkerList {
  workers: unknown[];
  count: number;
}

/**
 * Result of `tenzro_mediaGen_publishOutput`. The two hashes cover the
 * same bytes in different hash spaces: `output_hash` is the canonical
 * SHA-256 a receipt or handoff commits to, `locator` is the BLAKE3 the
 * content-addressed store indexes by.
 */
export interface MediaGenPublished {
  output_hash: string;
  locator?: string | null;
  bytes: number;
}

/**
 * Bytes pulled back out of the content-addressed store, already checked
 * by the node against the hash and length the receipt or handoff
 * committed to.
 */
export interface MediaGenPayload {
  job_id: string;
  /** Present on a rendered output, absent on an intermediate latent. */
  output_hash?: string;
  /** Present on a rendered output, absent on an intermediate latent. */
  output_mime?: string;
  bytes: Uint8Array;
}

interface MediaGenPayloadResponse {
  job_id: string;
  output_hash?: string;
  output_mime?: string;
  bytes: number;
  data: string;
}

/**
 * Base64 helpers — browser + Node ≥18 portable (`btoa`/`atob` are global
 * in both; matches the convention in iroh.ts / custody.ts).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodePayload(resp: MediaGenPayloadResponse): MediaGenPayload {
  return {
    job_id: resp.job_id,
    output_hash: resp.output_hash,
    output_mime: resp.output_mime,
    bytes: base64ToBytes(resp.data),
  };
}

/**
 * Read-only client for Tenzro Media Gen — the curated diffusers catalog,
 * a pixel-step price quote, the job queue, the worker registry, a
 * finished job's signed receipt, and the bytes behind it.
 *
 * Nothing here queues paid work or seals a commitment, so it is safe to
 * expose to a dashboard or a monitoring agent.
 *
 * @example
 * ```ts
 * const client = new TenzroClient({ endpoint: 'https://rpc.tenzro.xyz' });
 * const media = client.mediaGenInspection();
 *
 * const { count } = await media.listCatalog();
 * const quote = await media.quote('text2image', {
 *   prompt: 'a lighthouse in fog',
 *   width: 1328,
 *   height: 1328,
 *   steps: 50,
 * });
 * console.log(`${count} models; this job costs ${quote.quote} attoTNZO`);
 * ```
 */
export class MediaGenInspectionClient {
  constructor(private rpc: RpcClient) {}

  /**
   * The curated generative-media catalog: ungated, diffusers-loadable
   * models, each carrying its default resolution, step count, frame
   * count, VRAM floor, license tier, and — where the schedule splits —
   * the expert pair and the timestep boundary between them.
   */
  async listCatalog(): Promise<MediaGenCatalog> {
    return this.rpc.call("tenzro_mediaGen_listCatalog", []);
  }

  /** Price a job before posting it. Nothing is queued. */
  async quote(
    kind: MediaGenKind,
    params: Record<string, unknown>,
  ): Promise<MediaGenQuote> {
    return this.rpc.call("tenzro_mediaGen_quote", [{ kind, params }]);
  }

  /**
   * Every job this node holds, optionally filtered by status. Includes
   * jobs mirrored from the gossip topic, not only jobs this node's own
   * workers act on.
   */
  async listJobs(status?: MediaGenStatus): Promise<MediaGenJobList> {
    return this.rpc.call(
      "tenzro_mediaGen_listJobs",
      [status ? { status } : {}],
    );
  }

  /** One job by id. `null` when the node has never seen it. */
  async getJob(jobId: string): Promise<unknown | null> {
    return this.rpc.call("tenzro_mediaGen_getJob", [{ job_id: jobId }]);
  }

  /**
   * Workers enrolled with this node, with the models and expert halves
   * each one holds.
   */
  async listWorkers(): Promise<MediaGenWorkerList> {
    return this.rpc.call("tenzro_mediaGen_listWorkers", []);
  }

  /**
   * The signed receipt for a finished job. `null` while the job is
   * still in flight.
   */
  async getReceipt(jobId: string): Promise<unknown | null> {
    return this.rpc.call("tenzro_mediaGen_getReceipt", [{ job_id: jobId }]);
  }

  /**
   * Pull a finished job's rendered bytes. The node checks them against
   * the hash and length the receipt committed to before returning.
   */
  async fetchOutput(jobId: string): Promise<MediaGenPayload> {
    const resp: MediaGenPayloadResponse = await this.rpc.call(
      "tenzro_mediaGen_fetchOutput",
      [{ job_id: jobId }],
    );
    return decodePayload(resp);
  }

  /**
   * Pull the intermediate latent of a split job, checked against the
   * hash and length the handoff committed to. This is how the low-noise
   * expert picks up where the high-noise expert stopped.
   */
  async fetchLatent(jobId: string): Promise<MediaGenPayload> {
    const resp: MediaGenPayloadResponse = await this.rpc.call(
      "tenzro_mediaGen_fetchLatent",
      [{ job_id: jobId }],
    );
    return decodePayload(resp);
  }

  /**
   * Pull the conditioning image an editing or image-conditioned job
   * names, checked against the hash its spec committed to. A worker
   * elsewhere on the network cannot read the requester's disk, so this
   * is how it obtains the frame it conditions on.
   */
  async fetchInput(jobId: string): Promise<MediaGenPayload> {
    const resp: MediaGenPayloadResponse = await this.rpc.call(
      "tenzro_mediaGen_fetchInput",
      [{ job_id: jobId }],
    );
    return decodePayload(resp);
  }
}

/**
 * Write-side client for Tenzro Media Gen — post a job, enroll a worker,
 * claim a job or one expert half of it, report progress, publish
 * rendered bytes, hand an intermediate latent to the low-noise partner,
 * and seal the receipt.
 */
export class MediaGenClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Queue a job. Whether the job splits across two experts is read from
   * the catalog by the node, never from the spec, so every node
   * mirroring the announcement derives the same required roles.
   */
  async postJob(taskSpec: Record<string, unknown>): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_postJob", [{ task_spec: taskSpec }]);
  }

  /** Cancel a pending job. Only the DID that posted it may cancel it. */
  async cancelJob(jobId: string, requesterDid: string): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_cancelJob", [
      { job_id: jobId, requester_did: requesterDid },
    ]);
  }

  /**
   * Enroll a worker with this node. `capability` is the
   * `MediaGenWorkerCapability` object — the models it serves, the expert
   * halves it holds, its resolution and frame ceilings, and its GPU VRAM.
   */
  async enrollWorker(capability: Record<string, unknown>): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_enrollWorker", [{ capability }]);
  }

  /**
   * Claim a job. Pass `role` on a split job to claim one half; a worker
   * holding the whole model claims each half separately.
   */
  async claimJob(
    jobId: string,
    workerDid: string,
    role?: MediaGenExpertRole,
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      job_id: jobId,
      worker_did: workerDid,
    };
    if (role) params.role = role;
    return this.rpc.call("tenzro_mediaGen_claimJob", [params]);
  }

  /**
   * Report that the pipeline started. Local to the node — no gossip
   * envelope carries this transition.
   */
  async markRunning(jobId: string, workerDid: string): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_markRunning", [
      { job_id: jobId, worker_did: workerDid },
    ]);
  }

  /** Report that the pipeline failed, releasing the job. Local to the node. */
  async failJob(
    jobId: string,
    workerDid: string,
    error: string,
  ): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_failJob", [
      { job_id: jobId, worker_did: workerDid, error },
    ]);
  }

  /**
   * Put rendered bytes — or an intermediate latent — into the
   * content-addressed store. A worker calls this before building its
   * commitment, because the commitment names the returned SHA-256.
   */
  async publishOutput(bytes: Uint8Array): Promise<MediaGenPublished> {
    return this.rpc.call("tenzro_mediaGen_publishOutput", [
      { bytes: bytesToBase64(bytes) },
    ]);
  }

  /**
   * Announce the intermediate latent the high-noise expert hands to the
   * low-noise expert. `handoff` is the signed `MediaGenHandoff`.
   */
  async recordHandoff(handoff: Record<string, unknown>): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_recordHandoff", [{ handoff }]);
  }

  /**
   * Seal a finished job. `receipt` is the signed `MediaGenReceipt`, whose
   * commitment names the SHA-256 of the published bytes.
   */
  async submitReceipt(receipt: Record<string, unknown>): Promise<unknown> {
    return this.rpc.call("tenzro_mediaGen_submitReceipt", [{ receipt }]);
  }
}
