import { RpcClient } from "./rpc";
import { WalletInfo, AccountInfo, Address } from "./types";

/**
 * A self-custody hybrid signer: holds an Ed25519 + ML-DSA-65 keypair
 * locally and signs both legs of a Tenzro transaction without the node
 * ever seeing the secret. This is the client side of the self-custody
 * path — TEE-equipped or key-holding runners implement it so
 * `WalletClient.sendSelfCustody` can build the canonical
 * `Transaction::hash()` preimage, obtain both signatures, and submit via
 * `eth_sendRawTransaction`.
 *
 * The server-custodial `WalletClient.signAndSend` path stays the default
 * for runners that bring no local key; this interface is purely additive.
 */
export interface HybridSigner {
  /**
   * Raw 32-byte Ed25519 public key. This IS the account address on the
   * Tenzro native convention — the node's `eth_sendRawTransaction`
   * verifier accepts a raw 32-byte pubkey placed in `from`.
   */
  ed25519PublicKey(): Uint8Array;

  /**
   * ML-DSA-65 verifying key bytes (FIPS 204, exactly 1952) for the
   * mandatory `pq_public_key` field.
   */
  mlDsaVerifyingKey(): Uint8Array;

  /**
   * Sign `message` with both legs. Returns
   * `[ed25519Sig(64), mlDsaSig(3309)]`.
   */
  signHybrid(message: Uint8Array): Promise<[Uint8Array, Uint8Array]>;
}

function hexEncode(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexDecode(input: string): Uint8Array {
  const clean = input.startsWith("0x") ? input.slice(2) : input;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Builds the canonical `Transaction::hash()` preimage for a native TNZO
 * transfer, byte-identical to
 * `tenzro_types::transaction::Transaction::hash`.
 *
 * Preimage order (all integers little-endian):
 * `chain_id ‖ from(32) ‖ to(32) ‖ nonce ‖ gas_limit ‖ gas_price ‖
 * timestamp ‖ tx_type_json ‖ (no memo) ‖ pq_len(u32) ‖ pq_public_key`.
 *
 * `tx_type_json` reproduces serde's externally-tagged
 * `{"Transfer":{"amount":<N>}}` — no whitespace, bare integer.
 */
async function transferTxHash(args: {
  chainId: number;
  from: Uint8Array;
  to: Uint8Array;
  nonce: number;
  gasLimit: number;
  gasPrice: number;
  timestampMs: number;
  amountWei: bigint;
  pqPublicKey: Uint8Array;
}): Promise<Uint8Array> {
  const txTypeJson = new TextEncoder().encode(
    `{"Transfer":{"amount":${args.amountWei.toString()}}}`
  );

  const u64le = (v: number): Uint8Array => {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt(v), true);
    return new Uint8Array(buf);
  };
  const i64le = (v: number): Uint8Array => {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, BigInt(v), true);
    return new Uint8Array(buf);
  };
  const u32le = (v: number): Uint8Array => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, v, true);
    return new Uint8Array(buf);
  };

  const parts: Uint8Array[] = [
    u64le(args.chainId),
    args.from,
    args.to,
    u64le(args.nonce),
    u64le(args.gasLimit),
    u64le(args.gasPrice),
    i64le(args.timestampMs),
    txTypeJson,
    // memo is None on native transfers — nothing appended.
    u32le(args.pqPublicKey.length),
    args.pqPublicKey,
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const preimage = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    preimage.set(p, off);
    off += p.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", preimage);
  return new Uint8Array(digest);
}

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

  /**
   * Sign a TNZO transfer locally with a self-custody {@link HybridSigner}
   * and submit it via `eth_sendRawTransaction` — the node never holds the
   * secret.
   *
   * The signer's raw 32-byte Ed25519 public key is the `from` account.
   * This method fetches the nonce and chain id, builds the canonical
   * `Transaction::hash()` preimage (including the PQ verifying key), asks
   * the signer for both the Ed25519 and ML-DSA-65 legs over that hash, and
   * submits the pre-signed transaction. Both legs are mandatory; the node
   * rejects a raw send that omits either.
   *
   * @param value - amount in wei (smallest TNZO unit).
   * @returns The submitted transaction hash (64-char lowercase hex).
   */
  async sendSelfCustody(args: {
    signer: HybridSigner;
    to: Address;
    value: bigint;
    gasLimit?: number;
    gasPrice?: number;
    nonce?: number;
    chainId?: number;
  }): Promise<string> {
    const fromBytes = args.signer.ed25519PublicKey();
    if (fromBytes.length !== 32) {
      throw new Error(
        `self-custody Ed25519 public key must be 32 bytes, got ${fromBytes.length}`
      );
    }
    const toBytes = hexDecode(args.to);
    if (toBytes.length !== 32) {
      throw new Error(
        `recipient address must be 32 bytes, got ${toBytes.length}`
      );
    }
    const fromHex = "0x" + hexEncode(fromBytes);

    let { nonce, chainId } = args;
    if (nonce === undefined) {
      const nonceHex = await this.rpc.call<string>("tenzro_getNonce", [fromHex]);
      nonce = parseInt(nonceHex, 16);
    }
    if (chainId === undefined) {
      const chainHex = await this.rpc.call<string>("eth_chainId", []);
      chainId = parseInt(chainHex, 16);
    }

    const pqPublicKey = args.signer.mlDsaVerifyingKey();
    const gasLimit = args.gasLimit ?? 21000;
    const gasPrice = args.gasPrice ?? 1_000_000_000;
    const timestampMs = Date.now();

    const hash = await transferTxHash({
      chainId,
      from: fromBytes,
      to: toBytes,
      nonce,
      gasLimit,
      gasPrice,
      timestampMs,
      amountWei: args.value,
      pqPublicKey,
    });
    const [edSig, mlDsaSig] = await args.signer.signHybrid(hash);

    return this.rpc.call<string>("eth_sendRawTransaction", {
      from: fromHex,
      to: "0x" + hexEncode(toBytes),
      value: args.value.toString(),
      gas_limit: gasLimit,
      gas_price: gasPrice,
      nonce,
      chain_id: chainId,
      timestamp: timestampMs,
      public_key: hexEncode(fromBytes),
      signature: hexEncode(edSig),
      pq_public_key: hexEncode(pqPublicKey),
      pq_signature: hexEncode(mlDsaSig),
    });
  }
}
