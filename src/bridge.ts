import type { RpcClient } from './rpc';
import type {
  BridgeTransfer,
  BridgeRoute,
  BridgeAdapter,
  BridgeFee,
  TransferStatus,
} from './types';

/**
 * Client for cross-chain bridge operations.
 * Supports bridging tokens between Tenzro, Ethereum, Solana, Base, and other chains
 * via LayerZero V2, Chainlink CCIP, deBridge DLN, and Canton adapters.
 *
 * **LayerZero V2:** OFT transfers use `uint64 amountSD` (shared decimals) with TYPE_3
 * options encoding. Supported chain EIDs include Ethereum (30101), BSC (30102),
 * Avalanche (30106), Polygon (30109), Arbitrum (30110), Optimism (30111), zkSync (30165),
 * Base (30184), Solana (30168), Sei (30280), Sonic (30332), Berachain (30362),
 * Story (30364), Monad (30390), MegaETH (30398), Robinhood Chain (30416), Tron (30420).
 *
 * **Chainlink CCIP:** Uses `allowOutOfOrderExecution = true`. Router addresses:
 * BSC `0x34B03Cb9086d7D758AC55af71584F81A598759FE`,
 * Base `0x881e3A65B4d4a04dD529061dd0071cf975F58bCD`.
 *
 * **deBridge DLN:** Order status tracked via `stats-api.dln.trade`.
 * `ClaimedUnlock`/`SentUnlock` statuses map to `Filled`.
 */
export class BridgeClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Bridge tokens from one chain to another.
   * @param fromChain - Source chain identifier (e.g., "tenzro", "ethereum", "solana")
   * @param toChain - Destination chain identifier
   * @param token - Token to bridge (e.g., "TNZO", "USDC")
   * @param amount - Amount to bridge (decimal string)
   * @param recipient - Recipient address on the destination chain
   * @param adapter - Optional bridge adapter to use (e.g., "layerzero", "ccip", "debridge")
   * @returns Bridge transfer details
   */
  async bridgeTokens(
    fromChain: string,
    toChain: string,
    token: string,
    amount: string,
    recipient: string,
    adapter?: string
  ): Promise<BridgeTransfer> {
    return this.rpc.call<BridgeTransfer>('tenzro_bridgeTokens', [
      {
        from_chain: fromChain,
        to_chain: toChain,
        token,
        amount,
        recipient,
        adapter,
      },
    ]);
  }

  /**
   * Get available bridge routes between two chains.
   * @param fromChain - Source chain identifier
   * @param toChain - Destination chain identifier
   * @param token - Optional token filter
   * @returns Array of available routes with fee and timing estimates
   */
  async getRoutes(
    fromChain: string,
    toChain: string,
    token?: string
  ): Promise<BridgeRoute[]> {
    return this.rpc.call<BridgeRoute[]>('tenzro_getBridgeRoutes', [
      { from_chain: fromChain, to_chain: toChain, token },
    ]);
  }

  /**
   * List all registered bridge adapters.
   * @returns Array of bridge adapter information
   */
  async listAdapters(): Promise<BridgeAdapter[]> {
    return this.rpc.call<BridgeAdapter[]>('tenzro_listBridgeAdapters');
  }

  /**
   * Get the current status of a bridge transfer.
   * @param transferId - The transfer identifier
   * @returns Transfer status with source and destination transaction hashes
   */
  async getTransferStatus(transferId: string): Promise<TransferStatus> {
    return this.rpc.call<TransferStatus>('tenzro_getBridgeTransferStatus', [
      { transfer_id: transferId },
    ]);
  }

  /**
   * Estimate the fee for a bridge transfer.
   * @param fromChain - Source chain identifier
   * @param toChain - Destination chain identifier
   * @param token - Token to bridge
   * @param amount - Amount to bridge (decimal string)
   * @returns Fee estimate
   */
  async estimateFee(
    fromChain: string,
    toChain: string,
    token: string,
    amount: string
  ): Promise<BridgeFee> {
    return this.rpc.call<BridgeFee>('tenzro_estimateBridgeFee', [
      { from_chain: fromChain, to_chain: toChain, token, amount },
    ]);
  }
}
