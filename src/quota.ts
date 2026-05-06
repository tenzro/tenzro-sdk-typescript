import { RpcClient } from "./rpc";

/**
 * Client for node-level quota and resource-pressure queries.
 *
 * Surfaces the dual-rail burn quota (Spec 3), the prioritised mempool
 * lanes, per-account contention from the hot-state subsystem (Spec 6),
 * and the data-availability backend registry. All endpoints are
 * read-only.
 */
export class QuotaClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Returns the current dual-rail burn quota state (Spec 3).
   * @returns Burn quota snapshot
   */
  async getBurnQuota(): Promise<any> {
    return this.rpc.call("tenzro_getBurnQuota", []);
  }

  /**
   * Returns aggregate mempool statistics across all lanes.
   * @returns Mempool stats snapshot
   */
  async getMempoolStats(): Promise<any> {
    return this.rpc.call("tenzro_getMempoolStats", []);
  }

  /**
   * Returns the depth, fee floor, and admission stats for a single
   * mempool lane.
   * @param lane - Lane identifier (e.g. `"delegated"`, `"public"`,
   *   `"priority"`)
   * @returns Lane snapshot
   */
  async getMempoolLane(lane: string): Promise<any> {
    return this.rpc.call("tenzro_getMempoolLane", [lane]);
  }

  /**
   * Returns the hot-state contention score for a single account
   * (Spec 6 hot-state). Used by parallel-execution scheduling and
   * fee-market congestion signals.
   * @param address - Account address
   * @returns Contention metrics
   */
  async getAccountContention(address: string): Promise<any> {
    return this.rpc.call("tenzro_getAccountContention", [address]);
  }

  /**
   * List the registered data-availability backends (EigenDA, Celestia,
   * Avail, inline fallback) and their current health.
   * @returns Array of DA backend descriptors
   */
  async getDaBackends(): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_getDaBackends", []);
  }

  /**
   * Verify that the payload referenced by a `DaPointer` is currently
   * available on its backing DA backend.
   * @param pointer - The `DaPointer` (backend, namespace, locator,
   *   commitment_kzg, attestation_root)
   * @returns Verification result
   */
  async verifyDaPointer(pointer: Record<string, unknown>): Promise<any> {
    return this.rpc.call("tenzro_verifyDaPointer", [pointer]);
  }
}
