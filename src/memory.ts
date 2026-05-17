import { RpcClient } from "./rpc";

/** Kind of memory record. */
export type MemoryKind = "granted" | "recalled" | "self_noted" | "archived";

/** Where a memory record came from. */
export type MemorySource = "controller" | "tool" | "peer" | "self";

/** Search mode for `recall`. `hybrid` (default) merges Lance vector kNN
 * with Tantivy BM25 via Reciprocal Rank Fusion at k=60. */
export type MemorySearchMode = "hybrid" | "vector" | "text";

/** A single record from the per-agent memory tier. */
export interface MemoryRecord {
  id: string;
  agent_did: string;
  created_at_ms: number;
  kind: MemoryKind;
  source: MemorySource;
  text: string;
  metadata: Record<string, unknown>;
  /** Present when the record has been offloaded to a DA backend. */
  da_pointer?: {
    backend: string;
    namespace: string;
    locator: string;
    commitment_kzg?: string | null;
    attestation_root?: string | null;
  } | null;
}

export interface RecallResult {
  count: number;
  records: MemoryRecord[];
}

export interface ListMemoryResult {
  count: number;
  records: MemoryRecord[];
}

export interface MemoryGrantParams {
  agent_did: string;
  text: string;
  /** Default `"granted"`. */
  kind?: MemoryKind;
  /** Default `"controller"`. */
  source?: MemorySource;
  metadata?: Record<string, unknown>;
}

export interface MemoryRecallParams {
  agent_did: string;
  query: string;
  /** Top-k results (default 10). */
  k?: number;
  /** Default `"hybrid"`. */
  mode?: MemorySearchMode;
}

/**
 * Per-agent memory tier client — Lance vector kNN + Tantivy BM25 with
 * Reciprocal Rank Fusion at k=60 for `hybrid` mode (the production
 * default). Records can be archived to the node's DA backend, which
 * replaces the on-tier row with `kind=archived` plus a `da_pointer`.
 *
 * Backed by the `tenzro_memory*` RPC namespace. Requires the node to
 * have a configured embedding model — calls otherwise fail with a
 * `NoEmbedder` error.
 */
export class MemoryClient {
  constructor(private rpc: RpcClient) {}

  /** Persist a memory for an agent (writes to vector + text indices). */
  async grant(params: MemoryGrantParams): Promise<MemoryRecord> {
    return this.rpc.call("tenzro_memoryGrant", [
      {
        agent_did: params.agent_did,
        text: params.text,
        kind: params.kind ?? "granted",
        source: params.source ?? "controller",
        metadata: params.metadata ?? {},
      },
    ]);
  }

  /** Recall up to `k` memories matching `query`. */
  async recall(params: MemoryRecallParams): Promise<RecallResult> {
    return this.rpc.call("tenzro_memoryRecall", [
      {
        agent_did: params.agent_did,
        query: params.query,
        k: params.k ?? 10,
        mode: params.mode ?? "hybrid",
      },
    ]);
  }

  /**
   * Archive a record to the DA backend — replaces the on-tier rows with
   * `kind=archived` plus a `da_pointer`. The returned record reflects the
   * archived state.
   */
  async archive(recordId: string, agentDid: string): Promise<MemoryRecord> {
    return this.rpc.call("tenzro_memoryArchive", [
      { record_id: recordId, agent_did: agentDid },
    ]);
  }

  /** List newest-first memories for an agent (default limit 50). */
  async listRecords(agentDid: string, limit?: number): Promise<ListMemoryResult> {
    return this.rpc.call("tenzro_listMemoryRecords", [
      { agent_did: agentDid, limit: limit ?? 50 },
    ]);
  }
}
