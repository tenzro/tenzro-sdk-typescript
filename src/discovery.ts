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
    return this.rpc.call('tenzro_siwtBuildMessage', payload as unknown as Record<string, unknown>);
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

  /**
   * Decentralized MoE shard map for `model_id`: providers holding each
   * `(layer, expert)`, per-expert replication, under-replicated experts,
   * hot experts, and role counts.
   */
  async moeShardMap(modelId: string): Promise<unknown> {
    return this.rpc.call('tenzro_moeShardMap', { model_id: modelId });
  }

  /**
   * Build a dispatch plan from per-token top-k routing decisions.
   * `routings` is `[{token_index, experts: [{layer, expert}]}]`.
   */
  async moePlanDispatch(
    modelId: string,
    routings: Array<{ token_index: number; experts: Array<{ layer: number; expert: number }> }>,
    allowCold = false,
  ): Promise<unknown> {
    return this.rpc.call('tenzro_moePlanDispatch', {
      model_id: modelId,
      routings,
      allow_cold: allowCold,
    });
  }

  /** Current governance-tuned replication policy. */
  async moeReplicationPolicy(): Promise<unknown> {
    return this.rpc.call('tenzro_moeReplicationPolicy', []);
  }

  /** Catalog-side MoE topology for `model_id`. */
  async moeCatalogShape(modelId: string): Promise<unknown> {
    return this.rpc.call('tenzro_moeCatalogShape', { model_id: modelId });
  }

  /**
   * Peer IDs currently discovered on this node's local segment via mDNS.
   * Returns `{ local_peers, count, available }`; `available` is false when
   * local discovery is not running.
   */
  async localPeers(): Promise<unknown> {
    return this.rpc.call('tenzro_localPeers', []);
  }

  /**
   * This node's sustained connectivity tier (`direct` / `relay_only` /
   * `unreachable`). Returns `{ tier, available }`.
   */
  async nodeReachability(): Promise<unknown> {
    return this.rpc.call('tenzro_nodeReachability', []);
  }

  /**
   * This node's hardware self-profile from the ggml device API: build commit,
   * CPU arch, OS, devices, and the derived serving VRAM / backend / capability
   * key.
   */
  async nodeProfile(): Promise<unknown> {
    return this.rpc.call('tenzro_nodeProfile', []);
  }

  /**
   * Deterministic cluster placement for a model across candidate members.
   * Returns the fit decision and, when a cluster forms, the ordered per-member
   * layer stages. When `force` is true a cluster is requested even if one
   * member fits the whole model.
   */
  async clusterPlan(
    model: { layers: number; hidden_dim: number; total_vram_gb: number },
    members: Array<Record<string, unknown>>,
    force = false,
  ): Promise<unknown> {
    return this.rpc.call('tenzro_clusterPlan', {
      model,
      members,
      user_forced: force,
    });
  }

  /**
   * Preview how a downloaded model would be placed using the node's live view:
   * derives the model shape from the GGUF header and discovers LAN members from
   * gossip — no manual dimensions or member list required. `force` requests a
   * cluster even when the model fits one member; `forceSingle` previews
   * single-host placement. Returns the fit decision, discovered members, any
   * rejected members (with reasons), and the proposed per-member layer stages.
   * Call this before {@link ProviderClient.serveModel} to show the operator
   * what serving will do.
   */
  async clusterPreview(
    modelId: string,
    opts: { force?: boolean; forceSingle?: boolean } = {},
  ): Promise<unknown> {
    return this.rpc.call('tenzro_clusterPreview', {
      model_id: modelId,
      user_forced: opts.force ?? false,
      force_single: opts.forceSingle ?? false,
    });
  }
}
