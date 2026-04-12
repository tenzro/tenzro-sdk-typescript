import type { RpcClient } from './rpc';
import type {
  ChannelInfo,
  NanopaymentReceipt,
  BatchSettlement,
  CloseResult,
} from './types';

/**
 * Client for nanopayment channel operations.
 * Supports opening channels, sending individual nanopayments,
 * batch-flushing to on-chain settlement, and channel lifecycle management.
 */
export class NanopaymentClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Open a new nanopayment channel.
   * @param payer - Payer address
   * @param payee - Payee address
   * @param deposit - Initial deposit amount (decimal string)
   * @param asset - Asset to use (default: "TNZO")
   * @returns Opened channel information
   */
  async openChannel(
    payer: string,
    payee: string,
    deposit: string,
    asset: string = 'TNZO'
  ): Promise<ChannelInfo> {
    return this.rpc.call<ChannelInfo>('tenzro_openNanopaymentChannel', [
      { payer, payee, deposit, asset },
    ]);
  }

  /**
   * Send a nanopayment through an open channel.
   * @param channelId - The channel to send through
   * @param amount - Payment amount (decimal string)
   * @param memo - Optional memo for this payment
   * @returns Nanopayment receipt
   */
  async sendNanopayment(
    channelId: string,
    amount: string,
    memo?: string
  ): Promise<NanopaymentReceipt> {
    return this.rpc.call<NanopaymentReceipt>('tenzro_sendNanopayment', [
      { channel_id: channelId, amount, memo },
    ]);
  }

  /**
   * Flush accumulated nanopayments to on-chain settlement.
   * @param channelId - The channel to flush
   * @returns Batch settlement result with on-chain transaction hash
   */
  async flushBatch(channelId: string): Promise<BatchSettlement> {
    return this.rpc.call<BatchSettlement>('tenzro_flushNanopaymentBatch', [
      { channel_id: channelId },
    ]);
  }

  /**
   * Close a nanopayment channel and settle final balances.
   * @param channelId - The channel to close
   * @returns Close result with final settlement details
   */
  async closeChannel(channelId: string): Promise<CloseResult> {
    return this.rpc.call<CloseResult>('tenzro_closeNanopaymentChannel', [
      { channel_id: channelId },
    ]);
  }

  /**
   * Get details of a nanopayment channel.
   * @param channelId - The channel identifier
   * @returns Channel information
   */
  async getChannel(channelId: string): Promise<ChannelInfo> {
    return this.rpc.call<ChannelInfo>('tenzro_getNanopaymentChannel', [
      { channel_id: channelId },
    ]);
  }

  /**
   * List all nanopayment channels for an address.
   * @param address - The address to query (as payer or payee)
   * @returns Array of channel information
   */
  async listChannels(address: string): Promise<ChannelInfo[]> {
    return this.rpc.call<ChannelInfo[]>('tenzro_listNanopaymentChannels', [
      { address },
    ]);
  }
}
