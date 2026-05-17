import { RpcClient } from "./rpc";

/**
 * Client for receipt principal-chain queries (Spec 5).
 *
 * Every receipt produced by the network carries a principal chain that
 * traces it back from the acting agent (`actor`) through the chain of
 * delegations to the ultimate human or organisational `controller`.
 * These endpoints let auditors, dashboards, and seed-agent governance
 * walk that chain efficiently and aggregate per-controller activity.
 */
export class PrincipalChainClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Fetch the full principal chain for a single receipt.
   * @param receiptId - 32-byte receipt identifier (hex)
   * @returns Principal chain (actor → … → controller) or null if unknown
   */
  async getReceiptPrincipalChain(receiptId: string): Promise<any> {
    return this.rpc.call("tenzro_getReceiptPrincipalChain", [{ receipt_id: receiptId }]);
  }

  /**
   * List every receipt whose immediate `actor` is the given DID.
   * @param actorDid - Actor DID (typically a machine DID)
   * @returns Array of receipt summaries
   */
  async listReceiptsByActor(actorDid: string): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listReceiptsByActor", [{ did: actorDid }]);
  }

  /**
   * List every receipt whose principal chain terminates at the given
   * controller DID.
   * @param controllerDid - Controller DID (human or organisational root)
   * @returns Array of receipt summaries
   */
  async listReceiptsByController(controllerDid: string): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listReceiptsByController", [
      { did: controllerDid },
    ]);
  }

  /**
   * Returns aggregate activity metrics for a controller — receipt counts
   * by kind, total spend, slashing events, etc.
   * @param controllerDid - Controller DID
   * @returns Controller summary record
   */
  async summarizeController(controllerDid: string): Promise<any> {
    return this.rpc.call("tenzro_summarizeController", [{ did: controllerDid }]);
  }
}
