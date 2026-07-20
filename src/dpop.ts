/**
 * DPoP (Demonstrating Proof of Possession, RFC 9449) proof minting.
 *
 * The node authenticates user requests with `Authorization: DPoP <jwt>`
 * plus a fresh `DPoP: <proof>` header on every request. The proof is a
 * compact JWS signed by the holder's Ed25519 key, binding the request to
 * an `(htm, htu, iat, jti[, ath])` tuple. The verifier
 * (`crates/tenzro-auth/src/dpop.rs`) checks:
 *
 *   1. the embedded JWK thumbprint matches the JWT's `cnf.jkt`,
 *   2. the proof signature verifies against that JWK,
 *   3. `htm` matches the HTTP method, `htu` matches origin+path,
 *   4. `iat` is within ±60s,
 *   5. `jti` is unique within a 120s replay window,
 *   6. `ath = base64url(SHA-256(access_token))` when a token is present.
 *
 * This helper mints such proofs using WebCrypto (`crypto.subtle` Ed25519)
 * — no runtime dependency. The holder's key never leaves the caller: a
 * `CryptoKeyPair` is passed in, and only its public half is embedded in
 * the JWK header.
 *
 * ```ts
 * import { generateDpopKeyPair, mintDpopProof, computeJkt } from "@tenzro/sdk";
 *
 * const kp = await generateDpopKeyPair();
 * // Bind `kp` to a token via cnf.jkt = await computeJkt(kp.publicKey).
 * const proof = await mintDpopProof(kp, {
 *   htm: "POST",
 *   htu: "https://rpc.tenzro.xyz/",
 *   accessToken: bearerJwt,
 * });
 * // Send: Authorization: DPoP <bearerJwt>, DPoP: <proof>
 * ```
 */

/** Ed25519 JWK — the public-key shape embedded in a DPoP proof header. */
export interface Ed25519Jwk {
  kty: "OKP";
  crv: "Ed25519";
  /** base64url-no-pad x-coordinate (the 32-byte public key). */
  x: string;
}

/** Inputs for {@link mintDpopProof}. */
export interface DpopProofParams {
  /** HTTP method, uppercase ("GET", "POST", …). */
  htm: string;
  /**
   * Target URI — origin + path, query stripped. The node compares `htu`
   * against the request URL with the query removed, so pass the bare
   * endpoint (e.g. `"https://rpc.tenzro.xyz/"`).
   */
  htu: string;
  /**
   * Access token the proof accompanies. When set, `ath =
   * base64url(SHA-256(accessToken))` is included per RFC 9449 §4.1.
   * Omit only when minting a proof for the `/oauth/token` endpoint
   * (obtaining a fresh token).
   */
  accessToken?: string;
  /**
   * Issued-at override (Unix seconds). Defaults to the current time.
   * Provide only for testing — the node rejects proofs more than ±60s
   * from its own clock.
   */
  iat?: number;
  /**
   * Unique proof id override. Defaults to a random 128-bit value. The
   * node caches `jti` for 120s and rejects replays.
   */
  jti?: string;
}

/**
 * Generate an Ed25519 key pair for DPoP proof minting. The private key
 * is non-extractable — it is used only through `crypto.subtle.sign` and
 * never leaves the runtime. Bind the pair to a token by setting the
 * token's `cnf.jkt` to `await computeJkt(pair.publicKey)`.
 */
export async function generateDpopKeyPair(): Promise<CryptoKeyPair> {
  const pair = await subtle().generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"],
  );
  // WebCrypto types `generateKey` as `CryptoKey | CryptoKeyPair`; Ed25519
  // is always a pair.
  return pair as CryptoKeyPair;
}

/**
 * Compute the RFC 7638 JWK thumbprint of an Ed25519 public key,
 * `base64url-no-pad(SHA-256(canonical))`. This is the `jkt` value the
 * node compares against the token's `cnf.jkt` to bind proof ↔ token.
 *
 * Accepts either a WebCrypto `CryptoKey` (public half) or a
 * pre-computed {@link Ed25519Jwk}.
 */
export async function computeJkt(
  publicKey: CryptoKey | Ed25519Jwk,
): Promise<string> {
  const jwk =
    publicKey instanceof Object && "x" in publicKey
      ? (publicKey as Ed25519Jwk)
      : await exportEd25519Jwk(publicKey as CryptoKey);
  // RFC 7638 §3: sorted required members {crv, kty, x}, no whitespace.
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}"}`;
  const digest = await subtle().digest("SHA-256", utf8(canonical));
  return base64UrlNoPad(new Uint8Array(digest));
}

/**
 * Mint a DPoP proof JWS for a single request. Returns the compact
 * `header.payload.signature` string to place in the `DPoP` header.
 */
export async function mintDpopProof(
  keyPair: CryptoKeyPair,
  params: DpopProofParams,
): Promise<string> {
  const jwk = await exportEd25519Jwk(keyPair.publicKey);

  const header = {
    typ: "dpop+jwt",
    alg: "EdDSA",
    jwk,
  };

  const payload: Record<string, unknown> = {
    htm: params.htm.toUpperCase(),
    htu: params.htu,
    iat: params.iat ?? Math.floor(Date.now() / 1000),
    jti: params.jti ?? randomJti(),
  };
  if (params.accessToken !== undefined) {
    const ath = await subtle().digest("SHA-256", utf8(params.accessToken));
    payload.ath = base64UrlNoPad(new Uint8Array(ath));
  }

  const signingInput = `${base64UrlNoPad(utf8(json(header)))}.${base64UrlNoPad(
    utf8(json(payload)),
  )}`;
  const sig = await subtle().sign(
    { name: "Ed25519" },
    keyPair.privateKey,
    utf8(signingInput),
  );
  return `${signingInput}.${base64UrlNoPad(new Uint8Array(sig))}`;
}

// ── internals ──

async function exportEd25519Jwk(publicKey: CryptoKey): Promise<Ed25519Jwk> {
  const raw = (await subtle().exportKey("jwk", publicKey)) as {
    kty?: string;
    crv?: string;
    x?: string;
  };
  if (raw.kty !== "OKP" || raw.crv !== "Ed25519" || !raw.x) {
    throw new Error(
      "DPoP key must be an Ed25519 public key (OKP/Ed25519 JWK)",
    );
  }
  // `exportKey('jwk')` already yields base64url-no-pad `x`; re-emit only
  // the required members in a fixed shape.
  return { kty: "OKP", crv: "Ed25519", x: raw.x };
}

function subtle(): SubtleCrypto {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error(
      "WebCrypto SubtleCrypto unavailable — DPoP minting requires a runtime with crypto.subtle (browser or Node ≥18)",
    );
  }
  return c.subtle;
}

function randomJti(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c || !c.getRandomValues) {
    throw new Error("WebCrypto getRandomValues unavailable for jti");
  }
  c.getRandomValues(bytes);
  return base64UrlNoPad(bytes);
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function json(v: unknown): string {
  return JSON.stringify(v);
}

/** RFC 4648 §5 base64url, no padding. Local so the SDK stays dep-free. */
function base64UrlNoPad(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : (
          globalThis as unknown as {
            Buffer: { from(s: string, e: string): { toString(e: string): string } };
          }
        ).Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
