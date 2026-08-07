import { RpcClient } from "./rpc";

/**
 * Client for the adaptive-burn governance dial (TNZO supply control).
 *
 * Surfaces the current `BurnRateConfig`, rolling `SupplyMetricsSnapshot`,
 * the recommended action computed from the targets and metrics, and the
 * list of in-flight adaptive-burn governance proposals.
 *
 * All endpoints are read-only. The auto-proposal generator and the
 * EIP-1559 fee-market consumer run inside the node alongside the
 * governance executor; this client only reads their output.
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
   * Returns the economic policy this node applies to every settlement — how a
   * payment divides, the marketplace commission, the network's default
   * settlement asset, and the micro-settlement floor.
   *
   * Read this before paying rather than inferring the split from a receipt
   * afterwards. The response also reports, per capability, which economic mode
   * the node is in: a **private** capability keeps the whole payment, a
   * **public validating** one shares with the treasury, and a **public
   * delegated** one also pays the RPC provider validating on its behalf.
   *
   * Every rate is governance-set; see `docs/ECONOMICS.md`.
   */
  async getEconomicPolicy(): Promise<any> {
    return this.rpc.call("tenzro_getEconomicPolicy", [{}]);
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
