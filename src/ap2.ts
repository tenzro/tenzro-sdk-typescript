import type { RpcClient } from './rpc';
import type {
  Ap2Session,
  Ap2Authorization,
  PaymentReceipt,
  CancelResult,
} from './types';

/**
 * Result of verifying a single AP2 mandate (Checkout / Payment VDC).
 */
export interface Ap2MandateVerification {
  /** Whether the VDC proof is valid. */
  valid: boolean;
  /** Mandate id carried by the VDC (set on success). */
  mandate_id?: string;
  /** Mandate kind: "checkout" | "payment" (set on success). */
  kind?: string;
  /** DID that signed the VDC (set on success). */
  signer_did?: string;
  /** Signature algorithm the VDC was signed under (set on success). */
  alg?: string;
  /** Reason for failure if `valid` is false. */
  error?: string;
}

/**
 * Result of validating a Checkout+Payment mandate pair.
 */
export interface Ap2MandatePairValidation {
  /** Whether the pair is mutually consistent and both VDCs verify. */
  valid: boolean;
  /** Mandate id of the checkout VDC (set on success). */
  checkout_mandate_id?: string;
  /** Mandate id of the payment VDC (set on success). */
  payment_mandate_id?: string;
  /** Principal DID — checkout signer (set on success). */
  principal_did?: string;
  /** Agent DID — payment signer (set on success). */
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
  /** Algorithm mandates are signed under (e.g. "ed25519"). */
  signing_alg: string;
  /** Supported mandate kinds (`["checkout", "payment"]`). */
  mandate_kinds: string[];
  /** Recognized `vct` claim values (e.g. `["mandate.checkout.1", …]`). */
  vct_claims: string[];
  /** Supported presence modes (`["human_present", "human_not_present"]`). */
  presence_modes: string[];
  /** Accepted `cnf` key-binding forms (`["jwk", "did"]`). */
  cnf_forms: string[];
  /** How each `cnf` form is enforced, keyed by form. */
  cnf_enforcement: Record<string, unknown>;
  /** Ceilings applied during mandate-pair validation, outermost first. */
  ceilings: string[];
  /** Stripe SPT ceiling trigger, checks, and resolver. */
  spt_enforcement: Record<string, unknown>;
  /** On-chain escrow ceiling trigger, checks, and selectors. */
  escrow_enforcement: Record<string, unknown>;
  /** Agent-bond violation reporting flow and recognized violation kinds. */
  agent_bond_enforcement: Record<string, unknown>;
  /** Tenzro-specific mandate fields layered on top of AP2. */
  tenzro_extensions: Record<string, unknown>;
}

/**
 * Client for the AP2 (Agentic Payment Protocol).
 * Enables agents to establish payment sessions with providers,
 * authorize individual payments, and manage session lifecycle.
 */
export interface Ap2MandateRecord {
  mandate_id: string;
  payment_mandate_id: string;
  controller_did: string;
  agent_did: string;
  merchant_did: string;
  description: string;
  /** Per-mandate spend ceiling as a decimal string. */
  max_amount: string;
  /** Payment total as a decimal string. */
  total_amount: string;
  asset: string;
  chain: string;
  expires_at: number;
  delegation_enforced: boolean;
  validated_at_ms: number;
  checkout_vdc: unknown;
  payment_vdc: unknown;
}

export interface Ap2MandateList {
  controller_did: string;
  count: number;
  mandates: Ap2MandateRecord[];
}

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

  // ─── AP2 Mandate Signing + Verification (Google AP2 spec) ──────────────

  /**
   * Sign an AP2 Checkout or Payment mandate via the auth-bound wallet's
   * Ed25519 key. The node builds the canonical AP2 v0.2 preimage internally
   * and signs with `WalletService` — the caller never sees raw key material.
   * The returned Vdc self-verifies before being returned.
   *
   * Auth: DPoP+JWT mandatory. The wallet must be Ed25519. `signerDid` MUST
   * match the controller of the auth-bound wallet (principal for checkout,
   * agent for payment).
   *
   * @param mandateKind - `"checkout"` or `"payment"`.
   * @param mandate - The full CheckoutMandate or PaymentMandate JSON.
   * @param signerDid - Signer DID (principal for checkout, agent for payment).
   */
  async signMandate(
    mandateKind: 'checkout' | 'payment',
    mandate: unknown,
    signerDid: string,
  ): Promise<unknown> {
    return this.rpc.call<unknown>('tenzro_ap2SignMandate', [
      {
        mandate_kind: mandateKind,
        mandate,
        signer_did: signerDid,
      },
    ]);
  }

  /**
   * Verify a single AP2 mandate (Verifiable Digital Credential).
   *
   * Checks the VDC proof, issuer, and schema for Checkout and Payment
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
   * Validate an AP2 Checkout+Payment mandate pair for consistency.
   *
   * Ensures the payment mandate references the checkout mandate,
   * amounts/items match the checkout constraints, and both VDCs verify.
   * When `enforceDelegation` is true, additionally cross-checks the agent's
   * TDIP `DelegationScope` against the checkout total via
   * `IdentityRegistry::enforce_operation(agent_did, "payment", total)`. Both
   * layers must admit the checkout.
   *
   * @param checkoutVdc - The principal-signed CheckoutMandate VDC.
   * @param paymentVdc - The agent-signed PaymentMandate VDC.
   * @param enforceDelegation - If true, run the TDIP delegation gate after
   *   AP2 validation succeeds. Defaults to false (AP2-only).
   */
  async validateMandatePair(
    checkoutVdc: unknown,
    paymentVdc: unknown,
    enforceDelegation: boolean = false
  ): Promise<Ap2MandatePairValidation> {
    return this.rpc.call<Ap2MandatePairValidation>(
      'tenzro_ap2ValidateMandatePair',
      [{
        checkout_vdc: checkoutVdc,
        payment_vdc: paymentVdc,
        enforce_delegation: enforceDelegation,
      }]
    );
  }

  /**
   * Return AP2 protocol metadata (version, mandate kinds, presence modes,
   * key-binding forms, and the ceilings applied during validation).
   */
  async protocolInfo(): Promise<Ap2ProtocolInfo> {
    return this.rpc.call<Ap2ProtocolInfo>('tenzro_ap2ProtocolInfo', []);
  }

  /**
   * Lists the persisted AP2 mandates authorized by a controller DID. Each
   * record captures the validated checkout/payment pair — amounts, asset, chain,
   * merchant, expiry, and the stored checkout/payment VDCs.
   */
  async listMandates(controllerDid: string): Promise<Ap2MandateList> {
    return this.rpc.call<Ap2MandateList>('tenzro_listMandates', [
      { controller_did: controllerDid },
    ]);
  }
}
