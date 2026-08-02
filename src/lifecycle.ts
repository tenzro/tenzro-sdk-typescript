import { RpcClient } from "./rpc";

/**
 * Client for agent lifecycle and kill-switch queries.
 *
 * The kill-switch records every `TerminateAgent` event — including
 * cascaded terminations from a parent agent — with the canonical reason
 * code, the slash applied to the bond, and the controller that
 * authorised it. These endpoints are read-only inspections of that
 * audit trail; mutations flow through `TerminateAgent` typed
 * transactions.
 */
export class LifecycleClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Returns the current `AgentLifecycleInfo` for an agent (state, last
   * transition, controller, registration receipt id).
   * @param agentId - Agent identifier (DID or 32-byte id)
   * @returns Lifecycle record or null if unknown
   */
  async getAgentLifecycle(agentId: string): Promise<any> {
    return this.rpc.call("tenzro_getAgentLifecycle", [agentId]);
  }

  /**
   * List every kill-switch receipt whose target is the given agent.
   * @param agentId - Agent identifier (DID or 32-byte id)
   * @returns Array of kill-switch receipts
   */
  async listKillSwitchByAgent(agentId: string): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listKillSwitchByAgent", [agentId]);
  }

  /**
   * List every kill-switch receipt authored by the given controller DID.
   * @param controllerDid - Controller DID
   * @returns Array of kill-switch receipts
   */
  async listKillSwitchByController(controllerDid: string): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listKillSwitchByController", [
      controllerDid,
    ]);
  }

  /**
   * Fetch a single kill-switch receipt by its 32-byte id.
   * @param receiptId - Receipt identifier (hex)
   * @returns Kill-switch receipt or null if unknown
   */
  async getKillSwitchReceipt(receiptId: string): Promise<any> {
    return this.rpc.call("tenzro_getKillSwitchReceipt", [receiptId]);
  }
}
