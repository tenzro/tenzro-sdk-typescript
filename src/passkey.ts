/**
 * Passkey wallet — high-level "three-line" composition.
 *
 * TypeScript mirror of `tenzro_sdk::passkey` (Rust). See
 * `docs/SPECIFICATION.md` §15.10.1.
 *
 * ```ts
 * import { createPasskeyWallet, signWithPasskey } from "@tenzro/sdk";
 *
 * const wallet = await createPasskeyWallet({
 *   rpId: "keys.tenzro.xyz",
 * });
 * const sig = await signWithPasskey(wallet, userOp);
 * ```
 *
 * # Where the actual ceremony runs
 *
 * - **Browser:** `navigator.credentials.create/get`. The SDK detects
 *   the browser environment automatically.
 * - **Tauri desktop:** Tauri commands `device_create_passkey` /
 *   `device_sign_passkey` (implemented in
 *   `apps/tenzro-desktop/src-tauri/src/device_key.rs`). Pass a
 *   {@link PlatformAuthenticator} adapter that posts to those
 *   commands via `@tauri-apps/api/core`.
 * - **Headless:** {@link SoftwareP256Authenticator} via Web Crypto
 *   `subtle.generateKey` / `subtle.sign`. Returns `false` from
 *   `isPlatformAuthenticatorAvailable` so production configs reject
 *   it (the safe default).
 *
 * # Cross-device QR (FIDO hybrid / caBLE)
 *
 * When `isPlatformAuthenticatorAvailable()` returns false and the
 * caller used a production config, the SDK throws and recommends
 * {@link startCrossDeviceLink} which returns a QR payload + a
 * promise that resolves once the remote authenticator completes.
 * The actual caBLE wire is implemented by the host adapter; the SDK
 * ships only the surface.
 */

import type {
  PackedUserOperation,
  Signer,
  SignerKind,
  SignerSignature,
  Validator,
} from "./signer";
import { Erc7579ModuleType, SignerError, ValidatorError } from "./signer";
import type { Address } from "./types";

/** Bytes of a registered passkey credential. */
export interface PasskeyCredential {
  /** Authenticator-assigned credential ID (opaque blob). */
  credentialId: Uint8Array;
  /** 64-byte uncompressed P-256 public key (`x || y`, no SEC1 0x04 prefix). */
  publicKey: Uint8Array;
}

/** WebAuthn ceremony configuration. */
export interface PasskeyConfig {
  /** Relying-party ID (registrable domain only — no scheme/path). */
  rpId: string;
  /** Human-readable RP name shown in OS prompts. Defaults to "Tenzro Network". */
  rpName?: string;
  /** Require user verification (biometric/PIN). MUST be `true` in production. */
  requireUserVerification?: boolean;
  /** Require platform authenticator (Touch ID / Face ID / Windows Hello). */
  requirePlatformAuthenticator?: boolean;
}

/** Per-ceremony output from `create`. */
export interface AuthenticatorRegistration {
  credential: PasskeyCredential;
  /** Raw `attestationObject` bytes (CBOR). Empty for `none` attestation. */
  attestationObject: Uint8Array;
}

/** Per-ceremony output from `get` (assertion). */
export interface AuthenticatorAssertion {
  /** 64-byte raw P-256 signature (`r || s`). */
  signature: Uint8Array;
  /** WebAuthn `authenticatorData` blob. */
  authenticatorData: Uint8Array;
  /** Raw `clientDataJSON` bytes. */
  clientDataJson: Uint8Array;
}

/** QR + channel for the FIDO hybrid (caBLE) cross-device flow. */
export interface CrossDeviceLink {
  /** `FIDO:/...` URI — render as QR code. */
  qrUri: string;
  /** Channel ID used to await remote completion. */
  channelId: string;
}

/**
 * Trait every host implements once. Not a class — implementations
 * vary radically (browser vs Tauri vs headless), so we pin only the
 * shape.
 */
export interface PlatformAuthenticator {
  isPlatformAuthenticatorAvailable(): Promise<boolean>;
  createCredential(
    config: ResolvedPasskeyConfig,
    challenge: Uint8Array
  ): Promise<AuthenticatorRegistration>;
  signAssertion(
    config: ResolvedPasskeyConfig,
    credentialId: Uint8Array,
    challenge: Uint8Array
  ): Promise<AuthenticatorAssertion>;
  startCrossDeviceLink(
    config: ResolvedPasskeyConfig
  ): Promise<CrossDeviceLink>;
}

/** {@link PasskeyConfig} after defaults applied. */
export interface ResolvedPasskeyConfig {
  rpId: string;
  rpName: string;
  requireUserVerification: boolean;
  requirePlatformAuthenticator: boolean;
}

/** Production preset: strict UV, platform attachment required. */
export function productionConfig(rpId: string): ResolvedPasskeyConfig {
  return {
    rpId,
    rpName: "Tenzro Network",
    requireUserVerification: true,
    requirePlatformAuthenticator: true,
  };
}

/** Development preset: strict UV, allows cross-platform (YubiKey on Linux). */
export function developmentConfig(rpId: string): ResolvedPasskeyConfig {
  return {
    rpId,
    rpName: "Tenzro Network (dev)",
    requireUserVerification: true,
    requirePlatformAuthenticator: false,
  };
}

function resolveConfig(cfg: PasskeyConfig): ResolvedPasskeyConfig {
  const base =
    cfg.requirePlatformAuthenticator === false
      ? developmentConfig(cfg.rpId)
      : productionConfig(cfg.rpId);
  return {
    rpId: cfg.rpId,
    rpName: cfg.rpName ?? base.rpName,
    requireUserVerification:
      cfg.requireUserVerification ?? base.requireUserVerification,
    requirePlatformAuthenticator:
      cfg.requirePlatformAuthenticator ?? base.requirePlatformAuthenticator,
  };
}

/** {@link Signer} impl that delegates to a {@link PlatformAuthenticator}. */
export class WebAuthnSigner implements Signer {
  constructor(
    private readonly authenticator: PlatformAuthenticator,
    private readonly credentialBytes: PasskeyCredential,
    private readonly config: ResolvedPasskeyConfig
  ) {}

  describe(): SignerKind {
    return { kind: "webauthn", credentialId: this.credentialBytes.credentialId };
  }

  credential(): PasskeyCredential {
    return this.credentialBytes;
  }

  async sign(hash: Uint8Array): Promise<SignerSignature> {
    if (hash.length !== 32) {
      throw new SignerError(
        "authentication-failed",
        `expected 32-byte hash, got ${hash.length}`
      );
    }
    const assertion = await this.authenticator.signAssertion(
      this.config,
      this.credentialBytes.credentialId,
      hash
    );
    // Pack authenticatorData + clientDataJSON into `aux` with 4-byte
    // LE length prefixes — matches the Rust SDK and the on-chain
    // WebAuthnValidator's `validatorData` decoder.
    const aux = packAux(assertion.authenticatorData, assertion.clientDataJson);
    return { bytes: assertion.signature, aux };
  }
}

/** {@link Validator} impl that targets the on-chain `WebAuthnValidator` module. */
export class WebAuthnValidator implements Validator {
  constructor(
    private readonly module: Address,
    private readonly signer: WebAuthnSigner
  ) {}

  moduleAddress(): Address {
    return this.module;
  }

  moduleType(): Erc7579ModuleType {
    return Erc7579ModuleType.Validator;
  }

  async buildValidatorData(userOp: PackedUserOperation): Promise<Uint8Array> {
    let sig: SignerSignature;
    try {
      sig = await this.signer.sign(userOp.opHash);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ValidatorError("assembly-failed", msg);
    }
    // Wire format consumed by `aa_webauthn_validator::WebAuthnValidator`:
    //   sig.bytes (raw 64-byte P-256 sig) || sig.aux (length-prefixed
    //   authenticatorData + clientDataJSON).
    const out = new Uint8Array(sig.bytes.length + sig.aux.length);
    out.set(sig.bytes, 0);
    out.set(sig.aux, sig.bytes.length);
    return out;
  }
}

/** Optional inputs to {@link createPasskeyWallet}. */
export interface PasskeyWalletOptions {
  /** Explicit authenticator; defaults to {@link defaultAuthenticator}. */
  authenticator?: PlatformAuthenticator;
  /**
   * ML-DSA-65 verifying key (FIPS 204, exactly 1952 bytes) that forms
   * the post-quantum leg of the hybrid custody record. The device
   * passkey covers the classical P-256 leg; this covers the PQ leg.
   *
   * ML-DSA-65 is not available in WebCrypto, so the SDK does not
   * generate it — the wallet kernel that holds the PQ secret supplies
   * the verifying key here. When provided, {@link PasskeyWallet.enrollParams}
   * populates `ml_dsa_public_key_hex` so the wallet can drive
   * `PasskeyRpcClient.enroll`. On-chain enrollment refuses a wallet
   * whose PQ leg is absent, so production callers MUST provide it.
   */
  mlDsaPublicKey?: Uint8Array;
}

/** The composed wallet returned by {@link createPasskeyWallet}. */
export interface PasskeyWallet {
  /** Underlying credential — useful for "Touch ID with key XX:..." UI. */
  credential: PasskeyCredential;
  /** Resolved config (post-defaults). */
  config: ResolvedPasskeyConfig;
  /** The {@link Signer} the wallet wraps. */
  signer: WebAuthnSigner;
  /**
   * The ML-DSA-65 verifying key captured at creation, if any. `null`
   * when no PQ leg was supplied (local-only compositions).
   */
  mlDsaPublicKey(): Uint8Array | null;
  /**
   * Assemble the `tenzro_enrollPasskey` parameters from the captured
   * credential + PQ key. Throws if no ML-DSA-65 key was supplied to
   * {@link createPasskeyWallet}, since on-chain enrollment requires the
   * hybrid pair. `salt`/`display_name` are optional passthroughs.
   */
  enrollParams(opts?: {
    displayName?: string;
    salt?: number;
  }): {
    display_name?: string;
    passkey_public_key_hex: string;
    credential_id_hex: string;
    ml_dsa_public_key_hex: string;
    salt?: number;
  };
  /** Bind the on-chain `WebAuthnValidator` module address after bootstrap. */
  bindValidatorModule(address: Address): void;
  /** The currently-bound validator module address, if any. */
  validatorModule(): Address | null;
  /** Render a QR for the cross-device hybrid (caBLE) flow. */
  startCrossDeviceLink(): Promise<CrossDeviceLink>;
}

/**
 * One-shot create. Per Spec §15.10.1 step 1, when no platform
 * authenticator is available the SDK MUST switch to the cross-device
 * flow rather than silently using a software key — this is enforced
 * here.
 *
 * `optionsOrAuthenticator` accepts either a bare {@link PlatformAuthenticator}
 * (back-compat) or a {@link PasskeyWalletOptions} bag carrying both the
 * authenticator and the ML-DSA-65 verifying key for the hybrid PQ leg.
 */
export async function createPasskeyWallet(
  config: PasskeyConfig,
  optionsOrAuthenticator?: PlatformAuthenticator | PasskeyWalletOptions
): Promise<PasskeyWallet> {
  const options: PasskeyWalletOptions =
    optionsOrAuthenticator && "createCredential" in optionsOrAuthenticator
      ? { authenticator: optionsOrAuthenticator }
      : (optionsOrAuthenticator ?? {});

  const resolved = resolveConfig(config);
  const auth = options.authenticator ?? defaultAuthenticator();
  const mlDsaKey = options.mlDsaPublicKey ?? null;
  if (mlDsaKey && mlDsaKey.length !== 1952) {
    throw new SignerError(
      "authentication-failed",
      `ML-DSA-65 verifying key must be exactly 1952 bytes, got ${mlDsaKey.length}`
    );
  }

  if (
    resolved.requirePlatformAuthenticator &&
    !(await auth.isPlatformAuthenticatorAvailable())
  ) {
    throw new SignerError(
      "backend-unavailable",
      "no platform authenticator available — call startCrossDeviceLink to render a QR for the FIDO hybrid (caBLE) flow"
    );
  }

  // 32 random bytes per WebAuthn spec.
  const challenge = randomChallenge();
  const registration = await auth.createCredential(resolved, challenge);
  const signer = new WebAuthnSigner(auth, registration.credential, resolved);

  let validatorModule: Address | null = null;
  const credential = registration.credential;
  return {
    credential,
    config: resolved,
    signer,
    mlDsaPublicKey() {
      return mlDsaKey;
    },
    enrollParams(opts) {
      if (!mlDsaKey) {
        throw new SignerError(
          "authentication-failed",
          "cannot build enroll params: no ML-DSA-65 verifying key was supplied to createPasskeyWallet — pass options.mlDsaPublicKey from the wallet kernel"
        );
      }
      return {
        ...(opts?.displayName !== undefined
          ? { display_name: opts.displayName }
          : {}),
        passkey_public_key_hex: hexEncode(credential.publicKey),
        credential_id_hex: hexEncode(credential.credentialId),
        ml_dsa_public_key_hex: hexEncode(mlDsaKey),
        ...(opts?.salt !== undefined ? { salt: opts.salt } : {}),
      };
    },
    bindValidatorModule(address: Address) {
      validatorModule = address;
    },
    validatorModule() {
      return validatorModule;
    },
    async startCrossDeviceLink() {
      return auth.startCrossDeviceLink(resolved);
    },
  };
}

/**
 * Sign a user op. Returns the bytes ready to drop into
 * `UserOperation.signature`. Fails until `bindValidatorModule` has
 * been called with the on-chain module address.
 */
export async function signWithPasskey(
  wallet: PasskeyWallet,
  userOp: PackedUserOperation
): Promise<Uint8Array> {
  const module = wallet.validatorModule();
  if (!module) {
    throw new SignerError(
      "backend-unavailable",
      "validator module not yet bound — call bindValidatorModule after the bootstrap op lands"
    );
  }
  const validator = new WebAuthnValidator(module, wallet.signer);
  return validator.buildValidatorData(userOp);
}

/**
 * Pick the right {@link PlatformAuthenticator} for the current host.
 * Browsers use `navigator.credentials`; Tauri / Node fall back to the
 * software reference. Custom hosts pass an explicit authenticator to
 * {@link createPasskeyWallet}.
 */
export function defaultAuthenticator(): PlatformAuthenticator {
  if (
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator).credentials !== "undefined"
  ) {
    return new BrowserWebAuthnAuthenticator();
  }
  return new SoftwareP256Authenticator();
}

// --- Browser WebAuthn implementation ---------------------------------

/**
 * Browser-native authenticator using `navigator.credentials`. This is
 * the production path on the web.
 */
export class BrowserWebAuthnAuthenticator implements PlatformAuthenticator {
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (typeof PublicKeyCredential === "undefined") return false;
    const fn = (
      PublicKeyCredential as unknown as {
        isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
      }
    ).isUserVerifyingPlatformAuthenticatorAvailable;
    if (!fn) return false;
    try {
      return await fn.call(PublicKeyCredential);
    } catch {
      return false;
    }
  }

  async createCredential(
    config: ResolvedPasskeyConfig,
    challenge: Uint8Array
  ): Promise<AuthenticatorRegistration> {
    const userId = new Uint8Array(new ArrayBuffer(16));
    crypto.getRandomValues(userId);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: bufferOf(challenge),
        rp: { id: config.rpId, name: config.rpName },
        user: {
          id: bufferOf(userId),
          name: "tenzro-user",
          displayName: "Tenzro User",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 / P-256
        authenticatorSelection: {
          authenticatorAttachment: config.requirePlatformAuthenticator
            ? "platform"
            : undefined,
          userVerification: config.requireUserVerification
            ? "required"
            : "preferred",
          residentKey: "preferred",
        },
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) {
      throw new SignerError("user-cancelled", "credential creation returned null");
    }

    const response = cred.response as AuthenticatorAttestationResponse;
    const credentialId = new Uint8Array(cred.rawId);
    const publicKey = extractCosePublicKey(
      new Uint8Array(response.attestationObject)
    );
    return {
      credential: { credentialId, publicKey },
      attestationObject: new Uint8Array(response.attestationObject),
    };
  }

  async signAssertion(
    config: ResolvedPasskeyConfig,
    credentialId: Uint8Array,
    challenge: Uint8Array
  ): Promise<AuthenticatorAssertion> {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: bufferOf(challenge),
        rpId: config.rpId,
        allowCredentials: [
          {
            type: "public-key",
            id: bufferOf(credentialId),
            transports: ["internal", "hybrid", "usb", "nfc", "ble"],
          },
        ],
        userVerification: config.requireUserVerification
          ? "required"
          : "preferred",
      },
    })) as PublicKeyCredential | null;

    if (!cred) {
      throw new SignerError("user-cancelled", "assertion returned null");
    }

    const response = cred.response as AuthenticatorAssertionResponse;
    return {
      signature: derToRawP256(new Uint8Array(response.signature)),
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJson: new Uint8Array(response.clientDataJSON),
    };
  }

  async startCrossDeviceLink(
    _config: ResolvedPasskeyConfig
  ): Promise<CrossDeviceLink> {
    // The browser doesn't expose caBLE QR generation directly — it
    // ships inside `navigator.credentials.get` when the platform
    // detects no local authenticator. Custom hosts (Tauri) implement
    // this directly. Surface a clear error here.
    throw new SignerError(
      "backend-unavailable",
      "browser does not expose caBLE QR; the OS handles cross-device transparently inside navigator.credentials.get"
    );
  }
}

// --- Software reference implementation -------------------------------

/**
 * Software-only authenticator backed by Web Crypto's `subtle.sign`.
 *
 * **Not for production wallets.** The whole point of a passkey is that
 * the secret never leaves dedicated hardware; a software keypair gives
 * you the API shape but none of the security. The SDK exposes this so
 * Node tests, CI, and reference docs can exercise the full surface
 * without touching a real authenticator.
 *
 * `isPlatformAuthenticatorAvailable()` returns `false` so production
 * configs refuse to use it (the safe default — opting into software
 * keys requires {@link developmentConfig}).
 */
export class SoftwareP256Authenticator implements PlatformAuthenticator {
  private readonly readyPromise: Promise<void>;
  private keyPair!: CryptoKeyPair;
  private credentialId!: Uint8Array;
  private publicKey!: Uint8Array;

  constructor() {
    this.readyPromise = this.init();
  }

  private async init(): Promise<void> {
    this.keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair;
    const raw = new Uint8Array(
      await crypto.subtle.exportKey("raw", this.keyPair.publicKey)
    );
    // Web Crypto returns SEC1 uncompressed `0x04 || x(32) || y(32)` —
    // strip the prefix to match the on-chain WebAuthnValidator's
    // 64-byte `x || y` form.
    if (raw.length !== 65 || raw[0] !== 0x04) {
      throw new SignerError(
        "backend-unavailable",
        `unexpected raw EC public-key encoding (len=${raw.length}, prefix=${raw[0]})`
      );
    }
    this.publicKey = raw.slice(1);
    // Fill a local first: the field is declared `Uint8Array`, which TS 7
    // widens to `Uint8Array<ArrayBufferLike>`, and `getRandomValues` requires
    // a view backed specifically by `ArrayBuffer`. Assigning after the fill
    // keeps the narrow type at the call site.
    const credentialId = new Uint8Array(new ArrayBuffer(16));
    crypto.getRandomValues(credentialId);
    this.credentialId = credentialId;
  }

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    // Software-backed; not a platform authenticator. Production
    // configs will refuse this and force the cross-device flow.
    return false;
  }

  async createCredential(
    _config: ResolvedPasskeyConfig,
    _challenge: Uint8Array
  ): Promise<AuthenticatorRegistration> {
    await this.readyPromise;
    return {
      credential: {
        credentialId: this.credentialId,
        publicKey: this.publicKey,
      },
      attestationObject: new Uint8Array(),
    };
  }

  async signAssertion(
    _config: ResolvedPasskeyConfig,
    credentialId: Uint8Array,
    challenge: Uint8Array
  ): Promise<AuthenticatorAssertion> {
    await this.readyPromise;
    if (!eqBytes(credentialId, this.credentialId)) {
      throw new SignerError(
        "authentication-failed",
        "credential ID mismatch"
      );
    }
    // WebAuthn signs over `authenticatorData || SHA-256(clientDataJSON)`.
    const authenticatorData = new Uint8Array(37);
    // bytes 0..32 = rpIdHash placeholder (zeros)
    authenticatorData[32] = 0b0000_0101; // UP=1, UV=1
    // bytes 33..37 = signCount = 0

    const clientDataJsonText = `{"type":"webauthn.get","challenge":"${b64UrlNoPad(
      challenge
    )}","origin":"https://localhost"}`;
    const clientDataJson = new TextEncoder().encode(clientDataJsonText);

    const clientDataHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", clientDataJson)
    );
    const signed = new Uint8Array(authenticatorData.length + clientDataHash.length);
    signed.set(authenticatorData, 0);
    signed.set(clientDataHash, authenticatorData.length);

    // Web Crypto returns the canonical 64-byte `r || s` form for
    // ECDSA over P-256 (per WebCrypto §23.4.5), which is exactly what
    // the on-chain validator wants.
    const sig = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        this.keyPair.privateKey,
        signed
      )
    );

    return { signature: sig, authenticatorData, clientDataJson };
  }

  async startCrossDeviceLink(
    _config: ResolvedPasskeyConfig
  ): Promise<CrossDeviceLink> {
    throw new SignerError(
      "backend-unavailable",
      "cross-device link is host-specific (browser / Tauri); software reference does not implement caBLE"
    );
  }
}

// --- helpers ---------------------------------------------------------

function packAux(authData: Uint8Array, clientData: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + authData.length + clientData.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, authData.length, true);
  out.set(authData, 4);
  view.setUint32(4 + authData.length, clientData.length, true);
  out.set(clientData, 8 + authData.length);
  return out;
}

function randomChallenge(): Uint8Array {
  const buf = new Uint8Array(new ArrayBuffer(32));
  crypto.getRandomValues(buf);
  return buf;
}

function eqBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function b64UrlNoPad(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lowercase hex, no `0x` prefix — matches the node's `*_hex` param decoders. */
function hexEncode(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function bufferOf(arr: Uint8Array): ArrayBuffer {
  // Strip any subarray-offset by copying into a fresh buffer — most
  // WebAuthn implementations are picky about this.
  const out = new ArrayBuffer(arr.byteLength);
  new Uint8Array(out).set(arr);
  return out;
}

/**
 * Browser WebAuthn returns DER-encoded ECDSA signatures from
 * `navigator.credentials.get`. The on-chain validator wants the raw
 * `r || s` 64-byte form. Decode minimal DER:
 *
 *   30 LL 02 RL <r> 02 SL <s>
 */
function derToRawP256(der: Uint8Array): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new SignerError("transport", "DER: missing SEQUENCE");
  // Length (could be short-form for typical 70-72 byte sigs).
  if (der[i] & 0x80) {
    const lenBytes = der[i++] & 0x7f;
    i += lenBytes;
  } else {
    i++;
  }
  if (der[i++] !== 0x02) throw new SignerError("transport", "DER: missing r INTEGER");
  const rLen = der[i++];
  const rRaw = der.slice(i, i + rLen);
  i += rLen;
  if (der[i++] !== 0x02) throw new SignerError("transport", "DER: missing s INTEGER");
  const sLen = der[i++];
  const sRaw = der.slice(i, i + sLen);

  // Strip leading 0x00 padding (DER encodes positive ints with a
  // leading zero if MSB set), then left-pad to 32 bytes.
  const r = stripLeadingZero(rRaw);
  const s = stripLeadingZero(sRaw);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

function stripLeadingZero(b: Uint8Array): Uint8Array {
  // Copy into a fresh ArrayBuffer-backed Uint8Array so callers can
  // assign without TS narrowing the buffer type to ArrayBufferLike.
  const start = b.length > 1 && b[0] === 0x00 ? 1 : 0;
  const out = new Uint8Array(b.length - start);
  out.set(b.subarray(start));
  return out;
}

/**
 * Extract the raw 64-byte P-256 public key (`x || y`) from the COSE
 * key embedded in a WebAuthn `attestationObject`.
 *
 * The attestationObject is CBOR; its `authData` field embeds an
 * "attested credential data" record that ends with a COSE_Key. For
 * ES256/P-256 (alg=-7, kty=2, crv=1) the key has a fixed structure:
 *
 *   A5            ; map(5)
 *     01 02       ; kty: 2 (EC2)
 *     03 26       ; alg: -7 (ES256)
 *     20 01       ; crv: 1 (P-256)
 *     21 58 20 <x32>  ; x coord
 *     22 58 20 <y32>  ; y coord
 *
 * We scan for `21 58 20` + 32 bytes + `22 58 20` + 32 bytes — a
 * minimal CBOR-aware parse that avoids pulling in a full CBOR lib.
 */
function extractCosePublicKey(attestationObject: Uint8Array): Uint8Array {
  for (let i = 0; i + 70 < attestationObject.length; i++) {
    if (
      attestationObject[i] === 0x21 &&
      attestationObject[i + 1] === 0x58 &&
      attestationObject[i + 2] === 0x20 &&
      attestationObject[i + 35] === 0x22 &&
      attestationObject[i + 36] === 0x58 &&
      attestationObject[i + 37] === 0x20
    ) {
      const out = new Uint8Array(64);
      out.set(attestationObject.slice(i + 3, i + 35), 0);
      out.set(attestationObject.slice(i + 38, i + 70), 32);
      return out;
    }
  }
  throw new SignerError(
    "transport",
    "could not locate COSE P-256 public key in attestationObject"
  );
}
