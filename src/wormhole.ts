import type { RpcClient } from './rpc';

/**
 * Wormhole chain id lookup result.
 */
export interface WormholeChainId {
  /** Chain name echoed back. */
  chain: string;
  /** Wormhole-assigned numeric chain id. */
  wormhole_chain_id: number;
}

/**
 * Parsed components of a `{chain}/{emitter}/{sequence}` VAA id.
 */
export interface WormholeVaaId {
  /** Emitter chain id. */
  emitter_chain: number;
  /** Emitter address (hex for EVM, base58 for Solana). */
  emitter_address: string;
  /** Monotonic sequence number. */
  sequence: number;
}

/**
 * Wormhole bridge transfer result. On failure, `status` and `error` are set
 * instead of the success fields.
 */
export interface WormholeTransferResult {
  /** Status string ("failed" on error; unset on success). */
  status?: string;
  /** Error detail, populated when the transfer was rejected. */
  error?: string;
  /** Adapters registered on the router (set on error for diagnostics). */
  registered_adapters?: string[];

  /** Unique transfer identifier assigned by the adapter. */
  transfer_id: string;
  /** Source chain name echoed back. */
  source_chain: string;
  /** Destination chain name echoed back. */
  dest_chain: string;
  /** On-chain transaction hash. */
  tx_hash: string;
  /** Fee paid (decimal string). */
  fee_paid: string;
  /** Estimated arrival time on the destination chain, in milliseconds. */
  estimated_arrival_ms: number;
}

/**
 * Client for the Wormhole cross-chain bridge via the `tenzro_wormhole*`
 * RPC family: chain id lookup, VAA id parsing, and token bridging
 * through the Wormhole adapter registered on the node's BridgeRouter.
 */
export class WormholeClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Look up the Wormhole numeric chain id for a chain name
   * (e.g. ethereum=2, solana=1, base=30, arbitrum=23, optimism=24).
   */
  async chainId(chain: string): Promise<WormholeChainId> {
    return this.rpc.call<WormholeChainId>('tenzro_wormholeChainId', [
      { chain },
    ]);
  }

  /**
   * Parse a canonical Wormhole VAA id of the form
   * `{chain}/{emitter}/{sequence}` into its components.
   */
  async parseVaaId(vaaId: string): Promise<WormholeVaaId> {
    return this.rpc.call<WormholeVaaId>('tenzro_wormholeParseVaaId', [
      { vaa_id: vaaId },
    ]);
  }

  /**
   * Bridge tokens through the Wormhole adapter on the BridgeRouter.
   *
   * @param sourceChain - Source chain name (e.g. "ethereum").
   * @param destChain   - Destination chain name (e.g. "solana").
   * @param asset       - Asset symbol or address.
   * @param amount      - Decimal string in smallest asset units.
   * @param sender      - Sender address on the source chain.
   * @param recipient   - Recipient address on the destination chain.
   */
  async bridge(
    sourceChain: string,
    destChain: string,
    asset: string,
    amount: string,
    sender: string,
    recipient: string
  ): Promise<WormholeTransferResult> {
    return this.rpc.call<WormholeTransferResult>('tenzro_wormholeBridge', [
      {
        source_chain: sourceChain,
        dest_chain: destChain,
        asset,
        amount,
        sender,
        recipient,
      },
    ]);
  }
}
