import { TenzroConfig, MAINNET_CONFIG, TESTNET_CONFIG, LOCAL_CONFIG } from "./config";
import { RpcClient } from "./rpc";
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
import { NftClient } from "./nft";
import { ComplianceClient } from "./compliance";
import { EventsClient } from "./events";
import { DebridgeClient } from "./debridge";
import {
  Block,
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

  constructor(config: TenzroConfig) {
    this.config = config;
    this.rpc = new RpcClient(
      config.endpoint,
      config.apiEndpoint,
      config.timeout
    );
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

  async sendTransaction(params: {
    from: string;
    to: string;
    value: bigint;
    gas_limit?: number;
    gas_price?: number;
  }): Promise<string> {
    const tx: Record<string, unknown> = {
      from: params.from,
      to: params.to,
      value: `0x${params.value.toString(16)}`,
    };
    if (params.gas_limit !== undefined) {
      tx.gas_limit = `0x${params.gas_limit.toString(16)}`;
    }
    if (params.gas_price !== undefined) {
      tx.gas_price = `0x${params.gas_price.toString(16)}`;
    }
    return this.rpc.call<string>("eth_sendRawTransaction", [tx]);
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
