import { RpcClient } from "./rpc";
import { WalletInfo, AccountInfo, Address } from "./types";

/**
 * Client for wallet operations.
 * Supports MPC threshold wallets and standard accounts.
 */
export class WalletClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Create a new MPC threshold wallet (default 2-of-3).
   */
  async createWallet(): Promise<WalletInfo> {
    return this.rpc.call<WalletInfo>("tenzro_createWallet");
  }

  /**
   * Create a new account with a single keypair.
   * @param keyType - "ed25519" or "secp256k1" (default: ed25519)
   */
  async createAccount(keyType?: "ed25519" | "secp256k1"): Promise<AccountInfo> {
    return this.rpc.call<AccountInfo>("tenzro_createAccount", [
      { key_type: keyType },
    ]);
  }

  /**
   * Get the native token balance (TNZO) for an address.
   * Returns balance as bigint (in smallest unit).
   */
  async getBalance(address: Address): Promise<bigint> {
    const hex = await this.rpc.call<string>("tenzro_getBalance", [address]);
    return BigInt(hex);
  }

  /**
   * Get the token balance for an address (default: TNZO).
   * Returns balance as string (human-readable with decimals).
   */
  async getTokenBalance(address: Address): Promise<string> {
    return this.rpc.call<string>("tenzro_tokenBalance", [address]);
  }

  /**
   * Get the nonce for an address (for transaction ordering).
   */
  async getNonce(address: Address): Promise<number> {
    const hex = await this.rpc.call<string>("tenzro_getNonce", [address]);
    return parseInt(hex, 16);
  }

  /**
   * Send a transaction from one address to another.
   * @param from - Sender address
   * @param to - Recipient address
   * @param value - Amount to transfer (in smallest unit)
   * @param gasLimit - Optional gas limit
   * @param gasPrice - Optional gas price
   * @returns Transaction hash
   */
  async sendTransaction(
    from: Address,
    to: Address,
    value: bigint,
    gasLimit?: number,
    gasPrice?: number
  ): Promise<string> {
    const tx: Record<string, unknown> = {
      from,
      to,
      value: `0x${value.toString(16)}`,
    };
    if (gasLimit !== undefined) {
      tx.gas_limit = `0x${gasLimit.toString(16)}`;
    }
    if (gasPrice !== undefined) {
      tx.gas_price = `0x${gasPrice.toString(16)}`;
    }
    return this.rpc.call<string>("eth_sendRawTransaction", [tx]);
  }
}
