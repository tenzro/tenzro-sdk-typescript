import { RpcClient } from "./rpc";

/**
 * Client for the adaptive-burn governance dial (TNZO supply control).
 *
 * Surfaces the current `BurnRateConfig`, rolling `SupplyMetricsSnapshot`,
 * the recommended action computed from the targets and metrics, and the
 * list of in-flight adaptive-burn governance proposals.
 *
 * All endpoints are read-only — the auto-proposal generator and the
 * EIP-1559 fee-market consumer ship alongside the governance executor
 * wiring in a later wave.
 */
export class AdaptiveBurnClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Returns the current `BurnRateConfig` (base/local/paymaster burn bps).
   * @returns Active burn-rate configuration
   */
  async getBurnRateConfig(): Promise<any> {
    return this.rpc.call("tenzro_getBurnRateConfig", [{}]);
  }

  /**
   * Returns the latest rolling supply metrics snapshot — circulating
   * supply, epoch delta, burn breakdown, emission breakdown.
   * @returns Latest `SupplyMetricsSnapshot`
   */
  async getSupplyMetrics(): Promise<any> {
    return this.rpc.call("tenzro_getSupplyMetrics", [{}]);
  }

  /**
   * Computes the recommended adaptive-burn action from the current
   * metrics and configured supply targets. May return `NoChange`,
   * `IncreaseBurnPct`, `DecreaseBurnPct`, or alarm variants.
   * @returns `BurnRateRecommendation`
   */
  async getBurnRateRecommendation(): Promise<any> {
    return this.rpc.call("tenzro_getBurnRateRecommendation", [{}]);
  }

  /**
   * List in-flight adaptive-burn governance proposals.
   * @returns Array of proposal records
   */
  async listAdaptiveBurnProposals(): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listAdaptiveBurnProposals", [{}]);
  }
}
