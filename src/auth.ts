import { RpcClient } from "./rpc";

/**
 * Client for OAuth 2.1 + DPoP onboarding RPCs.
 *
 * Onboarding uses OAuth 2.1 (RFC 6749 successor) + DPoP-bound JWTs
 * (RFC 9449) + Rich Authorization Requests (RFC 9396). Participants —
 * humans, delegated agents under a human controller, and fully autonomous
 * agents — onboard via the three RPCs exposed here. Each call provisions
 * a TDIP identity (+ MPC wallet) and returns a JWT bound to a
 * holder-supplied DPoP `jkt` (RFC 7638 thumbprint of the holder's
 * Ed25519 public key).
 *
 * Subsequent privileged calls (sign + send transaction, escrow create,
 * release/refund, etc.) authenticate by sending the JWT in the
 * `Authorization: DPoP <jwt>` header alongside a per-request DPoP proof
 * in the `DPoP` header. The SDK forwards both headers automatically when
 * the `TENZRO_BEARER_JWT` and `TENZRO_DPOP_PROOF` environment variables
 * are set in Node — see {@link RpcClient} for the transport-level wiring.
 */
export class AuthClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Onboard a new **human** participant — provisions a TDIP `did:tenzro:human:*`
   * identity, a fresh MPC wallet, and returns an OAuth 2.1 access token.
   *
   * @param displayName - human-readable label surfaced in approver UIs
   * @param dpopJkt - optional RFC 7638 JWK thumbprint of the holder's
   *   Ed25519 public key. If supplied, the issued JWT is DPoP-bound to
   *   that key and every subsequent privileged call must accompany the
   *   bearer with a fresh DPoP proof signed by the same key. Strongly
   *   recommended.
   */
  async onboardHuman(
    displayName: string,
    dpopJkt?: string
  ): Promise<OnboardSession> {
    const params: Record<string, unknown> = { display_name: displayName };
    if (dpopJkt) params.dpop_jkt = dpopJkt;
    return this.rpc.call<OnboardSession>("tenzro_onboardHuman", params);
  }

  /**
   * Onboard a **delegated agent** that acts on behalf of an existing
   * `controllerDid` (typically a human). The agent inherits the
   * controller's act-chain and is bounded by `delegationScope`.
   *
   * Revoking the controller DID via {@link revokeDid} cascades and
   * invalidates this agent's token automatically.
   */
  async onboardDelegatedAgent(
    controllerDid: string,
    capabilities: string[],
    delegationScope: unknown,
    dpopJkt?: string
  ): Promise<OnboardSession> {
    const params: Record<string, unknown> = {
      controller_did: controllerDid,
      capabilities,
      delegation_scope: delegationScope,
    };
    if (dpopJkt) params.dpop_jkt = dpopJkt;
    return this.rpc.call<OnboardSession>(
      "tenzro_onboardDelegatedAgent",
      params
    );
  }

  /**
   * Onboard a **fully autonomous agent**. Unlike a delegated agent, this
   * has no human controller — instead the agent must post a TNZO bond
   * (slashable on misbehaviour) at `bondFundingAddress` before
   * onboarding succeeds.
   */
  async onboardAutonomousAgent(
    bondFundingAddress: string,
    dpopJkt?: string
  ): Promise<OnboardSession> {
    const params: Record<string, unknown> = {
      bond_funding_address: bondFundingAddress,
    };
    if (dpopJkt) params.dpop_jkt = dpopJkt;
    return this.rpc.call<OnboardSession>(
      "tenzro_onboardAutonomousAgent",
      params
    );
  }

  /**
   * Revoke a single JWT by its `jti` claim. The token is added to the
   * engine's revocation set and any subsequent validation fails.
   */
  async revokeJwt(jti: string, reason?: string): Promise<RevokeResponse> {
    return this.rpc.call<RevokeResponse>("tenzro_revokeJwt", {
      jti,
      reason: reason ?? "revoked via SDK",
    });
  }

  /**
   * Revoke an entire identity by DID. Every JWT minted under this DID
   * (and every descendant DID in the act-chain) is invalidated
   * transitively.
   */
  async revokeDid(did: string, reason?: string): Promise<RevokeResponse> {
    return this.rpc.call<RevokeResponse>("tenzro_revokeDid", {
      did,
      reason: reason ?? "revoked via SDK",
    });
  }

  /**
   * List approvals in `Pending` status for the given approver DID.
   * Returns the records the approver should review and decide on.
   */
  async listPendingApprovals(
    approverDid: string
  ): Promise<PendingApprovals> {
    return this.rpc.call<PendingApprovals>("tenzro_listPendingApprovals", {
      approver_did: approverDid,
    });
  }

  /**
   * Decide a pending approval — either `"approved"` or `"denied"`. Only
   * the recorded approver DID may decide; mismatched approvers are
   * rejected with JSON-RPC error code `-32001` (forbidden).
   */
  async decideApproval(
    approvalId: string,
    decision: "approved" | "denied",
    approverDid: string
  ): Promise<ApprovalDecision> {
    return this.rpc.call<ApprovalDecision>("tenzro_decideApproval", {
      approval_id: approvalId,
      decision,
      approver_did: approverDid,
    });
  }
}

/** One of the three onboarding RPCs returns this session bundle. */
export interface OnboardSession {
  /** Provisioned TDIP identity record. */
  identity: unknown;
  /** Provisioned MPC wallet record (id + address). */
  wallet: unknown;
  /**
   * OAuth 2.1 access token (DPoP-bound JWT). Send as
   * `Authorization: DPoP <token>` on subsequent privileged calls.
   */
  access_token: string;
  /** Always `"Bearer"` (RFC 6750 token type, even though DPoP-bound). */
  token_type?: string;
  /** `true` iff the token requires a DPoP proof on every call. */
  dpop_bound?: boolean;
  /** Token lifetime in seconds. */
  expires_in?: number;
}

/** Result of `revokeJwt` / `revokeDid`. */
export interface RevokeResponse {
  /** Engine status string — typically `"revoked"`. */
  status?: string;
  /** Number of JTIs invalidated by this call (>1 indicates cascade). */
  affected_jti_count?: number;
}

/** Result of `listPendingApprovals`. */
export interface PendingApprovals {
  /** Number of pending records returned. */
  count?: number;
  /**
   * The records themselves — opaque JSON to keep the SDK decoupled
   * from `tenzro-auth` storage internals.
   */
  pending?: unknown[];
}

/** Result of `decideApproval`. */
export interface ApprovalDecision {
  /** New status — `"Approved"` or `"Denied"`. */
  status?: string;
  /** Echo of the approval id. */
  approval_id?: string;
}
