/**
 * Client-side signing module — DPoP proofs (RFC 9449) for OAuth-bound
 * RPC calls and hybrid Ed25519 + ML-DSA-65 signing for agent messages.
 *
 * Two distinct surfaces, both built on Ed25519:
 *
 * 1. **DPoP** — onboard a human via {@link AuthClient.onboardHuman} with
 *    the JWK thumbprint of a locally-generated Ed25519 keypair, then mint
 *    fresh DPoP proofs per request. Proofs are forwarded as the `DPoP`
 *    header by {@link RpcClient} (which reads `TENZRO_BEARER_JWT` and
 *    `TENZRO_DPOP_PROOF` env vars). Required for `wallet.signAndSend`,
 *    `settlement.createEscrow`, `bond.postAgentBond`, `agent.sendMessage`,
 *    staking writes, governance writes — anything that mutates state on
 *    the holder's behalf.
 *
 * 2. **Agent message signing** — `tenzro_sendAgentMessage` enforces
 *    hybrid post-quantum signing on every message: an Ed25519
 *    `signature` AND an ML-DSA-65 `pq_signature`, both over
 *    `SHA256(canonicalAgentMessageHash(...))`. The canonical preimage
 *    layout matches `AgentMessage::signing_data()` in
 *    `tenzro-types/src/agent.rs` — length-prefixed concatenation with
 *    little-endian u64 lengths, signature fields excluded.
 *
 *    Server gap (current testnet): the RPC handler doesn't yet extract
 *    the signature fields from params. The SDK shape is forward-
 *    compatible — calls will pass once the server patch lands.
 */
import * as ed25519 from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import {
  type CryptoKey,
  type JWK,
  SignJWT,
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
} from 'jose';
import type { TenzroClient } from './client';

// noble-ed25519 v2 needs a sync SHA-512 implementation registered before
// the sync getPublicKey/sign/verify entry points work. Wire it from
// @noble/hashes so the agent-message signer doesn't have to await.
ed25519.etc.sha512Sync = (...msgs: Uint8Array[]) => {
  const h = sha512.create();
  for (const m of msgs) h.update(m);
  return h.digest();
};

// ── DPoP ──

export interface DpopKeyPair {
  /** EdDSA private key (CryptoKey, non-extractable). */
  privateKey: CryptoKey;
  /** EdDSA public key (CryptoKey, extractable). */
  publicKey: CryptoKey;
  /** Public key in JWK form — embed in DPoP proof headers as `jwk`. */
  publicJwk: JWK;
  /** RFC 7638 JWK thumbprint of `publicJwk` (base64url, no padding). */
  jkt: string;
}

/** Generate an Ed25519 keypair for DPoP proof signing. */
export async function generateDpopKeypair(): Promise<DpopKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
    extractable: false,
    crv: 'Ed25519',
  });
  const publicJwk = await exportJWK(publicKey);
  const jkt = await calculateJwkThumbprint(publicJwk, 'sha256');
  return { privateKey, publicKey, publicJwk, jkt };
}

/** Mint a fresh single-use DPoP proof JWT (RFC 9449). */
export async function createDpopProof(opts: {
  privateKey: CryptoKey;
  publicJwk: JWK;
  /** HTTP method, e.g. `"POST"`. */
  method: string;
  /**
   * Full URL the server-side auth layer sees. On the public testnet that
   * is `http://0.0.0.0:8545/` (with trailing slash) — the reverse proxy
   * does not rewrite the URL the auth layer validates against.
   */
  url: string;
  /**
   * When binding the proof to a bearer JWT, pass the bearer here. The
   * proof's `ath` claim becomes `base64url(SHA-256(accessToken))` so a
   * stolen bearer can't be paired with proofs minted against a
   * different bearer.
   */
  accessToken?: string;
}): Promise<string> {
  const claims: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: opts.method,
    htu: opts.url,
    iat: Math.floor(Date.now() / 1000),
  };
  if (opts.accessToken) {
    const hash = sha256(new TextEncoder().encode(opts.accessToken));
    claims.ath = bytesToBase64Url(hash);
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'dpop+jwt', jwk: opts.publicJwk })
    .sign(opts.privateKey);
}

/** Bound DPoP session — a generated keypair, an onboarded JWT, and a proof minter. */
export interface DpopSession {
  /** Bearer JWT from `auth.onboardHuman(name, jkt)`. Send as
   * `Authorization: DPoP <bearer>`. */
  bearer: string;
  /** Wallet address provisioned by onboarding. */
  walletAddress: string;
  /** RFC 7638 JWK thumbprint baked into the bearer's `cnf.jkt`. */
  jkt: string;
  /** Mint a fresh DPoP proof for the next request. */
  mintProof(method: string, url: string): Promise<string>;
}

/**
 * One-shot helper: generate a DPoP keypair, onboard a human bound to its
 * thumbprint, and return a `DpopSession` ready to mint proofs.
 *
 * Set `TENZRO_BEARER_JWT = session.bearer` and refresh
 * `TENZRO_DPOP_PROOF = await session.mintProof("POST", url)` immediately
 * before each privileged call — DPoP proofs are single-use (`jti` is
 * cached) and have a ~60s clock window (`iat`).
 */
export async function createDpopSession(
  client: TenzroClient,
  displayName: string,
): Promise<DpopSession> {
  const kp = await generateDpopKeypair();
  const onboard = await client.auth.onboardHuman(displayName, kp.jkt);
  const bearer = onboard.access_token;
  const walletAddress = (onboard.wallet as { address?: string } | undefined)
    ?.address ?? '';
  return {
    bearer,
    walletAddress,
    jkt: kp.jkt,
    mintProof(method: string, url: string) {
      return createDpopProof({
        privateKey: kp.privateKey,
        publicJwk: kp.publicJwk,
        method,
        url,
        accessToken: bearer,
      });
    },
  };
}

// ── Agent message signing ──

export interface AgentSigningKeys {
  /** Ed25519 private key (32 bytes). */
  ed25519Priv: Uint8Array;
  /** Ed25519 public key (32 bytes). */
  ed25519Pub: Uint8Array;
  /** ML-DSA-65 secret key. */
  mldsaPriv: Uint8Array;
  /** ML-DSA-65 public key. */
  mldsaPub: Uint8Array;
}

/** Generate a fresh hybrid (Ed25519 + ML-DSA-65) signing keypair. */
export function generateAgentSigningKeys(): AgentSigningKeys {
  const ed25519Priv = ed25519.utils.randomPrivateKey();
  const ed25519Pub = ed25519.getPublicKey(ed25519Priv);
  const mldsa = ml_dsa65.keygen();
  return {
    ed25519Priv,
    ed25519Pub,
    mldsaPriv: mldsa.secretKey,
    mldsaPub: mldsa.publicKey,
  };
}

export interface AgentMessageFields {
  messageId: string;
  /** Sender — agent_id (UTF-8 string) + on-chain address (32 raw bytes). */
  from: { agentId: string; address: Uint8Array };
  /** Recipient — agent_id (UTF-8 string) + on-chain address (32 raw bytes). */
  to: { agentId: string; address: Uint8Array };
  /**
   * Discriminant byte for the message type — matches the Rust
   * `AgentMessageType` enum order: TaskRequest=0, TaskResponse=1,
   * Query=2, QueryResponse=3, Notification=4, Coordination=5,
   * Error=6, SpawnRequest=7, …
   */
  messageType: number;
  /** Raw payload bytes (e.g. `new TextEncoder().encode("hello")`). */
  payload: Uint8Array;
  /** Timestamp in milliseconds since the Unix epoch (signed i64). */
  timestampMs: bigint;
  /** Optional reply-to message id. */
  replyTo?: string;
}

/**
 * Build the canonical preimage that Tenzro's agent-message verifier
 * SHA-256s before checking signatures.
 *
 * Matches `AgentMessage::signing_data()` in
 * `tenzro-types/src/agent.rs` — length-prefixed concatenation with
 * little-endian u64 lengths, signature fields excluded.
 */
export function canonicalAgentMessagePreimage(
  msg: AgentMessageFields,
): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const messageIdBytes = enc.encode(msg.messageId);
  const fromAgentBytes = enc.encode(msg.from.agentId);
  const toAgentBytes = enc.encode(msg.to.agentId);
  const replyToBytes = msg.replyTo ? enc.encode(msg.replyTo) : undefined;

  // message_id (length-prefixed)
  parts.push(u64Le(BigInt(messageIdBytes.length)), messageIdBytes);
  // from agent identity (length-prefixed agent_id, then raw 32-byte address)
  parts.push(u64Le(BigInt(fromAgentBytes.length)), fromAgentBytes, msg.from.address);
  // to agent identity
  parts.push(u64Le(BigInt(toAgentBytes.length)), toAgentBytes, msg.to.address);
  // message_type as a single tag byte
  parts.push(new Uint8Array([msg.messageType & 0xff]));
  // payload (length-prefixed)
  parts.push(u64Le(BigInt(msg.payload.length)), msg.payload);
  // timestamp (i64 LE)
  parts.push(i64Le(msg.timestampMs));
  // optional reply_to
  if (replyToBytes) {
    parts.push(new Uint8Array([1]), u64Le(BigInt(replyToBytes.length)), replyToBytes);
  } else {
    parts.push(new Uint8Array([0]));
  }
  return concat(parts);
}

/** SHA-256 of {@link canonicalAgentMessagePreimage}. */
export function canonicalAgentMessageHash(msg: AgentMessageFields): Uint8Array {
  return sha256(canonicalAgentMessagePreimage(msg));
}

/** Sign an agent message with both Ed25519 and ML-DSA-65 legs. */
export function signAgentMessage(
  keys: AgentSigningKeys,
  msg: AgentMessageFields,
): { signature: string; pq_signature: string } {
  const hash = canonicalAgentMessageHash(msg);
  const classical = ed25519.sign(hash, keys.ed25519Priv);
  const pq = ml_dsa65.sign(hash, keys.mldsaPriv);
  return {
    signature: bytesToHex(classical),
    pq_signature: bytesToHex(pq),
  };
}

// ── tiny shared helpers (no external deps beyond what's already imported) ──

function u64Le(v: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, v, /* littleEndian */ true);
  return buf;
}

function i64Le(v: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigInt64(0, v, /* littleEndian */ true);
  return buf;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) {
    s += b[i].toString(16).padStart(2, '0');
  }
  return s;
}

function bytesToBase64Url(b: Uint8Array): string {
  // btoa expects a binary string; we build one byte-by-byte to avoid
  // TextDecoder UTF-8 pitfalls. btoa is in WHATWG / Node 18+ globals.
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
