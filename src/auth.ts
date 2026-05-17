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
   * Exchange a long-lived refresh token for a fresh access token. Mirrors
   * OAuth 2.1 `grant_type=refresh_token`. Refresh tokens are opaque UUIDs
   * with a 30-day TTL; access tokens are HS256 JWTs with a 1-hour TTL.
   *
   * If `dpopJkt` is supplied, the new access token is DPoP-bound to that
   * thumbprint. The refresh token itself is **not** rotated in V1.
   */
  async refreshToken(
    refreshToken: string,
    dpopJkt?: string
  ): Promise<RefreshedToken> {
    const params: Record<string, unknown> = { refresh_token: refreshToken };
    if (dpopJkt) params.dpop_jkt = dpopJkt;
    return this.rpc.call<RefreshedToken>("tenzro_refreshToken", params);
  }

  /**
   * Mint a fresh access + refresh token pair against an existing MPC
   * wallet. Useful when the holder already provisioned a wallet via
   * `tenzro_createWallet` and now wants OAuth-style auth credentials
   * without re-running the full onboarding flow.
   *
   * Returns the same shape as the three onboard variants —
   * {@link OnboardSession} — so it slots into existing session-management
   * code.
   */
  async linkWalletForAuth(
    walletId: string,
    options?: {
      dpopJkt?: string;
      displayName?: string;
      ttlSecs?: number;
    }
  ): Promise<OnboardSession> {
    const params: Record<string, unknown> = { wallet_id: walletId };
    if (options?.dpopJkt) params.dpop_jkt = options.dpopJkt;
    if (options?.displayName) params.display_name = options.displayName;
    if (options?.ttlSecs) params.ttl_secs = options.ttlSecs;
    return this.rpc.call<OnboardSession>(
      "tenzro_linkWalletForAuth",
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
   * TDIP/GDPR Article 17 right-to-erasure. Hard-deletes a previously
   * revoked identity from the registry and persistent storage.
   *
   * The identity MUST already be `Revoked` — call {@link revokeDid} first,
   * allow the cascading revocation broadcaster to propagate, and then
   * call this. Distinct from `revokeDid` which is a logical delete.
   */
  async forgetIdentity(did: string): Promise<{ did: string; status: string; note: string }> {
    return this.rpc.call("tenzro_forgetIdentity", { did });
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

  /**
   * Fetch a single approval record by id. The engine lazy-transitions
   * an expired `Pending` record to `Expired` on this read path, so a
   * returned `Pending` record is guaranteed to still be live. Returns
   * JSON-RPC `-32000` if the id is unknown.
   */
  async getApproval(approvalId: string): Promise<ApprovalRecord> {
    return this.rpc.call<ApprovalRecord>("tenzro_getApproval", {
      approval_id: approvalId,
    });
  }

  /**
   * **RFC 8693 OAuth 2.0 Token Exchange.** Exchange a parent JWT for a
   * narrower child JWT bound to a different DPoP key, with a strictly
   * subset of the parent's RAR grants and AAP capabilities. The child
   * token's `controller_did` is set to the parent's `sub`, extending the
   * act-chain by one hop.
   *
   * Subset enforcement is performed by the AS — `requestedRar` and
   * `requestedAapCapabilities` must be a strict subset of what the parent
   * already holds. Anything outside the parent's authority is rejected
   * with JSON-RPC error code `-32002`.
   *
   * @param subjectToken - the parent JWT (validated for signature, exp,
   *   and revocation by the AS)
   * @param childBearerDid - DID that will be the `sub` of the child JWT
   * @param childDpopJkt - RFC 7638 JWK thumbprint of the child holder's
   *   Ed25519 public key. The child token will be DPoP-bound to it.
   * @param requestedRar - typed scope envelope (RFC 9396) the child should
   *   carry. Must be a subset of the parent's `authorization_details`.
   * @param requestedAapCapabilities - AAP `aap_capabilities` claim list.
   *   Must be a subset of the parent's capabilities.
   * @param requestedTtlSecs - optional override; clamped to the engine's
   *   `max_ttl_secs` and parent's remaining lifetime.
   */
  async exchangeToken(
    subjectToken: string,
    childBearerDid: string,
    childDpopJkt: string,
    requestedRar: unknown,
    requestedAapCapabilities: unknown[],
    requestedTtlSecs?: number
  ): Promise<TokenExchangeResult> {
    const params: Record<string, unknown> = {
      subject_token: subjectToken,
      child_bearer_did: childBearerDid,
      child_dpop_jkt: childDpopJkt,
      requested_rar: requestedRar,
      requested_aap_capabilities: requestedAapCapabilities,
    };
    if (requestedTtlSecs !== undefined) {
      params.requested_ttl_secs = requestedTtlSecs;
    }
    return this.rpc.call<TokenExchangeResult>("tenzro_exchangeToken", params);
  }

  /**
   * **RFC 7662 OAuth 2.0 Token Introspection.** Ask the AS whether a
   * token is currently active and, if so, return its full claim set
   * (RAR, AAP, cnf, controller_did, etc.). Per RFC 7662 §2.2 a failed
   * validation returns `{ active: false }` with no other fields — the AS
   * deliberately does not leak why the token is inactive.
   *
   * Use this from a downstream resource server that wants to validate a
   * bearer token without re-implementing JWT signature checking.
   */
  async introspectToken(token: string): Promise<IntrospectionResult> {
    return this.rpc.call<IntrospectionResult>("tenzro_introspectToken", {
      token,
    });
  }

  /**
   * **RFC 8414 / RFC 9728 OAuth Authorization Server / Protected Resource
   * Metadata.** Returns the same metadata document the AS publishes at
   * `GET /.well-known/openid-configuration`. Useful for JSON-RPC-only
   * clients (CLI, agents) that don't want to also speak HTTP discovery.
   */
  async oauthDiscovery(): Promise<OAuthDiscovery> {
    return this.rpc.call<OAuthDiscovery>("tenzro_oauthDiscovery", []);
  }
}

/**
 * One of the three onboarding RPCs (or `linkWalletForAuth`) returns this
 * session bundle.
 */
export interface OnboardSession {
  /** Provisioned TDIP identity record. */
  identity: unknown;
  /** Provisioned MPC wallet record (id + address). */
  wallet: unknown;
  /**
   * OAuth 2.1 access token (HS256 JWT, optionally DPoP-bound). Send as
   * `Authorization: Bearer <token>` on subsequent privileged calls. When
   * DPoP-bound, also send a fresh `DPoP: <proof>` header.
   */
  access_token: string;
  /** Always `"Bearer"` (RFC 6750 token type, even though DPoP-bound). */
  token_type?: string;
  /** Access-token lifetime in seconds (default 3600). */
  expires_in?: number;
  /**
   * Long-lived refresh token (opaque UUID, 30-day TTL). Exchange via
   * {@link AuthClient.refreshToken} when the access token expires. Treat
   * as a secret — leakage allows minting access tokens until revocation.
   */
  refresh_token?: string;
  /** Refresh-token lifetime in seconds (default 30 days). */
  refresh_token_expires_in?: number;
  /** `true` iff the access token requires a DPoP proof on every call. */
  dpop_bound?: boolean;
  /**
   * RFC 9396 Rich Authorization Request payload echoed back, describing
   * the act-chain and capabilities the token is authorized for.
   */
  authorization_details?: unknown;
}

/**
 * Result of {@link AuthClient.refreshToken}. The refresh token is **not**
 * rotated in V1 — only the access token changes.
 */
export interface RefreshedToken {
  /** New access-token JWT. */
  access_token: string;
  /** Always `"Bearer"`. */
  token_type?: string;
  /** Access-token lifetime in seconds. */
  expires_in?: number;
  /**
   * `true` iff the new access token is DPoP-bound (i.e., the request
   * supplied `dpopJkt` and the engine encoded a `cnf.jkt` claim).
   */
  dpop_bound?: boolean;
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

/**
 * Result of `getApproval` — a single approval record. Matches the wire
 * shape produced by `approval_to_json` in `tenzro-node`.
 */
export interface ApprovalRecord {
  /** Engine-assigned unique identifier for this approval. */
  approval_id?: string;
  /** DID that initiated the request and is waiting on a decision. */
  requester_did?: string;
  /** DID that must approve or deny the request. */
  approver_did?: string;
  /** Creation time (Unix epoch, ms). */
  created_at_ms?: number;
  /**
   * Hard expiry — past this point the engine lazy-transitions the
   * record to `Expired` on the next read.
   */
  expires_at_ms?: number;
  /**
   * Lifecycle state as a debug-printed enum string
   * (`"Pending"` / `"Approved"` / `"Denied"` / `"Expired"`).
   */
  status?: string;
  /** Decision timestamp (Unix epoch, ms). `null`/absent while pending. */
  decided_at_ms?: number | null;
  /** Short human-readable summary of the request. */
  summary?: string;
  /** Action identifier (free-form, e.g. `"wallet.transfer"`). */
  action?: string;
}

/**
 * Result of {@link AuthClient.exchangeToken} — the issued child JWT and
 * its delegation envelope per RFC 8693 §2.2.
 */
export interface TokenExchangeResult {
  /** The newly-issued child JWT (HS256, DPoP-bound to `child_dpop_jkt`). */
  access_token: string;
  /** Lifetime of the child token in seconds. */
  expires_in: number;
  /** Always `"DPoP"` — child tokens are always DPoP-bound (RFC 9449). */
  token_type: string;
  /**
   * Always `"urn:ietf:params:oauth:token-type:jwt"` — the format of the
   * issued token (RFC 8693 §2.2).
   */
  issued_token_type: string;
  /**
   * Echo of the delegation envelope: `{ controller_did, depth, … }`. The
   * exact shape is defined by `tenzro_auth::TokenExchangeOutcome` — kept
   * as opaque JSON in the SDK to avoid recapitulating every AAP claim
   * type.
   */
  delegation: unknown;
}

/**
 * Result of {@link AuthClient.introspectToken} — the RFC 7662 §2.2
 * introspection response. When `active` is `false`, all other fields are
 * absent (the AS does not leak why the token is inactive).
 *
 * The full claim set (RAR `authorization_details`, AAP `aap_*` claims,
 * `cnf`, `controller_did`, etc.) is returned as flat JSON properties to
 * keep the SDK decoupled from `tenzro-auth` internals — callers that
 * need typed access can narrow the fields themselves.
 */
export interface IntrospectionResult {
  /**
   * `true` iff the token validates and its controller chain is not
   * revoked.
   */
  active: boolean;
  /** Subject — bearer DID. Present iff `active`. */
  sub?: string;
  /** Issuer — node DID. Present iff `active`. */
  iss?: string;
  /** Audience — typically the resource server URL. Present iff `active`. */
  aud?: string;
  /** Issued-at, Unix seconds. Present iff `active`. */
  iat?: number;
  /** Not-before, Unix seconds. Present iff `active`. */
  nbf?: number;
  /** Expires-at, Unix seconds. Present iff `active`. */
  exp?: number;
  /** JWT id. Present iff `active`. */
  jti?: string;
  /** `"DPoP"` for tokens with a `cnf.jkt`; absent otherwise. */
  token_type?: string;
  /**
   * RFC 7800 confirmation claim — `{ jkt: "<thumbprint>" }` for
   * DPoP-bound tokens.
   */
  cnf?: { jkt: string };
  /** The authorizing DID (parent of `sub` in the act-chain). */
  controller_did?: string;
  /** RFC 9396 typed scope envelope. */
  authorization_details?: unknown;
  /** AAP claims — present only when set on the token. */
  aap_agent?: unknown;
  aap_task?: unknown;
  aap_capabilities?: unknown;
  aap_oversight?: unknown;
  aap_delegation?: unknown;
  aap_context?: unknown;
  aap_audit?: unknown;
}

/**
 * Result of {@link AuthClient.oauthDiscovery} — the OAuth 2.0
 * authorization-server metadata document (RFC 8414) augmented with the
 * AAP-specific extensions.
 *
 * Mirrors the document published at
 * `GET /.well-known/openid-configuration` on the AS.
 */
export interface OAuthDiscovery {
  /** Issuer DID — typically `did:tenzro:node:<node_id>`. */
  issuer: string;
  /**
   * `POST` endpoint for authorization-code, refresh-token, and
   * token-exchange grants.
   */
  token_endpoint: string;
  /** `POST` endpoint for RFC 7662 token introspection. */
  introspection_endpoint: string;
  /** `POST` endpoint for RFC 7009 token revocation. */
  revocation_endpoint: string;
  /**
   * All grant types the AS accepts. Includes
   * `urn:ietf:params:oauth:grant-type:token-exchange`,
   * `authorization_code`, and `refresh_token`.
   */
  grant_types_supported: string[];
  /**
   * Authentication methods at the token endpoint (`"none"` for public
   * clients, `"private_key_jwt"`).
   */
  token_endpoint_auth_methods_supported: string[];
  /** Authorization-code response types — currently `["code"]`. */
  response_types_supported: string[];
  /**
   * DPoP signing algorithms accepted on proofs — currently `["EdDSA"]`
   * (Ed25519 per RFC 8037).
   */
  dpop_signing_alg_values_supported: string[];
  /**
   * RFC 9396 RAR `type` values the AS recognises: `transfer`,
   * `create_escrow`, `discharge_escrow`, `inference`, `stake`, `vote`,
   * `contract`, `register_identity`.
   */
  authorization_details_types_supported: string[];
  /**
   * AAP claim names the AS issues — `aap_agent`, `aap_task`,
   * `aap_capabilities`, `aap_oversight`, `aap_delegation`, `aap_context`,
   * `aap_audit`.
   */
  aap_claims_supported: string[];
}
