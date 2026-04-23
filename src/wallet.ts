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
   *
   * **Signing contract:** The Tenzro node canonicalises the transaction hash
   * over `Transaction::hash()`, which includes the server-supplied `timestamp`
   * field. It synchronously verifies the Ed25519 signature before accepting
   * and returns JSON-RPC error `-32003` on an invalid or missing signature.
   *
   * This helper dispatches the bare `{from, to, value}` payload to
   * `eth_sendRawTransaction`; the node will reject it unless the same call
   * also carries `signature`, `public_key`, and explicit `timestamp` matching
   * a client-computed `Transaction::hash()`. For most workflows prefer
   * `tenzro_signAndSendTransaction` directly via `rpc.call(...)` — that path
   * forwards a hex-encoded private key and lets the node assemble, hash,
   * sign, verify, and submit the transaction atomically. See the
   * `crates/tenzro-cli` `wallet send` command for a reference implementation.
   *
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
