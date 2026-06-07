import type { RpcClient } from './rpc';

export interface SecureMintPolicy {
  asset_id: string;
  reserve: string;
  circulating?: string;
  por_feed_id: string;
  attester_did: string;
  attestation_hash: string;
  attested_at: number;
  ttl_secs: number;
}

export interface SecureMintCheck {
  would_succeed: boolean;
  reserve: string;
  circulating: string;
  headroom: string;
  reason?: string | null;
}

export interface SecureMintApply {
  asset_id: string;
  new_circulating: string;
  reserve: string;
}

/**
 * Secure-Mint registry client — enforces per-token 1:1
 * reserve-attestation invariant `circulating + amount ≤ reserve` for
 * tokenized real-world assets.
 */
export class SecureMintClient {
  constructor(private readonly rpc: RpcClient) {}

  async setPolicy(policy: SecureMintPolicy): Promise<SecureMintPolicy> {
    return this.rpc.call<SecureMintPolicy>('tenzro_setSecureMintPolicy', [
      policy,
    ]);
  }

  async getPolicy(assetId: string): Promise<SecureMintPolicy | null> {
    return this.rpc.call<SecureMintPolicy | null>(
      'tenzro_getSecureMintPolicy',
      [{ asset_id: assetId }]
    );
  }

  async clearPolicy(assetId: string): Promise<unknown> {
    return this.rpc.call('tenzro_clearSecureMintPolicy', [
      { asset_id: assetId },
    ]);
  }

  async check(assetId: string, amount: string): Promise<SecureMintCheck> {
    return this.rpc.call<SecureMintCheck>('tenzro_secureMintCheck', [
      { asset_id: assetId, amount },
    ]);
  }

  async apply(assetId: string, amount: string): Promise<SecureMintApply> {
    return this.rpc.call<SecureMintApply>('tenzro_secureMintApply', [
      { asset_id: assetId, amount },
    ]);
  }

  async recordBurn(assetId: string, amount: string): Promise<SecureMintApply> {
    return this.rpc.call<SecureMintApply>('tenzro_secureMintRecordBurn', [
      { asset_id: assetId, amount },
    ]);
  }
}
