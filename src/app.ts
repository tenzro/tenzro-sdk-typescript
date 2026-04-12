import { TenzroClient } from "./client";
import { TenzroConfig, TESTNET_CONFIG } from "./config";
import { RpcClient } from "./rpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Master wallet information derived from the developer's private key. */
export interface MasterWallet {
  /** Hex-encoded master wallet address (with 0x prefix) */
  address: string;
  /** Hex-encoded public key */
  publicKey: string;
}

/** A user sub-wallet created and funded by the master wallet. */
export interface UserWallet {
  /** Hex-encoded user wallet address (with 0x prefix) */
  address: string;
  /** Human-readable label */
  label: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Optional spending policy applied to this wallet */
  spendingPolicy?: SpendingPolicy;
}

/** Result of funding a user wallet. */
export interface FundResult {
  /** Transaction hash of the funding transfer */
  txHash: string;
  /** Amount transferred in wei */
  amount: bigint;
}

/** Spending limits enforced on a user wallet. */
export interface SpendingPolicy {
  /** Maximum amount (wei) per 24-hour rolling window */
  dailyLimit: bigint;
  /** Maximum amount (wei) per single transaction */
  perTxLimit: bigint;
  /** Amount already spent in the current daily window */
  dailySpent: bigint;
}

/** A scoped session key with temporary, limited permissions. */
export interface SessionKey {
  /** Unique session identifier */
  sessionId: string;
  /** ISO-8601 expiry timestamp */
  expiresAt: string;
  /** Allowed operation names (e.g. "transfer", "inference") */
  operations: string[];
}

/** Aggregated usage statistics for the master wallet. */
export interface UsageStats {
  /** Total gas spent across all sponsored transactions (wei) */
  totalGasSpent: bigint;
  /** Estimated total cost of inference requests (TNZO) */
  totalInferenceCost: number;
  /** Total bridge fees paid (wei) */
  totalBridgeFees: bigint;
  /** Number of user wallets created */
  userCount: number;
  /** Total number of sponsored transactions */
  transactionCount: number;
}

/** Result of a sponsored inference request. */
export interface InferenceResult {
  /** Model output text */
  output: string;
  /** Number of tokens generated */
  tokens: number;
  /** Estimated cost in TNZO */
  cost: number;
  /** Model used */
  modelId: string;
}

/** Result of a sponsored agent registration. */
export interface AgentResult {
  /** Registered agent ID */
  agentId: string;
  /** Agent's wallet address */
  walletAddress: string;
}

/** Result of a sponsored bridge transfer. */
export interface BridgeResult {
  /** Bridge transaction hash */
  txHash: string;
  /** Current status */
  status: string;
}

/** Result of a sponsored task posting. */
export interface TaskResult {
  /** Posted task ID */
  taskId: string;
}

/** Result of a sponsored transaction. */
export interface TxResult {
  /** Transaction hash */
  txHash: string;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface AppState {
  users: Map<string, UserWallet>;
  policies: Map<string, SpendingPolicy>;
  sessions: Map<string, SessionKey>;
  stats: UsageStats;
}

function newAppState(): AppState {
  return {
    users: new Map(),
    policies: new Map(),
    sessions: new Map(),
    stats: {
      totalGasSpent: 0n,
      totalInferenceCost: 0,
      totalBridgeFees: 0n,
      userCount: 0,
      transactionCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// AppClient
// ---------------------------------------------------------------------------

/**
 * Application client -- the primary interface for developers building on Tenzro.
 *
 * Wraps a master wallet and provides methods to:
 * - Create and fund user wallets
 * - Sponsor gas for user transactions (paymaster)
 * - Manage spending policies and session keys
 * - Track usage and costs
 *
 * @example
 * ```ts
 * const app = await AppClient.create("https://rpc.tenzro.network", "your-master-wallet-private-key");
 *
 * // Create a user wallet (funded from master)
 * const user = await app.createUserWallet("alice", 100_000_000_000_000_000n);
 *
 * // Sponsor an inference request
 * const result = await app.sponsorInference(user.address, "gemma3-270m", "Hello world");
 *
 * // Check usage
 * const stats = await app.getUsageStats();
 * console.log("Total gas spent:", stats.totalGasSpent);
 * ```
 */
export class AppClient {
  private rpc: RpcClient;
  private tenzroClient: TenzroClient;
  private masterWalletInfo: MasterWallet;
  private state: AppState;

  private constructor(
    rpc: RpcClient,
    tenzroClient: TenzroClient,
    masterWallet: MasterWallet,
  ) {
    this.rpc = rpc;
    this.tenzroClient = tenzroClient;
    this.masterWalletInfo = masterWallet;
    this.state = newAppState();
  }

  /**
   * Create a new AppClient with a master wallet private key.
   *
   * The private key should be the hex-encoded Ed25519 or Secp256k1 key that
   * controls the developer's master wallet.
   */
  static async create(
    rpcUrl: string,
    masterPrivateKey: string,
  ): Promise<AppClient> {
    const config: TenzroConfig = { endpoint: rpcUrl, timeout: 30_000 };
    const tenzroClient = new TenzroClient(config);
    const rpc = new RpcClient(rpcUrl, undefined, 30_000);

    // Derive master wallet address from the private key
    const walletInfo = await rpc.call<{ address: string; public_key: string }>(
      "tenzro_createAccount",
      [{ private_key: masterPrivateKey }],
    );

    const masterWallet: MasterWallet = {
      address: walletInfo.address ?? "0x0",
      publicKey: walletInfo.public_key ?? "",
    };

    return new AppClient(rpc, tenzroClient, masterWallet);
  }

  /**
   * Connect using an API key that resolves to a master wallet on the server.
   */
  static async fromApiKey(
    rpcUrl: string,
    apiKey: string,
  ): Promise<AppClient> {
    const config: TenzroConfig = { endpoint: rpcUrl, timeout: 30_000 };
    const tenzroClient = new TenzroClient(config);
    const rpc = new RpcClient(rpcUrl, undefined, 30_000);

    const walletInfo = await rpc.call<{ address: string; public_key: string }>(
      "tenzro_resolveApiKey",
      [{ api_key: apiKey }],
    );

    const masterWallet: MasterWallet = {
      address: walletInfo.address ?? "0x0",
      publicKey: walletInfo.public_key ?? "",
    };

    return new AppClient(rpc, tenzroClient, masterWallet);
  }

  // -------------------------------------------------------------------------
  // User Management
  // -------------------------------------------------------------------------

  /**
   * Create a sub-wallet for a user, funded from the master wallet.
   *
   * 1. Creates a new keypair via `tenzro_createWallet`
   * 2. Transfers `initialFundingWei` TNZO from master to the new wallet
   * 3. Tracks the user locally for policy enforcement
   */
  async createUserWallet(
    label: string,
    initialFundingWei: bigint,
  ): Promise<UserWallet> {
    const walletInfo = await this.rpc.call<{ address: string }>(
      "tenzro_createWallet",
    );
    const userAddress = walletInfo.address ?? "0x0";

    // Fund from master
    if (initialFundingWei > 0n) {
      await this.rpc.call<string>("eth_sendRawTransaction", [
        {
          from: this.masterWalletInfo.address,
          to: userAddress,
          value: `0x${initialFundingWei.toString(16)}`,
        },
      ]);
    }

    const user: UserWallet = {
      address: userAddress,
      label,
      createdAt: new Date().toISOString(),
    };

    this.state.users.set(userAddress, user);
    this.state.stats.userCount += 1;
    this.state.stats.transactionCount += 1;

    return user;
  }

  /** Fund an existing user wallet from the master wallet. */
  async fundUserWallet(
    userAddress: string,
    amountWei: bigint,
  ): Promise<FundResult> {
    const txHash = await this.rpc.call<string>("eth_sendRawTransaction", [
      {
        from: this.masterWalletInfo.address,
        to: userAddress,
        value: `0x${amountWei.toString(16)}`,
      },
    ]);

    this.state.stats.transactionCount += 1;
    return { txHash, amount: amountWei };
  }

  /** List all user wallets created by this app. */
  async listUserWallets(): Promise<UserWallet[]> {
    return Array.from(this.state.users.values());
  }

  /**
   * Set spending limits for a user wallet.
   * Policies are enforced locally before submitting sponsored transactions.
   */
  async setUserLimits(
    userAddress: string,
    dailyLimit: bigint,
    perTxLimit: bigint,
  ): Promise<SpendingPolicy> {
    const policy: SpendingPolicy = {
      dailyLimit,
      perTxLimit,
      dailySpent: 0n,
    };

    this.state.policies.set(userAddress, policy);

    const user = this.state.users.get(userAddress);
    if (user) {
      user.spendingPolicy = policy;
    }

    return policy;
  }

  /** Create a session key for a user with scoped permissions and expiry. */
  async createSessionKey(
    userAddress: string,
    durationSecs: number,
    allowedOps: string[],
  ): Promise<SessionKey> {
    const now = Math.floor(Date.now() / 1000);
    const prefix = userAddress.slice(0, 8);

    const session: SessionKey = {
      sessionId: `sess_${prefix}_${now.toString(16)}`,
      expiresAt: new Date((now + durationSecs) * 1000).toISOString(),
      operations: allowedOps,
    };

    this.state.sessions.set(session.sessionId, session);
    return session;
  }

  // -------------------------------------------------------------------------
  // Sponsored Operations (master wallet pays)
  // -------------------------------------------------------------------------

  /**
   * Send a transaction on behalf of a user (master pays gas).
   */
  async sponsorTransaction(
    userAddress: string,
    to: string,
    amountWei: bigint,
  ): Promise<TxResult> {
    this.enforceSpendingPolicy(userAddress, amountWei);

    const txHash = await this.rpc.call<string>("eth_sendRawTransaction", [
      {
        from: this.masterWalletInfo.address,
        to,
        value: `0x${amountWei.toString(16)}`,
        sponsor: this.masterWalletInfo.address,
        on_behalf_of: userAddress,
      },
    ]);

    this.state.stats.transactionCount += 1;
    this.state.stats.totalGasSpent += 21_000_000_000_000n;

    const policy = this.state.policies.get(userAddress);
    if (policy) {
      policy.dailySpent += amountWei;
    }

    return { txHash };
  }

  /**
   * Run inference on behalf of a user (master pays).
   */
  async sponsorInference(
    userAddress: string,
    modelId: string,
    message: string,
  ): Promise<InferenceResult> {
    const response = await this.rpc.call<Record<string, any>>(
      "tenzro_chat",
      [
        {
          model: modelId,
          messages: [{ role: "user", content: message }],
          caller_address: this.masterWalletInfo.address,
          on_behalf_of: userAddress,
        },
      ],
    );

    const output =
      response?.choices?.[0]?.message?.content ?? "";
    const tokens = response?.usage?.total_tokens ?? 0;
    const cost = response?.usage?.cost ?? 0;

    this.state.stats.totalInferenceCost += cost;
    this.state.stats.transactionCount += 1;

    return { output, tokens, cost, modelId };
  }

  /**
   * Spawn an agent on behalf of a user (master pays).
   */
  async sponsorAgent(
    userAddress: string,
    agentName: string,
    capabilities: string[],
  ): Promise<AgentResult> {
    const response = await this.rpc.call<{
      agent_id?: string;
      wallet_address?: string;
    }>("tenzro_registerAgent", [
      {
        name: agentName,
        display_name: agentName,
        capabilities,
        creator: this.masterWalletInfo.address,
        on_behalf_of: userAddress,
      },
    ]);

    this.state.stats.transactionCount += 1;

    return {
      agentId: response.agent_id ?? "",
      walletAddress: response.wallet_address ?? "",
    };
  }

  /**
   * Bridge tokens on behalf of a user (master pays bridge fees).
   */
  async sponsorBridge(
    userAddress: string,
    token: string,
    fromChain: string,
    toChain: string,
    amount: string,
    recipient: string,
  ): Promise<BridgeResult> {
    const response = await this.rpc.call<{
      tx_hash?: string;
      status?: string;
      fee?: string;
    }>("tenzro_bridgeTokens", [
      {
        token,
        from_chain: fromChain,
        to_chain: toChain,
        amount,
        recipient,
        fee_payer: this.masterWalletInfo.address,
        on_behalf_of: userAddress,
      },
    ]);

    const fee = BigInt(response.fee ?? "0");
    this.state.stats.totalBridgeFees += fee;
    this.state.stats.transactionCount += 1;

    return {
      txHash: response.tx_hash ?? "",
      status: response.status ?? "pending",
    };
  }

  /**
   * Post a task to the marketplace on behalf of a user (master pays budget).
   */
  async sponsorTask(
    userAddress: string,
    title: string,
    description: string,
    taskType: string,
    budgetWei: bigint,
  ): Promise<TaskResult> {
    this.enforceSpendingPolicy(userAddress, budgetWei);

    const response = await this.rpc.call<{ task_id?: string }>(
      "tenzro_postTask",
      [
        {
          title,
          description,
          task_type: taskType,
          max_price: `0x${budgetWei.toString(16)}`,
          poster: this.masterWalletInfo.address,
          on_behalf_of: userAddress,
        },
      ],
    );

    this.state.stats.transactionCount += 1;

    const policy = this.state.policies.get(userAddress);
    if (policy) {
      policy.dailySpent += budgetWei;
    }

    return { taskId: response.task_id ?? "" };
  }

  // -------------------------------------------------------------------------
  // Master Wallet Info
  // -------------------------------------------------------------------------

  /** Get master wallet balance in wei. */
  async getMasterBalance(): Promise<bigint> {
    const hex = await this.rpc.call<string>("tenzro_getBalance", [
      this.masterWalletInfo.address,
    ]);
    return BigInt(hex);
  }

  /**
   * Get aggregated usage statistics for this app instance.
   * Statistics are tracked locally since the AppClient was created.
   */
  async getUsageStats(): Promise<UsageStats> {
    return { ...this.state.stats };
  }

  /** Returns the master wallet information. */
  get masterWallet(): MasterWallet {
    return this.masterWalletInfo;
  }

  /** Get the underlying TenzroClient for advanced operations. */
  get client(): TenzroClient {
    return this.tenzroClient;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private enforceSpendingPolicy(
    userAddress: string,
    amountWei: bigint,
  ): void {
    const policy = this.state.policies.get(userAddress);
    if (!policy) return;

    if (amountWei > policy.perTxLimit) {
      throw new Error(
        `Amount ${amountWei} exceeds per-transaction limit ${policy.perTxLimit} for user ${userAddress}`,
      );
    }
    if (policy.dailySpent + amountWei > policy.dailyLimit) {
      throw new Error(
        `Amount ${amountWei} would exceed daily limit ${policy.dailyLimit} (already spent ${policy.dailySpent}) for user ${userAddress}`,
      );
    }
  }
}
