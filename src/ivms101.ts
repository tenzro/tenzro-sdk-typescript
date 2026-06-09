import type { RpcClient } from './rpc';

export interface Ivms101HashResult {
  envelope_hash_hex: string;
  spec_version: string;
  originating_vasp_did: string | null;
  beneficiary_vasp_did: string | null;
  asset_caip19: string;
  amount_smallest_unit: string;
}

/**
 * IVMS101 Travel Rule envelope client. Computes the canonical SHA-256
 * binding hash for an originator + beneficiary + VASP + transfer-data
 * envelope so a settlement receipt can anchor to a specific record.
 */
export class Ivms101Client {
  constructor(private readonly rpc: RpcClient) {}

  async canonicalHash(envelope: Record<string, unknown>): Promise<Ivms101HashResult> {
    return this.rpc.call<Ivms101HashResult>('tenzro_ivms101Hash', envelope);
  }
}
