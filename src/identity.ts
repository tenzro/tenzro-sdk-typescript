import { RpcClient } from "./rpc";
import { IdentityInfo, IdentityType, DidDocument, JoinAsMicroNodeResponse, UsernameResult, Jwk, JwkSet } from "./types";
import { EnvelopeSigner, buildEnvelope, envelopeToHeaderValue } from "./app";

// ---------------------------------------------------------------------------
// Canonical params for identity-write envelopes
// ---------------------------------------------------------------------------

const textEncoder = new TextEncoder();

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function u64be(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, false);
  return b;
}

function pushBytes(chunks: Uint8Array[], bytes: Uint8Array): void {
  chunks.push(u32be(bytes.length));
  chunks.push(bytes);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Byte-wise (UTF-8) string comparison matching Rust's `BTreeMap<String, _>` key order. */
function byteCompare(a: string, b: string): number {
  const ab = textEncoder.encode(a);
  const bb = textEncoder.encode(b);
  const n = Math.min(ab.length, bb.length);
  for (let i = 0; i < n; i++) {
    if (ab[i] !== bb[i]) {
      return ab[i] - bb[i];
    }
  }
  return ab.length - bb.length;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort(byteCompare)) {
      out[k] = sortJson(src[k]);
    }
    return out;
  }
  return value;
}

/**
 * Sorted-key compact JSON bytes of a claims object — matches the node's
 * `serde_json` canonicalization (`Value::Object` is sorted-key).
 */
export function canonicalClaimsBytes(claims: Record<string, unknown>): Uint8Array {
  return textEncoder.encode(JSON.stringify(sortJson(claims)));
}

/**
 * Canonical bytes of the credential subject the issuer's durable proof signs —
 * the sorted-key compact JSON of `{"claims": {...}, "id": "<did>"}`, matching
 * the node's `CredentialSubject::canonical_bytes`.
 */
export function credentialSubjectCanonicalBytes(
  did: string,
  claims: Record<string, unknown>
): Uint8Array {
  return textEncoder.encode(JSON.stringify(sortJson({ id: did, claims })));
}

/** Canonical params for `tenzro_addCredential`, byte-identical to the node's builder. */
export function identityCredentialParams(
  did: string,
  credentialType: string,
  issuer: string,
  claimsCanonical: Uint8Array
): Uint8Array {
  const chunks: Uint8Array[] = [textEncoder.encode("tenzro/identity/credential")];
  pushBytes(chunks, textEncoder.encode(did));
  pushBytes(chunks, textEncoder.encode(credentialType));
  pushBytes(chunks, textEncoder.encode(issuer));
  pushBytes(chunks, claimsCanonical);
  return concat(chunks);
}

/** Canonical params for `tenzro_addService`, byte-identical to the node's builder. */
export function identityServiceParams(
  did: string,
  serviceType: string,
  endpoint: string
): Uint8Array {
  const chunks: Uint8Array[] = [textEncoder.encode("tenzro/identity/service")];
  pushBytes(chunks, textEncoder.encode(did));
  pushBytes(chunks, textEncoder.encode(serviceType));
  pushBytes(chunks, textEncoder.encode(endpoint));
  return concat(chunks);
}

/**
 * Canonical params for `tenzro_addIdentityClaim`, byte-identical to the
 * node's builder. `addressHexLower` is the 0x-stripped lowercase hex form.
 */
export function identityClaimParams(
  addressHexLower: string,
  topic: bigint,
  issuer: string,
  data: string,
  validFrom: string,
  validTo: string
): Uint8Array {
  const chunks: Uint8Array[] = [textEncoder.encode("tenzro/identity/claim")];
  pushBytes(chunks, textEncoder.encode(addressHexLower));
  chunks.push(u64be(topic));
  pushBytes(chunks, textEncoder.encode(issuer));
  pushBytes(chunks, textEncoder.encode(data));
  pushBytes(chunks, textEncoder.encode(validFrom));
  pushBytes(chunks, textEncoder.encode(validTo));
  return concat(chunks);
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Client for Tenzro Decentralized Identity Protocol (TDIP) operations.
 * Supports both human and machine identities with W3C DID documents.
 */
export class IdentityClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Register a new human identity.
   * @param displayName - Human-readable display name
   * @param publicKey - Optional public key (hex-encoded)
   * @param keyType - Optional key type ("ed25519" or "secp256k1")
   * @returns Identity information with DID and private key
   */
  async registerHuman(
    displayName: string,
    publicKey?: string,
    keyType?: "ed25519" | "secp256k1"
  ): Promise<IdentityInfo & { private_key?: string }> {
    return this.rpc.call("tenzro_registerIdentity", [
      {
        display_name: displayName,
        identity_type: "human",
        public_key: publicKey,
        key_type: keyType,
      },
    ]);
  }

  /**
   * Register a new machine identity.
   * @param controllerDid - DID of the controlling identity (optional for autonomous machines)
   * @param capabilities - List of machine capabilities
   * @param publicKey - Optional public key (hex-encoded)
   * @param keyType - Optional key type ("ed25519" or "secp256k1")
   * @returns Identity information with DID and private key
   */
  async registerMachine(
    controllerDid?: string,
    capabilities: string[] = [],
    publicKey?: string,
    keyType?: "ed25519" | "secp256k1"
  ): Promise<IdentityInfo & { private_key?: string }> {
    return this.rpc.call("tenzro_registerIdentity", [
      {
        identity_type: "machine",
        controller_did: controllerDid,
        capabilities,
        public_key: publicKey,
        key_type: keyType,
      },
    ]);
  }

  /**
   * Resolve a DID to get identity information.
   * @param did - The DID to resolve (e.g., "did:tenzro:human:..." or "did:tenzro:machine:...")
   * @returns Identity information
   */
  async resolve(did: string): Promise<IdentityInfo> {
    return this.rpc.call<IdentityInfo>("tenzro_resolveIdentity", [{ did }]);
  }

  /**
   * Resolve a DID to get the full W3C DID Document.
   * @param did - The DID to resolve
   * @returns W3C DID Document
   */
  async resolveDidDocument(did: string): Promise<DidDocument> {
    return this.rpc.call<DidDocument>("tenzro_resolveDidDocument", [{ did }]);
  }

  /**
   * List all identities (optionally filtered by type).
   * @param identityType - Optional filter: "Human" or "Machine"
   * @returns Array of identity information
   */
  async listIdentities(identityType?: IdentityType): Promise<IdentityInfo[]> {
    return this.rpc.call<IdentityInfo[]>("tenzro_listIdentities", [
      { identity_type: identityType },
    ]);
  }

  /**
   * Add a verifiable credential to an identity with a pre-built DID-envelope
   * header value. The envelope must be signed by the issuer
   * (`method = "tenzro_addCredential"`, `params_hash` over
   * {@link identityCredentialParams}). `proofValue` is an optional hex Ed25519
   * signature by the issuer over {@link credentialSubjectCanonicalBytes}.
   * @returns Credential ID
   */
  async addCredentialPresigned(
    did: string,
    credentialType: string,
    issuerDid: string,
    claims: Record<string, unknown>,
    envelopeHeader: string,
    proofValue?: string,
    proofType?: string
  ): Promise<string> {
    const params: Record<string, unknown> = {
      did,
      type: credentialType,
      issuer: issuerDid,
      claims,
      envelope: envelopeHeader,
    };
    if (proofValue !== undefined) {
      params.proof_value = proofValue;
      params.proof_type = proofType ?? "Ed25519Signature2020";
    }
    return this.rpc.call<string>("tenzro_addCredential", [params]);
  }

  /**
   * Add a verifiable credential, signing the DID envelope locally with
   * `signer` (the issuer's Ed25519 key). When `signProof` is true the same
   * signer also produces the durable credential proof over the subject's
   * canonical bytes.
   * @returns Credential ID
   */
  async addCredential(
    signer: EnvelopeSigner,
    did: string,
    credentialType: string,
    issuerDid: string,
    claims: Record<string, unknown> = {},
    signProof = false
  ): Promise<string> {
    const claimsCanonical = canonicalClaimsBytes(claims);
    const canonicalParams = identityCredentialParams(
      did,
      credentialType,
      issuerDid,
      claimsCanonical
    );
    const env = await buildEnvelope(
      signer,
      issuerDid,
      "tenzro_addCredential",
      canonicalParams
    );
    let proofValue: string | undefined;
    if (signProof) {
      const subjectBytes = credentialSubjectCanonicalBytes(did, claims);
      proofValue = toHex(await signer.signPreimage(subjectBytes));
    }
    return this.addCredentialPresigned(
      did,
      credentialType,
      issuerDid,
      claims,
      envelopeToHeaderValue(env),
      proofValue
    );
  }

  /**
   * Add a service endpoint to an identity with a pre-built DID-envelope
   * header value. The envelope must be signed by the subject DID or its
   * controller (`method = "tenzro_addService"`, `params_hash` over
   * {@link identityServiceParams}).
   */
  async addServicePresigned(
    did: string,
    serviceType: string,
    endpoint: string,
    envelopeHeader: string
  ): Promise<void> {
    await this.rpc.call("tenzro_addService", [
      { did, type: serviceType, endpoint, envelope: envelopeHeader },
    ]);
  }

  /**
   * Add a service endpoint, signing the DID envelope locally. `signerDid` is
   * the DID whose key `signer` holds — the subject DID itself, or its
   * controller when the controller authorizes the write.
   */
  async addService(
    signer: EnvelopeSigner,
    signerDid: string,
    did: string,
    serviceType: string,
    endpoint: string
  ): Promise<void> {
    const canonicalParams = identityServiceParams(did, serviceType, endpoint);
    const env = await buildEnvelope(
      signer,
      signerDid,
      "tenzro_addService",
      canonicalParams
    );
    await this.addServicePresigned(
      did,
      serviceType,
      endpoint,
      envelopeToHeaderValue(env)
    );
  }

  /**
   * Register a new machine identity with a name and controller.
   * Convenience wrapper around `registerMachine` with a display name.
   * @param name - Human-readable name for the machine identity
   * @param controller - DID of the controlling identity
   * @returns Identity information with DID and private key
   */
  async registerMachineIdentity(
    name: string,
    controller: string
  ): Promise<IdentityInfo & { private_key?: string }> {
    return this.rpc.call("tenzro_registerMachineIdentity", [
      { name, controller },
    ]);
  }

  /**
   * Set a human-readable username for a DID.
   * Usernames are unique across the network and provide an easy way to
   * discover identities without memorizing DIDs.
   * @param did - The DID to associate the username with
   * @param username - The desired username
   * @returns The username and associated DID
   */
  async setUsername(did: string, username: string): Promise<UsernameResult> {
    return this.rpc.call<UsernameResult>("tenzro_setUsername", [
      { did, username },
    ]);
  }

  /**
   * Resolve a username to its associated DID.
   * @param username - The username to look up
   * @returns The username and associated DID
   */
  async resolveUsername(username: string): Promise<UsernameResult> {
    return this.rpc.call<UsernameResult>("tenzro_resolveUsername", [
      { username },
    ]);
  }

  /**
   * Join the Tenzro Network as a MicroNode participant.
   * Zero-install — no P2P binary required.
   * Auto-provisions a TDIP DID and MPC wallet.
   * @param params - Optional display name, origin hint, and participant type
   * @returns Full MicroNode identity, wallet, capabilities, and network endpoints
   */
  async joinAsMicroNode(params?: {
    display_name?: string;
    origin?: string;
    participant_type?: string;
  }): Promise<JoinAsMicroNodeResponse> {
    return this.rpc.call<JoinAsMicroNodeResponse>("tenzro_joinAsMicroNode", [
      params ?? {},
    ]);
  }

  /**
   * List the public JWK Set published by this node (RFC 7517 / RFC 9421 keyid resolution).
   *
   * Each entry's `kid` is the canonical RFC 9421 keyid in the form
   * `<did>#<key_fragment>` and resolves directly via `getJwk`.
   *
   * Equivalent to GET `/.well-known/jwks.json` on the verification API.
   */
  async listJwks(): Promise<JwkSet> {
    return this.rpc.call<JwkSet>("tenzro_listAgentJwks", []);
  }

  /**
   * Look up a single JWK by `kid` (RFC 9421 keyid resolution).
   * @param keyid - Typically `<did>#<key_fragment>`
   */
  async getJwk(keyid: string): Promise<Jwk> {
    return this.rpc.call<Jwk>("tenzro_getAgentJwk", [keyid]);
  }
}
