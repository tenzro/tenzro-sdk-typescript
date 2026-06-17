import type { RpcClient } from './rpc';

export interface SiwtBuildPayload {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chain_id: number;
  nonce: string;
  issued_at: string;
  expiration_time?: string;
  not_before?: string;
  request_id?: string;
  resources: string[];
}

/**
 * Discovery + helper RPCs for the IBC-Eureka, NEAR Chain Signatures,
 * BitVM2, Hyperbridge, Stargate V2 Hydra, Universal Resolver, SIWT,
 * KERI, MPC pre-sign / PKR, global supply, and Institution-identity
 * modules.
 *
 * State-bearing dispatch (party allocation, threshold sign, mint apply)
 * lives on the individual adapter clients; this class gives wallets and
 * SDK consumers read access to the new modules.
 */
export class DiscoveryClient {
  constructor(private readonly rpc: RpcClient) {}

  /** IBC-Eureka commitment domain tag (precompile 0x1020 prepends this). */
  async ibcEurekaCommitmentTag(): Promise<unknown> {
    return this.rpc.call('tenzro_ibcEurekaCommitmentTag', []);
  }

  /** NEAR Chain Signatures `epsilon` derivation for (predecessor, path). */
  async nearChainSigEpsilon(predecessor: string, path: string): Promise<unknown> {
    return this.rpc.call('tenzro_nearChainSigEpsilon', { predecessor, path });
  }

  /** Supported BitVM2 / Clementine verifier kinds. */
  async bitvm2VerifierKinds(): Promise<unknown> {
    return this.rpc.call('tenzro_bitvm2VerifierKinds', []);
  }

  /** Default Hyperbridge mint-control policy (post-2026-04-13 hardening). */
  async hyperbridgeMintControlsDefault(): Promise<unknown> {
    return this.rpc.call('tenzro_hyperbridgeMintControlsDefault', []);
  }

  /** Verified Stargate V2 Hydra pools. */
  async stargateV2KnownPools(): Promise<unknown> {
    return this.rpc.call('tenzro_stargateV2KnownPools', []);
  }

  /** Methods this Universal Resolver instance can resolve. */
  async universalResolverMethods(): Promise<unknown> {
    return this.rpc.call('tenzro_universalResolverMethods', []);
  }

  /** Build a SIWT canonical-form message from a payload. */
  async siwtBuildMessage(payload: SiwtBuildPayload): Promise<unknown> {
    return this.rpc.call('tenzro_siwtBuildMessage', payload);
  }

  /** Parse a SIWT canonical-form message. */
  async siwtParseMessage(message: string): Promise<unknown> {
    return this.rpc.call('tenzro_siwtParseMessage', { message });
  }

  /** Build a KERI inception event from hex-encoded inputs. */
  async keriBuildInception(params: {
    signing_keys_hex: string[];
    next_key_digests_hex: string[];
    signing_threshold?: number;
    next_threshold?: number;
  }): Promise<unknown> {
    return this.rpc.call('tenzro_keriBuildInception', params);
  }

  /** MPC pre-signing pool stats. */
  async mpcPresignStats(): Promise<unknown> {
    return this.rpc.call('tenzro_mpcPresignStats', []);
  }

  /** MPC PKR scheduler snapshots. */
  async mpcPkrStatus(): Promise<unknown> {
    return this.rpc.call('tenzro_mpcPkrStatus', []);
  }

  /** Read the global-supply policy for an asset. */
  async globalSupplyPolicy(assetId: string): Promise<unknown> {
    return this.rpc.call('tenzro_globalSupplyPolicy', { asset_id: assetId });
  }

  /** Read the global-supply circulating amount for an asset. */
  async globalSupplyCirculating(assetId: string): Promise<unknown> {
    return this.rpc.call('tenzro_globalSupplyCirculating', { asset_id: assetId });
  }

  /** Validate a 20-character ISO 17442 LEI via Mod 97-10. */
  async validateLei(lei: string): Promise<unknown> {
    return this.rpc.call('tenzro_validateLei', { lei });
  }
}
