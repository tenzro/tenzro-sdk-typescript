import type { RpcClient } from './rpc';

/**
 * The deterministic CREATE2 address of the wTNZO ERC-20 pointer contract on EVM.
 * All VMs (EVM, SVM, DAML) share the same underlying native TNZO balance via
 * the Sei V2 pointer model -- this address is the EVM representation.
 */
export const WTNZO_EVM_ADDRESS = '0x7a4bcb13a6b2b384c284b5caa6e5ef3126527f93';

// ── Parameter types ──

/** Parameters for creating a new token via the factory. */
export interface CreateTokenParams {
  /** Token name (e.g. "Tenzro Rewards") */
  name: string;
  /** Token ticker symbol (e.g. "TRW") */
  symbol: string;
  /** Number of decimals (default: 18) */
  decimals?: number;
  /** Initial supply as a decimal string (e.g. "1000000") */
  initial_supply: string;
  /** Creator address */
  creator: string;
  /** Target VM: "evm", "svm", or "daml" */
  vm_type?: string;
}

/** Parameters for looking up a token. */
export interface GetTokenInfoParams {
  /** Token symbol (e.g. "TNZO") */
  symbol?: string;
  /** EVM contract address */
  address?: string;
  /** Unified token ID */
  token_id?: string;
}

/** Parameters for listing tokens. */
export interface ListTokensParams {
  /** Filter by VM type: "evm", "svm", "daml" */
  vm_type?: string;
}

/** Parameters for a cross-VM token transfer. */
export interface CrossVmTransferParams {
  /** Sender address */
  from_address: string;
  /** Recipient address */
  to_address: string;
  /** Amount as a decimal string */
  amount: string;
  /** Source VM: "evm", "svm", "daml", or "native" */
  from_vm: string;
  /** Destination VM: "evm", "svm", "daml", or "native" */
  to_vm: string;
  /** Token symbol (default: "TNZO") */
  token?: string;
}

// ── Return types ──

/** Information about a registered token. */
export interface TokenInfo {
  /** Unique token identifier */
  token_id: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Number of decimals */
  decimals: number;
  /** Total supply as a decimal string */
  total_supply: string;
  /** Creator address */
  creator: string;
  /** VM type the token was deployed on */
  vm_type: string;
  /** EVM contract address (if applicable) */
  evm_address?: string;
  /** SVM SPL mint address (if applicable) */
  svm_mint?: string;
  /** Canton DAML CIP-56 template identifier (if applicable) */
  daml_template_id?: string;
  /** Tempo L1 TIP-20 contract address (if applicable) */
  tempo_address?: string;
  /** Transaction hash of the creation */
  tx_hash?: string;
}

/** Result of listing tokens. */
export interface TokenListResult {
  /** Array of registered tokens */
  tokens: TokenInfo[];
  /** Total number of tokens matching the filter */
  total: number;
}

/** Native TNZO view (18 decimals). */
export interface NativeBalance {
  /** Balance in wei (decimal string) */
  balance_wei: string;
  /** Number of decimals (always 18) */
  decimals: number;
}

/** EVM wTNZO ERC-20 view — same wei as native, 18 decimals. */
export interface EvmBalance {
  /** Balance in wei (decimal string) */
  balance_wei: string;
  /** Number of decimals (always 18) */
  decimals: number;
}

/** SVM wTNZO SPL view — 9-decimal truncation of native balance. */
export interface SvmBalance {
  /** Balance in SPL base units (decimal string, 9 decimals) */
  balance_base_units: string;
  /** Number of decimals (always 9) */
  decimals: number;
}

/** DAML CIP-56 holding view — same wei as native, 18 decimals. */
export interface DamlBalance {
  /** Holding amount in wei (decimal string) */
  amount_wei: string;
  /** Number of decimals (always 18) */
  decimals: number;
}

/** Token balance across all four VM views (pointer model). */
export interface TokenBalance {
  /** Address queried */
  address: string;
  /** Native TNZO balance (18-decimal wei) */
  native: NativeBalance;
  /** EVM wTNZO ERC-20 view — tracks native 1:1 */
  evm_wtnzo: EvmBalance;
  /** SVM wTNZO SPL view — 9-decimal truncation */
  svm_wtnzo: SvmBalance;
  /** DAML CIP-56 holding view — tracks native 1:1 */
  daml_holding: DamlBalance;
}

/** Result of wrapping native TNZO into a VM representation. */
export interface WrapResult {
  /** Transaction hash */
  tx_hash: string;
  /** Wrapped amount as a decimal string */
  amount: string;
  /** Target VM */
  vm_type: string;
  /** Status */
  status: string;
}

/** Result of a cross-VM transfer. */
export interface TransferResult {
  /** Transaction hash */
  tx_hash: string;
  /** Transferred amount as a decimal string */
  amount: string;
  /** Source VM */
  from_vm: string;
  /** Destination VM */
  to_vm: string;
  /** Status */
  status: string;
}

// ── Treasury multisig types ──

/** Treasury withdrawer/threshold configuration */
export interface TreasuryConfig {
  /** Authorized withdrawer addresses (0x-prefixed hex) */
  withdrawers: string[];
  /** Approvals required per withdrawal */
  threshold: number;
}

/** Parameters for approving a treasury withdrawal */
export interface TreasuryApproveWithdrawalParams {
  /** Withdrawal identifier shared by all approvers */
  withdrawal_id: string;
  /** Asset identifier (e.g. "TNZO") */
  asset_id: string;
  /** Amount in base units (decimal string) */
  amount: string;
  /** Approver address (0x-prefixed hex) — must be an authorized withdrawer */
  approver: string;
  /** Signature key type: "ed25519" (default) or "secp256k1" */
  key_type?: string;
  /** Approver public key (hex) */
  public_key: string;
  /**
   * Hex signature over
   * `"tenzro/treasury/withdrawal-approval" || withdrawal_id || asset_id || amount_le`
   */
  signature: string;
}

/** Result of approving a treasury withdrawal */
export interface TreasuryApproval {
  /** Withdrawal identifier */
  withdrawal_id: string;
  /** Asset identifier */
  asset_id: string;
  /** Amount in base units (decimal string) */
  amount: string;
  /** Distinct approvals recorded so far */
  approvals: number;
  /** Approvals required */
  threshold: number;
  /** Whether the threshold is now reached */
  threshold_reached: boolean;
}

/** Result of executing a treasury withdrawal */
export interface TreasuryExecution {
  /** Withdrawal identifier */
  withdrawal_id: string;
  /** Asset identifier */
  asset_id: string;
  /** Amount in base units (decimal string) */
  amount: string;
  /** Whether the withdrawal executed */
  executed: boolean;
  /** Treasury balance for the asset after execution (decimal string) */
  remaining_balance: string;
}

/** Pending withdrawal approval state */
export interface PendingWithdrawal {
  /** Withdrawal identifier */
  withdrawal_id: string;
  /** Asset identifier */
  asset_id: string;
  /** Amount in base units (decimal string) */
  amount: string;
  /** Approver addresses recorded so far (0x-prefixed hex) */
  approvers: string[];
  /** Distinct approvals recorded so far */
  approvals: number;
  /** Approvals required */
  threshold: number;
}

// ── Client ──

/**
 * Client for token registry and cross-VM token operations.
 * Supports creating ERC-20 tokens, querying the unified registry,
 * wrapping native TNZO, and atomic cross-VM transfers.
 */
export class TokenClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a new ERC-20 token via the factory and register it
   * in the unified token registry.
   * @param params - Token creation parameters
   * @returns Information about the newly created token
   */
  async createToken(params: CreateTokenParams): Promise<TokenInfo> {
    return this.rpc.call<TokenInfo>('tenzro_createToken', [params]);
  }

  /**
   * Look up a token by symbol, EVM address, or token ID.
   * @param params - At least one of symbol, address, or token_id
   * @returns Token information
   */
  async getTokenInfo(params: GetTokenInfoParams): Promise<TokenInfo> {
    return this.rpc.call<TokenInfo>('tenzro_getToken', [params]);
  }

  /**
   * List registered tokens with an optional VM type filter.
   * @param params - Optional filter parameters
   * @returns List of tokens
   */
  async listTokens(params?: ListTokensParams): Promise<TokenListResult> {
    return this.rpc.call<TokenListResult>('tenzro_listTokens', [params ?? {}]);
  }

  /**
   * Get TNZO balance across all VMs with decimal conversion.
   * @param address - Address to query
   * @param token - Token symbol (default: "TNZO")
   * @returns Token balance with optional per-VM breakdown
   */
  async getTokenBalance(address: string, token?: string): Promise<TokenBalance> {
    return this.rpc.call<TokenBalance>('tenzro_getTokenBalance', [
      { address, token: token ?? 'TNZO' },
    ]);
  }

  /**
   * Wrap native TNZO to a VM-specific representation.
   * In the pointer model this is a no-op that returns the same balance.
   * @param address - Address performing the wrap
   * @param amount - Amount to wrap as a decimal string
   * @param toVm - Target VM: "evm", "svm", or "daml"
   * @returns Wrap result
   */
  async wrapTnzo(address: string, amount: string, toVm: string): Promise<WrapResult> {
    return this.rpc.call<WrapResult>('tenzro_wrapTnzo', [
      { address, amount, vm_type: toVm },
    ]);
  }

  /**
   * Perform an atomic cross-VM token transfer using the pointer model.
   * @param params - Transfer parameters
   * @returns Transfer result
   */
  async crossVmTransfer(params: CrossVmTransferParams): Promise<TransferResult> {
    return this.rpc.call<TransferResult>('tenzro_crossVmTransfer', [params]);
  }

  // ── Treasury multisig withdrawals ──
  //
  // Withdrawer/threshold configuration requires the operator admin token
  // (TENZRO_ADMIN_TOKEN). Approval and execution are authorized by the
  // approver's signature over the domain-separated preimage and the
  // configured threshold.

  /**
   * Authorize a treasury withdrawer address (admin token required).
   * @param address - Withdrawer address (0x-prefixed hex)
   * @returns Updated withdrawer set and threshold
   */
  async treasuryAddWithdrawer(address: string): Promise<TreasuryConfig> {
    return this.rpc.call<TreasuryConfig>('tenzro_treasuryAddWithdrawer', [
      { address },
    ]);
  }

  /**
   * Remove an authorized treasury withdrawer address (admin token required).
   * @param address - Withdrawer address (0x-prefixed hex)
   * @returns Updated withdrawer set and threshold
   */
  async treasuryRemoveWithdrawer(address: string): Promise<TreasuryConfig> {
    return this.rpc.call<TreasuryConfig>('tenzro_treasuryRemoveWithdrawer', [
      { address },
    ]);
  }

  /**
   * Set the treasury withdrawal approval threshold (admin token required).
   * @param threshold - Distinct approvals required per withdrawal
   * @returns Updated withdrawer set and threshold
   */
  async treasurySetWithdrawalThreshold(threshold: number): Promise<TreasuryConfig> {
    return this.rpc.call<TreasuryConfig>('tenzro_treasurySetWithdrawalThreshold', [
      { threshold },
    ]);
  }

  /**
   * Approve a treasury withdrawal with a signed approval.
   * @param params - Withdrawal triple plus the approver's address, key, and signature
   * @returns Approval count and whether the threshold is reached
   */
  async treasuryApproveWithdrawal(
    params: TreasuryApproveWithdrawalParams
  ): Promise<TreasuryApproval> {
    return this.rpc.call<TreasuryApproval>('tenzro_treasuryApproveWithdrawal', [
      params,
    ]);
  }

  /**
   * Execute a treasury withdrawal once the approval threshold is reached.
   * The (withdrawal_id, asset_id, amount) triple must match the approved
   * withdrawal exactly.
   * @param withdrawalId - Withdrawal identifier
   * @param assetId - Asset identifier (e.g. "TNZO")
   * @param amount - Amount in base units (decimal string)
   * @returns Execution result with the remaining treasury balance
   */
  async treasuryExecuteWithdrawal(
    withdrawalId: string,
    assetId: string,
    amount: string
  ): Promise<TreasuryExecution> {
    return this.rpc.call<TreasuryExecution>('tenzro_treasuryExecuteWithdrawal', [
      { withdrawal_id: withdrawalId, asset_id: assetId, amount },
    ]);
  }

  /**
   * Get a pending treasury withdrawal's approval state.
   * @param withdrawalId - Withdrawal identifier
   * @returns Pending withdrawal state, or null when none matches
   */
  async treasuryGetPendingWithdrawal(
    withdrawalId: string
  ): Promise<PendingWithdrawal | null> {
    return this.rpc.call<PendingWithdrawal | null>(
      'tenzro_treasuryGetPendingWithdrawal',
      [{ withdrawal_id: withdrawalId }]
    );
  }
}
