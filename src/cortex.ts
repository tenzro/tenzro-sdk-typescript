import { RpcClient } from "./rpc";

/**
 * Service tier for a Cortex reasoning request.
 *
 * Each tier implies a default loop range, an expected latency profile,
 * and whether hardware attestation / ZK inference proofs are required.
 */
export type ReasoningTier = "fast" | "standard" | "deep" | "institutional";

/**
 * Attestation requirement for a Cortex inference request.
 *
 * - `none` — no attestation, cheapest.
 * - `tee` — Intel TDX / AMD SEV-SNP / AWS Nitro / NVIDIA CC quote required.
 * - `tee_and_zk` — TEE quote AND a Plonky3 STARK inference-verification proof.
 */
export type AttestationRequirement = "none" | "tee" | "tee_and_zk";

/**
 * Reasoning-specific metadata captured during a Cortex inference.
 */
export interface CortexMetadata {
  input_tokens: number;
  output_tokens: number;
  /** Number of recurrent loops actually executed. */
  loops_used: number;
  /** Wall-clock latency in milliseconds. */
  latency_ms: number;
  model_version?: string | null;
  /** "stop" | "length" | "converged" | etc. */
  finish_reason?: string | null;
  /** Distinct MoE experts activated, if known. */
  experts_activated?: number | null;
}

/**
 * Signed execution receipt for a Cortex reasoning call.
 *
 * Every Cortex response carries a receipt. Deep / Institutional receipts
 * also anchor on Tenzro Ledger and may carry TEE quotes or Plonky3 STARK
 * inference-verification proofs.
 *
 * Receipts let auditors reconstruct:
 * 1. Which model weights were used (`weights_hash`, `runtime_hash`).
 * 2. What input produced what output (`input_commitment`, `output_commitment`).
 * 3. How much compute was spent (`loops_used`, `tokens_in`, `tokens_out`).
 * 4. Who executed it (`worker_did`, `signature`).
 * 5. Optional hardware / ZK evidence.
 */
export interface CortexReceipt {
  model_id: string;
  /** Hex-encoded SHA-256 hash of the model weights. */
  weights_hash: string;
  /** Hex-encoded SHA-256 hash of the serving runtime (container / binary). */
  runtime_hash: string;
  /** Number of loops the worker was asked to run at most. */
  loops_requested: number;
  /** Number of loops actually run. */
  loops_used: number;
  /** Hex-encoded hash of the canonical request payload. */
  input_commitment: string;
  /** Hex-encoded hash of the canonical response payload. */
  output_commitment: string;
  /** DID of the worker that executed the inference. */
  worker_did: string;
  /** Worker wallet address (for settlement). Hex string. */
  worker_address: string;
  /** Optional TEE attestation quote bytes (base64-encoded over JSON-RPC). */
  tee_quote?: number[] | null;
  /** Optional Plonky3 STARK inference-verification proof bytes. */
  zk_proof?: number[] | null;
  /** Input tokens charged. */
  tokens_in: number;
  /** Output tokens charged. */
  tokens_out: number;
  /** Final settled price in smallest TNZO unit (uint64 — may overflow JS number; treat as bigint where precision matters). */
  price_tnzo: number;
  /** Receipt creation timestamp. */
  timestamp?: unknown;
  /** Worker signature over the canonical receipt preimage. */
  signature?: unknown;
}

/**
 * A Cortex reasoning request.
 *
 * Only `model_id` and `input` are required. All other fields default to the
 * `Standard` tier values when omitted.
 */
export interface CortexRequest {
  request_id?: string;
  model_id: string;
  /** Plain-text prompt input. */
  input: string;
  tier?: ReasoningTier;
  /** Override `min_loops` (defaults from tier). */
  min_loops?: number;
  /** Override `max_loops` (defaults from tier). */
  max_loops?: number;
  /** Hard cap on billed cost in smallest TNZO unit. */
  max_cost_tnzo?: number;
  /** Wall-clock deadline in milliseconds. */
  deadline_ms?: number;
  attestation?: AttestationRequirement;
  /** Caller address (also the payer). Hex string. */
  requester?: string;
  /** Free-form generation parameters forwarded to the sidecar. */
  params?: Record<string, string>;
}

/**
 * A Cortex reasoning response.
 */
export interface CortexResponse {
  request_id: string;
  response_id: string;
  model_id: string;
  /** Worker address that executed the inference. Hex string. */
  worker: string;
  /** Raw response payload. May arrive as a byte-array or string. */
  output: number[] | string;
  metadata: CortexMetadata;
  /** Final price charged in smallest TNZO unit. */
  price_tnzo: number;
  /** Receipt binding this response to its inputs, weights, and worker. */
  receipt: CortexReceipt;
  /** Whether on-chain settlement of `price_tnzo` succeeded on this node. */
  settled: boolean;
  /** Response creation timestamp (server-side). */
  timestamp?: unknown;
}

/**
 * A locally-registered Cortex worker entry.
 */
export interface CortexWorkerEntry {
  model_id: string;
  worker_did?: string;
  family?: unknown;
  pricing?: unknown;
}

/**
 * Worker list response.
 */
export interface CortexWorkerList {
  workers: unknown[];
  count: number;
}

/**
 * Loop-aware pricing configuration for a Cortex model.
 *
 * Total cost formula (smallest TNZO unit):
 *
 *     cost = base_request_fee
 *          + tokens_in  * price_per_input_token
 *          + tokens_out * price_per_output_token
 *          + loops_used * price_per_loop
 *          + tee_premium  (if attestation includes Tee)
 *          + zk_premium   (if attestation includes Zk)
 */
export interface CortexPricing {
  base_request_fee: number;
  price_per_input_token: number;
  price_per_output_token: number;
  price_per_loop: number;
  tee_premium: number;
  zk_premium: number;
}

/** Default Cortex pricing — mirror of the on-node `CortexPricing::default()`. */
export const DEFAULT_CORTEX_PRICING: CortexPricing = {
  base_request_fee: 100,
  price_per_input_token: 10,
  price_per_output_token: 20,
  price_per_loop: 1_000,
  tee_premium: 10_000,
  zk_premium: 100_000,
};

/**
 * Compute the total cost for a settled Cortex inference (mirror of the on-node logic).
 *
 * Uses native `number` arithmetic — fine for testnet pricing, but if you need
 * full uint64 precision use bigint by hand.
 */
export function computeCortexCost(
  pricing: CortexPricing,
  tokensIn: number,
  tokensOut: number,
  loopsUsed: number,
  attestation: AttestationRequirement,
): number {
  let cost = pricing.base_request_fee;
  cost += tokensIn * pricing.price_per_input_token;
  cost += tokensOut * pricing.price_per_output_token;
  cost += loopsUsed * pricing.price_per_loop;
  if (attestation === "tee" || attestation === "tee_and_zk") {
    cost += pricing.tee_premium;
  }
  if (attestation === "tee_and_zk") {
    cost += pricing.zk_premium;
  }
  return cost;
}

/**
 * Client for Cortex recurrent-depth reasoning operations on Tenzro Network.
 *
 * Cortex treats recurrent-loop depth as a first-class billable primitive.
 * Use this to submit reasoning requests with explicit budget envelopes
 * (Fast / Standard / Deep / Institutional tiers) and receive signed
 * receipts binding inputs, outputs, and worker identity.
 *
 * @example
 * ```ts
 * const cortex = new CortexClient(rpc);
 * const resp = await cortex.reason("openmythos-3b", "Plan a trade", "deep");
 * console.log("loops_used:", resp.metadata.loops_used);
 * console.log("cost:", resp.price_tnzo);
 * console.log("worker:", resp.receipt.worker_did);
 * ```
 */
export class CortexClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Submit a Cortex reasoning request via `tenzro_cortexReason` (one-shot helper).
   *
   * For full control over budget, attestation, params, etc., use {@link reasonWithRequest}.
   */
  async reason(
    modelId: string,
    input: string,
    tier: ReasoningTier = "standard",
  ): Promise<CortexResponse> {
    return this.rpc.call<CortexResponse>("tenzro_cortexReason", {
      model_id: modelId,
      input,
      tier,
    });
  }

  /**
   * Submit a Cortex reasoning request with full request parameters.
   */
  async reasonWithRequest(req: CortexRequest): Promise<CortexResponse> {
    const params: Record<string, unknown> = {
      model_id: req.model_id,
      input: req.input,
    };
    if (req.tier !== undefined) params.tier = req.tier;
    if (req.min_loops !== undefined) params.min_loops = req.min_loops;
    if (req.max_loops !== undefined) params.max_loops = req.max_loops;
    if (req.max_cost_tnzo !== undefined) params.max_cost_tnzo = req.max_cost_tnzo;
    if (req.deadline_ms !== undefined) params.deadline_ms = req.deadline_ms;
    if (req.attestation !== undefined) params.attestation = req.attestation;
    if (req.requester !== undefined) params.requester = req.requester;
    if (req.params !== undefined && Object.keys(req.params).length > 0) {
      params.params = req.params;
    }
    if (req.request_id !== undefined) params.request_id = req.request_id;
    return this.rpc.call<CortexResponse>("tenzro_cortexReason", params);
  }

  /**
   * List Cortex workers registered locally on the connected node.
   */
  async listWorkers(): Promise<CortexWorkerList> {
    return this.rpc.call<CortexWorkerList>("tenzro_listCortexWorkers", []);
  }

  /**
   * List remote Cortex workers learned via the `tenzro/cortex`
   * gossip topic (signed advertisements still within their TTL).
   */
  async listRemoteWorkers(): Promise<CortexWorkerList> {
    return this.rpc.call<CortexWorkerList>(
      "tenzro_listRemoteCortexWorkers",
      [],
    );
  }

  /**
   * Register a Cortex worker on the connected node. The worker forwards
   * Cortex requests to a sidecar HTTP backend.
   *
   * @param modelId       Model id (must be unique on this node).
   * @param sidecarUrl    HTTP endpoint of the recurrent-depth model sidecar.
   * @param familyArch    Architecture identifier ("rdt-moe", "rdt-dense", etc.).
   * @param maxLoops      Hard ceiling on recurrent loops this model supports.
   * @param opts          Optional bearer token, pricing, supported tiers.
   */
  async registerWorker(
    modelId: string,
    sidecarUrl: string,
    familyArch: string,
    maxLoops: number,
    opts?: {
      bearerToken?: string;
      pricing?: CortexPricing;
      supportedTiers?: ReasoningTier[];
    },
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      model_id: modelId,
      sidecar_url: sidecarUrl,
      arch: familyArch,
      max_loops: maxLoops,
    };
    if (opts?.bearerToken !== undefined) params.bearer_token = opts.bearerToken;
    if (opts?.pricing !== undefined) params.pricing = opts.pricing;
    if (opts?.supportedTiers !== undefined) {
      params.supported_tiers = opts.supportedTiers;
    }
    return this.rpc.call<unknown>("tenzro_registerCortexWorker", params);
  }
}
