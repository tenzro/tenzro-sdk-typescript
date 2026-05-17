import { RpcClient } from "./rpc";
import { IdentityInfo, IdentityType, DidDocument, JoinAsMicroNodeResponse, UsernameResult, Jwk, JwkSet } from "./types";

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
   * Add a verifiable credential to an identity.
   * @param did - The identity DID
   * @param credentialType - Type of credential (e.g., "KYC", "Attestation")
   * @param issuerDid - DID of the issuing authority
   * @returns Credential ID
   */
  async addCredential(
    did: string,
    credentialType: string,
    issuerDid: string
  ): Promise<string> {
    return this.rpc.call<string>("tenzro_addCredential", [
      { did, type: credentialType, issuer: issuerDid },
    ]);
  }

  /**
   * Add a service endpoint to an identity.
   * @param did - The identity DID
   * @param serviceType - Type of service (e.g., "MessagingService", "A2AEndpoint")
   * @param endpoint - Service endpoint URL
   */
  async addService(
    did: string,
    serviceType: string,
    endpoint: string
  ): Promise<void> {
    await this.rpc.call("tenzro_addService", [
      { did, type: serviceType, endpoint },
    ]);
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
    controller: string,
    capabilities: string[] = []
  ): Promise<IdentityInfo & { private_key?: string }> {
    return this.rpc.call("tenzro_registerMachineIdentity", [
      { name, controller_did: controller, capabilities },
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
