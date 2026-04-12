import type { RpcClient } from './rpc';
import type {
  Ap2Session,
  Ap2Authorization,
  PaymentReceipt,
  CancelResult,
} from './types';

/**
 * Client for the AP2 (Agentic Payment Protocol).
 * Enables agents to establish payment sessions with providers,
 * authorize individual payments, and manage session lifecycle.
 */
export class Ap2Client {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a new AP2 payment session between an agent and a provider.
   * @param agentDid - DID of the agent initiating the session
   * @param providerDid - DID of the service provider
   * @param service - Service identifier (e.g., model ID or endpoint)
   * @param maxAmount - Maximum authorized spend for this session (decimal string)
   * @param asset - Asset to use for payments (default: "TNZO")
   * @returns Created AP2 session
   */
  async createSession(
    agentDid: string,
    providerDid: string,
    service: string,
    maxAmount: string,
    asset: string = 'TNZO'
  ): Promise<Ap2Session> {
    return this.rpc.call<Ap2Session>('tenzro_ap2CreateSession', [
      {
        agent_did: agentDid,
        provider_did: providerDid,
        service,
        max_amount: maxAmount,
        asset,
      },
    ]);
  }

  /**
   * Authorize a payment within an existing AP2 session.
   * @param sessionId - The session to authorize against
   * @param amount - Amount to authorize (decimal string)
   * @returns Payment authorization
   */
  async authorizePayment(
    sessionId: string,
    amount: string
  ): Promise<Ap2Authorization> {
    return this.rpc.call<Ap2Authorization>('tenzro_ap2AuthorizePayment', [
      { session_id: sessionId, amount },
    ]);
  }

  /**
   * Execute a previously authorized payment.
   * @param sessionId - The session containing the authorization
   * @param authorizationId - The authorization to execute
   * @returns Payment receipt
   */
  async executePayment(
    sessionId: string,
    authorizationId: string
  ): Promise<PaymentReceipt> {
    return this.rpc.call<PaymentReceipt>('tenzro_ap2ExecutePayment', [
      { session_id: sessionId, authorization_id: authorizationId },
    ]);
  }

  /**
   * Cancel an active AP2 session.
   * @param sessionId - The session to cancel
   * @returns Cancellation result with optional refund info
   */
  async cancelSession(sessionId: string): Promise<CancelResult> {
    return this.rpc.call<CancelResult>('tenzro_ap2CancelSession', [
      { session_id: sessionId },
    ]);
  }

  /**
   * Get details of an AP2 session.
   * @param sessionId - The session identifier
   * @returns Session details
   */
  async getSession(sessionId: string): Promise<Ap2Session> {
    return this.rpc.call<Ap2Session>('tenzro_ap2GetSession', [
      { session_id: sessionId },
    ]);
  }

  /**
   * List all AP2 sessions for a given agent.
   * @param agentDid - The agent's DID
   * @returns Array of AP2 sessions
   */
  async listAgentSessions(agentDid: string): Promise<Ap2Session[]> {
    return this.rpc.call<Ap2Session[]>('tenzro_ap2ListAgentSessions', [
      { agent_did: agentDid },
    ]);
  }
}
