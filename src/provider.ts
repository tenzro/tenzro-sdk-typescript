import { RpcClient } from "./rpc";
import { ModelLoadInfo, ModelEndpoint } from "./types";

export interface ParticipateResponse {
  did: string;
  address: string;
  hardware_profile: Record<string, unknown>;
}

export interface ProviderStats {
  is_serving: boolean;
  models_served: string[];
  total_inferences: number;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatResponse {
  response: string;
  model_id: string;
  tokens_used: number;
}

export interface DownloadProgress {
  model_id: string;
  status: string;
  progress: number;
  bytes_downloaded: number;
  total_bytes: number;
}

export interface HardwareProfile {
  cpu: string;
  memory_gb: number;
  gpu?: string;
  tee_support: string[];
}

/**
 * A provider discovered on the Tenzro Network via gossipsub announcements.
 *
 * Providers broadcast a `ProviderAnnouncement` every 60 seconds on the
 * `tenzro/providers` gossipsub topic. All peers merge incoming
 * announcements into their `network_providers` cache so any node can
 * discover every provider without a central registry.
 *
 * Use {@link ProviderClient.listProviders} to discover providers via
 * the `tenzro_listProviders` JSON-RPC method.
 */
export interface NetworkProvider {
  /** libp2p peer ID of the announcing node */
  peer_id: string;
  /** Wallet/account address of the provider */
  provider_address: string;
  /** Provider type (e.g. "llm", "tee", "general") */
  provider_type: string;
  /** Model IDs currently being served by this node */
  served_models: string[];
  /** Capability labels (e.g. "inference", "tee-attestation") */
  capabilities: string[];
  /** HTTP RPC endpoint for direct inference routing (e.g. "http://10.128.0.5:8545") */
  rpc_endpoint: string;
  /** Lifecycle status (e.g. "active", "draining") */
  status: string;
  /** Whether this is the local node */
  is_local: boolean;
}

/**
 * Client for provider operations including network participation,
 * model serving, and hardware management.
 */
export class ProviderClient {
  private rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  /**
   * One-click network participation — provisions identity, wallet, and hardware profile
   *
   * @param password - Password to encrypt the wallet
   * @returns Participation response with DID, address, and hardware profile
   *
   * @example
   * ```typescript
   * const result = await client.provider.participate("my-secure-password");
   * console.log("DID:", result.did);
   * console.log("Address:", result.address);
   * ```
   */
  async participate(password: string): Promise<ParticipateResponse> {
    return await this.rpc.call<ParticipateResponse>("tenzro_participate", [password]);
  }

  /**
   * Download a model from the registry
   *
   * @param modelId - ID of the model to download
   * @returns Task ID for tracking download progress
   *
   * @example
   * ```typescript
   * const taskId = await client.provider.downloadModel("gemma4-9b");
   * console.log("Download started:", taskId);
   * ```
   */
  async downloadModel(modelId: string): Promise<string> {
    return await this.rpc.call<string>("tenzro_downloadModel", [modelId]);
  }

  /**
   * Get download progress for a model
   *
   * @param modelId - ID of the model being downloaded
   * @returns Download progress information
   *
   * @example
   * ```typescript
   * const progress = await client.provider.getDownloadProgress("gemma4-9b");
   * console.log(`Progress: ${(progress.progress * 100).toFixed(1)}%`);
   * ```
   */
  async getDownloadProgress(modelId: string): Promise<DownloadProgress> {
    return await this.rpc.call<DownloadProgress>("tenzro_getDownloadProgress", [modelId]);
  }

  /**
   * Start serving a model on the network
   *
   * @param modelId - ID of the model to serve
   *
   * @example
   * ```typescript
   * await client.provider.serveModel("gemma4-9b");
   * console.log("Now serving model");
   * ```
   */
  async serveModel(modelId: string): Promise<void> {
    await this.rpc.call("tenzro_serveModel", [modelId]);
  }

  /**
   * Stop serving a model
   *
   * @param modelId - ID of the model to stop serving
   *
   * @example
   * ```typescript
   * await client.provider.stopModel("gemma4-9b");
   * console.log("Stopped serving model");
   * ```
   */
  async stopModel(modelId: string): Promise<void> {
    await this.rpc.call("tenzro_stopModel", [modelId]);
  }

  /**
   * Delete a downloaded model
   *
   * @param modelId - ID of the model to delete
   *
   * @example
   * ```typescript
   * await client.provider.deleteModel("gemma4-9b");
   * console.log("Model deleted");
   * ```
   */
  async deleteModel(modelId: string): Promise<void> {
    await this.rpc.call("tenzro_deleteModel", [modelId]);
  }

  /**
   * Chat with a loaded model
   *
   * @param modelId - ID of the model to use
   * @param messages - Array of chat messages
   * @returns Chat completion response
   *
   * @example
   * ```typescript
   * const messages = [
   *   { role: "user", content: "What is Tenzro Network?" }
   * ];
   * const response = await client.provider.chat("gemma4-9b", messages);
   * console.log("Response:", response.response);
   * ```
   */
  async chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    return await this.rpc.call<ChatResponse>("tenzro_chat", [modelId, messages]);
  }

  /**
   * Get hardware profile of the node
   *
   * @returns Hardware profile with CPU, memory, GPU, and TEE support
   *
   * @example
   * ```typescript
   * const profile = await client.provider.getHardwareProfile();
   * console.log("CPU:", profile.cpu);
   * console.log("Memory:", profile.memory_gb, "GB");
   * ```
   */
  async getHardwareProfile(): Promise<HardwareProfile> {
    return await this.rpc.call<HardwareProfile>("tenzro_getHardwareProfile", []);
  }

  /**
   * Set node role (validator, provider, light_client)
   *
   * @param role - Node role to set
   *
   * @example
   * ```typescript
   * await client.provider.setRole("provider");
   * console.log("Role updated");
   * ```
   */
  async setRole(role: string): Promise<void> {
    await this.rpc.call("tenzro_setRole", [role]);
  }

  /**
   * Register as a provider on the network
   *
   * Model/inference providers do not need to stake TNZO — staking is only
   * required for validators. The `stake` parameter defaults to "0" (wei).
   *
   * @param providerType - One of "validator", "model_provider", "tee_provider", "storage_provider"
   * @param models - List of model IDs to serve
   * @param stake - Stake amount in wei (10^-18 TNZO) as decimal string. Default "0".
   * @returns Transaction hash of the registration
   *
   * @example
   * ```typescript
   * // Register as a model provider — no staking required
   * const models = ["gemma3-270m"];
   * const txHash = await client.provider.register("model_provider", models);
   * console.log("Registration tx:", txHash);
   * ```
   */
  async register(
    providerType: string,
    models: string[],
    stake: string = "0",
  ): Promise<string> {
    return await this.rpc.call<string>("tenzro_registerProvider", [
      { provider_type: providerType, models, stake },
    ]);
  }

  /**
   * Get provider statistics
   *
   * @returns Provider statistics with serving state and inference count
   *
   * @example
   * ```typescript
   * const stats = await client.provider.stats();
   * console.log("Serving:", stats.is_serving);
   * console.log("Total inferences:", stats.total_inferences);
   * ```
   */
  async stats(): Promise<ProviderStats> {
    return await this.rpc.call<ProviderStats>("tenzro_providerStats", []);
  }

  /**
   * List all model service endpoints with load information
   *
   * @returns Array of model endpoints with load data
   *
   * @example
   * ```typescript
   * const endpoints = await client.provider.listModelEndpoints();
   * for (const ep of endpoints) {
   *   console.log(`${ep.model_name}: ${ep.status} (${ep.location})`);
   *   if (ep.load) {
   *     console.log(`  Load: ${ep.load.active_requests}/${ep.load.max_concurrent} (${ep.load.utilization_percent}%)`);
   *   }
   * }
   * ```
   */
  async listModelEndpoints(): Promise<ModelEndpoint[]> {
    return await this.rpc.call<ModelEndpoint[]>("tenzro_listModelEndpoints", []);
  }

  /**
   * Get load information for a specific model
   *
   * @param modelId - ID of the model to check
   * @returns Load info if the model is being served, undefined otherwise
   *
   * @example
   * ```typescript
   * const load = await client.provider.getModelLoad("gemma3-270m");
   * if (load) {
   *   console.log(`Load: ${load.active_requests}/${load.max_concurrent} (${load.utilization_percent}%)`);
   * }
   * ```
   */
  async getModelLoad(modelId: string): Promise<ModelLoadInfo | undefined> {
    const endpoints = await this.listModelEndpoints();
    const ep = endpoints.find(e => e.model_id === modelId || e.model_name === modelId);
    return ep?.load;
  }

  /**
   * List all providers discovered on the Tenzro Network.
   *
   * Queries the `tenzro_listProviders` JSON-RPC method which merges:
   * - The local node's own provider info (if it is serving models)
   * - All remote providers discovered via the `tenzro/providers`
   *   gossipsub topic (announcements refreshed every 60 seconds)
   *
   * @param providerType - Optional filter by provider type (e.g. "llm", "tee", "general")
   * @returns Array of discovered network providers
   *
   * @example
   * ```typescript
   * // List all providers
   * const providers = await client.provider.listProviders();
   * for (const p of providers) {
   *   console.log(`${p.peer_id}: ${p.provider_type} — models: ${p.served_models.join(", ")}`);
   * }
   *
   * // List only LLM providers
   * const llmProviders = await client.provider.listProviders("llm");
   * ```
   */
  async listProviders(providerType?: string): Promise<NetworkProvider[]> {
    const params = providerType ? [{ provider_type: providerType }] : [];
    return await this.rpc.call<NetworkProvider[]>("tenzro_listProviders", params);
  }

  /**
   * Join the network as a micro node.
   * @param displayName - Optional display name for the node
   * @param participantType - Optional participant type
   * @returns Micro node registration response
   */
  async joinAsMicroNode(
    displayName?: string,
    participantType?: string
  ): Promise<any> {
    return await this.rpc.call("tenzro_joinAsMicroNode", [
      {
        display_name: displayName,
        participant_type: participantType,
      },
    ]);
  }

  /**
   * Set the provider availability schedule.
   * @param schedule - Schedule configuration
   * @returns Updated schedule
   */
  async setProviderSchedule(schedule: any): Promise<any> {
    return await this.rpc.call("tenzro_setProviderSchedule", [schedule]);
  }

  /**
   * Get the current provider schedule.
   * @returns Provider schedule configuration
   */
  async getProviderSchedule(): Promise<any> {
    return await this.rpc.call("tenzro_getProviderSchedule", []);
  }

  /**
   * Set provider pricing configuration.
   * @param pricing - Pricing configuration
   * @returns Updated pricing
   */
  async setProviderPricing(pricing: any): Promise<any> {
    return await this.rpc.call("tenzro_setProviderPricing", [pricing]);
  }

  /**
   * Get the current provider pricing.
   * @returns Provider pricing configuration
   */
  async getProviderPricing(): Promise<any> {
    return await this.rpc.call("tenzro_getProviderPricing", []);
  }

  /**
   * Get a specific model endpoint.
   * @param instanceId - The model endpoint instance ID
   * @returns Model endpoint details
   */
  async getModelEndpoint(instanceId: string): Promise<any> {
    return await this.rpc.call("tenzro_getModelEndpoint", [
      { instance_id: instanceId },
    ]);
  }

  /**
   * Register a remote model endpoint.
   * @param modelId - ID of the model
   * @param apiEndpoint - API endpoint URL
   * @param mcpEndpoint - Optional MCP endpoint URL
   * @param modelName - Optional human-readable model name
   * @param providerName - Optional provider name
   * @returns Registration result
   */
  async registerModelEndpoint(
    modelId: string,
    apiEndpoint: string,
    mcpEndpoint?: string,
    modelName?: string,
    providerName?: string
  ): Promise<any> {
    return await this.rpc.call("tenzro_registerModelEndpoint", [
      {
        model_id: modelId,
        api_endpoint: apiEndpoint,
        mcp_endpoint: mcpEndpoint,
        model_name: modelName,
        provider_name: providerName,
      },
    ]);
  }

  /**
   * Unregister a model endpoint.
   * @param instanceId - The model endpoint instance ID to remove
   * @returns Unregistration result
   */
  async unregisterModelEndpoint(instanceId: string): Promise<any> {
    return await this.rpc.call("tenzro_unregisterModelEndpoint", [
      { instance_id: instanceId },
    ]);
  }

  /**
   * Add a resource to the node.
   * @param resourceId - Resource identifier
   * @param resourceType - Optional resource type
   * @returns Resource registration result
   */
  async addResource(resourceId: string, resourceType?: string): Promise<any> {
    return await this.rpc.call("tenzro_addResource", [
      { resource_id: resourceId, resource_type: resourceType },
    ]);
  }

  /**
   * Send a signed transaction.
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount to send
   * @param asset - Optional asset identifier
   * @returns Transaction hash
   */
  async sendTransaction(
    from: string,
    to: string,
    amount: string,
    asset?: string
  ): Promise<string> {
    return await this.rpc.call<string>("tenzro_sendTransaction", [
      { from, to, amount, asset },
    ]);
  }

  /**
   * Submit a block to the network.
   * @param block - Block data to submit
   * @returns Submission result
   */
  async submitBlock(block: any): Promise<any> {
    return await this.rpc.call("tenzro_submitBlock", [block]);
  }
}
