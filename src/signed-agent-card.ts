import type { RpcClient } from './rpc';

export interface SignedAgentCardHash {
  canonical_hash_hex: string;
  agent_card_name: string;
  agent_card_url: string;
  protocol_version: string;
  skills_count: number;
}

/**
 * A2A v1.0 SignedAgentCard canonical-hash client. Compute the
 * deterministic SHA-256 hash of an A2A agent card so a domain owner
 * can JWS-sign it (and relying parties can re-verify).
 */
export class SignedAgentCardClient {
  constructor(private readonly rpc: RpcClient) {}

  async canonicalHash(agentCard: Record<string, unknown>): Promise<SignedAgentCardHash> {
    return this.rpc.call<SignedAgentCardHash>(
      'tenzro_signedAgentCardCanonicalHash',
      agentCard,
    );
  }
}
