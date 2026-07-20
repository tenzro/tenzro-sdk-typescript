/**
 * Passkey-first wallet RPC client.
 *
 * Mirrors `crates/tenzro-node/src/passkey_rpc.rs` 1:1. Use this when you
 * need to talk to a Tenzro node from a browser, Tauri desktop, or Node.js
 * environment. The local-signing side (acquiring a WebAuthn assertion,
 * holding the platform authenticator handle) is covered by
 * [`PasskeyWallet`](./passkey.ts).
 */

import type { RpcClient } from "./rpc";

export interface EnrollPasskeyParams {
  display_name?: string;
  passkey_public_key_hex: string;
  credential_id_hex: string;
  ml_dsa_public_key_hex: string;
  salt?: number;
}

export interface EnrollPasskeyResponse {
  did: string;
  smart_account_address: string;
  credential_id_hex: string;
  webauthn_validator_address: string;
  installed_validators: string[];
}

export interface WebAuthnAssertionJson {
  authenticator_data: number[] | Uint8Array;
  client_data_json: number[] | Uint8Array;
  signature: number[] | Uint8Array;
  user_handle?: number[] | Uint8Array | null;
}

export interface SignWithPasskeyParams {
  account_address: string;
  op_hash_hex: string;
  assertion: WebAuthnAssertionJson;
  /** Hex credential id identifying which enrolled passkey produced the assertion. */
  credential_id_hex: string;
  ml_dsa_signature_hex?: string;
  /**
   * Second-credential leg — required when the account's second-factor
   * policy is `two_credentials`. All three `second_*` fields must be
   * supplied together and must address a different enrolled credential
   * than the primary leg.
   */
  second_assertion?: WebAuthnAssertionJson;
  second_credential_id_hex?: string;
  second_ml_dsa_signature_hex?: string;
}

export interface SignWithPasskeyResponse {
  verified: boolean;
  validator: string;
  op_hash_hex: string;
}

export interface AddPasskeyParams {
  account_address: string;
  new_passkey_public_key_hex: string;
  new_credential_id_hex: string;
  label?: string;
}

export interface AddPasskeyResponse {
  account_address: string;
  credential_id_hex: string;
  credentials_total: number;
  label?: string | null;
}

export interface ListPasskeysResponse {
  account_address: string;
  count: number;
  credential_ids: string[];
}

export interface RemovePasskeyParams {
  account_address: string;
  credential_id_hex: string;
}

export interface RemovePasskeyResponse {
  account_address: string;
  credential_id_hex: string;
  removed: boolean;
  credentials_remaining: number;
}

export type SecondFactorPolicy = "single_credential" | "two_credentials";

export interface SetPasskeyPolicyParams {
  account_address: string;
  second_factor: SecondFactorPolicy;
}

export interface PasskeyPolicyResponse {
  account_address: string;
  second_factor: SecondFactorPolicy;
  required_signatures: number;
  credentials_enrolled: number;
}

export type PasskeySessionKind = "enroll" | "add" | "sign";

export type PasskeySessionStatus =
  | "pending"
  | "in_flight"
  | "completed"
  | "failed"
  | "expired";

export interface CreatePasskeySessionParams {
  kind: PasskeySessionKind;
  /** Enroll: display name for the new identity. */
  display_name?: string;
  /**
   * Enroll: ML-DSA-65 verifying key hex for the hybrid PQ leg. Add sessions
   * omit this — the node mints the new credential's PQ leg itself, so a
   * browser/phone that can only produce a P-256 passkey can still add a device.
   */
  ml_dsa_public_key_hex?: string;
  /** Enroll: CREATE2 salt (defaults to 0). */
  salt?: number;
  /** Add + sign: target smart-account address. */
  account_address?: string;
  /** Add: display label for the new credential. */
  label?: string;
  /** Sign: 32-byte op hash the assertion must attest to. */
  op_hash_hex?: string;
  /** Sign: ML-DSA-65 signature over the op-hash bytes, pre-signed client-side. */
  ml_dsa_signature_hex?: string;
}

export interface CreatePasskeySessionResponse {
  session_id: string;
  /** Path on the node's web API, e.g. `/auth/passkey?session=<id>`. */
  verification_path: string;
  status: PasskeySessionStatus;
  challenge_b64: string;
  expires_at_ms: number;
}

export interface PasskeySessionState {
  session_id: string;
  kind: PasskeySessionKind;
  status: PasskeySessionStatus;
  /** Handler result once `status === "completed"`. */
  result?: Record<string, unknown> | null;
  /** Failure detail once `status === "failed"`. */
  error?: string | null;
  expires_at_ms: number;
}

export interface AddGuardianParams {
  account_address: string;
  guardian_ed25519_pubkey_hex: string;
  guardian_ml_dsa_pubkey_hex: string;
  label?: string;
  threshold?: number;
}

export interface AddGuardianResponse {
  account_address: string;
  guardian_count: number;
  threshold: number;
}

export interface InitiateRecoveryParams {
  account_address: string;
  new_passkey_public_key_hex: string;
  new_credential_id_hex: string;
  new_ml_dsa_public_key_hex: string;
  ttl_secs?: number;
}

export interface InitiateRecoveryResponse {
  recovery_id: string;
  account_address: string;
  recovery_op_hash_hex: string;
  expires_at_ms: number;
  guardians_required: number;
  guardians_total: number;
}

export interface SubmitRecoverySignatureParams {
  recovery_id: string;
  guardian_index: number;
  composite_signature_hex: string;
}

export interface SubmitRecoverySignatureResponse {
  recovery_id: string;
  guardian_signatures_collected: number;
  guardians_required: number;
  quorum_reached: boolean;
}

export interface FinalizeRecoveryParams {
  recovery_id: string;
}

export interface FinalizeRecoveryResponse {
  recovery_id: string;
  account_address: string;
  new_credential_id_hex: string;
  installed_validators: string[];
}

export interface GrantSessionKeyParams {
  account_address: string;
  session_pubkey_hex: string;
  allowed_selectors_hex: string[];
  allowed_targets?: string[];
  max_value_per_call_wei?: string;
  max_total_value_wei?: string;
  valid_after_unix: number;
  valid_until_unix: number;
  label?: string;
}

export interface GrantSessionKeyResponse {
  account_address: string;
  session_pubkey_hex: string;
  valid_after_unix: number;
  valid_until_unix: number;
}

export interface RevokeSessionKeyParams {
  account_address: string;
}

export interface RevokeSessionKeyResponse {
  account_address: string;
  revoked: boolean;
}

export interface SetSpendingLimitParams {
  account_address: string;
  per_tx_cap_wei: string;
  daily_cap_wei: string;
  authenticator_pubkey_hex: string;
}

export interface SetSpendingLimitResponse {
  account_address: string;
  per_tx_cap_wei: string;
  daily_cap_wei: string;
}

export type HardwareDeviceKind =
  | "ledger"
  | "trezor"
  | "gridplus"
  | "yubikey"
  | "generic";

export interface AddHardwareSignerParams {
  account_address: string;
  device_kind: HardwareDeviceKind;
  public_key_hex: string;
  required_always?: boolean;
  required_above_wei?: string;
  label?: string;
}

export interface AddHardwareSignerResponse {
  account_address: string;
  device_kind: string;
  validator_module_address: string;
}

export interface InstalledValidatorSummary {
  module_address: string;
  type_id: number;
  priority: number;
}

export interface SmartAccountSummary {
  address: string;
  owner_hex: string;
  nonce: number;
  is_deployed: boolean;
  installed_validators: InstalledValidatorSummary[];
}

export interface ListSmartAccountsResponse {
  count: number;
  smart_accounts: SmartAccountSummary[];
}

export interface PendingRecoverySummary {
  recovery_id: string;
  created_at_ms: number;
  expires_at_ms: number;
  guardian_signatures_collected: number;
  finalized: boolean;
}

export interface ListPendingRecoveriesResponse {
  account_address: string;
  count: number;
  pending_recoveries: PendingRecoverySummary[];
}

// ---- Threshold-key DKG ----------------------------------------------------

export interface MpcKeygenParams {
  /** This operator's DID; must appear in `participant_dids`. */
  local_did: string;
  /** Every participant DID (the node sorts + dedups canonically). */
  participant_dids: string[];
  threshold: number;
  /** 64-hex finalized block hash — must agree across all parties. */
  finalized_block_hash: string;
  /** 64-hex session nonce — must agree across all parties. */
  session_nonce: string;
  /** DID → libp2p PeerId, one entry per remote participant (fail-closed). */
  peer_bindings: Record<string, string>;
}

export interface MpcKeygenSession {
  instance_id: string;
  /** "running" | "completed" | "failed". */
  status: string;
  local_did: string;
  participant_dids: string[];
  threshold: number;
  total_parties: number;
  local_party_index: number;
  started_at_ms: number;
  finished_at_ms?: number;
  group_id?: string;
  /** SEC1-compressed group public key. */
  group_public_key?: string;
  epoch?: number;
  /** EIP-55 checksummed address derived from the group key. */
  address?: string;
  error?: string;
}

export interface ListMpcKeygenSessionsResponse {
  sessions: MpcKeygenSession[];
}

// ---- Identity / credential lifecycle --------------------------------------

export interface RevokeIdentityParams {
  did: string;
  reason?: string;
  revoked_by?: string;
}

export interface RevokeIdentityResponse {
  did: string;
  status: string;
  affected_jti_count: number;
  /** "revoked" | "not_registered" | "skipped_no_signer" | "skipped_no_registry". */
  identity_registry: string;
  cascade: string;
}

export interface RevokeJwtParams {
  jti: string;
  reason?: string;
}

export interface RevokeJwtResponse {
  jti: string;
  status: string;
  cascade: string;
}

export interface AddTrustedIssuerParams {
  issuer_did: string;
  name?: string;
  topics?: number[];
}

export interface AddTrustedIssuerResponse {
  issuer_did: string;
  name: string;
  topics: number[];
  status: string;
}

/**
 * RPC binding for the passkey-first custody surface on a Tenzro node.
 */
export class PasskeyRpcClient {
  private rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  enroll(params: EnrollPasskeyParams): Promise<EnrollPasskeyResponse> {
    return this.rpc.call("tenzro_enrollPasskey", params as unknown as Record<string, unknown>);
  }

  sign(params: SignWithPasskeyParams): Promise<SignWithPasskeyResponse> {
    return this.rpc.call("tenzro_signWithPasskey", params as unknown as Record<string, unknown>);
  }

  addPasskey(params: AddPasskeyParams): Promise<AddPasskeyResponse> {
    return this.rpc.call("tenzro_addPasskey", params as unknown as Record<string, unknown>);
  }

  listPasskeys(account_address: string): Promise<ListPasskeysResponse> {
    return this.rpc.call("tenzro_listPasskeys", { account_address });
  }

  removePasskey(params: RemovePasskeyParams): Promise<RemovePasskeyResponse> {
    return this.rpc.call("tenzro_removePasskey", params as unknown as Record<string, unknown>);
  }

  /**
   * Set the account's second-factor policy. `two_credentials` requires
   * two distinct enrolled passkeys to co-sign every UserOp; upgrading
   * requires at least two enrolled credentials.
   */
  setPolicy(params: SetPasskeyPolicyParams): Promise<PasskeyPolicyResponse> {
    return this.rpc.call("tenzro_setPasskeyPolicy", params as unknown as Record<string, unknown>);
  }

  getPolicy(account_address: string): Promise<PasskeyPolicyResponse> {
    return this.rpc.call("tenzro_getPasskeyPolicy", { account_address });
  }

  /**
   * Create a pending browser-ceremony session (device-login flow). Open
   * `<web base>` + `verification_path` in a browser, then poll
   * {@link getSession} until the session is terminal.
   */
  createSession(
    params: CreatePasskeySessionParams,
  ): Promise<CreatePasskeySessionResponse> {
    return this.rpc.call("tenzro_createPasskeySession", params as unknown as Record<string, unknown>);
  }

  getSession(session_id: string): Promise<PasskeySessionState> {
    return this.rpc.call("tenzro_getPasskeySession", { session_id });
  }

  addGuardian(params: AddGuardianParams): Promise<AddGuardianResponse> {
    return this.rpc.call("tenzro_addGuardian", params as unknown as Record<string, unknown>);
  }

  initiateRecovery(
    params: InitiateRecoveryParams,
  ): Promise<InitiateRecoveryResponse> {
    return this.rpc.call("tenzro_initiateRecovery", params as unknown as Record<string, unknown>);
  }

  submitRecoverySignature(
    params: SubmitRecoverySignatureParams,
  ): Promise<SubmitRecoverySignatureResponse> {
    return this.rpc.call("tenzro_submitRecoverySignature", params as unknown as Record<string, unknown>);
  }

  finalizeRecovery(
    params: FinalizeRecoveryParams,
  ): Promise<FinalizeRecoveryResponse> {
    return this.rpc.call("tenzro_finalizeRecovery", params as unknown as Record<string, unknown>);
  }

  grantSessionKey(
    params: GrantSessionKeyParams,
  ): Promise<GrantSessionKeyResponse> {
    return this.rpc.call("tenzro_grantSessionKey", params as unknown as Record<string, unknown>);
  }

  revokeSessionKey(
    params: RevokeSessionKeyParams,
  ): Promise<RevokeSessionKeyResponse> {
    return this.rpc.call("tenzro_revokeSessionKey", params as unknown as Record<string, unknown>);
  }

  setSpendingLimit(
    params: SetSpendingLimitParams,
  ): Promise<SetSpendingLimitResponse> {
    return this.rpc.call("tenzro_setSpendingLimit", params as unknown as Record<string, unknown>);
  }

  addHardwareSigner(
    params: AddHardwareSignerParams,
  ): Promise<AddHardwareSignerResponse> {
    return this.rpc.call("tenzro_addHardwareSigner", params as unknown as Record<string, unknown>);
  }

  getSmartAccount(account_address: string): Promise<SmartAccountSummary> {
    return this.rpc.call("tenzro_getSmartAccount", { account_address });
  }

  listSmartAccounts(): Promise<ListSmartAccountsResponse> {
    return this.rpc.call("tenzro_listSmartAccounts", {});
  }

  listPendingRecoveries(
    account_address: string,
  ): Promise<ListPendingRecoveriesResponse> {
    return this.rpc.call("tenzro_listPendingRecoveries", { account_address });
  }

  // ---- Threshold-key DKG (bridge signer establishment) --------------

  /**
   * Start a DKLS23 secp256k1 distributed key generation session. Every
   * participant's operator calls this with identical parameters (the node
   * sorts `participant_dids` canonically) so the derived `instance_id` is
   * byte-identical across parties. Admin-token-gated.
   */
  mpcKeygen(params: MpcKeygenParams): Promise<MpcKeygenSession> {
    return this.rpc.call("tenzro_mpcKeygen", params as unknown as Record<string, unknown>);
  }

  /** Fetch one DKG session by `instance_id`. */
  mpcKeygenStatus(instance_id: string): Promise<MpcKeygenSession> {
    return this.rpc.call("tenzro_mpcKeygenStatus", { instance_id });
  }

  /** List every DKG session known to the node (ordered by start time). */
  listMpcKeygenSessions(): Promise<ListMpcKeygenSessionsResponse> {
    return this.rpc.call("tenzro_mpcKeygenStatus", {});
  }

  // ---- Identity / credential lifecycle ------------------------------

  /**
   * Revoke an entire identity by DID across both the auth act-chain and the
   * TDIP registry, broadcasting the revocation to peers. Admin-token-gated.
   */
  revokeIdentity(params: RevokeIdentityParams): Promise<RevokeIdentityResponse> {
    return this.rpc.call("tenzro_revokeIdentity", params as unknown as Record<string, unknown>);
  }

  /**
   * Revoke a single JWT by its `jti`, cascading to the act-chain transitive
   * closure. Admin-token-gated.
   */
  revokeJwt(params: RevokeJwtParams): Promise<RevokeJwtResponse> {
    return this.rpc.call("tenzro_revokeJwt", params as unknown as Record<string, unknown>);
  }

  /**
   * Register a trusted credential/claim issuer for the given topics.
   * Admin-token-gated.
   */
  addTrustedIssuer(params: AddTrustedIssuerParams): Promise<AddTrustedIssuerResponse> {
    return this.rpc.call("tenzro_addTrustedIssuer", params as unknown as Record<string, unknown>);
  }
}
