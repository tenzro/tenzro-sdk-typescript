import { TenzroConfig, MAINNET_CONFIG, TESTNET_CONFIG, LOCAL_CONFIG } from "./config";
import { discoverEip6963Provider } from "./eip6963";
import { Eip1193Transport, RpcClient, RpcTransport } from "./rpc";
import { WalletClient } from "./wallet";
import { InferenceClient } from "./inference";
import { SettlementClient } from "./settlement";
import { AgentClient } from "./agent";
import { GovernanceClient } from "./governance";
import { IdentityClient } from "./identity";
import { PaymentClient } from "./payment";
import { ProviderClient } from "./provider";
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
import { AgentPaymentClient } from "./agent-payments";
import { CircuitBreakerClient } from "./circuit-breaker";
import { NanopaymentClient } from "./nanopayment";
import { Erc7802Client } from "./erc7802";
import { Erc8004Client } from "./erc8004";
import { WormholeClient } from "./wormhole";
import { CctClient } from "./cct";
import { NftClient } from "./nft";
import { ComplianceClient } from "./compliance";
import { EventsClient } from "./events";
import { DebridgeClient } from "./debridge";
import { AuthClient } from "./auth";
import {
  Block,
  BlockRange,
  FeeHistory,
  Transaction,
  NodeStatus,
  FaucetResponse,
  HealthResponse,
} from "./types";

/**
 * Main client for interacting with Tenzro Network.
 * Provides access to all network functionality through specialized sub-clients.
 */
export class TenzroClient {
  public readonly auth: AuthClient;
  public readonly wallet: WalletClient;
  public readonly inference: InferenceClient;
  public readonly settlement: SettlementClient;
  public readonly agent: AgentClient;
  public readonly governance: GovernanceClient;
  public readonly identity: IdentityClient;
  public readonly payment: PaymentClient;
  public readonly provider: ProviderClient;
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
    this.wallet = new WalletClient(this.rpc);
    this.inference = new InferenceClient(this.rpc);
    this.settlement = new SettlementClient(this.rpc);
    this.agent = new AgentClient(this.rpc);
    this.governance = new GovernanceClient(this.rpc);
    this.identity = new IdentityClient(this.rpc);
    this.payment = new PaymentClient(this.rpc);
    this.provider = new ProviderClient(this.rpc);
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
   * and never opens a direct fetch to `rpc.tenzro.network`. All
   * `client.rpc.call(...)` calls become `provider.request(...)` calls.
   *
   * Defaults to the mainnet config for `endpoint` / `apiEndpoint` so
   * REST surfaces (`api.tenzro.network`) still work for direct fetches
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
