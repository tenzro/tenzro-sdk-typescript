import { TenzroConfig, MAINNET_CONFIG, TESTNET_CONFIG, LOCAL_CONFIG } from "./config";
import { discoverEip6963Provider } from "./eip6963";
import { Eip1193Transport, RpcClient, RpcTransport } from "./rpc";
import { WalletClient } from "./wallet";
import { PasskeyRpcClient } from "./passkey-rpc";
import { TenzroAgentWallet } from "./agent-wallet";
import { InferenceClient } from "./inference";
import { CortexClient } from "./cortex";
import { SettlementClient } from "./settlement";
import { AgentClient } from "./agent";
import { GovernanceClient } from "./governance";
import { IdentityClient } from "./identity";
import { PaymentClient } from "./payment";
import { ProviderClient } from "./provider";
import { StorageClient } from "./storage";
import { DatabaseClient } from "./database";
import { ComputeClient } from "./compute";
import { TaskClient } from "./task";
import { MarketplaceClient } from "./marketplace";
import { SkillClient } from "./skill";
import { ToolClient } from "./tool";
import { CantonClient } from "./canton";
import { StakingClient } from "./staking";
import { TokenClient } from "./token";
import { ContractClient } from "./contract";
import { CryptoClient } from "./crypto";
import { CustodyClient } from "./custody";
import { TeeClient } from "./tee";
import { ZkClient } from "./zk";
import { StreamingClient } from "./streaming";
import { Ap2Client } from "./ap2";
import { BridgeClient } from "./bridge";
import { CcipClient } from "./ccip";
import { AgentPaymentClient } from "./agent-payments";
import { CircuitBreakerClient } from "./circuit-breaker";
import { NanopaymentClient } from "./nanopayment";
import { Eip7702Client } from "./eip7702";
import { Erc7683Client } from "./erc7683";
import { Erc7802Client } from "./erc7802";
import { Erc8004Client } from "./erc8004";
import { WormholeClient } from "./wormhole";
import { IrohClient } from "./iroh";
import { CctClient } from "./cct";
import { NftClient } from "./nft";
import { ComplianceClient } from "./compliance";
import { EventsClient } from "./events";
import { DebridgeClient } from "./debridge";
import { ApiKeyClient } from "./api-key";
import { AuthClient } from "./auth";
import { BondClient } from "./bond";
import { InsuranceClient } from "./insurance";
import { AdaptiveBurnClient } from "./adaptive-burn";
import { SeedAgentClient } from "./seed-agent";
import { QuotaClient } from "./quota";
import { PrincipalChainClient } from "./principal-chain";
import { LifecycleClient } from "./lifecycle";
import { MultimodalClient } from "./multimodal";
import { MemoryClient } from "./memory";
import { ValidatorClient } from "./validator";
import { TrainingInspectionClient } from "./training";
import { SlaClient } from "./sla";
import { SnapshotClient } from "./snapshot";
import { CapitalClient } from "./capital";
import { WorkflowClient } from "./workflow";
import { Permit2Client } from "./permit2";
import { SecureMintClient } from "./secure-mint";
import { StableAssetClient } from "./stable-asset";
import { HyperlaneClient } from "./hyperlane";
import { UrwaClient } from "./urwa";
import { Ivms101Client } from "./ivms101";
import { AttestedClockClient } from "./attested-clock";
import { SignedAgentCardClient } from "./signed-agent-card";
import { WormholeNttClient } from "./wormhole-ntt";
import { BridgeFeeClient } from "./bridge-fee";
import { AxelarClient } from "./axelar";
import { BabylonClient } from "./babylon";
import { CaipClient } from "./caip";
import { DiscoveryClient } from "./discovery";
import {
  Block,
  BlockRange,
  FeeHistory,
  Transaction,
  NodeStatus,
  FaucetResponse,
  HealthResponse,
  NetworkStats,
} from "./types";

/**
 * Main client for interacting with Tenzro Network.
 * Provides access to all network functionality through specialized sub-clients.
 */
export class TenzroClient {
  public readonly auth: AuthClient;
  public readonly apiKey: ApiKeyClient;
  public readonly wallet: WalletClient;
  public readonly passkeyRpc: PasskeyRpcClient;
  /** Composite agent-wallet surface — passkey + bond + Canton mandate
   *  in one named class. The substrate sub-clients
   *  (`passkey`/`bond`/`canton`) hang off `agentWallet` for drop-down
   *  access; most callers use the composite methods (`spawn`,
   *  `postBond`, `actAsParty`, `getRisk`). */
  public readonly agentWallet: TenzroAgentWallet;
  public readonly inference: InferenceClient;
  public readonly cortex: CortexClient;
  public readonly settlement: SettlementClient;
  public readonly agent: AgentClient;
  public readonly governance: GovernanceClient;
  public readonly identity: IdentityClient;
  public readonly payment: PaymentClient;
  public readonly provider: ProviderClient;
  public readonly storage: StorageClient;
  public readonly database: DatabaseClient;
  public readonly compute: ComputeClient;
  public readonly skill: SkillClient;
  public readonly tool: ToolClient;
  public readonly canton: CantonClient;
  public readonly staking: StakingClient;
  public readonly token: TokenClient;
  public readonly contract: ContractClient;
  public readonly crypto: CryptoClient;
  public readonly custody: CustodyClient;
  public readonly tee: TeeClient;
  public readonly zk: ZkClient;
  public readonly streaming: StreamingClient;
  public readonly capital: CapitalClient;
  public readonly workflow: WorkflowClient;
  public readonly permit2: Permit2Client;
  public readonly secureMint: SecureMintClient;
  public readonly stableAsset: StableAssetClient;
  public readonly hyperlane: HyperlaneClient;
  public readonly axelar: AxelarClient;
  public readonly babylon: BabylonClient;
  public readonly caip: CaipClient;
  public readonly discovery: DiscoveryClient;
  public readonly urwa: UrwaClient;
  public readonly ivms101: Ivms101Client;
  public readonly attestedClock: AttestedClockClient;
  public readonly signedAgentCard: SignedAgentCardClient;
  public readonly wormholeNtt: WormholeNttClient;
  public readonly bridgeFee: BridgeFeeClient;

  private readonly rpc: RpcClient;
  private readonly config: TenzroConfig;

  constructor(config: TenzroConfig, transport?: RpcTransport) {
    this.config = config;
    this.rpc = new RpcClient(
      config.endpoint,
      config.apiEndpoint,
      config.timeout,
      transport,
    );
    this.auth = new AuthClient(this.rpc);
    this.apiKey = new ApiKeyClient(this.rpc);
    this.wallet = new WalletClient(this.rpc);
    this.passkeyRpc = new PasskeyRpcClient(this.rpc);
    this.agentWallet = new TenzroAgentWallet(this.rpc);
    this.inference = new InferenceClient(this.rpc);
    this.cortex = new CortexClient(this.rpc);
    this.settlement = new SettlementClient(this.rpc);
    this.agent = new AgentClient(this.rpc);
    this.governance = new GovernanceClient(this.rpc);
    this.identity = new IdentityClient(this.rpc);
    this.payment = new PaymentClient(this.rpc);
    this.provider = new ProviderClient(this.rpc);
    this.storage = new StorageClient(this.rpc);
    this.database = new DatabaseClient(this.rpc);
    this.compute = new ComputeClient(this.rpc);
    this.skill = new SkillClient(this.rpc);
    this.tool = new ToolClient(this.rpc);
    this.canton = new CantonClient(this.rpc);
    this.staking = new StakingClient(this.rpc);
    this.token = new TokenClient(this.rpc);
    this.contract = new ContractClient(this.rpc);
    this.crypto = new CryptoClient(this.rpc);
    this.custody = new CustodyClient(this.rpc);
    this.tee = new TeeClient(this.rpc);
    this.zk = new ZkClient(this.rpc);
    this.streaming = new StreamingClient(this.rpc);
    this.capital = new CapitalClient(this.rpc);
    this.workflow = new WorkflowClient(this.rpc);
    this.permit2 = new Permit2Client(this.rpc);
    this.secureMint = new SecureMintClient(this.rpc);
    this.stableAsset = new StableAssetClient(this.rpc);
    this.hyperlane = new HyperlaneClient(this.rpc);
    this.axelar = new AxelarClient(this.rpc);
    this.babylon = new BabylonClient(this.rpc);
    this.caip = new CaipClient(this.rpc);
    this.discovery = new DiscoveryClient(this.rpc);
    this.urwa = new UrwaClient(this.rpc);
    this.ivms101 = new Ivms101Client(this.rpc);
    this.attestedClock = new AttestedClockClient(this.rpc);
    this.signedAgentCard = new SignedAgentCardClient(this.rpc);
    this.wormholeNtt = new WormholeNttClient(this.rpc);
    this.bridgeFee = new BridgeFeeClient(this.rpc);
  }

  task(): TaskClient {
    return new TaskClient(this.rpc);
  }

  marketplace(): MarketplaceClient {
    return new MarketplaceClient(this.rpc);
  }

  /** Access the AP2 (Agentic Payment Protocol) client. */
  ap2(): Ap2Client {
    return new Ap2Client(this.rpc);
  }

  /** Access the cross-chain bridge client. */
  bridge(): BridgeClient {
    return new BridgeClient(this.rpc);
  }

  /**
   * Access the Chainlink CCIP client. Wraps the `tenzro_ccip*`
   * JSON-RPC namespace on the node (fee quote, send, track,
   * supported chains/tokens/lanes, CCT pool inspection, rate
   * limits, and a router-mediated `bridge` that pins the route
   * to the CCIP adapter).
   */
  ccip(): CcipClient {
    return new CcipClient(this.rpc);
  }

  /** Access the agent payment executor client. */
  agentPayments(): AgentPaymentClient {
    return new AgentPaymentClient(this.rpc);
  }

  /** Access the circuit breaker configuration client. */
  circuitBreaker(): CircuitBreakerClient {
    return new CircuitBreakerClient(this.rpc);
  }

  /** Access the nanopayment channel client. */
  nanopayment(): NanopaymentClient {
    return new NanopaymentClient(this.rpc);
  }

  /**
   * Access the ERC-7683 cross-chain intent settler client.
   *
   * Read RPCs on the origin side (`get_order` / `list_orders` over
   * `7683_origin:` keyspace) plus destination-side fill recording
   * (`record_fill` / `get_fill` / `list_fills` over `7683_dest:`).
   * Order state machine: Open → AwaitingProof → Settled / Refunded /
   * ForceRefundEligible.
   */
  erc7683(): Erc7683Client {
    return new Erc7683Client(this.rpc);
  }

  /**
   * Access the EIP-7702 (Set EOA Account Code) helper client. Wraps
   * `tenzro_eip7702SigningHash`, `tenzro_eip7702BuildDesignator`,
   * `tenzro_eip7702ParseDesignator`, and `tenzro_eip7702ProtocolInfo`.
   * These are stateless helpers — the EOA's secp256k1 signature and
   * the on-chain installation of the designator are performed out of
   * band by the caller.
   */
  eip7702(): Eip7702Client {
    return new Eip7702Client(this.rpc);
  }

  /** Access the ERC-7802 cross-chain token client. */
  erc7802(): Erc7802Client {
    return new Erc7802Client(this.rpc);
  }

  /** Access the ERC-8004 Trustless Agents Registry client. */
  erc8004(): Erc8004Client {
    return new Erc8004Client(this.rpc);
  }

  /** Access the Wormhole cross-chain client. */
  wormhole(): WormholeClient {
    return new WormholeClient(this.rpc);
  }

  /**
   * Access the Iroh consumer surface client for the `tenzro_iroh_*`
   * namespace — endpoint id / ALPNs / publish / fetch over the shared
   * `IrohBackedResolver` (QUIC + Pkarr + iroh-blobs substrate that
   * also backs DA, training gradients, sealed shards, model fetch,
   * agent memory archive, and A2A-over-iroh).
   */
  iroh(): IrohClient {
    return new IrohClient(this.rpc);
  }

  /** Access the TNZO CCT (Chainlink Cross-Chain Token) pool registry client. */
  cct(): CctClient {
    return new CctClient(this.rpc);
  }

  /** Access the NFT client. */
  nft(): NftClient {
    return new NftClient(this.rpc);
  }

  /** Access the compliance client. */
  compliance(): ComplianceClient {
    return new ComplianceClient(this.rpc);
  }

  /** Access the events client. */
  events(): EventsClient {
    return new EventsClient(this.rpc);
  }

  /** Access the deBridge cross-chain client. */
  debridge(): DebridgeClient {
    return new DebridgeClient(this.rpc);
  }

  /** Access the AgentBond client (Spec 9). */
  bond(): BondClient {
    return new BondClient(this.rpc);
  }

  /** Access the AgentBond insurance client (Spec 9). */
  insurance(): InsuranceClient {
    return new InsuranceClient(this.rpc);
  }

  /** Access the adaptive-burn governance dial client. */
  adaptiveBurn(): AdaptiveBurnClient {
    return new AdaptiveBurnClient(this.rpc);
  }

  /** Access the SeedAgent treasury / charter / registry client (Spec 10). */
  seedAgent(): SeedAgentClient {
    return new SeedAgentClient(this.rpc);
  }

  /** Access the node quota / mempool / DA client (Spec 3, 6). */
  quota(): QuotaClient {
    return new QuotaClient(this.rpc);
  }

  /** Access the receipt principal-chain client (Spec 5). */
  principalChain(): PrincipalChainClient {
    return new PrincipalChainClient(this.rpc);
  }

  /** Access the agent lifecycle / kill-switch client. */
  lifecycle(): LifecycleClient {
    return new LifecycleClient(this.rpc);
  }

  /**
   * Access the multi-modal AI client — forecast (timeseries), vision
   * encoders, text embeddings, segmentation, detection, audio (ASR),
   * and video. Each modality exposes catalog browse, list-loaded,
   * load, unload, and one inference verb.
   *
   * Four of the seven `load*Model` paths are wave-1 stubs that return
   * JSON-RPC `-32004` from the node — see `MultimodalClient` rustdoc.
   */
  multimodal(): MultimodalClient {
    return new MultimodalClient(this.rpc);
  }

  /**
   * Access the per-agent memory tier client — Lance vector kNN +
   * Tantivy BM25 with Reciprocal Rank Fusion at k=60 for hybrid
   * search, with DA-backed archival.
   */
  memory(): MemoryClient {
    return new MemoryClient(this.rpc);
  }

  /**
   * Access the validator registry read client — `getValidatorState` /
   * `listValidators` / `listActiveValidators`. Read-only; validators
   * self-register via the staking transaction path.
   */
  validators(): ValidatorClient {
    return new ValidatorClient(this.rpc);
  }

  /**
   * Access the Tenzro Train read-side inspection client — list runs,
   * fetch a single run by task_id, fetch a sealed receipt, and fetch
   * the installed Confidential-tier sealed-shard manifest. Safe to
   * expose to monitoring agents — no write surface.
   */
  trainingInspection(): TrainingInspectionClient {
    return new TrainingInspectionClient(this.rpc);
  }

  /**
   * Access the validator-side SLA fault-detector inspection client.
   * Wraps `tenzro_slaIssueProbe`, `tenzro_slaListOutstandingProbes`,
   * and `tenzro_slaGetParams`. The probe-issuing call is
   * validator-only; on a non-validator node it returns
   * `-32000 SlaManager not initialized`.
   */
  sla(): SlaClient {
    return new SlaClient(this.rpc);
  }

  /**
   * State-sync snapshot client. Wraps `tenzro_listSnapshots`,
   * `tenzro_getSnapshotManifest`, `tenzro_getSnapshotChunk`,
   * `tenzro_offerSnapshot`, and `tenzro_applySnapshotChunk`. Callers
   * MUST verify a manifest's `state_root_hex` against a trusted QC at
   * the same height before calling `offerSnapshot` / `applySnapshotChunk`.
   */
  snapshot(): SnapshotClient {
    return new SnapshotClient(this.rpc);
  }

  static mainnet(): TenzroClient {
    return new TenzroClient(MAINNET_CONFIG);
  }

  static testnet(): TenzroClient {
    return new TenzroClient(TESTNET_CONFIG);
  }

  static local(): TenzroClient {
    return new TenzroClient(LOCAL_CONFIG);
  }

  /**
   * Construct a client that routes RPCs through a browser-extension
   * provider (`window.tenzro`) discovered via EIP-6963.
   *
   * The Tenzro provider handles auth (DPoP-bound JWT) and CAIP-25
   * sessions on its own — the SDK never sees the user's keys or tokens
   * and never opens a direct fetch to `rpc.tenzro.xyz`. All
   * `client.rpc.call(...)` calls become `provider.request(...)` calls.
   *
   * Defaults to the mainnet config for `endpoint` / `apiEndpoint` so
   * REST surfaces (`api.tenzro.xyz`) still work for direct fetches
   * (e.g., `/health`, `/faucet`). Override via `options.config` when
   * targeting testnet or a local node.
   *
   * Throws if no Tenzro provider is announced within `timeoutMs`
   * (default 3000) — wrap the call in a try/catch and render an
   * "Install Tenzro" CTA on `TenzroNotInstalledError`.
   *
   * @example
   * ```ts
   * try {
   *   const client = await TenzroClient.fromInjected();
   *   const block = await client.getLatestBlock();
   * } catch (err) {
   *   if (err instanceof TenzroNotInstalledError) showInstallCta();
   *   else throw err;
   * }
   * ```
   */
  static async fromInjected(options?: {
    config?: TenzroConfig;
    timeoutMs?: number;
    rdns?: string;
  }): Promise<TenzroClient> {
    const detail = await discoverEip6963Provider({
      timeoutMs: options?.timeoutMs,
      rdns: options?.rdns,
    });
    const transport = new Eip1193Transport(detail.provider);
    const config = options?.config ?? MAINNET_CONFIG;
    return new TenzroClient(config, transport);
  }

  // Core blockchain queries

  async getBlockNumber(): Promise<number> {
    const hex = await this.rpc.call<string>("tenzro_blockNumber");
    return parseHex(hex);
  }

  async getBlock(height: number): Promise<Block> {
    return this.rpc.call<Block>("tenzro_getBlock", [{ block_number: height }]);
  }

  async getLatestBlock(): Promise<Block> {
    return this.rpc.call<Block>("tenzro_getBlock", [{ height: "latest" }]);
  }

  /**
   * Fetch a contiguous range of blocks for catch-up sync.
   *
   * Returns up to `maxResults` blocks (default 64, capped at 256). Use
   * `nextHeight` and `moreAvailable` to drive pagination. `moreAvailable`
   * reflects whether the chain has further blocks beyond `nextHeight`,
   * independent of the requested `endHeight`, so a sync loop can step over
   * pruning gaps:
   *
   * ```ts
   * let cur = 0;
   * while (true) {
   *   const r = await client.getBlockRange(cur, cur + 255, 256);
   *   for (const b of r.blocks) { /* ... *\/ }
   *   if (!r.moreAvailable) break;
   *   cur = r.nextHeight;
   * }
   * ```
   */
  async getBlockRange(
    startHeight: number,
    endHeight: number,
    maxResults?: number,
  ): Promise<BlockRange> {
    const params: Record<string, number> = {
      startHeight,
      endHeight,
    };
    if (maxResults !== undefined) {
      params.maxResults = maxResults;
    }
    return this.rpc.call<BlockRange>("tenzro_getBlockRange", params);
  }

  /**
   * Get a transaction by hash.
   *
   * Resolves from finalized storage first, then falls back to the consensus
   * mempool. The returned object's `status` field is `"pending"` while the
   * transaction is in-mempool and `"finalized"` once it has been included in
   * a block — callers polling immediately after broadcast can therefore
   * distinguish "not yet finalized" from "unknown hash" (the RPC returns
   * `null` only when the hash is unknown to both storage and mempool).
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    return this.rpc.call<Transaction | null>("tenzro_getTransaction", [txHash]);
  }

  async getBalance(address: string): Promise<bigint> {
    const hex = await this.rpc.call<string>("tenzro_getBalance", [address]);
    return BigInt(hex);
  }

  async getNonce(address: string): Promise<number> {
    const hex = await this.rpc.call<string>("tenzro_getNonce", [address]);
    return parseHex(hex);
  }

  async getChainId(): Promise<number> {
    const hex = await this.rpc.call<string>("eth_chainId");
    return parseHex(hex);
  }

  /**
   * Returns the current effective gas price in wei (base fee + suggested
   * priority tip). Tracks the EIP-1559 fee market — the value adjusts ±12.5%
   * per block based on parent gas usage vs. the 15M target.
   */
  async getGasPrice(): Promise<bigint> {
    const hex = await this.rpc.call<string>("eth_gasPrice");
    return BigInt(hex);
  }

  /**
   * Returns a suggested EIP-1559 priority fee (tip) in wei. Use this to fill
   * `maxPriorityFeePerGas` on a Type-2 transaction; derive the base-fee
   * portion from `getFeeHistory()` or the parent block's `baseFeePerGas`.
   */
  async getMaxPriorityFeePerGas(): Promise<bigint> {
    const hex = await this.rpc.call<string>("eth_maxPriorityFeePerGas");
    return BigInt(hex);
  }

  /**
   * Returns base-fee history and gas-usage ratios for the last `blockCount`
   * blocks. `newestBlock` is a hex height or `"latest"`. `rewardPercentiles`
   * requests per-block tip percentiles (e.g. `[25, 50, 75]`); pass `undefined`
   * to omit. `baseFeePerGas` returns `blockCount + 1` entries — the trailing
   * entry is the predicted base fee for the next block. Used by wallets to
   * model `maxFeePerGas` and `maxPriorityFeePerGas`.
   */
  async getFeeHistory(
    blockCount: number,
    newestBlock: string = "latest",
    rewardPercentiles?: number[],
  ): Promise<FeeHistory> {
    const params: unknown[] = [
      `0x${blockCount.toString(16)}`,
      newestBlock,
      rewardPercentiles ?? [],
    ];
    return this.rpc.call<FeeHistory>("eth_feeHistory", params);
  }

  /**
   * Sign and send a TNZO transfer atomically via the node's hybrid-signing
   * path (`tenzro_signAndSendTransaction`).
   *
   * The node identifies the signing wallet from the ambient auth context
   * (DPoP-bound bearer JWT), constructs the canonical `Transaction::hash()`
   * preimage including the PQ public key, signs both the Ed25519 and
   * ML-DSA-65 legs, verifies them, and submits atomically. Private keys
   * never travel over the wire.
   */
  async sendTransaction(params: {
    from: string;
    to: string;
    value: bigint;
    gas_limit?: number;
    gas_price?: number;
    nonce?: number;
    chain_id?: number;
  }): Promise<string> {
    let { nonce, chain_id } = params;
    if (nonce === undefined) {
      const nonceHex = await this.rpc.call<string>("tenzro_getNonce", [params.from]);
      nonce = parseHex(nonceHex);
    }
    if (chain_id === undefined) {
      const chainHex = await this.rpc.call<string>("eth_chainId", []);
      chain_id = parseHex(chainHex);
    }
    return this.rpc.call<string>("tenzro_signAndSendTransaction", {
      from: params.from,
      to: params.to,
      value: params.value.toString(),
      gas_limit: params.gas_limit ?? 21000,
      gas_price: params.gas_price ?? 1_000_000_000,
      nonce,
      chain_id,
    });
  }

  // Node status and network info

  async nodeInfo(): Promise<NodeStatus> {
    return this.rpc.call<NodeStatus>("tenzro_nodeInfo");
  }

  async getStatus(): Promise<NodeStatus> {
    return this.rpc.get<NodeStatus>("/status");
  }

  async totalSupply(): Promise<string> {
    return this.rpc.call<string>("tenzro_totalSupply");
  }

  async peerCount(): Promise<number> {
    const hex = await this.rpc.call<string>("tenzro_peerCount");
    return parseHex(hex);
  }

  /**
   * Gets the libp2p network metrics snapshot.
   *
   * Returns counters and gauges from `tenzro_network::NetworkMetrics`,
   * including `peer_address_migrations_total` for QUIC path migration /
   * mobile network switch / NAT rebinding observability.
   */
  async getNetworkStats(): Promise<NetworkStats> {
    return this.rpc.call<NetworkStats>("tenzro_getNetworkStats");
  }

  async isSyncing(): Promise<boolean> {
    return this.rpc.call<boolean>("tenzro_syncing");
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.rpc.call<string>("eth_chainId");
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<HealthResponse> {
    return this.rpc.get<HealthResponse>("/health");
  }

  async requestFaucet(address: string): Promise<FaucetResponse> {
    return this.rpc.post<FaucetResponse>("/faucet", { address });
  }

  /**
   * Gets the finalized block height.
   * @returns Finalized block number
   */
  async getFinalizedBlock(): Promise<number> {
    const hex = await this.rpc.call<string>("tenzro_getFinalizedBlock");
    return parseHex(hex);
  }

  /**
   * Exports the node configuration.
   * @returns Node configuration object
   */
  async exportConfig(): Promise<any> {
    return this.rpc.call("tenzro_exportConfig");
  }

  /**
   * Gets transaction history for an address.
   * @param address - The address to query
   * @param limit - Optional maximum number of transactions to return
   * @returns Transaction history
   */
  async getTransactionHistory(address: string, limit?: number): Promise<any> {
    return this.rpc.call("tenzro_getTransactionHistory", [{ address, limit }]);
  }

  /**
   * Lists all accounts.
   * @returns Array of account information
   */
  async listAccounts(): Promise<any> {
    return this.rpc.call("tenzro_listAccounts");
  }

  // Getters

  get endpoint(): string {
    return this.config.endpoint;
  }

  get apiEndpoint(): string {
    return this.rpc.getApiEndpoint();
  }

  get chainId(): number | undefined {
    return this.config.chainId;
  }
}

/**
 * Parse a hex string (with or without 0x prefix) to a number.
 */
function parseHex(hex: string): number {
  if (hex.startsWith("0x")) {
    return parseInt(hex.slice(2), 16);
  }
  return parseInt(hex, 16);
}
