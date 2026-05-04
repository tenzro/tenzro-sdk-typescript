import { RpcClient } from "./rpc";
import { WalletInfo, AccountInfo, Address } from "./types";

/**
 * Client for wallet operations.
 * Supports MPC threshold wallets and standard accounts.
 */
export class WalletClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Create a new chain-agnostic 2-of-3 Ed25519 MPC wallet.
   *
   * Tenzro wallets are chain-agnostic by design — a single wallet projects
   * into EVM, SVM, and Canton via the pointer-token model, so there is no
   * per-chain parameter. Use `crossVmTransfer` / `wrapTnzo` for VM-specific
   * operations and the bridge clients (LayerZero V2, Chainlink CCIP, deBridge,
   * Wormhole NTT) for sends to external chains.
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
   * Sign and send a TNZO transfer atomically via the node's hybrid-signing
   * path (`tenzro_signAndSendTransaction`).
   *
   * The node identifies the signing wallet from the ambient auth context
   * (DPoP-bound bearer JWT), constructs the canonical `Transaction::hash()`
   * preimage including the PQ public key, signs both the Ed25519 and
   * ML-DSA-65 legs, verifies them against the preimage, and submits to
   * the mempool. Private keys never travel over the wire.
   *
   * @returns The submitted transaction hash (64-char lowercase hex).
   */
  async signAndSend(args: {
    from: Address;
    to: Address;
    value: bigint;
    gasLimit?: number;
    gasPrice?: number;
    nonce?: number;
    chainId?: number;
  }): Promise<string> {
    let { nonce, chainId } = args;
    if (nonce === undefined) {
      const nonceHex = await this.rpc.call<string>("tenzro_getNonce", [args.from]);
      nonce = parseInt(nonceHex, 16);
    }
    if (chainId === undefined) {
      const chainHex = await this.rpc.call<string>("eth_chainId", []);
      chainId = parseInt(chainHex, 16);
    }
    return this.rpc.call<string>("tenzro_signAndSendTransaction", {
      from: args.from,
      to: args.to,
      value: args.value.toString(),
      gas_limit: args.gasLimit ?? 21000,
      gas_price: args.gasPrice ?? 1_000_000_000,
      nonce,
      chain_id: chainId,
    });
  }
}
