import { RpcClient } from "./rpc";

/**
 * A single ERC-7683 `Output` — chain-discriminated 32-byte recipient +
 * uint256 amount.
 */
export interface Erc7683Output {
  /** Token address (hex, chain-native — 20-byte EVM left-padded to 32, or 32-byte SVM mint). */
  token: string;
  /** uint256 amount in token's smallest unit, as 32-byte big-endian hex. */
  amount: string;
  /** 32-byte recipient on the destination chain (hex). */
  recipient: string;
  /** CAIP-2 numeric chain id of the destination chain. */
  chain_id: number;
}

/** Result of `tenzro_list7683Orders`. */
export interface Erc7683OrderList {
  orders: unknown[];
  count: number;
}

/**
 * Client for ERC-7683 cross-chain intent settler (Spec 4).
 *
 * Wraps the `tenzro_get7683Order` / `tenzro_list7683Orders` read RPCs on the
 * origin side and the `tenzro_recordFill7683` / `tenzro_getFill7683` /
 * `tenzro_listFills7683` RPCs on the destination side. The Tenzro ERC-7683
 * envelope is `Tenzro7683Order` persisted in `CF_SETTLEMENTS` under the
 * `7683_origin:` keyspace; fill records live under `7683_dest:`.
 *
 * Order state machine: `Open → AwaitingProof → Settled / Refunded /
 * ForceRefundEligible`.
 */
export class Erc7683Client {
  constructor(private rpc: RpcClient) {}

  /**
   * Fetch a single persisted `Tenzro7683Order` by 32-byte `order_id`
   * (hex, with or without `0x` prefix).
   * @param orderId - 32-byte order id (hex)
   * @returns JSON envelope produced by the node's `tenzro_7683_order_to_json` projection
   */
  async getOrder(orderId: string): Promise<any> {
    return this.rpc.call("tenzro_get7683Order", [{ order_id: orderId }]);
  }

  /**
   * Paginated scan over the `7683_origin:` keyspace. All filters are
   * optional; omit to skip a filter.
   * @param opts.state - one of `open`, `awaiting_proof`, `settled`, `refunded`, `force_refund_eligible`
   * @param opts.destChain - CAIP-2 numeric destination chain id
   * @param opts.limit - cap on returned envelopes (default 50)
   */
  async listOrders(opts: {
    state?: string;
    destChain?: number;
    limit?: number;
  } = {}): Promise<Erc7683OrderList> {
    const params: Record<string, unknown> = {};
    if (opts.state !== undefined) params.state = opts.state;
    if (opts.destChain !== undefined) params.dest_chain = opts.destChain;
    if (opts.limit !== undefined) params.limit = opts.limit;
    return this.rpc.call<Erc7683OrderList>("tenzro_list7683Orders", [params]);
  }

  /**
   * Destination-side write: commit a `FillRecord` for an order that has
   * been filled on the destination chain. Idempotency-guarded — the
   * second call for the same `(order_id, origin_chain_id)` pair is
   * rejected by the node.
   *
   * @param args.proofRoute - one of `layerzero`, `wormhole`, `debridge`, `hyperlane`
   */
  async recordFill(args: {
    orderId: string;
    originChainId: number;
    originSettler: string;
    filler: string;
    recipient: string;
    fillTxHash: string;
    filledAtMs: number;
    proofRoute: string;
    outputs: Erc7683Output[];
  }): Promise<any> {
    return this.rpc.call("tenzro_recordFill7683", [
      {
        order_id: args.orderId,
        origin_chain_id: args.originChainId,
        origin_settler: args.originSettler,
        filler: args.filler,
        recipient: args.recipient,
        fill_tx_hash: args.fillTxHash,
        filled_at_ms: args.filledAtMs,
        proof_route: args.proofRoute,
        outputs: args.outputs,
      },
    ]);
  }

  /** Fetch a single persisted `FillRecord` by `(order_id, origin_chain_id)`. */
  async getFill(orderId: string, originChainId: number): Promise<any> {
    return this.rpc.call("tenzro_getFill7683", [
      { order_id: orderId, origin_chain_id: originChainId },
    ]);
  }

  /** List every persisted `FillRecord` in the `7683_dest:` keyspace. */
  async listFills(): Promise<any> {
    return this.rpc.call("tenzro_listFills7683", [{}]);
  }
}
