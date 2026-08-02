/**
 * Application registry + non-custodial settlement authorization.
 *
 * A developer building a fiat-priced product on Tenzro registers an *app*
 * on-chain (permissionless — any DID may register by signing with a key it
 * controls), funds the app's own TNZO wallet, and settles usage against it.
 * Tenzro never holds custody of the developer's payment-provider secrets or
 * their funds: the developer charges fiat on their own PSP, signs a
 * {@link SettlementAuthorization} with a key registered in the on-chain
 * {@link AppRecord}, and any node executes the TNZO movement.
 *
 * Flow:
 *   1. registerApp       — register app_id + signing keys + margin, on-chain
 *   2. (fund appWallet)  — developer moves their own TNZO into the app wallet
 *   3. developer backend — charges the end user fiat on the developer's own PSP
 *   4. settleAuthorized  — a signed authorization moves TNZO appWallet -> payer,
 *                          commission -> treasury; idempotent on (appId, externalRef)
 *
 * Two paths are offered for every mutating call:
 *
 *   - Pre-signed forwarding (most non-custodial): the developer's backend
 *     produces the signature bytes and the DID-envelope header value itself
 *     and passes them in. The SDK never touches a secret. Use
 *     {@link AppClient.registerAppPresigned}, {@link AppClient.setAppStatusPresigned},
 *     {@link AppClient.settleAuthorizedPresigned}.
 *   - Local-signer convenience: for registry writes the developer supplies an
 *     {@link EnvelopeSigner} (an Ed25519 key) plus its `did:key`; the SDK builds
 *     the canonical preimage and asks the signer to sign it directly (the node
 *     verifies Ed25519 over the raw preimage). For settlement it supplies a
 *     {@link Signer} — the input there is the 32-byte
 *     {@link SettlementAuthorization} signing hash. Use {@link AppClient.registerApp},
 *     {@link AppClient.setAppStatus}, {@link AppClient.settleAuthorized}.
 *
 * The canonical byte encodings below are reproduced from the node's
 * `app_registry`, settlement, and DID-envelope modules. This package has zero
 * runtime dependencies, so the encodings are kept byte-identical here; local
 * SHA-256 uses the Web Crypto API (`crypto.subtle.digest`), which makes the
 * hashing helpers async.
 */

import { RpcClient } from "./rpc";
import type { Signer, SignContext } from "./signer";

// ---------------------------------------------------------------------------
// Canonical domain tags (byte-identical to the node + types crates)
// ---------------------------------------------------------------------------

const APP_REGISTRATION_DOMAIN = utf8("tenzro/app/registration");
const APP_STATUS_DOMAIN = utf8("tenzro/app/status");
const SETTLEMENT_AUTHORIZATION_DOMAIN = utf8("tenzro/settlement/authorization");
const ENVELOPE_DOMAIN_V1 = utf8("tenzro-did-envelope:v1");

const METHOD_REGISTER_APP = "tenzro_registerApp";
const METHOD_SET_APP_STATUS = "tenzro_setAppStatus";

/**
 * Protocol ceiling on the developer's per-settlement margin. A margin above
 * this is rejected on-chain; the SDK validates it early so callers get an
 * error before spending a round-trip.
 */
export const MAX_DEVELOPER_MARGIN_BPS = 2000;

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

/** Big-endian encoding of a bigint into `len` bytes. */
function bigUintBe(value: bigint, len: number): Uint8Array {
  if (value < 0n) {
    throw new Error("value must be non-negative");
  }
  const out = new Uint8Array(len);
  let v = value;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) {
    throw new Error(`value does not fit in ${len} bytes`);
  }
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) {
    total += c.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/**
 * Length-prefixed byte push: `u32` big-endian length, then the bytes. Matches
 * the node's `push_bytes` used throughout `canonical_params`.
 */
function pushBytes(chunks: Uint8Array[], bytes: Uint8Array): void {
  chunks.push(u32be(bytes.length));
  chunks.push(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`invalid hex string (odd length): ${hex}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function subtleCrypto(): SubtleCrypto {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      "Web Crypto (crypto.subtle) is unavailable — Node >= 18 or a browser is required"
    );
  }
  return c.subtle;
}

/** SHA-256 of `bytes` as a 32-byte array. Matches the node's `params_hash`. */
export async function paramsHash(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await subtleCrypto().digest("SHA-256", bytes as BufferSource);
  return new Uint8Array(digest);
}

function randomBytes(len: number): Uint8Array {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c || !c.getRandomValues) {
    throw new Error("crypto.getRandomValues is unavailable");
  }
  const b = new Uint8Array(len);
  c.getRandomValues(b);
  return b;
}

function nowMs(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One signing key attached to an app record. The developer's backend holds the
 * secret; only the 32-byte Ed25519 verifying key is on-chain.
 */
export interface AppSigningKeySpec {
  /** Stable identifier for this key inside the app (1..=64 bytes). */
  keyId: string;
  /** Ed25519 verifying key (exactly 32 bytes). */
  publicKey: Uint8Array;
  /** Optional per-key daily settlement ceiling, in TNZO base units. */
  dailyLimitTnzo?: bigint;
}

/**
 * A signing key as echoed back by the node (public key hex-encoded). Field
 * names match the node's JSON wire format.
 */
export interface AppSigningKeyView {
  key_id: string;
  /** Hex-encoded Ed25519 verifying key. */
  public_key: string;
  /** Per-key daily settlement ceiling in TNZO base units (decimal string). */
  daily_limit_tnzo: string | null;
}

/**
 * An on-chain app record as returned by the node. Field names match the node's
 * JSON wire format.
 */
export interface AppRecord {
  app_id: string;
  developer_did: string;
  /** Hex-encoded address of the app's own TNZO wallet. */
  app_wallet: string;
  signing_pubkeys: AppSigningKeyView[];
  margin_bps: number;
  min_balance: string;
  created_at: number;
  active: boolean;
}

/**
 * Outcome of a `tenzro_settleAuthorized` call. Field names match the node's
 * JSON wire format. `duplicate` is present on `settleAuthorized` responses and
 * absent on `getSettleAuthorizedOutcome` reads.
 */
export interface SettleOutcome {
  app_id: string;
  external_ref: string;
  payer_did: string;
  /** Hex-encoded payer wallet that received the net TNZO. */
  payer_wallet: string;
  /** Gross TNZO moved from the app wallet, in base units (decimal string). */
  amount_tnzo: string;
  /** Net TNZO credited to the payer after commission (decimal string). */
  payer_net_tnzo: string;
  /** Commission routed to the treasury (decimal string). */
  commission_tnzo: string;
  key_id: string;
  settled_at: number;
  success: boolean;
  failure_reason: string | null;
  app_wallet_funded: boolean;
  /** True when this call replayed an already-recorded (app_id, external_ref). */
  duplicate?: boolean;
}

/**
 * A settlement authorization the developer's backend signs to move TNZO from
 * the app wallet to a payer.
 */
export interface SettlementAuthorization {
  appId: string;
  chainId: bigint;
  payerDid: string;
  amountTnzo: bigint;
  /** Idempotency key — typically the PSP charge id (e.g. a Stripe `pi_...`). */
  externalRef: string;
  /** 32-byte anti-replay nonce. */
  nonce: Uint8Array;
  /** Expiry as unix-ms; the node rejects authorizations past this. */
  expiry: bigint;
  keyId: string;
}

/**
 * Canonical signing preimage, byte-identical to the node's
 * `SettlementAuthorization::signing_preimage`. The signature field is excluded
 * (it is the output).
 */
export function settlementSigningPreimage(
  auth: SettlementAuthorization
): Uint8Array {
  if (auth.nonce.length !== 32) {
    throw new Error("nonce must be exactly 32 bytes");
  }
  const chunks: Uint8Array[] = [];
  chunks.push(SETTLEMENT_AUTHORIZATION_DOMAIN);
  pushBytes(chunks, utf8(auth.appId));
  chunks.push(bigUintBe(auth.chainId, 8));
  pushBytes(chunks, utf8(auth.payerDid));
  chunks.push(bigUintBe(auth.amountTnzo, 16));
  pushBytes(chunks, utf8(auth.externalRef));
  chunks.push(auth.nonce);
  chunks.push(bigUintBe(auth.expiry, 8));
  pushBytes(chunks, utf8(auth.keyId));
  return concatBytes(chunks);
}

/** SHA-256 of the signing preimage — the 32-byte hash the developer's key signs. */
export async function settlementSigningHash(
  auth: SettlementAuthorization
): Promise<Uint8Array> {
  return paramsHash(settlementSigningPreimage(auth));
}

/**
 * The DID envelope carried on mutating app-registry calls so the node can
 * verify the caller controls the developer DID.
 */
export interface DidEnvelope {
  did: string;
  method: string;
  /** SHA-256 of the method's canonical params. */
  paramsHash: Uint8Array;
  /** Unix-ms timestamp; the node rejects skew beyond ±60s. */
  timestamp: number;
  /** 16-byte anti-replay nonce (must not be all-zero). */
  nonce: Uint8Array;
  /** Signature over {@link envelopeCanonicalPreimage}. */
  signature: Uint8Array;
}

/**
 * Canonical preimage the DID signs, byte-identical to the node's
 * `canonical_preimage`.
 */
export function envelopeCanonicalPreimage(env: DidEnvelope): Uint8Array {
  const did = utf8(env.did);
  const method = utf8(env.method);
  return concatBytes([
    ENVELOPE_DOMAIN_V1,
    u32be(did.length),
    did,
    u32be(method.length),
    method,
    env.paramsHash,
    bigUintBe(BigInt(env.timestamp), 8),
    env.nonce,
  ]);
}

/**
 * Hex header value the node parses, byte-identical to the node's
 * `to_header_value`. Excludes the domain tag (which the verifier re-derives)
 * but includes the signature.
 */
export function envelopeToHeaderValue(env: DidEnvelope): string {
  const did = utf8(env.did);
  const method = utf8(env.method);
  return bytesToHex(
    concatBytes([
      u32be(did.length),
      did,
      u32be(method.length),
      method,
      env.paramsHash,
      bigUintBe(BigInt(env.timestamp), 8),
      env.nonce,
      u32be(env.signature.length),
      env.signature,
    ])
  );
}

/**
 * Canonical registration params, byte-identical to the node's
 * `AppRecord::canonical_params`. `created_at` is excluded (server-set).
 */
export function appRegistrationParams(
  appId: string,
  developerDid: string,
  appWallet: Uint8Array,
  signingPubkeys: AppSigningKeySpec[],
  marginBps: number,
  minBalance: bigint,
  active: boolean
): Uint8Array {
  const chunks: Uint8Array[] = [];
  chunks.push(APP_REGISTRATION_DOMAIN);
  pushBytes(chunks, utf8(appId));
  pushBytes(chunks, utf8(developerDid));
  pushBytes(chunks, appWallet);
  chunks.push(u32be(signingPubkeys.length));
  for (const k of signingPubkeys) {
    pushBytes(chunks, utf8(k.keyId));
    pushBytes(chunks, k.publicKey);
    if (k.dailyLimitTnzo !== undefined) {
      chunks.push(new Uint8Array([1]));
      chunks.push(bigUintBe(k.dailyLimitTnzo, 16));
    } else {
      chunks.push(new Uint8Array([0]));
    }
  }
  chunks.push(u32be(marginBps));
  chunks.push(bigUintBe(minBalance, 16));
  chunks.push(new Uint8Array([active ? 1 : 0]));
  return concatBytes(chunks);
}

/**
 * Canonical set-status params, byte-identical to the node's
 * `canonical_status_params`.
 */
export function appStatusParams(appId: string, active: boolean): Uint8Array {
  const chunks: Uint8Array[] = [];
  chunks.push(APP_STATUS_DOMAIN);
  pushBytes(chunks, utf8(appId));
  chunks.push(new Uint8Array([active ? 1 : 0]));
  return concatBytes(chunks);
}

// ---------------------------------------------------------------------------
// Envelope signer
// ---------------------------------------------------------------------------

/**
 * Signs the DID-envelope {@link envelopeCanonicalPreimage} — the
 * variable-length, domain-separated bytes the node verifies an Ed25519
 * signature over.
 *
 * This is a distinct seam from {@link Signer} on purpose. The generic `Signer`
 * is a 32-byte-hash signer (ERC-7579 user ops, settlement authorizations — the
 * input genuinely is a digest). The DID envelope, by contrast, is Ed25519 over
 * the raw preimage: the node's verifier does `verify(pk, canonicalPreimage(env),
 * sig)`, and Ed25519 hashes the message internally (SHA-512), so pre-hashing
 * here would produce a signature the node rejects. An implementation therefore
 * receives the full preimage and signs it directly with the developer's Ed25519
 * key.
 */
export interface EnvelopeSigner {
  /**
   * Sign `preimage` with the developer's Ed25519 key and return the raw 64-byte
   * signature. The developer's key never leaves the implementation.
   */
  signPreimage(preimage: Uint8Array): Promise<Uint8Array>;
}

/**
 * Build a signed DID envelope for `method` over `canonicalParams`, signing the
 * raw canonical preimage with `signer`. `did` is the signer's DID (e.g. a
 * `did:key`); the node re-derives the verifying key from it for `did:key`.
 */
export async function buildEnvelope(
  signer: EnvelopeSigner,
  did: string,
  method: string,
  canonicalParams: Uint8Array
): Promise<DidEnvelope> {
  const ph = await paramsHash(canonicalParams);
  const nonce = randomBytes(16);
  if (nonce.every((b) => b === 0)) {
    // Astronomically unlikely, but the node rejects an all-zero nonce.
    throw new Error("rng produced zero nonce");
  }
  const env: DidEnvelope = {
    did,
    method,
    paramsHash: ph,
    timestamp: nowMs(),
    nonce,
    signature: new Uint8Array(0),
  };
  env.signature = await signer.signPreimage(envelopeCanonicalPreimage(env));
  return env;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Client for the on-chain app registry + non-custodial settlement surface. */
export class AppClient {
  private readonly rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  /** Connect to a node's JSON-RPC endpoint. */
  static connect(rpcUrl: string, timeoutMs = 30_000): AppClient {
    return new AppClient(new RpcClient(rpcUrl, undefined, timeoutMs));
  }

  // ---- registerApp -----------------------------------------------------

  /**
   * Register (or update) an app with a pre-built DID-envelope header value. The
   * developer's backend signs the envelope; the SDK never sees a secret.
   */
  async registerAppPresigned(
    appId: string,
    developerDid: string,
    appWallet: string,
    signingPubkeys: AppSigningKeySpec[],
    marginBps: number,
    minBalance: bigint,
    active: boolean,
    envelopeHeader: string
  ): Promise<AppRecord> {
    validateRegister(appId, developerDid, signingPubkeys, marginBps);
    return this.rpc.call<AppRecord>("tenzro_registerApp", [
      {
        app_id: appId,
        developer_did: developerDid,
        app_wallet: appWallet,
        signing_pubkeys: signingPubkeys.map((k) => ({
          key_id: k.keyId,
          public_key: bytesToHex(k.publicKey),
          daily_limit_tnzo:
            k.dailyLimitTnzo !== undefined
              ? k.dailyLimitTnzo.toString()
              : null,
        })),
        margin_bps: marginBps,
        min_balance: minBalance.toString(),
        active,
        envelope: envelopeHeader,
      },
    ]);
  }

  /**
   * Register (or update) an app, signing the DID envelope locally with
   * `signer`. `developerDid` is the DID that owns the app (e.g. the signer's
   * `did:key`).
   */
  async registerApp(
    signer: EnvelopeSigner,
    appId: string,
    developerDid: string,
    appWallet: string,
    signingPubkeys: AppSigningKeySpec[],
    marginBps: number,
    minBalance: bigint,
    active: boolean
  ): Promise<AppRecord> {
    validateRegister(appId, developerDid, signingPubkeys, marginBps);
    const params = appRegistrationParams(
      appId,
      developerDid,
      hexToBytes(appWallet),
      signingPubkeys,
      marginBps,
      minBalance,
      active
    );
    const env = await buildEnvelope(
      signer,
      developerDid,
      METHOD_REGISTER_APP,
      params
    );
    return this.registerAppPresigned(
      appId,
      developerDid,
      appWallet,
      signingPubkeys,
      marginBps,
      minBalance,
      active,
      envelopeToHeaderValue(env)
    );
  }

  // ---- setAppStatus ----------------------------------------------------

  /** Activate or deactivate an app with a pre-built DID-envelope header value. */
  async setAppStatusPresigned(
    appId: string,
    active: boolean,
    envelopeHeader: string
  ): Promise<AppRecord> {
    return this.rpc.call<AppRecord>("tenzro_setAppStatus", [
      { app_id: appId, active, envelope: envelopeHeader },
    ]);
  }

  /** Activate or deactivate an app, signing the DID envelope locally. */
  async setAppStatus(
    signer: EnvelopeSigner,
    developerDid: string,
    appId: string,
    active: boolean
  ): Promise<AppRecord> {
    const params = appStatusParams(appId, active);
    const env = await buildEnvelope(
      signer,
      developerDid,
      METHOD_SET_APP_STATUS,
      params
    );
    return this.setAppStatusPresigned(appId, active, envelopeToHeaderValue(env));
  }

  // ---- reads -----------------------------------------------------------

  /** Fetch an app record by id. */
  async getApp(appId: string): Promise<AppRecord> {
    return this.rpc.call<AppRecord>("tenzro_getApp", [{ app_id: appId }]);
  }

  /** List all registered apps. */
  async listApps(): Promise<AppRecord[]> {
    const res = await this.rpc.call<{ apps?: AppRecord[] }>(
      "tenzro_listApps",
      [{}]
    );
    return res.apps ?? [];
  }

  // ---- settleAuthorized ------------------------------------------------

  /**
   * Execute a settlement from a pre-built authorization signature (hex). The
   * developer's backend signs the {@link SettlementAuthorization} signing hash
   * with the app key `auth.keyId`; the SDK never sees the secret. Idempotent on
   * `(appId, externalRef)`.
   */
  async settleAuthorizedPresigned(
    auth: SettlementAuthorization,
    signatureHex: string
  ): Promise<SettleOutcome> {
    if (auth.nonce.length !== 32) {
      throw new Error("nonce must be exactly 32 bytes");
    }
    return this.rpc.call<SettleOutcome>("tenzro_settleAuthorized", [
      {
        app_id: auth.appId,
        chain_id: Number(auth.chainId),
        payer_did: auth.payerDid,
        amount_tnzo: auth.amountTnzo.toString(),
        external_ref: auth.externalRef,
        nonce: bytesToHex(auth.nonce),
        expiry: Number(auth.expiry),
        key_id: auth.keyId,
        signature: signatureHex,
      },
    ]);
  }

  /**
   * Execute a settlement, signing the authorization locally with `signer` (must
   * correspond to the app key `auth.keyId`). Idempotent on
   * `(appId, externalRef)`.
   */
  async settleAuthorized(
    signer: Signer,
    auth: SettlementAuthorization,
    context: SignContext = {}
  ): Promise<SettleOutcome> {
    const hash = await settlementSigningHash(auth);
    const sig = await signer.sign(hash, context);
    return this.settleAuthorizedPresigned(auth, bytesToHex(sig.bytes));
  }

  /** Look up a prior settlement outcome by `(appId, externalRef)`. */
  async getSettleAuthorizedOutcome(
    appId: string,
    externalRef: string
  ): Promise<SettleOutcome> {
    return this.rpc.call<SettleOutcome>("tenzro_getSettleAuthorizedOutcome", [
      { app_id: appId, external_ref: externalRef },
    ]);
  }
}

function validateRegister(
  appId: string,
  developerDid: string,
  signingPubkeys: AppSigningKeySpec[],
  marginBps: number
): void {
  const appIdBytes = utf8(appId).length;
  if (appIdBytes < 1 || appIdBytes > 128) {
    throw new Error("app_id must be 1..=128 bytes");
  }
  if (developerDid.length === 0) {
    throw new Error("developer_did is required");
  }
  if (signingPubkeys.length === 0) {
    throw new Error("at least one signing key is required");
  }
  for (const k of signingPubkeys) {
    const keyIdBytes = utf8(k.keyId).length;
    if (keyIdBytes < 1 || keyIdBytes > 64) {
      throw new Error("key_id must be 1..=64 bytes");
    }
    if (k.publicKey.length !== 32) {
      throw new Error("public_key must be exactly 32 bytes");
    }
  }
  if (marginBps > MAX_DEVELOPER_MARGIN_BPS) {
    throw new Error(
      `margin_bps ${marginBps} exceeds max ${MAX_DEVELOPER_MARGIN_BPS}`
    );
  }
}

// ---------------------------------------------------------------------------
// did:key helper
// ---------------------------------------------------------------------------

/**
 * Build a `did:key` identifier from a 32-byte Ed25519 verifying key. The node
 * verifies `did:key` envelopes without a registry lookup by re-deriving the key
 * from this DID (multicodec `0xed 0x01` + 32-byte key, base58btc after `z`).
 */
export function didKeyFromEd25519(verifyingKey: Uint8Array): string {
  if (verifyingKey.length !== 32) {
    throw new Error("verifying key must be exactly 32 bytes");
  }
  const mc = new Uint8Array(34);
  mc[0] = 0xed;
  mc[1] = 0x01;
  mc.set(verifyingKey, 2);
  return `did:key:z${base58btcEncode(mc)}`;
}

/**
 * Minimal Bitcoin-alphabet base58 encoder (no checksum), matching the base58btc
 * alphabet used by `did:key`.
 */
function base58btcEncode(input: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) {
    zeros++;
  }
  const digits: number[] = [];
  for (const byte of input) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (let i = 0; i < zeros; i++) {
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    out += ALPHABET[digits[i]];
  }
  return out;
}
