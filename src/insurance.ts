import { RpcClient } from "./rpc";

/** Parameters to file an insurance claim against a bonded agent. */
export interface FileClaimParams {
  /** DID of the claimant. */
  claimant_did: string;
  /** Claimant wallet address (hex). */
  claimant_address: string;
  /** DID of the agent the claim is against. */
  against_agent_did: string;
  /** Claim amount in TNZO base units (number or string-encoded u128). */
  amount_requested: string | number;
  /** Per-claimant nonce for deterministic claim id derivation. */
  nonce: number;
  /** Optional evidence references (hashes, URIs). */
  receipt_refs?: string[];
  /** Optional free-form narrative (capped at 1024 bytes by the node). */
  narrative?: string;
}

/** Insurance pool vault state as returned by the node. */
export interface InsurancePool {
  /** Vault address holding the pooled TNZO. */
  vault: string;
  /** Pool balance in TNZO base units (string-encoded). */
  balance_wei: string;
  /** Number of claims paid out to date. */
  paid_claims: number;
  /** Total TNZO base units paid out to date. */
  total_paid_wei: string;
  /** Number of claims currently open. */
  open_claim_count: number;
}

/** Wrapped claim list as returned by the node. */
export interface ClaimList {
  /** Number of claims in the list. */
  count: number;
  /** The claim records. */
  claims: any[];
}

/**
 * Client for AgentBond insurance claims (Agent-Swarm Spec 9).
 *
 * Insurance claims are filed against a misbehaving agent's bond and
 * (when approved) paid out from the insurance pool vault. All methods
 * here are read-only state queries and the claim filing endpoint —
 * approval and payout flow through governance + the on-chain
 * `PayInsuranceClaim` transaction.
 */
export class InsuranceClient {
  constructor(private rpc: RpcClient) {}

  /**
   * File a new insurance claim against an agent bond. The node reads named
   * params directly from the params object.
   * @param params - Claim parameters
   * @returns Filed claim record (including the deterministic claim_id)
   */
  async fileInsuranceClaim(params: FileClaimParams): Promise<any> {
    return this.rpc.call("tenzro_fileInsuranceClaim", {
      ...params,
    } as Record<string, unknown>);
  }

  /**
   * List all insurance claims known to the node.
   * @returns Wrapped claim list: `{count, claims}`
   */
  async listInsuranceClaims(): Promise<ClaimList> {
    return this.rpc.call<ClaimList>("tenzro_listInsuranceClaims");
  }

  /**
   * Fetch a single insurance claim by its deterministic 32-byte id.
   * @param claimId - Claim identifier (lowercase hex)
   * @returns Claim record or null if not found
   */
  async getInsuranceClaim(claimId: string): Promise<any> {
    return this.rpc.call("tenzro_getInsuranceClaim", [claimId]);
  }

  /**
   * Returns the current insurance pool vault state — balance plus paid and
   * open claim counts.
   */
  async getInsurancePoolBalance(): Promise<InsurancePool> {
    return this.rpc.call<InsurancePool>("tenzro_getInsurancePoolBalance");
  }
}
