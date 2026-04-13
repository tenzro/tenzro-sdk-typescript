import { RpcClient } from "./rpc";
import { IdentityType } from "./types";

/**
 * Client for onboarding key management.
 * Issue, list, revoke, and validate onboarding keys for network participants.
 */
export class AuthClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Issue an onboarding key for a new participant.
   * @param name - Human-readable name for the participant
   * @param did - The DID to associate with the key
   * @param address - The wallet address to associate with the key
   * @param identityType - Optional identity type ("Human" or "Machine")
   * @returns The issued onboarding key
   */
  async issueOnboardingKey(
    name: string,
    did: string,
    address: string,
    identityType?: IdentityType
  ): Promise<OnboardingKey> {
    return this.rpc.call<OnboardingKey>("tenzro_issueOnboardingKey", [
      {
        name,
        did,
        address,
        identity_type: identityType,
      },
    ]);
  }

  /**
   * List all active onboarding keys.
   * @returns Array of onboarding keys that have been issued
   */
  async listOnboardingKeys(): Promise<OnboardingKey[]> {
    return this.rpc.call<OnboardingKey[]>("tenzro_listOnboardingKeys", []);
  }

  /**
   * Revoke an onboarding key by DID or key hash.
   * Once revoked, the key can no longer be used to join the network.
   * @param didOrHash - Either the DID associated with the key, or the key hash
   * @returns Revocation confirmation
   */
  async revokeOnboardingKey(didOrHash: string): Promise<RevokeKeyResponse> {
    return this.rpc.call<RevokeKeyResponse>("tenzro_revokeOnboardingKey", [
      { did_or_hash: didOrHash },
    ]);
  }

  /**
   * Validate an onboarding key.
   * Checks that the key is valid, not expired, and not revoked.
   * @param key - The onboarding key string to validate
   * @returns Validation result with associated DID and address if valid
   */
  async validateOnboardingKey(key: string): Promise<ValidateKeyResponse> {
    return this.rpc.call<ValidateKeyResponse>(
      "tenzro_validateOnboardingKey",
      [{ key }]
    );
  }
}

/** An onboarding key issued to a network participant */
export interface OnboardingKey {
  /** The key string (opaque token) */
  key: string;
  /** Human-readable name for the participant */
  name: string;
  /** The DID associated with this key */
  did: string;
  /** The wallet address associated with this key */
  address: string;
  /** Identity type ("Human" or "Machine") */
  identity_type: string;
  /** Key status ("active", "revoked", "expired") */
  status: string;
  /** ISO-8601 timestamp when the key was issued */
  issued_at: string;
  /** ISO-8601 timestamp when the key expires (if applicable) */
  expires_at?: string;
  /** SHA-256 hash of the key (safe to store/log) */
  key_hash: string;
}

/** Response from revoking an onboarding key */
export interface RevokeKeyResponse {
  /** Whether the key was successfully revoked */
  revoked: boolean;
  /** The DID whose key was revoked */
  did?: string;
  /** Status message */
  message?: string;
}

/** Response from validating an onboarding key */
export interface ValidateKeyResponse {
  /** Whether the key is currently valid */
  valid: boolean;
  /** The DID associated with the key (if valid) */
  did?: string;
  /** The wallet address associated with the key (if valid) */
  address?: string;
  /** Identity type (if valid) */
  identity_type?: string;
  /** Reason the key is invalid (if not valid) */
  reason?: string;
}
