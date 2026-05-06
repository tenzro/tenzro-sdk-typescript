import { RpcClient } from "./rpc";

/**
 * Client for the SeedAgent treasury earmark and protocol-owned bootstrap
 * agent registry (Spec 10).
 *
 * The SeedAgent earmark is a genesis-funded TNZO allocation governed by
 * a decay schedule and `Charter`s that enumerate which `OperationKind`s
 * a seed agent may exercise (inference, task marketplace, bridge, etc.)
 * with per-charter spend caps, target throughput, and counterparty
 * filters.
 *
 * All endpoints here are read-only — provisioning, monthly decay, and
 * sunset wind-down land in a later wave with the off-chain provisioning
 * daemon and governance-executor mutation paths.
 */
export class SeedAgentClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Returns the singleton `TreasuryEarmark` — genesis allocation,
   * decay schedule, master enabled flag, and surplus-burn disposition.
   * @returns Current `TreasuryEarmark`
   */
  async getTreasuryEarmark(): Promise<any> {
    return this.rpc.call("tenzro_getTreasuryEarmark", []);
  }

  /**
   * Fetch a single `Charter` by its identifier.
   * @param charterId - Charter identifier
   * @returns Charter record or null if not found
   */
  async getSeedAgentCharter(charterId: string): Promise<any> {
    return this.rpc.call("tenzro_getSeedAgentCharter", [charterId]);
  }

  /**
   * List every registered `Charter` (active and sunset).
   * @returns Array of charter records
   */
  async listSeedAgentCharters(): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listSeedAgentCharters", []);
  }

  /**
   * List provisioned `SeedAgentRecord`s, optionally filtered by charter.
   * @param charterId - Optional charter filter
   * @returns Array of seed agent records
   */
  async listSeedAgents(charterId?: string): Promise<any[]> {
    const params: unknown[] = charterId === undefined ? [] : [charterId];
    return this.rpc.call<any[]>("tenzro_listSeedAgents", params);
  }

  /**
   * Returns network activity metrics over the requested window. Used by
   * the SeedAgent counterparty filter and the organic-activity dashboards
   * to exclude protocol-owned bootstrap traffic during the 12-month
   * earmark window.
   * @param windowBlocks - Optional rolling window (in blocks)
   * @returns Activity metrics snapshot
   */
  async getNetworkActivity(windowBlocks?: number): Promise<any> {
    const params: unknown[] = windowBlocks === undefined ? [] : [windowBlocks];
    return this.rpc.call("tenzro_getNetworkActivity", params);
  }
}
