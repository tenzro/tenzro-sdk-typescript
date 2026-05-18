import { RpcClient } from "./rpc";

/**
 * Client for AgentBond operations (Agent-Swarm Spec 9).
 *
 * Bonds are TNZO-denominated stakes posted by a controller against a
 * specific agent DID. While Active and ≥ `bond_min_for_promotion`, the
 * bonded agent is promoted to the Delegated admission lane. Bonds are
 * locked at a deterministic vault address derived from the agent DID:
 * `Address(SHA-256("tenzro/agent-bond/vault" || agent_did))`.
 *
 * Read methods query node state directly. Write methods build typed
 * `PostAgentBond` / `IncreaseAgentBond` / `WithdrawAgentBond`
 * transactions and submit them through `tenzro_signAndSendTransaction`,
 * matching the {@link SettlementClient.createEscrow} pattern.
 */
export class BondClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Fetch a single AgentBond record by its 32-byte bond id.
   * @param bondId - 32-byte bond identifier (hex with or without 0x)
   * @returns Bond record or null if not found
   */
  async getAgentBond(bondId: string): Promise<any> {
    return this.rpc.call("tenzro_getAgentBond", [bondId]);
  }

  /**
   * List all AgentBonds posted by a given controller DID.
   * @param controllerDid - The controller DID (e.g. `did:tenzro:human:...`)
   * @returns Array of bond records (empty if controller has none)
   */
  async listAgentBondsByController(controllerDid: string): Promise<any[]> {
    return this.rpc.call<any[]>("tenzro_listAgentBondsByController", [
      controllerDid,
    ]);
  }

  /**
   * Post a fresh AgentBond for `agentDid` from `controller` (the controller
   * wallet address, used as `tx.from`). Locks `amount` TNZO into the bond
   * vault and promotes the agent to Delegated lane while ≥
   * `bond_min_for_promotion`.
   *
   * Authentication is ambient (DPoP-bound bearer JWT). Signing happens
   * server-side against the holder's MPC wallet.
   *
   * @param controller - Controller wallet address (signer / `tx.from`)
   * @param agentDid - DID of the agent being bonded
   * @param controllerDid - DID of the controller posting the bond
   * @param amount - TNZO base units to lock
   * @returns Transaction hash
   */
  async postAgentBond(
    controller: string,
    agentDid: string,
    controllerDid: string,
    amount: bigint
  ): Promise<string> {
    const { nonce, chainId } = await this.fetchNonceAndChainId(controller);
    const txType = {
      type: "PostAgentBond",
      data: {
        agent_did: agentDid,
        controller_did: controllerDid,
        amount: amount.toString(),
      },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: controller,
        to: "0x0000000000000000000000000000000000000000000000000000000000000000",
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
   * Top up an existing Active AgentBond by `amount`. `tx.from` MUST equal
   * the original poster (the bond's controller).
   *
   * @param controller - Controller wallet address (signer / `tx.from`)
   * @param agentDid - DID of the bonded agent
   * @param amount - Additional TNZO base units to lock
   * @returns Transaction hash
   */
  async increaseAgentBond(
    controller: string,
    agentDid: string,
    amount: bigint
  ): Promise<string> {
    const { nonce, chainId } = await this.fetchNonceAndChainId(controller);
    const txType = {
      type: "IncreaseAgentBond",
      data: {
        agent_did: agentDid,
        amount: amount.toString(),
      },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: controller,
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
   * Initiate the cooldown timer on an Active AgentBond. Funds are not
   * released by the VM — finalisation happens off-VM via the node-side
   * `BondManager` once `cooldown_ms` has elapsed. `tx.from` MUST equal
   * the bond's controller.
   *
   * @param controller - Controller wallet address (signer / `tx.from`)
   * @param agentDid - DID of the bonded agent
   * @returns Transaction hash
   */
  async withdrawAgentBond(
    controller: string,
    agentDid: string
  ): Promise<string> {
    const { nonce, chainId } = await this.fetchNonceAndChainId(controller);
    const txType = {
      type: "WithdrawAgentBond",
      data: { agent_did: agentDid },
    };

    const result = await this.rpc.call<any>("tenzro_signAndSendTransaction", [
      {
        from: controller,
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

  private async fetchNonceAndChainId(
    address: string
  ): Promise<{ nonce: number; chainId: number }> {
    let nonce = 0;
    let chainId = 1337;
    try {
      const nonceHex = await this.rpc.call<string>("eth_getTransactionCount", [
        address,
        "latest",
      ]);
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
}
