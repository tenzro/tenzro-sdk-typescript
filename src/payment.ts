import { RpcClient } from "./rpc";
import {
  PaymentChallenge,
  PaymentReceipt,
  PaymentSessionInfo,
  GatewayInfo,
} from "./types";

/**
 * Client for payment protocol operations (MPP / x402).
 * Supports HTTP 402-based payments with session management.
 */
export class PaymentClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Create a payment challenge for a resource.
   * @param resource - Resource identifier (e.g., URL or model ID)
   * @param amount - Payment amount
   * @param asset - Asset identifier (default: "USDC")
   * @param protocol - Payment protocol: "mpp" or "x402" (default: "mpp")
   * @returns Payment challenge
   */
  async createChallenge(
    resource: string,
    amount: number,
    asset: string = "USDC",
    protocol: string = "mpp"
  ): Promise<PaymentChallenge> {
    return this.rpc.call<PaymentChallenge>("tenzro_createPaymentChallenge", [
      { resource, amount, asset, protocol },
    ]);
  }

  /**
   * Pay for a resource using the MPP (Machine Payments Protocol).
   * @param url - Resource URL
   * @param payerDid - Optional payer DID for identity binding
   * @returns Payment receipt
   */
  async payMpp(url: string, payerDid?: string): Promise<PaymentReceipt> {
    return this.rpc.call<PaymentReceipt>("tenzro_payMpp", [
      { url, payer_did: payerDid },
    ]);
  }

  /**
   * Pay for a resource using x402 protocol (Coinbase).
   * @param url - Resource URL
   * @param payerDid - Optional payer DID for identity binding
   * @returns Payment receipt
   */
  async payX402(url: string, payerDid?: string): Promise<PaymentReceipt> {
    return this.rpc.call<PaymentReceipt>("tenzro_payX402", [
      { url, payer_did: payerDid },
    ]);
  }

  /**
   * List all payment sessions.
   * @param includeInactive - Include inactive sessions (default: false)
   * @returns Array of session information
   */
  async listSessions(includeInactive?: boolean): Promise<PaymentSessionInfo[]> {
    return this.rpc.call<PaymentSessionInfo[]>("tenzro_listPaymentSessions", [
      { include_inactive: includeInactive ?? false },
    ]);
  }

  /**
   * Get a payment receipt by ID.
   * @param receiptId - Receipt identifier
   * @returns Payment receipt
   */
  async getReceipt(receiptId: string): Promise<PaymentReceipt> {
    return this.rpc.call<PaymentReceipt>("tenzro_getPaymentReceipt", [
      { receipt_id: receiptId },
    ]);
  }

  /**
   * Get payment gateway information.
   * @returns Gateway status and supported protocols/assets
   */
  async gatewayInfo(): Promise<GatewayInfo> {
    return this.rpc.call<GatewayInfo>("tenzro_paymentGatewayInfo");
  }

  /**
   * Pay via Visa TAP protocol.
   * @param credential - Visa TAP payment credential
   * @returns Payment result
   */
  async payVisaTap(credential: any): Promise<any> {
    return this.rpc.call("tenzro_payVisaTap", [credential]);
  }

  /**
   * Pay via Mastercard Agent Pay protocol.
   * @param credential - Mastercard payment credential
   * @returns Payment result
   */
  async payMastercard(credential: any): Promise<any> {
    return this.rpc.call("tenzro_payMastercard", [credential]);
  }

  /**
   * Pay for a resource using the AP2 (Agentic Payment Protocol).
   * @param agentDid - The agent's DID authorizing the payment
   * @param url - Resource URL to pay for
   * @param amount - Payment amount (decimal string)
   * @returns Payment receipt
   */
  async payAp2(
    agentDid: string,
    url: string,
    amount: string
  ): Promise<PaymentReceipt> {
    return this.rpc.call<PaymentReceipt>("tenzro_payAp2", [
      { agent_did: agentDid, url, amount },
    ]);
  }
}
