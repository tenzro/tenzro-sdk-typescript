/**
 * TS SDK surface for the unified resource discovery + invocation,
 * knowledge registry, MCP plugin host, and child-agent spawn RPCs.
 * Mirrors the Rust SDK modules `resources`, `knowledge`, `mcp_host`.
 */

import { RpcClient } from './rpc';

// ── Unified resources ──────────────────────────────────────────────

export interface ResourceFilter {
  classes?: string[];
  query?: string;
  capability_tags?: string[];
  category?: string;
  /** atto-TNZO decimal string */
  max_tnzo_price?: string;
  creator_did?: string;
  limit?: number;
  offset?: number;
}

export interface ResourceDescriptor {
  class: string;
  resource_id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  capabilities: string[];
  creator_did?: string;
  creator_wallet?: string;
  price_per_call: string;
  is_available: boolean;
  last_seen_at: number;
  subtype?: string;
  reputation?: number;
}

export interface UseResourceParams {
  resource_id: string;
  class?: string;
  params: unknown;
  payer_wallet?: string;
}

export interface SpawnChildAgentParams {
  parent_did: string;
  display_name: string;
  /** atto-TNZO decimal string */
  tnzo_budget: string;
  parent_wallet?: string;
  valid_until?: number;
  max_per_transaction?: string;
  max_daily_spend?: string;
  key_type?: 'ed25519' | 'secp256k1';
}

export interface SpawnChildAgentResponse {
  child_did: string;
  parent_did: string;
  child_wallet?: string;
  registration: unknown;
  funding: unknown;
  spending_policy: unknown;
}

export class ResourcesClient {
  constructor(private readonly rpc: RpcClient) {}

  async list(filter: ResourceFilter = {}): Promise<ResourceDescriptor[]> {
    return this.rpc.call('tenzro_listResources', filter as unknown as Record<string, unknown>);
  }

  async use(params: UseResourceParams): Promise<unknown> {
    return this.rpc.call('tenzro_useResource', params as unknown as Record<string, unknown>);
  }

  async spawnChildAgent(
    params: SpawnChildAgentParams,
  ): Promise<SpawnChildAgentResponse> {
    return this.rpc.call('tenzro_spawnChildAgent', params as unknown as Record<string, unknown>);
  }
}

// ── Knowledge registry ─────────────────────────────────────────────

export type KnowledgeKind =
  | 'vector_index'
  | 'document_corpus'
  | 'indexed_dataset'
  | 'feed'
  | 'embedding_store'
  | 'other';

export interface RegisterKnowledgeParams {
  name: string;
  version: string;
  kind: KnowledgeKind;
  endpoint: string;
  description: string;
  category: string;
  capabilities?: string[];
  creator_did?: string;
  creator_wallet?: string;
  /** atto-TNZO decimal string */
  price_per_call?: string;
  params_schema?: unknown;
  response_schema?: unknown;
  backing_tool_id?: string;
  allowed_to_subjects?: string[];
}

export interface KnowledgeFilter {
  kind?: string;
  category?: string;
  status?: string;
  creator_did?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface KnowledgeInfo {
  knowledge_id: string;
  name: string;
  version: string;
  kind: string;
  endpoint: string;
  description: string;
  category: string;
  capabilities: string[];
  creator_did?: string;
  creator_wallet?: string;
  price_per_call: string;
  status: string;
  created_at: number;
  invocation_count: number;
  last_seen_at: number;
}

export interface UseKnowledgeParams {
  knowledge_id: string;
  params: unknown;
  payer_wallet?: string;
}

export interface KnowledgeInvocationResult {
  knowledge_id: string;
  invocation_id: string;
  output: unknown;
  amount_paid: string;
  completed_at: number;
}

export class KnowledgeClient {
  constructor(private readonly rpc: RpcClient) {}

  async register(params: RegisterKnowledgeParams): Promise<KnowledgeInfo> {
    return this.rpc.call('tenzro_registerKnowledge', params as unknown as Record<string, unknown>);
  }

  async list(filter: KnowledgeFilter = {}): Promise<KnowledgeInfo[]> {
    return this.rpc.call('tenzro_listKnowledge', filter as unknown as Record<string, unknown>);
  }

  async search(filter: KnowledgeFilter): Promise<KnowledgeInfo[]> {
    return this.rpc.call('tenzro_searchKnowledge', filter as unknown as Record<string, unknown>);
  }

  async get(knowledgeId: string): Promise<KnowledgeInfo> {
    return this.rpc.call('tenzro_getKnowledge', { knowledge_id: knowledgeId });
  }

  async use(params: UseKnowledgeParams): Promise<KnowledgeInvocationResult> {
    return this.rpc.call('tenzro_useKnowledge', params as unknown as Record<string, unknown>);
  }
}

// ── MCP plugin host (operator-only) ────────────────────────────────

export type UpstreamAuth =
  | { kind: 'bearer'; sealed_secret_ref: string }
  | { kind: 'header'; header_name: string; sealed_secret_ref: string }
  | { kind: 'env_var'; env_var_name: string; sealed_secret_ref: string }
  | { kind: 'query_param'; param_name: string; sealed_secret_ref: string };

export interface StdioSpawnSpec {
  command: string;
  args: string[];
  working_dir?: string;
  env?: Record<string, string>;
  timeout_secs?: number;
  persistent?: boolean;
}

export interface StoreSecretResponse {
  sealed_secret_ref: string;
  stored: boolean;
}

export interface ForgetSecretResponse {
  sealed_secret_ref: string;
  forgotten: boolean;
}

export interface EvictSubprocessResponse {
  tool_id: string;
  evicted: boolean;
}

export class McpHostClient {
  constructor(private readonly rpc: RpcClient) {}

  async storeSecret(
    sealedSecretRef: string,
    plaintext: string,
  ): Promise<StoreSecretResponse> {
    return this.rpc.call('tenzro_storeMcpSecret', {
      sealed_secret_ref: sealedSecretRef,
      plaintext,
    });
  }

  async forgetSecret(sealedSecretRef: string): Promise<ForgetSecretResponse> {
    return this.rpc.call('tenzro_forgetMcpSecret', {
      sealed_secret_ref: sealedSecretRef,
    });
  }

  async evictSubprocess(toolId: string): Promise<EvictSubprocessResponse> {
    return this.rpc.call('tenzro_evictMcpSubprocess', { tool_id: toolId });
  }
}
