import { RpcClient } from "./rpc";
import { SettlementParams, SettlementReceipt } from "./types";

/**
 * Client for payment settlement operations.
 * Supports immediate settlement, escrow, and micropayment channels.
 */
export class SettlementClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Settle a payment for AI inference or other services.
   * @param request - Settlement request parameters
   * @returns Settlement receipt with transaction details
   */
  async settle(request: SettlementParams): Promise<SettlementReceipt> {
    return this.rpc.call<SettlementReceipt>("tenzro_settle", [request]);
  }

  /**
   * Get the status of a settlement by receipt ID.
   * @param receiptId - The settlement receipt identifier
   * @returns Settlement receipt or null if not found
   */
  async getSettlement(receiptId: string): Promise<SettlementReceipt | null> {
    return this.rpc.call<SettlementReceipt | null>("tenzro_getSettlement", [
      receiptId,
    ]);
  }

  /**
   * Create an escrow that releases payment when conditions are met.
   * @param payee - Address receiving the payment
   * @param amount - Amount to escrow (in smallest unit)
   * @param asset - Asset identifier (e.g., "TNZO")
   * @param conditions - JSON-encoded release conditions
   * @returns Escrow ID
   */
  async createEscrow(
    payee: string,
    amount: bigint,
    asset: string,
    conditions: string
  ): Promise<string> {
    return this.rpc.call<string>("tenzro_createEscrow", [
      {
        payee,
        amount: amount.toString(),
        asset,
        conditions,
      },
    ]);
  }

  /**
   * Release funds from an escrow.
   * @param escrowId - The escrow identifier
   * @param proof - Optional proof that conditions are met
   * @returns Transaction hash
   */
  async releaseEscrow(escrowId: string, proof?: string): Promise<string> {
    return this.rpc.call<string>("tenzro_releaseEscrow", [
      { escrow_id: escrowId, proof },
    ]);
  }

  /**
   * Open a micropayment channel for streaming payments.
   * @param payee - Address receiving payments
   * @param deposit - Initial deposit amount
   * @returns Channel ID
   */
  async openPaymentChannel(payee: string, deposit: bigint): Promise<string> {
    return this.rpc.call<string>("tenzro_openPaymentChannel", [
      {
        payee,
        deposit: deposit.toString(),
      },
    ]);
  }

  /**
   * Close a micropayment channel.
   * @param channelId - The channel identifier to close
   * @returns Channel closure result
   */
  async closePaymentChannel(channelId: string): Promise<any> {
    return this.rpc.call("tenzro_closePaymentChannel", [
      { channel_id: channelId },
    ]);
  }
}
