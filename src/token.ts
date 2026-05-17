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
}
