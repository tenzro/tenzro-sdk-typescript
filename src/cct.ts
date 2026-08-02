import type { RpcClient } from './rpc';

/**
 * Metadata for a single TNZO CCT pool on one chain.
 */
export interface CctPool {
  /** CAIP-2 or Chainlink chain id. */
  chain_id: string;
  /** Chainlink CCIP chain selector. */
  chain_selector: string;
  /** Deployed pool contract address. */
  pool_address: string;
  /** Underlying TNZO token contract address on the chain. */
  token_address: string;
  /** Pool type ("LockRelease" on Ethereum; "BurnMint" elsewhere). */
  pool_type: string;
  /** Contract name (e.g. "LockReleaseTokenPool"). */
  contract_name: string;
  /** Outbound rate-limiter capacity (decimal string). */
  outbound_capacity: string;
  /** Inbound rate-limiter capacity (decimal string). */
  inbound_capacity: string;
  /** Rate-limiter refill rate (decimal string). */
  refill_rate: string;
}

/**
 * List of TNZO CCT pools.
 */
export interface CctPoolList {
  /** Number of registered pools. */
  count: number;
  /** Per-chain pool entries. */
  pools: CctPool[];
}

/**
 * Client for the TNZO CCT (Chainlink Cross-Chain Token) pool registry.
 *
 * Ethereum uses a LockRelease pool; Base, Arbitrum, Optimism, and Solana
 * use BurnMint pools.
 */
export class CctClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * List all registered TNZO CCT pools.
   */
  async listPools(): Promise<CctPoolList> {
    return this.rpc.call<CctPoolList>('tenzro_cctListPools', [{}]);
  }

  /**
   * Get a single TNZO CCT pool by chain name
   * (e.g. `ethereum`, `base`, `arbitrum`, `optimism`, `solana`).
   */
  async getPool(chain: string): Promise<CctPool> {
    return this.rpc.call<CctPool>('tenzro_cctGetPool', [{ chain }]);
  }
}
