import type { RpcClient } from './rpc';

// ── Types ──

/** Compliance rules registered for a token (ERC-3643). */
export interface ComplianceRules {
  /** Token identifier the rules apply to */
  token_id: string;
  /** Whether KYC verification is required for holders */
  kyc_required: boolean;
  /** Maximum number of token holders (omit for unlimited) */
  holder_limit?: number;
  /** Allowed jurisdictions (ISO 3166-1 alpha-2 codes) */
  allowed_jurisdictions?: string[];
  /** Whether transfer restrictions are active */
  transfer_restricted: boolean;
}

/** Result of a compliance check on a proposed transfer. */
export interface ComplianceResult {
  /** Whether the transfer is compliant */
  compliant: boolean;
  /** Reason for non-compliance (present when compliant is false) */
  reason?: string;
  /** KYC status of the sender */
  sender_kyc?: string;
  /** KYC status of the recipient */
  recipient_kyc?: string;
}

/** Result of freezing or unfreezing an address. */
export interface FreezeResult {
  /** Token identifier */
  token_id: string;
  /** Frozen address */
  address: string;
  /** Whether the address is now frozen */
  frozen: boolean;
  /** Transaction hash */
  tx_hash?: string;
}

// ── Client ──

/**
 * Client for ERC-3643 compliance operations.
 * Supports registering compliance rules for security tokens,
 * checking transfer compliance, and freezing/unfreezing addresses.
 */
export class ComplianceClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Register compliance rules for a token.
   * @param tokenId - Token identifier
   * @param kycRequired - Whether KYC is required for holders
   * @param holderLimit - Optional maximum number of holders
   * @returns The registered compliance rules
   */
  async registerCompliance(
    tokenId: string,
    kycRequired: boolean,
    holderLimit?: number
  ): Promise<ComplianceRules> {
    return this.rpc.call<ComplianceRules>('tenzro_registerCompliance', [
      { token_id: tokenId, kyc_required: kycRequired, holder_limit: holderLimit },
    ]);
  }

  /**
   * Check whether a proposed transfer is compliant with the token's rules.
   * @param tokenId - Token identifier
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Transfer amount as a decimal string
   * @returns Compliance check result
   */
  async checkCompliance(
    tokenId: string,
    from: string,
    to: string,
    amount: string
  ): Promise<ComplianceResult> {
    return this.rpc.call<ComplianceResult>('tenzro_checkCompliance', [
      { token_id: tokenId, from, to, amount },
    ]);
  }

  /**
   * Freeze an address, preventing it from sending or receiving a token.
   * @param tokenId - Token identifier
   * @param address - Address to freeze
   * @returns Freeze result with transaction hash
   */
  async freezeAddress(
    tokenId: string,
    address: string
  ): Promise<FreezeResult> {
    return this.rpc.call<FreezeResult>('tenzro_freezeAddress', [
      { token_id: tokenId, address },
    ]);
  }

  /**
   * Unfreeze a previously frozen address.
   * @param tokenId - Token identifier
   * @param address - Address to unfreeze
   * @returns Freeze result with updated status
   */
  async unfreezeAddress(
    tokenId: string,
    address: string
  ): Promise<FreezeResult> {
    return this.rpc.call<FreezeResult>('tenzro_unfreezeAddress', [
      { token_id: tokenId, address },
    ]);
  }

  /**
   * Get the compliance rules for a token.
   * @param tokenId - Token identifier
   * @returns Compliance rules
   */
  async getCompliance(tokenId: string): Promise<ComplianceRules> {
    return this.rpc.call<ComplianceRules>('tenzro_getCompliance', [
      { token_id: tokenId },
    ]);
  }
}
