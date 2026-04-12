import type { RpcClient } from './rpc';
import type { MintResult, BurnResult, CrossChainSupply } from './types';

/**
 * Client for ERC-7802 cross-chain token interface operations.
 * Supports cross-chain minting, burning, and supply queries
 * for tokens that implement the ERC-7802 standard.
 */
export class Erc7802Client {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Mint tokens on the current chain authorized by a source chain burn.
   * @param token - Token address or symbol
   * @param recipient - Recipient address for the minted tokens
   * @param amount - Amount to mint (decimal string)
   * @param sourceChain - Source chain that authorized this mint
   * @returns Mint result with transaction hash
   */
  async crosschainMint(
    token: string,
    recipient: string,
    amount: string,
    sourceChain: string
  ): Promise<MintResult> {
    return this.rpc.call<MintResult>('tenzro_erc7802CrosschainMint', [
      { token, recipient, amount, source_chain: sourceChain },
    ]);
  }

  /**
   * Burn tokens on the current chain to authorize minting on a target chain.
   * @param token - Token address or symbol
   * @param from - Address to burn tokens from
   * @param amount - Amount to burn (decimal string)
   * @param targetChain - Target chain where tokens will be minted
   * @returns Burn result with transaction hash
   */
  async crosschainBurn(
    token: string,
    from: string,
    amount: string,
    targetChain: string
  ): Promise<BurnResult> {
    return this.rpc.call<BurnResult>('tenzro_erc7802CrosschainBurn', [
      { token, from, amount, target_chain: targetChain },
    ]);
  }

  /**
   * Get the cross-chain supply breakdown for a token.
   * @param token - Token address or symbol
   * @returns Cross-chain supply with per-chain breakdown
   */
  async getCrossChainSupply(token: string): Promise<CrossChainSupply> {
    return this.rpc.call<CrossChainSupply>('tenzro_erc7802GetCrossChainSupply', [
      { token },
    ]);
  }
}
