import { RpcClient } from "./rpc";
import {
  PaymentChallenge,
  PaymentReceipt,
  PaymentSessionInfo,
  GatewayInfo,
  X402SchemeRegistry,
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
   * List the x402 scheme backends registered on the connected node.
   *
   * Each scheme corresponds to a different verification path under the x402
   * protocol: `tenzro-hybrid` (Ed25519 hybrid signature over canonical
   * preimage), `exact-eip3009` (USDC EIP-3009 meta-transaction via the CDP
   * facilitator), `permit2` (Uniswap Permit2 via the CDP facilitator), and
   * `erc7710` (delegation redemption). Use the returned ids in the
   * `extra.scheme` field of an x402 PaymentRequirement.
   *
   * @returns Snapshot of the node's x402 scheme registry
   */
  async listX402Schemes(): Promise<X402SchemeRegistry> {
    return this.rpc.call<X402SchemeRegistry>("tenzro_listX402Schemes");
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
