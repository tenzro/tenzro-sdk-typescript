import type { RpcClient } from './rpc';

/**
 * Token amount payload for CCIP message construction.
 */
export interface CcipTokenAmount {
  /** ERC-20 token address on the source chain (hex with `0x`). */
  token: string;
  /** Amount in token base units as a decimal string. */
  amount: string;
}

/**
 * `Router.getFee()` quote, in source-chain native units.
 */
export interface CcipFeeQuote {
  source_chain: string;
  router_address: string;
  dest_chain_selector: string;
  fee_token: string;
  /** Native fee in wei as a decimal string. */
  fee_wei: string;
  /** Native fee in display units (e.g. ETH). */
  fee_native: string;
}

/**
 * `Router.ccipSend()` envelope — calldata + msg.value ready for the
 * caller to sign and broadcast via `eth_sendRawTransaction`.
 */
export interface CcipSendEnvelope {
  status: string;
  source_chain: string;
  router_address: string;
  dest_chain_selector: string;
  /** Hex-encoded calldata to attach to the `to=router_address` tx. */
  calldata: string;
  /** Native value to attach as msg.value, in wei (decimal string). */
  msg_value_wei: string;
  gas_limit_destination: number;
  note: string;
}

/**
 * `OffRamp.getExecutionState()` result.
 * Execution state: 0=UNTOUCHED, 1=IN_PROGRESS, 2=SUCCESS, 3=FAILURE.
 */
export interface CcipExecutionState {
  message_id: string;
  dest_chain: string;
  offramp_address: string;
  execution_state: number;
  state_name: string;
  description: string;
}

/**
 * Router-mediated CCIP transfer receipt. On failure, `status` and
 * `error` are set instead of the success fields.
 */
export interface CcipTransferResult {
  status?: string;
  error?: string;
  registered_adapters?: string[];

  transfer_id: string;
  source_chain: string;
  dest_chain: string;
  tx_hash: string;
  fee_paid: string;
  estimated_arrival_ms: number;
  adapter: string;
}

/**
 * Client for Chainlink CCIP. CCIP uses a Chainlink-operated OCR
 * commit-store committee plus an independent RMN ARM (Risk
 * Management Network) that co-attest every inbound message.
 *
 * Use this client when the cross-chain leg requires CCIP
 * specifically rather than letting `BridgeRouter` pick. The 9
 * methods mirror the `tenzro_ccip*` JSON-RPC namespace on the node.
 */
export class CcipClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Quote a CCIP fee via `Router.getFee()` eth_call against the
   * source-chain Router.
   */
  async getFee(
    sourceChain: string,
    destChain: string,
    receiver: string,
    dataHex = '',
    tokenAmounts: CcipTokenAmount[] = [],
    feeToken?: string
  ): Promise<CcipFeeQuote> {
    return this.rpc.call<CcipFeeQuote>('tenzro_ccipGetFee', [
      {
        source_chain: sourceChain,
        dest_chain: destChain,
        receiver,
        data_hex: dataHex,
        token_amounts: tokenAmounts,
        fee_token: feeToken,
      },
    ]);
  }

  /**
   * Prepare a `Router.ccipSend()` envelope. Signing and broadcasting
   * are left to the caller — pair `calldata` and `msg_value_wei` with
   * `eth_sendRawTransaction`.
   */
  async send(
    sourceChain: string,
    destChain: string,
    receiver: string,
    dataHex = '',
    tokenAmounts: CcipTokenAmount[] = [],
    feeToken?: string,
    gasLimit?: number
  ): Promise<CcipSendEnvelope> {
    return this.rpc.call<CcipSendEnvelope>('tenzro_ccipSend', [
      {
        source_chain: sourceChain,
        dest_chain: destChain,
        receiver,
        data_hex: dataHex,
        token_amounts: tokenAmounts,
        fee_token: feeToken,
        gas_limit: gasLimit,
      },
    ]);
  }

  /**
   * Track a CCIP message via `OffRamp.getExecutionState(bytes32)`.
   */
  async track(
    messageId: string,
    destChain: string,
    offrampAddress: string
  ): Promise<CcipExecutionState> {
    return this.rpc.call<CcipExecutionState>('tenzro_ccipTrack', [
      {
        message_id: messageId,
        dest_chain: destChain,
        offramp_address: offrampAddress,
      },
    ]);
  }

  /**
   * List CCIP-supported chains (proxy of the Chainlink docs API).
   * `environment` is `"mainnet"` or `"testnet"`.
   */
  async supportedChains(environment?: 'mainnet' | 'testnet'): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ccipSupportedChains', [
      { environment },
    ]);
  }

  /** List CCIP-supported tokens. */
  async supportedTokens(environment?: 'mainnet' | 'testnet'): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ccipSupportedTokens', [
      { environment },
    ]);
  }

  /**
   * List CCIP lanes (source-destination pairs). Both selector filters
   * are optional.
   */
  async lanes(
    environment?: 'mainnet' | 'testnet',
    sourceChainSelector?: string,
    destChainSelector?: string
  ): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ccipLanes', [
      {
        environment,
        source_chain_selector: sourceChainSelector,
        dest_chain_selector: destChainSelector,
      },
    ]);
  }

  /** Inspect a CCIP CCT v1.6+ token-pool contract. */
  async tokenPool(chain: string, poolAddress: string): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ccipTokenPool', [
      { chain, pool_address: poolAddress },
    ]);
  }

  /**
   * Read inbound + outbound rate-limiter state for a (pool,
   * remote-chain) pair.
   */
  async rateLimits(
    chain: string,
    poolAddress: string,
    remoteChain: string
  ): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ccipRateLimits', [
      { chain, pool_address: poolAddress, remote_chain: remoteChain },
    ]);
  }

  /**
   * Bridge tokens through the node's BridgeRouter with the CCIP
   * adapter pinned. The router refuses the call if no CCIP adapter
   * is registered rather than falling back to a generic adapter.
   */
  async bridge(
    sourceChain: string,
    destChain: string,
    asset: string,
    amount: string,
    sender: string,
    recipient: string
  ): Promise<CcipTransferResult> {
    return this.rpc.call<CcipTransferResult>('tenzro_ccipBridge', [
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
