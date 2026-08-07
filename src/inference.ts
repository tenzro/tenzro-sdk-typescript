import { RpcClient } from "./rpc";
import {
  ModelInfo,
  InferenceResult,
  ModelEndpoint,
  ModelFileRecord,
  CanonicalModelHash,
} from "./types";

/**
 * A use-case hint that biases model selection toward the right modality and
 * quality tier. Mirrors `UseCase::ALL` on the node.
 */
export type UseCase =
  | "chat"
  | "code"
  | "reasoning"
  | "research"
  | "summarize"
  | "extract"
  | "embed";

/**
 * The shared intent fields consumed by `routeIntent` and `chatByIntent`.
 * `budget` is the smallest TNZO unit as a decimal string (a u128 exceeds
 * JavaScript's safe integer range).
 */
export interface IntentParams {
  useCase: UseCase;
  budget?: string;
  /** Cost-quality knob in [0.0, 1.0]: 0.0 = cheapest acceptable, 1.0 = strongest. */
  optimize?: number;
  /** Reject any model below this tier. */
  qualityFloor?: "cheap" | "strong";
  estInputTokens?: number;
  estOutputTokens?: number;
  /** Payer DID — enables the per-DID rolling-window budget gate. */
  payerDid?: string;
  /** Payer wallet address (hex) — enables the wallet-balance hard ceiling. */
  payerAddress?: string;
  /**
   * Text the model will answer, used only to place the request in a difficulty
   * cluster. It is not sent to any provider by `routeIntent`. On `chatByIntent`
   * the node derives it from the chat turns, so it only needs setting when
   * routing without dispatching.
   */
  prompt?: string;
}

/** How a routed call turned out, reported through `recordRouteOutcome`. */
export type RouteOutcome = "resolved" | "escalated" | "failed";

/**
 * What one finished generation consumed and cost, as recorded by the node.
 *
 * The dimensions past prompt and completion appear only when the call actually
 * consumed them, so a chat completion carries none of the media fields. Read it
 * back with {@link InferenceClient.getGeneration}.
 */
export interface GenerationStats {
  /** The id the read was keyed on — a `chatcmpl-…` or a `request_id`. */
  id: string;
  model: string;
  /** Payee address of the node that served it. */
  provider: string;
  /** The whole prompt, including anything served from cache. */
  input_tokens: number;
  output_tokens: number;
  /** Every token-denominated dimension summed, image tokens included. */
  total_tokens: number;
  bytes_in: number;
  bytes_out: number;
  /** Smallest TNZO unit, decimal string — a u128 exceeds JavaScript's safe integer range. */
  cost_wei: string;
  latency_ms: number;
  /** Omitted when the recorded latency is zero. */
  tokens_per_second?: number | null;
  created: number;
  /** Prompt tokens served from a warm prefix cache. */
  cached_read_tokens?: number;
  /** Prompt tokens written into the prefix cache for a later call to reuse. */
  cached_write_tokens?: number;
  /** Recurrent reasoning loops a Cortex call executed. */
  reasoning_loops?: number;
  /** Tokens attributed to image inputs, derived from geometry by the model's tokenization descriptor. */
  image_tokens?: number;
  /** Audio consumed, whole seconds. */
  audio_seconds?: number;
  /** Video consumed, whole seconds. */
  video_seconds?: number;
  /** Frames a video generation produced or a video encoder consumed. */
  frames?: number;
  /** Denoising work — `width × height × steps × frames` — as a decimal string. */
  pixel_steps?: string;
}

/** What one call consumed, every dimension present and zero where unused. */
export interface BillableUnits {
  input_tokens: number;
  output_tokens: number;
  cached_read_tokens: number;
  cached_write_tokens: number;
  reasoning_loops: number;
  image_tokens: number;
  /** Audio consumed, milliseconds. */
  audio_ms: number;
  /** Video consumed, milliseconds. */
  video_ms: number;
  /**
   * Denoising work — `width × height × steps × frames`. A number below 2^64,
   * a decimal string above it.
   */
  pixel_steps: number | string;
  frames: number;
}

/**
 * One recorded generation, as it sits in the node's ring of recent records.
 *
 * This is the raw record rather than the reshaped {@link GenerationStats}:
 * `provider_id` is the raw 32-byte address, durations stay in milliseconds, and
 * every dimension is present rather than conditional.
 */
export interface UsageRecord {
  record_id: string;
  model_id: string;
  /** The serving provider's address, as 32 bytes. */
  provider_id: number[];
  units: BillableUnits;
  bytes_in: number;
  bytes_out: number;
  /** Smallest TNZO unit. */
  cost: number;
  latency_ms: number;
  /** Unix milliseconds. */
  timestamp: number;
}

/** Lifetime totals of every billable dimension, on the aggregate reads. */
export interface BillableTotals {
  input_tokens: number;
  output_tokens: number;
  cached_read_tokens: number;
  cached_write_tokens: number;
  reasoning_loops: number;
  image_tokens: number;
  audio_ms: number;
  video_ms: number;
  /**
   * Accumulated denoising work. Widened on the node so a provider's lifetime
   * total cannot wrap, and written to the wire as a number — past 2^53
   * `JSON.parse` will round it.
   */
  pixel_steps: number;
  frames: number;
}

/** Usage rolled up for one model. */
export interface ModelUsageStats {
  model_id: string;
  inference_count: number;
  total_units: BillableTotals;
  /** Smallest TNZO unit. */
  total_cost: number;
  total_latency_ms: number;
  total_bytes_in: number;
  total_bytes_out: number;
  first_inference?: number | null;
  last_inference?: number | null;
}

/** Usage rolled up for one provider — the same shape, counted as earnings. */
export interface ProviderUsageStats {
  /** The provider's address, as 32 bytes. */
  provider_id: number[];
  inference_count: number;
  total_units: BillableTotals;
  /** Smallest TNZO unit. */
  total_revenue: number;
  total_latency_ms: number;
  total_bytes_in: number;
  total_bytes_out: number;
  first_inference?: number | null;
  last_inference?: number | null;
}

/** Usage rolled up across everything this node has served or routed. */
export interface GlobalUsageStats {
  total_inference_count: number;
  total_units: BillableTotals;
  /** Smallest TNZO unit. */
  total_cost: number;
  total_latency_ms: number;
  total_bytes_in: number;
  total_bytes_out: number;
  unique_models: number;
  unique_providers: number;
  first_inference?: number | null;
  last_inference?: number | null;
}

/**
 * What {@link InferenceClient.listInferenceUsage} returns. Which key is present
 * follows the filters given: both filters returns the matching `records`, one
 * returns that model's or provider's rollup, neither returns all three tiers.
 */
export interface InferenceUsage {
  records?: UsageRecord[];
  model_stats?: ModelUsageStats | null;
  provider_stats?: ProviderUsageStats | null;
  global?: GlobalUsageStats;
  models?: ModelUsageStats[];
  providers?: ProviderUsageStats[];
}

/** The model-selection decision returned by `routeIntent`. */
export interface RouteDecision {
  model_id: string;
  tier: string;
  /** Estimated cost, smallest TNZO unit, decimal string. */
  estimated_cost: string;
  fallback_chain: string[];
  /**
   * Difficulty cluster the prompt landed in. Null when no prompt was supplied
   * or the node has no embedding model loaded. Echo it back to
   * `recordRouteOutcome` so the observation lands on the right cluster.
   */
  cluster?: number | null;
  /**
   * The chosen model's observed adverse-outcome rate in that cluster. Null when
   * the cluster has no observations, meaning the decision was made on declared
   * metadata alone.
   */
  expected_error?: number | null;
  /**
   * Wallet address (hex) of the provider whose announced offer won. Absent when
   * the winner came from this node's own catalog, where the serving operator is
   * resolved at dispatch time.
   */
  provider?: string | null;
  /** The winning offer's endpoint, present alongside `provider`. */
  endpoint?: string | null;
  reason: string;
}

/**
 * The intent→capabilities request for `orchestrate`. `intent` is the natural-
 * language goal; the rest narrow model selection and the budget ceiling.
 */
export interface OrchestrateParams {
  intent: string;
  useCase?: UseCase;
  budget?: string;
  payerDid?: string;
  payerAddress?: string;
  /** Max re-plan iterations, clamped to [1, 6]. 1 = single-shot. */
  maxIterations?: number;
}

/** One executed capability step in an orchestration outcome. */
export interface OrchestrationStep {
  kind: "model" | "skill" | "tool" | "agent" | "swarm";
  output: string;
  detail?: unknown;
}

/** The outcome of an orchestration: the plan, per-step results, and accounting. */
export interface OrchestrationOutcome {
  plan: { steps: unknown[]; rationale: string; planner: string };
  steps: OrchestrationStep[];
  /** Aggregate estimated cost, smallest TNZO unit, decimal string. */
  estimated_cost: string;
  iterations: number;
}

/** Serializes {@link IntentParams} into the node's snake_case RPC param shape. */
function intentToParams(p: IntentParams): Record<string, unknown> {
  const out: Record<string, unknown> = { use_case: p.useCase };
  if (p.budget !== undefined) out.budget = p.budget;
  if (p.optimize !== undefined) out.optimize = p.optimize;
  if (p.qualityFloor !== undefined) out.quality_floor = p.qualityFloor;
  if (p.estInputTokens !== undefined) out.est_input_tokens = p.estInputTokens;
  if (p.estOutputTokens !== undefined) out.est_output_tokens = p.estOutputTokens;
  if (p.payerDid !== undefined) out.payer_did = p.payerDid;
  if (p.payerAddress !== undefined) out.payer_address = p.payerAddress;
  if (p.prompt !== undefined) out.prompt = p.prompt;
  return out;
}

/**
 * Client for AI inference operations.
 * Supports model discovery and inference requests.
 */
export class InferenceClient {
  constructor(private rpc: RpcClient) {}

  /**
   * List all available models on the network.
   */
  async listModels(): Promise<ModelInfo[]> {
    return this.rpc.call<ModelInfo[]>("tenzro_listModels");
  }

  /**
   * Read the canonical content-hash record for a model from the transparency
   * log. This is the trust root a fetcher verifies downloaded weights against
   * before load. Open — no auth.
   *
   * @param modelId - The model identifier
   */
  async getModelHash(modelId: string): Promise<CanonicalModelHash> {
    return this.rpc.call<CanonicalModelHash>("tenzro_getModelHash", [
      { model_id: modelId },
    ]);
  }

  /**
   * List every recorded canonical model hash. Open — no auth.
   */
  async listModelHashes(): Promise<{
    count: number;
    model_hashes: CanonicalModelHash[];
  }> {
    return this.rpc.call("tenzro_listModelHashes");
  }

  /**
   * Anchor a canonical model hash in the transparency log. Permissionless:
   * first recorder wins. Re-asserting an identical hash is idempotent; a
   * differing hash for an already-recorded model is rejected so tampering is
   * visible (correct only via governance override).
   *
   * @param modelId - The model identifier
   * @param files - One record per weight file (single GGUF, or one per ONNX
   *   bundle member). Each carries the file's SHA-256 + BLAKE3 (64-hex) + size.
   */
  async recordModelHash(
    modelId: string,
    files: ModelFileRecord[]
  ): Promise<CanonicalModelHash> {
    return this.rpc.call<CanonicalModelHash>("tenzro_recordModelHash", [
      { model_id: modelId, files },
    ]);
  }

  /**
   * Request inference from a specific model.
   * @param modelId - The model identifier
   * @param input - The input text/data
   * @param maxTokens - Optional maximum tokens to generate (default: 1024)
   * @returns Inference result with output, cost, and metadata
   */
  async request(
    modelId: string,
    input: string,
    maxTokens?: number
  ): Promise<InferenceResult> {
    return this.rpc.call<InferenceResult>("tenzro_inferenceRequest", [
      {
        model_id: modelId,
        input,
        max_tokens: maxTokens ?? 1024,
      },
    ]);
  }

  /**
   * Resolve an intent to the best model without naming one. Discovery only:
   * no provider is dialed and no spend is recorded, but the per-DID budget
   * gate and the wallet-balance ceiling are still consulted, so an
   * unaffordable request is rejected at discovery time. Feed the returned
   * `model_id` into {@link request} or the chat surface to run it.
   */
  async routeIntent(params: IntentParams): Promise<RouteDecision> {
    return this.rpc.call<RouteDecision>("tenzro_routeIntent", [
      intentToParams(params),
    ]);
  }

  /**
   * Resolve an intent to a model and run a chat completion through the same
   * path a named-model request takes. `messages` is the rich chat shape;
   * `message` is the simple single-turn shape. The chosen `RouteDecision`
   * is attached to the response under `route`.
   */
  async chatByIntent(
    params: IntentParams & {
      message?: string;
      messages?: Array<{ role: string; content: string }>;
    }
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = intentToParams(params);
    if (params.message !== undefined) body.message = params.message;
    if (params.messages !== undefined) body.messages = params.messages;
    return this.rpc.call<Record<string, unknown>>("tenzro_chatByIntent", [body]);
  }

  /**
   * Report how a routed call turned out, so per-cluster error rates reflect what
   * happened rather than only what the catalog declares. `cluster` is the
   * `cluster` from the routing decision.
   *
   * In practice this carries `escalated` — the outcome only the caller knows,
   * because it means the caller took the answer to a stronger model. `resolved`
   * and `failed` are already recorded by {@link chatByIntent} from the dispatch
   * itself. Reporting is advisory: `retained: false` in the response means the
   * node has no difficulty index wired, so the feedback was accepted and
   * discarded.
   */
  async recordRouteOutcome(
    modelId: string,
    cluster: number,
    outcome: RouteOutcome
  ): Promise<Record<string, unknown>> {
    return this.rpc.call<Record<string, unknown>>("tenzro_recordRouteOutcome", [
      { model_id: modelId, cluster, outcome },
    ]);
  }

  /**
   * Read the node's difficulty index: how many clusters it has discovered and
   * how many prompts landed in each. With `modelId`, also returns that model's
   * per-cluster outcome counters and error rate. An operator diagnostic —
   * routing does not depend on it.
   */
  async routeDifficultyStats(
    modelId?: string
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {};
    if (modelId !== undefined) body.model_id = modelId;
    return this.rpc.call<Record<string, unknown>>(
      "tenzro_routeDifficultyStats",
      [body]
    );
  }

  /**
   * Satisfy a natural-language intent by planning and running an ordered set
   * of capabilities — models, registered skills, registered tools, and
   * agent/swarm delegation. One layer above {@link chatByIntent}: that
   * resolves a single model; this composes models with the skill/tool
   * registries and the swarm runtime. When `payerAddress` is set, the plan's
   * aggregate estimated cost is checked against the payer's wallet balance
   * before any step runs; an over-budget plan is rejected.
   */
  async orchestrate(params: OrchestrateParams): Promise<OrchestrationOutcome> {
    const body: Record<string, unknown> = { intent: params.intent };
    if (params.useCase !== undefined) body.use_case = params.useCase;
    if (params.budget !== undefined) body.budget = params.budget;
    if (params.payerDid !== undefined) body.payer_did = params.payerDid;
    if (params.payerAddress !== undefined) body.payer_address = params.payerAddress;
    if (params.maxIterations !== undefined) body.max_iterations = params.maxIterations;
    return this.rpc.call<OrchestrationOutcome>("tenzro_orchestrate", [body]);
  }

  /**
   * List all model service endpoints with load information.
   */
  async listModelEndpoints(): Promise<ModelEndpoint[]> {
    return this.rpc.call<ModelEndpoint[]>("tenzro_listModelEndpoints");
  }

  /**
   * Read the inference router's live metrics snapshot: total requests routed,
   * hedges dispatched, hedges won, and requests abandoned on the whole-request
   * deadline.
   */
  async routerMetrics(): Promise<Record<string, unknown>> {
    return this.rpc.call<Record<string, unknown>>("tenzro_getRouterMetrics");
  }

  /**
   * Look up the cached provenance manifest for generated content by its
   * 32-byte hex `contentHash` (with or without `0x` prefix). This is the
   * machine-readable synthetic-content marker per EU AI Act Art. 50(2).
   * Throws JSON-RPC `-32004` when no manifest is cached for the hash.
   */
  async getProvenance(contentHash: string): Promise<Record<string, unknown>> {
    return this.rpc.call<Record<string, unknown>>("tenzro_getContentProvenance", [
      { content_hash: contentHash },
    ]);
  }

  /**
   * Read back what one finished generation consumed and cost, by the id you
   * already hold — a `chatcmpl-…` from a chat completion, or the `request_id`
   * of a routed inference.
   *
   * Useful when a stream was consumed and the terminal chunk went by, or when
   * reconciling a billing period against your own request log. Throws JSON-RPC
   * `-32004` when the id is unknown to this node, which also covers a
   * generation still running or one that failed before it could be recorded.
   */
  async getGeneration(id: string): Promise<GenerationStats> {
    return this.rpc.call<GenerationStats>("tenzro_getGeneration", [{ id }]);
  }

  /**
   * Read usage. Which tier comes back follows the filters given: pass both a
   * model and a provider for the matching records, one for that model's or
   * provider's rollup, neither for the global rollup plus the per-model and
   * per-provider breakdowns.
   *
   * Records are the node's bounded ring of recent generations; the rollups are
   * lifetime totals that survive restart.
   */
  async listInferenceUsage(filters?: {
    modelId?: string;
    provider?: string;
  }): Promise<InferenceUsage> {
    const body: Record<string, unknown> = {};
    if (filters?.modelId !== undefined) body.model_id = filters.modelId;
    if (filters?.provider !== undefined) body.provider = filters.provider;
    return this.rpc.call<InferenceUsage>("tenzro_listInferenceUsage", [body]);
  }
}
