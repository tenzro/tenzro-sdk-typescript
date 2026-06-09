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
  ml_dsa_signature_hex?: string;
}

export interface SignWithPasskeyResponse {
  verified: boolean;
  validator: string;
  op_hash_hex: string;
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
}
