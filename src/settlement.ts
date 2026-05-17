import { RpcClient } from "./rpc";
import { SettlementParams, SettlementReceipt } from "./types";

/**
 * Client for payment settlement operations.
 * Supports immediate settlement, escrow, and micropayment channels.
 */
export class SettlementClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Settle a payment for AI inference or other services.
   * @param request - Settlement request parameters
   * @returns Settlement receipt with transaction details
   */
  async settle(request: SettlementParams): Promise<SettlementReceipt> {
    return this.rpc.call<SettlementReceipt>("tenzro_settle", [request]);
  }

  /**
   * Get the status of a settlement by receipt ID.
   * @param receiptId - The settlement receipt identifier
   * @returns Settlement receipt or null if not found
   */
  async getSettlement(receiptId: string): Promise<SettlementReceipt | null> {
    return this.rpc.call<SettlementReceipt | null>("tenzro_getSettlement", [
      receiptId,
    ]);
  }

  /**
   * Create an on-chain escrow via a signed `CreateEscrow` transaction.
   *
   * The escrow_id is derived deterministically by the VM as
   * `SHA-256("tenzro/escrow/id" || payer || nonce_le)` and the funds are
   * locked at a vault address derived from that escrow_id. Only the signing
   * payer can later release or refund.
   *
   * Authentication is ambient: the underlying RPC call carries the OAuth
   * 2.1 bearer JWT and per-request DPoP proof from `TENZRO_BEARER_JWT` /
   * `TENZRO_DPOP_PROOF` (set after onboarding via {@link AuthClient}). This
   * SDK no longer takes raw private keys — signing happens server-side
   * against the holder's MPC wallet, gated by the DPoP-bound bearer.
   *
   * @param payer - Payer address (the holder's MPC wallet address)
   * @param payee - Recipient address upon successful release
   * @param amount - Amount to lock in escrow (in wei, smallest unit)
   * @param asset - Asset identifier (e.g., "TNZO")
   * @param expiresAt - Unix timestamp in milliseconds when the escrow expires
   * @param releaseConditions - One of: "timeout" | "provider" | "consumer" |
   *   "both" | "verifier" | "custom"
   * @returns Transaction hash
   */
  async createEscrow(
    payer: string,
    payee: string,
    amount: bigint,
    asset: string,
    expiresAt: bigint,
    releaseConditions: string
  ): Promise<string> {
    const conditionsJson = (() => {
      switch (releaseConditions.toLowerCase()) {
        case "timeout":
          return { type: "Timeout" };
        case "provider":
        case "provider_signature":
          return { type: "ProviderSignature" };
        case "consumer":
        case "consumer_signature":
          return { type: "ConsumerSignature" };
        case "both":
        case "both_signatures":
          return { type: "BothSignatures" };
        case "verifier":
        case "verifier_signature":
          return { type: "VerifierSignature" };
        case "custom":
          return { type: "Custom", data: "" };
        default:
          throw new Error(
            `unsupported release condition '${releaseConditions}': use timeout|provider|consumer|both|verifier|custom`
          );
      }
    })();

    const { nonce, chainId } = await this.fetchNonceAndChainId(payer);
    const txType = {
      type: "CreateEscrow",
      data: {
        payee,
        amount: amount.toString(),
        asset_id: asset,
        expires_at: Number(expiresAt),
        release_conditions: conditionsJson,
      },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: payer,
        to: payee,
        value: 0,
        gas_limit: 75_000,
        gas_price: 1_000_000_000,
        nonce,
        chain_id: chainId,
        tx_type: txType,
      },
    ]);

    return typeof result === "string"
      ? result
      : result?.tx_hash || result?.transaction_hash || "";
  }

  /**
   * Release escrowed funds to the payee via a signed `ReleaseEscrow` transaction.
   * Only the original payer can submit this — the VM rejects releases from any
   * other address. Authentication is ambient (see {@link createEscrow}).
   *
   * @param payer - Payer address (the holder's MPC wallet address)
   * @param escrowId - 32-byte escrow id (hex with or without 0x)
   * @param proof - Optional proof bytes (hex with or without 0x)
   * @returns Transaction hash
   */
  async releaseEscrow(
    payer: string,
    escrowId: string,
    proof?: string
  ): Promise<string> {
    const escrowIdBytes = parseEscrowId(escrowId);
    const proofBytes = proof
      ? Array.from(hexToBytes(proof))
      : [];

    const { nonce, chainId } = await this.fetchNonceAndChainId(payer);
    const txType = {
      type: "ReleaseEscrow",
      data: {
        escrow_id: Array.from(escrowIdBytes),
        proof: {
          proof_type: "Timeout",
          proof_data: proofBytes,
          signatures: [],
        },
      },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: payer,
        to: "0x0000000000000000000000000000000000000000000000000000000000000000",
        value: 0,
        gas_limit: 60_000,
        gas_price: 1_000_000_000,
        nonce,
        chain_id: chainId,
        tx_type: txType,
      },
    ]);

    return typeof result === "string"
      ? result
      : result?.tx_hash || result?.transaction_hash || "";
  }

  /**
   * Refund escrowed funds back to the payer via a signed `RefundEscrow` transaction.
   * Only the original payer can submit this, AND the escrow must be expired
   * (or use Timeout/Custom release conditions). Authentication is ambient
   * (see {@link createEscrow}).
   */
  async refundEscrow(
    payer: string,
    escrowId: string
  ): Promise<string> {
    const escrowIdBytes = parseEscrowId(escrowId);

    const { nonce, chainId } = await this.fetchNonceAndChainId(payer);
    const txType = {
      type: "RefundEscrow",
      data: { escrow_id: Array.from(escrowIdBytes) },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: payer,
        to: "0x0000000000000000000000000000000000000000000000000000000000000000",
        value: 0,
        gas_limit: 50_000,
        gas_price: 1_000_000_000,
        nonce,
        chain_id: chainId,
        tx_type: txType,
      },
    ]);

    return typeof result === "string"
      ? result
      : result?.tx_hash || result?.transaction_hash || "";
  }

  /** Inspect an escrow record by its 32-byte id. */
  async getEscrow(escrowId: string): Promise<any> {
    const escrowIdBytes = parseEscrowId(escrowId);
    const escrowIdHex = "0x" + bytesToHex(escrowIdBytes);
    return this.rpc.call("tenzro_getEscrow", { escrow_id: escrowIdHex });
  }

  /**
   * List every escrow funded by `payer`. Returns
   * `{payer, count, escrows: [...]}`. Backed by the `escrow_payer:`
   * secondary index in `CF_SETTLEMENTS`.
   *
   * @param payer - Payer address (the wallet that created the escrow)
   */
  async listEscrowsByPayer(payer: string): Promise<any> {
    return this.rpc.call("tenzro_listEscrowsByPayer", { payer });
  }

  /**
   * List every escrow held for `payee`. Returns
   * `{payee, count, escrows: [...]}`. Backed by the `escrow_payee:`
   * secondary index in `CF_SETTLEMENTS`.
   *
   * @param payee - Payee address (the recipient on successful release)
   */
  async listEscrowsByPayee(payee: string): Promise<any> {
    return this.rpc.call("tenzro_listEscrowsByPayee", { payee });
  }

  /**
   * Fetch a single channel dispute by id. Returns the full
   * `ChannelDispute` record (challenger, evidence blobs, status,
   * opened_at / timeout_at / resolved_at, resolution). Returns
   * JSON-RPC `-32004` if no dispute with that id exists.
   */
  async getDispute(disputeId: string): Promise<any> {
    return this.rpc.call("tenzro_getDispute", { dispute_id: disputeId });
  }

  /**
   * List every dispute (open or historical) attached to a channel.
   * Returns `{channel_id, count, disputes: [...]}`. Empty list is not
   * an error — a channel with no disputes returns `count: 0`.
   */
  async listDisputesByChannel(channelId: string): Promise<any> {
    return this.rpc.call("tenzro_listDisputesByChannel", {
      channel_id: channelId,
    });
  }

  /** Internal helper: fetch nonce + chain_id with safe defaults. */
  private async fetchNonceAndChainId(
    address: string
  ): Promise<{ nonce: number; chainId: number }> {
    let nonce = 0;
    let chainId = 1337;
    try {
      const nonceHex = await this.rpc.call<string>(
        "eth_getTransactionCount",
        [address, "latest"]
      );
      nonce = parseInt(nonceHex.replace(/^0x/, ""), 16) || 0;
    } catch (_) {
      // ignore — default to 0
    }
    try {
      const chainIdHex = await this.rpc.call<string>("eth_chainId", []);
      chainId = parseInt(chainIdHex.replace(/^0x/, ""), 16) || 1337;
    } catch (_) {
      // ignore — default to 1337
    }
    return { nonce, chainId };
  }

  /**
   * Open a micropayment channel for streaming payments.
   * @param payee - Address receiving payments
   * @param deposit - Initial deposit amount
   * @returns Channel ID
   */
  async openPaymentChannel(payee: string, deposit: bigint): Promise<string> {
    return this.rpc.call<string>("tenzro_openPaymentChannel", [
      {
        payee,
        deposit: deposit.toString(),
      },
    ]);
  }

  /**
   * Close a micropayment channel.
   * @param channelId - The channel identifier to close
   * @returns Channel closure result
   */
  async closePaymentChannel(channelId: string): Promise<any> {
    return this.rpc.call("tenzro_closePaymentChannel", [
      { channel_id: channelId },
    ]);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0) {
    throw new Error(`invalid hex string (odd length): ${hex}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseEscrowId(s: string): Uint8Array {
  const bytes = hexToBytes(s);
  if (bytes.length !== 32) {
    throw new Error(`escrow_id must be 32 bytes, got ${bytes.length}`);
  }
  return bytes;
}
