import type { RpcClient } from './rpc';

// ── Types ──

/** MPC threshold wallet information. */
export interface MpcWallet {
  /** Wallet identifier */
  wallet_id: string;
  /** Wallet address (hex) */
  address: string;
  /** Signing threshold (e.g., 2) */
  threshold: number;
  /** Total number of key shares (e.g., 3) */
  total_shares: number;
}

/** Encrypted keystore export. */
export interface EncryptedKeystore {
  /** Encrypted keystore data (JSON string) */
  encrypted: string;
  /** Key derivation function used ("argon2id") */
  kdf: string;
  /** Cipher used ("aes-256-gcm") */
  cipher: string;
}

/** Key share metadata (not the actual share material). */
export interface KeyShare {
  /** Share index (1-based) */
  index: number;
  /** When this share was created */
  created_at: string;
}

/** Result of a key rotation operation. */
export interface RotationResult {
  /** Whether the rotation succeeded */
  success: boolean;
  /** Number of shares rotated */
  shares_rotated: number;
  /** New rotation epoch */
  epoch: number;
}

/** Wallet spending policy. */
export interface SpendingPolicy {
  /** Maximum daily spending (in smallest unit, as string for BigInt support) */
  daily_limit: string;
  /** Maximum per-transaction spending (in smallest unit, as string) */
  per_tx_limit: string;
  /** Amount already spent today (in smallest unit, as string) */
  daily_spent: string;
}

/** Scoped session key for temporary wallet access. */
export interface SessionKey {
  /** Session key identifier */
  session_id: string;
  /** When the session expires (ISO 8601) */
  expires_at: string;
  /** Allowed operations */
  operations: string[];
}

export interface RevokedSession {
  /** Revoked session identifier */
  session_id: string;
  /** Terminal status — always `"revoked"`. */
  status: string;
}

// ── Client ──

/**
 * Client for key custody and wallet security operations.
 *
 * Provides MPC wallet creation, keystore management, key rotation,
 * spending policies, and session key authorization.
 */
export class CustodyClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a new MPC threshold wallet.
   * @param threshold - Minimum number of shares required to sign
   * @param totalShares - Total number of key shares
   * @param keyType - "ed25519" or "secp256k1"
   */
  async createMpcWallet(
    threshold: number,
    totalShares: number,
    keyType: 'ed25519' | 'secp256k1',
  ): Promise<MpcWallet> {
    return this.rpc.call<MpcWallet>('tenzro_createMpcWallet', [
      { threshold, total_shares: totalShares, key_type: keyType },
    ]);
  }

  /**
   * Export an encrypted keystore (Argon2id + AES-256-GCM).
   * @param walletId - Wallet identifier
   * @param password - Password to encrypt the keystore
   */
  async exportKeystore(walletId: string, password: string): Promise<EncryptedKeystore> {
    return this.rpc.call<EncryptedKeystore>('tenzro_exportKeystore', [
      { wallet_id: walletId, password },
    ]);
  }

  /**
   * Import a wallet from an encrypted keystore.
   * @param keystore - Encrypted keystore JSON string
   * @param password - Password to decrypt the keystore
   */
  async importKeystore(keystore: string, password: string): Promise<MpcWallet> {
    return this.rpc.call<MpcWallet>('tenzro_importKeystore', [{ keystore, password }]);
  }

  /**
   * Get key share metadata (not the actual shares).
   * @param walletId - Wallet identifier
   */
  async getKeyShares(walletId: string): Promise<KeyShare[]> {
    return this.rpc.call<KeyShare[]>('tenzro_getKeyShares', [{ wallet_id: walletId }]);
  }

  /**
   * Rotate MPC key shares (same public key, new shares).
   * @param walletId - Wallet identifier
   */
  async rotateKeys(walletId: string): Promise<RotationResult> {
    return this.rpc.call<RotationResult>('tenzro_rotateKeys', [{ wallet_id: walletId }]);
  }

  /**
   * Set spending limits for a wallet.
   * @param walletId - Wallet identifier
   * @param dailyLimit - Maximum daily spending (in smallest unit)
   * @param perTxLimit - Maximum per-transaction spending
   */
  async setSpendingLimits(
    walletId: string,
    dailyLimit: bigint,
    perTxLimit: bigint,
  ): Promise<SpendingPolicy> {
    return this.rpc.call<SpendingPolicy>('tenzro_setSpendingLimits', [
      {
        wallet_id: walletId,
        daily_limit: dailyLimit.toString(),
        per_tx_limit: perTxLimit.toString(),
      },
    ]);
  }

  /**
   * Get current spending limits for a wallet.
   * @param walletId - Wallet identifier
   */
  async getSpendingLimits(walletId: string): Promise<SpendingPolicy> {
    return this.rpc.call<SpendingPolicy>('tenzro_getSpendingLimits', [
      { wallet_id: walletId },
    ]);
  }

  /**
   * Create a session key with scoped permissions.
   * @param walletId - Wallet identifier
   * @param didEnvelope - Hex envelope proving control of the DID that owns
   *   `walletId`, bound to method `tenzro_authorizeSession` with the wallet id
   *   as the params hash. The node resolves the owner through the identity
   *   registry; a wallet id names the subject and proves nothing about the
   *   caller.
   * @param durationSecs - Session validity duration in seconds
   * @param operations - Allowed operations (e.g., "transfer", "stake")
   */
  async authorizeSession(
    walletId: string,
    didEnvelope: string,
    durationSecs: number,
    operations: string[],
  ): Promise<SessionKey> {
    return this.rpc.call<SessionKey>('tenzro_authorizeSession', [
      {
        wallet_id: walletId,
        did_envelope: didEnvelope,
        duration_secs: durationSecs,
        operations,
      },
    ]);
  }

  /**
   * Revoke an authorized session before its natural expiry.
   * @param sessionId - The `session_id` returned by {@link authorizeSession}
   * @param didEnvelope - Hex envelope proving control of the DID that owns
   *   the session's wallet, bound to method `tenzro_revokeSession` with the
   *   `sessionId` bytes as the params hash. A session id is a handle the node
   *   hands back, not a credential.
   */
  async revokeSession(
    sessionId: string,
    didEnvelope: string,
  ): Promise<RevokedSession> {
    return this.rpc.call<RevokedSession>('tenzro_revokeSession', [
      { session_id: sessionId, did_envelope: didEnvelope },
    ]);
  }

  // ── ML-DSA-65 (FIPS 204) — post-quantum wallet signing surface ──
  //
  // These methods call the `/wallet/mldsa/*` Web API endpoints (not
  // JSON-RPC). Each call requires a caller-supplied DPoP-bound JWT and
  // a fresh DPoP proof signed over `(method, htu)`. The proof is opaque
  // to the SDK — the wallet kernel constructs it.

  /**
   * Discover the node's ML-DSA-65 signing mode.
   *
   * Always `tee-only` on testnet. The wallet uses this to decide
   * whether to invoke threshold-coordination methods (skipped in
   * `tee-only`) or fall through to the single-shot {@link mldsaSign}.
   *
   * Required AAP capability: `wallet.mldsa.sign`.
   */
  async mldsaCapabilities(
    bearerJwt: string,
    dpopProof: string,
  ): Promise<MlDsaCapabilities> {
    return this.rpc.getWithAuth<MlDsaCapabilities>(
      '/wallet/mldsa/capabilities',
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Sign a preimage with the node-held ML-DSA-65 key bound to
   * `(did, surfaceKey)`. The returned signature is 3309 bytes per
   * FIPS 204 §4 Table 2.
   *
   * Required AAP capability: `wallet.mldsa.sign`.
   *
   * @param bearerJwt - DPoP-bound bearer JWT.
   * @param dpopProof - Fresh DPoP proof signed over `(POST, "<base>/wallet/mldsa/sign")`.
   * @param did - Bearer DID owning the surface key.
   * @param surfaceKey - Wallet-defined surface identifier (e.g. `"vault.0"`).
   * @param preimage - Raw bytes to be signed (encoded base64url no-pad on the wire).
   * @param purpose - Optional caller-supplied purpose string for audit logging.
   */
  async mldsaSign(
    bearerJwt: string,
    dpopProof: string,
    did: string,
    surfaceKey: string,
    preimage: Uint8Array,
    purpose?: string,
  ): Promise<MlDsaSignature> {
    return this.rpc.postWithAuth<MlDsaSignature>(
      '/wallet/mldsa/sign',
      {
        did,
        surface_key: surfaceKey,
        preimage_b64: base64UrlNoPadEncode(preimage),
        purpose,
      },
      bearerJwt,
      dpopProof,
    );
  }

  // ── FROST (RFC 9591) — threshold Schnorr signing surface ──
  //
  // Per-curve `:scheme` path dispatch (`ed25519` | `secp256k1`). The
  // node holds one share, the wallet holds the other (2-of-2). The
  // wallet drives the protocol; the node is purely reactive. Each call
  // is gated by AAP capability `wallet.frost.sign` and requires a
  // fresh DPoP proof bound to the request's `(method, htu)`.
  //
  // Wire bytes (`*_b64` fields) are the FROST crate's canonical
  // `.serialize()` of the corresponding round structure.

  /**
   * Start a FROST signing session.
   *
   * Server allocates a session, runs Round 1, and returns its
   * commitments together with both participant identifiers. The
   * wallet then runs its own Round 1 against the same `preimage`
   * and the returned identifiers, and submits its commitments via
   * {@link frostCommit}.
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostStart(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    did: string,
    surfaceKey: string,
    preimage: Uint8Array,
  ): Promise<FrostStartResponse> {
    return this.rpc.postWithAuth<FrostStartResponse>(
      `/wallet/frost/${scheme}/start`,
      {
        did,
        surface_key: surfaceKey,
        preimage_b64: base64UrlNoPadEncode(preimage),
      },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Submit the wallet's Round 1 commitments.
   *
   * Transitions the session from `pending` to `committed`. After this
   * call the wallet should call {@link frostAwaitChallenge} to receive
   * the `SigningPackage` it must feed into the FROST crate's
   * `round2::sign`.
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostCommit(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    sessionId: string,
    deviceCommitments: Uint8Array,
  ): Promise<FrostStateResponse> {
    return this.rpc.postWithAuth<FrostStateResponse>(
      `/wallet/frost/${scheme}/commit`,
      {
        session_id: sessionId,
        device_commitments_b64: base64UrlNoPadEncode(deviceCommitments),
      },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Long-poll for the challenge (`SigningPackage`).
   *
   * Returns immediately if the session is already `committed`. Polls
   * for up to ~5s otherwise. The wallet feeds `signing_package_b64`
   * into `round2::sign(signing_package, signer_nonces, key_package)`
   * to produce its signature share.
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostAwaitChallenge(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    sessionId: string,
  ): Promise<FrostChallengeResponse> {
    return this.rpc.postWithAuth<FrostChallengeResponse>(
      `/wallet/frost/${scheme}/await-challenge`,
      { session_id: sessionId },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Submit the wallet's Round 2 signature share.
   *
   * Server runs its own Round 2, aggregates the two shares, and
   * transitions the session to `finalized`. The aggregated signature
   * is then retrievable via {@link frostFinalize}.
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostRespond(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    sessionId: string,
    deviceSignatureShare: Uint8Array,
  ): Promise<FrostStateResponse> {
    return this.rpc.postWithAuth<FrostStateResponse>(
      `/wallet/frost/${scheme}/respond`,
      {
        session_id: sessionId,
        device_signature_share_b64: base64UrlNoPadEncode(deviceSignatureShare),
      },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Long-poll for the aggregated signature.
   *
   * Returns immediately if the session is already `finalized`. Polls
   * for up to ~5s otherwise. `signature_b64` is the canonical Schnorr
   * signature: 64 bytes for Ed25519, 65 for secp256k1 (Taproot).
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostFinalize(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    sessionId: string,
  ): Promise<FrostFinalizeResponse> {
    return this.rpc.postWithAuth<FrostFinalizeResponse>(
      `/wallet/frost/${scheme}/finalize`,
      { session_id: sessionId },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Abort an in-flight FROST session.
   *
   * Idempotent: an already-aborted session returns `aborted`. A
   * session that has already finalized stays `finalized` (the abort
   * is a no-op rather than an error).
   *
   * Required AAP capability: `wallet.frost.sign`.
   */
  async frostAbort(
    bearerJwt: string,
    dpopProof: string,
    scheme: FrostScheme,
    sessionId: string,
  ): Promise<FrostStateResponse> {
    return this.rpc.postWithAuth<FrostStateResponse>(
      `/wallet/frost/${scheme}/abort`,
      { session_id: sessionId },
      bearerJwt,
      dpopProof,
    );
  }

  // ── Passkey share-unwrap surface (`/wallet/share/*`) ──
  //
  // Three-step flow:
  //   1. shareEnvelope          — fetch the wrapped FROST share blob.
  //   2. shareEscrowChallenge   — mint a single-use 30s nonce.
  //   3. shareEscrowUnwrap      — submit the WebAuthn assertion + nonce
  //                                to receive `(wrapped_share, pepper)`.
  //
  // The pepper is mixed into the wallet's local unwrap KDF; without it
  // the wrapped share is gibberish even to a caller that holds a valid
  // AAP token. All endpoints require capability `wallet.share.unwrap`.

  /**
   * Fetch the wrapped FROST share for `(credentialId, surfaceKey)`.
   *
   * Idempotent — repeated calls return identical bytes for the same
   * pair. The returned blob is useless on its own; the wallet must
   * also obtain the per-assertion pepper via {@link shareEscrowUnwrap}
   * and combine the two through its local KDF to recover the cleartext
   * share.
   *
   * Required AAP capability: `wallet.share.unwrap`.
   */
  async shareEnvelope(
    bearerJwt: string,
    dpopProof: string,
    credentialId: string,
    surfaceKey: string,
  ): Promise<ShareEnvelopeResponse> {
    const path = `/wallet/share/envelope?credential_id=${encodeURIComponent(credentialId)}&surface_key=${encodeURIComponent(surfaceKey)}`;
    return this.rpc.getWithAuth<ShareEnvelopeResponse>(path, bearerJwt, dpopProof);
  }

  /**
   * Mint a single-use, 30-second-TTL nonce for an upcoming WebAuthn
   * ceremony.
   *
   * The wallet must use the returned `nonce_b64` value verbatim as
   * the WebAuthn `challenge` field when prompting the user's passkey.
   * Server-side the nonce is held in an in-memory escrow; it is
   * consumed by {@link shareEscrowUnwrap} regardless of whether the
   * assertion verifies.
   *
   * Required AAP capability: `wallet.share.unwrap`.
   */
  async shareEscrowChallenge(
    bearerJwt: string,
    dpopProof: string,
    credentialId: string,
    surfaceKey: string,
  ): Promise<ShareEscrowChallengeResponse> {
    return this.rpc.postWithAuth<ShareEscrowChallengeResponse>(
      '/wallet/share/escrow/challenge',
      { credential_id: credentialId, surface_key: surfaceKey },
      bearerJwt,
      dpopProof,
    );
  }

  /**
   * Verify a WebAuthn assertion, consume the escrow nonce, and return
   * `(wrapped_share, pepper)`.
   *
   * Single-use: the nonce is removed from the escrow before the
   * assertion is verified, so a successful unwrap cannot be replayed
   * and a failed verification still consumes the nonce. The wallet
   * must request a fresh challenge before retrying.
   *
   * Required AAP capability: `wallet.share.unwrap`.
   */
  async shareEscrowUnwrap(
    bearerJwt: string,
    dpopProof: string,
    credentialId: string,
    surfaceKey: string,
    nonceB64: string,
    assertion: PasskeyAssertion,
  ): Promise<ShareEscrowUnwrapResponse> {
    return this.rpc.postWithAuth<ShareEscrowUnwrapResponse>(
      '/wallet/share/escrow/unwrap',
      {
        credential_id: credentialId,
        surface_key: surfaceKey,
        nonce_b64: nonceB64,
        assertion,
      },
      bearerJwt,
      dpopProof,
    );
  }
}

// ── ML-DSA-65 wire types ──

/** Discovery response from `GET /wallet/mldsa/capabilities`. */
export interface MlDsaCapabilities {
  /** Mode of the ML-DSA-65 signing surface. `"tee-only"` on testnet. */
  mode: string;
}

/** Sign-response from `POST /wallet/mldsa/sign`. */
export interface MlDsaSignature {
  /** 3309-byte ML-DSA-65 signature, base64url no-pad. */
  signature_b64: string;
}

// ── FROST wire types ──

/**
 * FROST signing scheme — selects the curve via the `:scheme` path
 * segment of the `/wallet/frost/:scheme/*` endpoints.
 */
export type FrostScheme = 'ed25519' | 'secp256k1';

/** Session-state discriminator returned by every FROST endpoint. */
export type FrostSessionState = 'pending' | 'committed' | 'finalized' | 'aborted';

/** Response from `POST /wallet/frost/:scheme/start`. */
export interface FrostStartResponse {
  /** Opaque session identifier — pass back into every subsequent call. */
  session_id: string;
  /** Unix-millis at which the session is evicted regardless of state. */
  expires_at_ms: number;
  /** Stable participant identifier the node uses for itself. */
  node_identifier_b64: string;
  /**
   * Stable participant identifier the wallet must use for itself
   * (must match what the node will look up in the `KeyPackage`).
   */
  device_identifier_b64: string;
  /**
   * Node's Round 1 `SigningCommitments`, serialized via the FROST
   * crate's canonical `.serialize()`.
   */
  node_commitments_b64: string;
}

/**
 * Response from FROST endpoints that only carry a state transition
 * (`commit`, `respond`, `abort`).
 */
export interface FrostStateResponse {
  state: FrostSessionState;
}

/** Response from `POST /wallet/frost/:scheme/await-challenge`. */
export interface FrostChallengeResponse {
  state: FrostSessionState;
  /**
   * Present only when `state === 'committed'`. Serialized
   * `SigningPackage` — feed straight into the FROST crate's
   * `round2::sign(signing_package, signer_nonces, key_package)`.
   */
  signing_package_b64?: string;
}

/** Response from `POST /wallet/frost/:scheme/finalize`. */
export interface FrostFinalizeResponse {
  state: FrostSessionState;
  /**
   * Present only when `state === 'finalized'`. The aggregated Schnorr
   * signature: 64 bytes for Ed25519, 65 bytes for secp256k1.
   */
  signature_b64?: string;
}

// ── Passkey share-unwrap wire types ──

/**
 * WebAuthn assertion submitted to `/wallet/share/escrow/unwrap`.
 *
 * All three fields are base64url no-pad. The wallet kernel performs
 * the WebAuthn ceremony (`navigator.credentials.get()`) and forwards
 * the resulting bytes verbatim — the SDK is transport-only and does
 * not parse or validate the assertion.
 */
export interface PasskeyAssertion {
  /** `AuthenticatorAssertionResponse.authenticatorData`. */
  authenticator_data_b64: string;
  /**
   * `AuthenticatorAssertionResponse.clientDataJSON`. The embedded
   * `challenge` field must equal the `nonce_b64` returned by
   * {@link CustodyClient.shareEscrowChallenge}.
   */
  client_data_json_b64: string;
  /**
   * `AuthenticatorAssertionResponse.signature` — Ed25519 (COSE alg
   * `-8`) signature over `authenticatorData || SHA-256(clientDataJSON)`
   * per WebAuthn L3 §7.2.
   */
  signature_b64: string;
}

/** Response from `GET /wallet/share/envelope`. */
export interface ShareEnvelopeResponse {
  /**
   * Wrapped FROST share — AES-256-GCM ciphertext of the cleartext
   * share, AAD-bound to `(credential_id, surface_key)`. Base64url
   * no-pad.
   */
  wrapped_share_b64: string;
  /** Wrap algorithm identifier — `"aes-256-gcm"` on testnet. */
  alg: string;
  /** Salt used by the wallet's local unwrap KDF, base64url no-pad. */
  salt_b64: string;
}

/** Response from `POST /wallet/share/escrow/challenge`. */
export interface ShareEscrowChallengeResponse {
  /**
   * 32-byte random nonce, base64url no-pad. Must be passed verbatim
   * as the WebAuthn `challenge` field.
   */
  nonce_b64: string;
  /** Unix-millis at which the escrow entry is swept (30s TTL). */
  expires_at_ms: number;
}

/** Response from `POST /wallet/share/escrow/unwrap`. */
export interface ShareEscrowUnwrapResponse {
  /**
   * Same wrapped FROST share returned by
   * {@link CustodyClient.shareEnvelope}. Returned again here so a
   * wallet can perform challenge → unwrap in a single round-trip
   * without holding the envelope client-side.
   */
  wrapped_share_b64: string;
  /**
   * Per-assertion entropy mixed into the wallet's local unwrap KDF.
   * Without this value the wrapped share is gibberish even to a
   * caller holding a valid AAP token. Base64url no-pad.
   */
  pepper_b64: string;
}

// ── helpers ──

/**
 * Encode bytes as base64url with no padding (RFC 4648 §5). Used for
 * the `*_b64` fields on the wire format. Implemented locally so the
 * SDK does not pull in a runtime dependency.
 */
function base64UrlNoPadEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in browsers and modern Node (≥16); fall back
  // to a Buffer path on older runtimes.
  const b64 =
    typeof btoa !== 'undefined'
      ? btoa(binary)
      : (globalThis as unknown as { Buffer: { from(s: string, e: string): { toString(e: string): string } } })
          .Buffer.from(binary, 'binary')
          .toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
