import type { RpcClient } from './rpc';

export interface Caip2Info {
  chain_id: string;
  namespace: string;
  reference: string;
  evm_chain_id: number;
}

export interface Caip10Info {
  account_id: string;
  chain_id: string;
  address: string;
}

export interface Caip19Request {
  /** One of `"slip44"`, `"token"`, `"nft"`. */
  kind: 'slip44' | 'token' | 'nft' | string;
  token_id?: string;
  collection_id?: string;
  nft_token_id?: string;
}

export interface Caip19Info {
  asset_id: string;
  chain_id: string;
  asset_namespace: string;
  asset_reference: string;
  token_id?: string | null;
}

/**
 * Chain-agnostic discovery client per the submitted `tenzro` CASA
 * namespace (`ChainAgnostic/namespaces#184`).
 *
 * - CAIP-2 chain id: `tenzro:<lowercase hex of first 16 bytes of
 *   genesis block hash>`. EVM `evm_chain_id` sidecar is included.
 * - CAIP-10: accepts hex or base58btc, normalises to canonical 64-hex.
 * - CAIP-19: `slip44` (SLIP-44 coin index 1414421071), `token`, `nft`.
 */
export class CaipClient {
  constructor(private readonly rpc: RpcClient) {}

  async caip2(): Promise<Caip2Info> {
    return this.rpc.call<Caip2Info>('tenzro_caip2', []);
  }

  async caip10(address: string): Promise<Caip10Info> {
    return this.rpc.call<Caip10Info>('tenzro_caip10', [{ address }]);
  }

  async caip19(params: Caip19Request): Promise<Caip19Info> {
    return this.rpc.call<Caip19Info>('tenzro_caip19', [params]);
  }
}
