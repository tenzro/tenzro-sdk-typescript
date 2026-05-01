import type { RpcClient } from './rpc';
import type {
  Ap2Session,
  Ap2Authorization,
  PaymentReceipt,
  CancelResult,
} from './types';

/**
 * Result of verifying a single AP2 mandate (Intent / Cart / Payment VDC).
 */
export interface Ap2MandateVerification {
  /** Whether the VDC proof is valid. */
  valid: boolean;
  /** Mandate type: "Intent" | "Cart" | "Payment". */
  mandate_type: string;
  /** Issuer DID. */
  issuer: string;
  /** Subject DID (agent/merchant). */
  subject: string;
  /** Expiration timestamp (Unix seconds). */
  expires_at: number;
  /** Reason for failure if `valid` is false. */
  error?: string;
}

/**
 * Result of validating an Intent+Cart mandate pair.
 */
export interface Ap2MandatePairValidation {
  /** Whether the pair is mutually consistent and both VDCs verify. */
  valid: boolean;
  /** Mandate id of the intent VDC (set on success). */
  intent_mandate_id?: string;
  /** Mandate id of the cart VDC (set on success). */
  cart_mandate_id?: string;
  /** Principal DID — intent signer (set on success). */
  principal_did?: string;
  /** Agent DID — cart signer (set on success). */
  agent_did?: string;
  /**
   * Whether the TDIP delegation gate ran in addition to AP2 validation.
   * Mirrors the `enforce_delegation` request flag.
   */
  delegation_enforced: boolean;
  /** Reason for failure if `valid` is false. */
  error?: string;
}

/**
 * AP2 protocol metadata.
 */
export interface Ap2ProtocolInfo {
  /** AP2 protocol version. */
  version: string;
  /** Supported mandate types (e.g. ["Intent", "Cart", "Payment"]). */
  supported_mandate_types: string[];
  /** Supported VC formats (e.g. ["jwt_vc", "ldp_vc"]). */
  supported_vc_formats: string[];
  /** Recognized issuer DID methods (e.g. ["did:tenzro", "did:web"]). */
  supported_did_methods: string[];
}

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

  // ─── AP2 Mandate Verification (Google AP2 spec) ────────────────────────

  /**
   * Verify a single AP2 mandate (Verifiable Digital Credential).
   *
   * Checks the VDC proof, issuer, and schema for Intent, Cart, or Payment
   * mandates per Google's AP2 specification.
   *
   * @param vdc - The full JSON-LD VC envelope with proof.
   */
  async verifyMandate(vdc: unknown): Promise<Ap2MandateVerification> {
    return this.rpc.call<Ap2MandateVerification>('tenzro_ap2VerifyMandate', [
      { vdc },
    ]);
  }

  /**
   * Validate an AP2 Intent+Cart mandate pair for consistency.
   *
   * Ensures the cart references the intent, amounts/items match the intent's
   * constraints, and both VDCs verify. When `enforceDelegation` is true,
   * additionally cross-checks the agent's TDIP `DelegationScope` against
   * the cart total via `IdentityRegistry::enforce_operation(agent_did,
   * "payment", total)`. Both layers must admit the cart.
   *
   * @param intentVdc - The principal-signed IntentMandate VDC.
   * @param cartVdc - The agent-signed CartMandate VDC.
   * @param enforceDelegation - If true, run the TDIP delegation gate after
   *   AP2 validation succeeds. Defaults to false (AP2-only).
   */
  async validateMandatePair(
    intentVdc: unknown,
    cartVdc: unknown,
    enforceDelegation: boolean = false
  ): Promise<Ap2MandatePairValidation> {
    return this.rpc.call<Ap2MandatePairValidation>(
      'tenzro_ap2ValidateMandatePair',
      [{
        intent_vdc: intentVdc,
        cart_vdc: cartVdc,
        enforce_delegation: enforceDelegation,
      }]
    );
  }

  /**
   * Return AP2 protocol metadata (version, supported mandate types,
   * VC formats, and recognized DID methods).
   */
  async protocolInfo(): Promise<Ap2ProtocolInfo> {
    return this.rpc.call<Ap2ProtocolInfo>('tenzro_ap2ProtocolInfo', []);
  }
}
