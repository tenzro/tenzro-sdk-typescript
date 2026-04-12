import type { RpcClient } from './rpc';

// ── Types ──

/** A chain supported by deBridge DLN. */
export interface DebridgeChain {
  /** Numeric chain ID */
  chainId: number;
  /** Human-readable chain name (e.g. "Ethereum", "Solana") */
  name: string;
  /** Chain type (e.g. "evm", "svm") */
  chain_type?: string;
}

/** A token available on deBridge DLN. */
export interface DebridgeToken {
  /** Token contract address (or native token sentinel) */
  address: string;
  /** Token ticker symbol (e.g. "USDC") */
  symbol: string;
  /** Full token name */
  name: string;
  /** Number of decimals */
  decimals: number;
  /** Chain ID the token is on */
  chainId?: number;
}

/** A cross-chain order created via deBridge DLN. */
export interface DebridgeOrder {
  /** Order identifier */
  order_id: string;
  /** Source chain ID */
  src_chain: number;
  /** Destination chain ID */
  dst_chain: number;
  /** Source token address */
  src_token: string;
  /** Destination token address */
  dst_token: string;
  /** Amount as a decimal string */
  amount: string;
  /** Recipient address on the destination chain */
  recipient: string;
  /** Order status */
  status: string;
  /** Transaction data to sign and submit */
  tx_data?: Record<string, unknown>;
}

/** Result of a same-chain swap via deBridge. */
export interface DebridgeSwapResult {
  /** Transaction hash */
  tx_hash?: string;
  /** Input token address */
  token_in: string;
  /** Output token address */
  token_out: string;
  /** Input amount as a decimal string */
  amount_in: string;
  /** Output amount as a decimal string */
  amount_out: string;
  /** Status */
  status: string;
  /** Transaction data to sign and submit */
  tx_data?: Record<string, unknown>;
}

/** deBridge usage instructions and supported features. */
export interface DebridgeInstructions {
  /** Supported order types */
  order_types: string[];
  /** Supported features */
  features: string[];
  /** API version */
  api_version: string;
}

// ── Client ──

/**
 * Client for deBridge DLN (Decentalized Liquidity Network) cross-chain operations.
 * Supports token search, chain listing, cross-chain order creation,
 * and same-chain swaps. Order status is tracked via `stats-api.dln.trade`.
 *
 * deBridge uses an intent-based model: callers create orders specifying
 * source/destination chains and tokens, and market makers (takers) fill them.
 */
export class DebridgeClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Search for tokens available on deBridge DLN.
   * @param query - Search query (token name or symbol)
   * @param chainId - Optional chain ID filter
   * @returns Array of matching tokens
   */
  async searchTokens(
    query: string,
    chainId?: number
  ): Promise<DebridgeToken[]> {
    return this.rpc.call<DebridgeToken[]>('tenzro_debridgeSearchTokens', [
      { query, chain_id: chainId },
    ]);
  }

  /**
   * List all chains supported by deBridge DLN.
   * @returns Array of supported chains
   */
  async getChains(): Promise<DebridgeChain[]> {
    return this.rpc.call<DebridgeChain[]>('tenzro_debridgeGetChains');
  }

  /**
   * Get deBridge usage instructions and supported features.
   * @returns Instructions including order types and API version
   */
  async getInstructions(): Promise<DebridgeInstructions> {
    return this.rpc.call<DebridgeInstructions>(
      'tenzro_debridgeGetInstructions'
    );
  }

  /**
   * Create a cross-chain order via deBridge DLN.
   * Returns unsigned transaction data that the caller must sign and submit.
   * @param srcChain - Source chain ID
   * @param dstChain - Destination chain ID
   * @param srcToken - Source token address
   * @param dstToken - Destination token address
   * @param amount - Amount as a decimal string (in source token units)
   * @param recipient - Recipient address on the destination chain
   * @returns Order details with transaction data to sign
   */
  async createTx(
    srcChain: number,
    dstChain: number,
    srcToken: string,
    dstToken: string,
    amount: string,
    recipient: string
  ): Promise<DebridgeOrder> {
    return this.rpc.call<DebridgeOrder>('tenzro_debridgeCreateTx', [
      {
        src_chain: srcChain,
        dst_chain: dstChain,
        src_token: srcToken,
        dst_token: dstToken,
        amount,
        recipient,
      },
    ]);
  }

  /**
   * Execute a same-chain swap via deBridge.
   * Returns unsigned transaction data for a single-chain token swap.
   * @param chainId - Chain ID to swap on
   * @param tokenIn - Input token address
   * @param tokenOut - Output token address
   * @param amount - Input amount as a decimal string
   * @returns Swap result with transaction data
   */
  async sameChainSwap(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amount: string
  ): Promise<DebridgeSwapResult> {
    return this.rpc.call<DebridgeSwapResult>('tenzro_debridgeSameChainSwap', [
      { chain_id: chainId, token_in: tokenIn, token_out: tokenOut, amount },
    ]);
  }

  /**
   * Get the status of an existing deBridge DLN order.
   * Status is fetched from the deBridge stats API (`stats-api.dln.trade`).
   * @param orderId - Order identifier
   * @returns Order details including current status
   */
  async getOrderStatus(orderId: string): Promise<DebridgeOrder> {
    return this.rpc.call<DebridgeOrder>('tenzro_debridgeGetOrderStatus', [
      { order_id: orderId },
    ]);
  }
}
