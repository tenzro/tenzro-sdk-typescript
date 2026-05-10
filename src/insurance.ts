import { RpcClient } from "./rpc";

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
   * File a new insurance claim against an agent bond.
   * @param params - Claim parameters (claimant, agent_did, evidence, amount, etc.)
   * @returns Filed claim record (including the deterministic claim_id)
   */
  async fileInsuranceClaim(params: Record<string, unknown>): Promise<any> {
    return this.rpc.call("tenzro_fileInsuranceClaim", [params]);
  }

  /**
   * List all insurance claims known to the node.
   * @returns Array of claim records
   */
  async listInsuranceClaims(): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listInsuranceClaims", []);
  }

  /**
   * Fetch a single insurance claim by its deterministic 32-byte id.
   * @param claimId - Claim identifier (lowercase hex)
   * @returns Claim record or null if not found
   */
  async getInsuranceClaim(claimId: string): Promise<any> {
    return this.rpc.call("tenzro_getInsuranceClaim", [{ claim_id: claimId }]);
  }

  /**
   * Returns the current TNZO balance held in the insurance pool vault,
   * in base units.
   * @returns Pool balance (string-encoded uint, to preserve precision)
   */
  async getInsurancePoolBalance(): Promise<string> {
    return this.rpc.call<string>("tenzro_getInsurancePoolBalance", []);
  }
}
