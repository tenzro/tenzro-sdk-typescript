import { RpcClient } from "./rpc";
import { ModelInfo, InferenceResult, ModelEndpoint } from "./types";

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
}

/** The model-selection decision returned by `routeIntent`. */
export interface RouteDecision {
  model_id: string;
  tier: string;
  /** Estimated cost, smallest TNZO unit, decimal string. */
  estimated_cost: string;
  fallback_chain: string[];
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
    return this.rpc.call<Record<string, unknown>>("tenzro_getProvenance", [
      { content_hash: contentHash },
    ]);
  }
}
