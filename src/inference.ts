import { RpcClient } from "./rpc";
import { ModelInfo, InferenceResult, ModelEndpoint } from "./types";

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
