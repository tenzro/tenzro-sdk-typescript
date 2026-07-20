/**
 * `/wallet/new/*` — passkey-quorum wallet provisioning.
 *
 * TypeScript binding for the node's four pre-auth Web API routes (port
 * 8080, `api.tenzro.xyz`) that mint a fresh TDIP identity whose signing
 * key is split 2-of-2 between the wallet device (passkey-bound) and the
 * node's TEE leg. No seed phrase is ever produced or transmitted. See
 * `crates/tenzro-node/src/web/wallet_new.rs`.
 *
 * These routes are deliberately pre-auth: the user has no session yet.
 * Consent for the new device is asserted by the WebAuthn attestation
 * embedded in {@link WalletProvisioningClient.finalize} — the
 * `attestation_object` binds the freshly-created passkey to the
 * node-issued `challenge` from `start`. There is no `Authorization`
 * header on these calls.
 *
 * Reply `*_b64` fields are STANDARD base64 (RFC 4648 §4) — decode with
 * `atob`, not the URL-safe variant.
 *
 * ```ts
 * const prov = new WalletProvisioningClient(rpc);
 * const { session_id, challenge_b64, user_handle_b64 } = await prov.start("human");
 * // Drive navigator.credentials.create(...) with the decoded challenge,
 * // then finalize with the resulting attestation.
 * const { identity, wrapped_share } = await prov.finalize(session_id, {
 *   credential_id, attestation_object, client_data_json,
 * });
 * await prov.confirm(session_id);
 * ```
 */

import type { RpcClient } from "./rpc";

/** Identity class requested from `start`. */
export type WalletKind = "human" | "controlled-machine" | "autonomous-machine";

/** Reply from `/wallet/new/start`. */
export interface StartProvisioningResponse {
  /** Opaque session identifier threaded through finalize/confirm/cancel. */
  session_id: string;
  /** WebAuthn challenge — STANDARD base64 (decode with `atob`). */
  challenge_b64: string;
  /** WebAuthn user handle — STANDARD base64. */
  user_handle_b64: string;
  /** Human-readable display name shown in the OS passkey prompt. */
  user_display_name: string;
}

/**
 * WebAuthn enrolment produced by `navigator.credentials.create`. All
 * three fields are base64url (as the browser emits them).
 */
export interface WalletEnrolment {
  /** Credential id — base64url. */
  credential_id: string;
  /** Attestation object — base64url CBOR. */
  attestation_object: string;
  /** clientDataJSON — base64url; its embedded challenge is verified. */
  client_data_json: string;
}

/** The DID parts breakdown returned inside {@link ProvisionedIdentity}. */
export interface ProvisionedDidParts {
  method: string;
  kind: string;
  /** Controller DID for controlled-machine identities. */
  controller?: string;
  uuid: string;
}

/** The minted identity returned from `finalize`. */
export interface ProvisionedIdentity {
  did: string;
  parts: ProvisionedDidParts;
  /** Per-surface public key material, keyed by surface name. */
  keys: Record<string, unknown>;
  created_at: number;
}

/** The 2-of-2 quorum descriptor. */
export interface ProvisioningThreshold {
  k: number;
  n: number;
}

/**
 * The wrapped device share returned from `finalize`. The wallet unwraps
 * this locally with a passkey-derived key (the salt is provided); the
 * node retains the TEE leg.
 */
export interface WrappedDeviceShare {
  credential_id: string;
  /** Wrapped device share — STANDARD base64. */
  wrapped_share_b64: string;
  /** Wrapping algorithm — `aes-256-gcm`. */
  alg: string;
  /** KDF salt for the wallet's local unwrap — STANDARD base64. */
  salt_b64: string;
}

/** Reply from `/wallet/new/finalize`. */
export interface FinalizeProvisioningResponse {
  identity: ProvisionedIdentity;
  threshold: ProvisioningThreshold;
  wrapped_share: WrappedDeviceShare;
}

/**
 * Client for the four `/wallet/new/*` provisioning routes.
 *
 * The routes form a session state machine: `start` → `finalize` →
 * `confirm`, with `cancel` as an idempotent abort. Sessions expire 10
 * minutes after `start`.
 */
export class WalletProvisioningClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Begin provisioning. Returns a session and the WebAuthn challenge the
   * caller feeds to `navigator.credentials.create`.
   */
  async start(kind: WalletKind): Promise<StartProvisioningResponse> {
    return this.rpc.post<StartProvisioningResponse>("/wallet/new/start", {
      kind,
    });
  }

  /**
   * Submit the WebAuthn attestation. The node verifies the embedded
   * challenge, registers the passkey, provisions the 2-of-2 split, and
   * returns the minted identity plus the wrapped device share.
   */
  async finalize(
    sessionId: string,
    enrolment: WalletEnrolment,
  ): Promise<FinalizeProvisioningResponse> {
    return this.rpc.post<FinalizeProvisioningResponse>(
      "/wallet/new/finalize",
      { session_id: sessionId, enrolment },
    );
  }

  /**
   * Confirm the finalized identity, making it live. Returns once the
   * node acknowledges (HTTP 204 → resolves with no value).
   */
  async confirm(sessionId: string): Promise<void> {
    await this.rpc.postNoContent("/wallet/new/confirm", {
      session_id: sessionId,
    });
  }

  /**
   * Abort a provisioning session. Idempotent — cancelling an unknown or
   * already-cancelled session succeeds.
   */
  async cancel(sessionId: string): Promise<void> {
    await this.rpc.postNoContent("/wallet/new/cancel", {
      session_id: sessionId,
    });
  }
}
