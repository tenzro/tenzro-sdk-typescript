import type { RpcClient } from './rpc';
import type {
  SpendingPolicy,
  PolicyResult,
  AgentPaymentReceipt,
  DailySpend,
  AgentTransaction,
} from './types';

/**
 * Client for agent transaction execution and spending policy management.
 * Allows agents to make payments for services within configurable spending limits.
 */
export class AgentPaymentClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Set a spending policy for an agent.
   * @param agentDid - The agent's DID
   * @param policy - Spending policy configuration
   * @returns Policy update result
   */
  async setSpendingPolicy(
    agentDid: string,
    policy: Omit<SpendingPolicy, 'agent_did'>
  ): Promise<PolicyResult> {
    const remapped = policy as Record<string, unknown>;
    const toNum = (v: unknown): number | undefined => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "number") return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const maxPerTx =
      toNum(remapped.max_per_transaction) ?? toNum(remapped.per_tx_limit);
    const maxDaily =
      toNum(remapped.max_daily_spend) ?? toNum(remapped.daily_limit);
    return this.rpc.call<PolicyResult>('tenzro_setSpendingPolicy', [
      {
        agent_did: agentDid,
        max_per_transaction: maxPerTx,
        max_daily_spend: maxDaily,
        active: remapped.active ?? true,
        allowed_services: remapped.allowed_services ?? [],
      },
    ]);
  }

  /**
   * Get the current spending policy for an agent.
   * @param agentDid - The agent's DID
   * @returns Current spending policy
   */
  async getSpendingPolicy(agentDid: string): Promise<SpendingPolicy> {
    return this.rpc.call<SpendingPolicy>('tenzro_getSpendingPolicy', [
      { agent_did: agentDid },
    ]);
  }

  /**
   * Pay for a service on behalf of an agent.
   * The payment is validated against the agent's spending policy.
   * @param agentDid - The agent's DID
   * @param provider - Provider address to pay
   * @param amount - Payment amount (decimal string)
   * @param serviceType - Type of service being paid for
   * @returns Payment receipt
   */
  async payForService(
    agentDid: string,
    provider: string,
    amount: string,
    serviceType: string
  ): Promise<AgentPaymentReceipt> {
    return this.rpc.call<AgentPaymentReceipt>('tenzro_agentPayForService', [
      {
        agent_did: agentDid,
        provider,
        amount,
        service_type: serviceType,
      },
    ]);
  }

  /**
   * Get the daily spend summary for an agent.
   * @param agentDid - The agent's DID
   * @returns Daily spend summary with limits and remaining allowance
   */
  async getDailySpend(agentDid: string): Promise<DailySpend> {
    return this.rpc.call<DailySpend>('tenzro_getAgentDailySpend', [
      { agent_did: agentDid },
    ]);
  }

  /**
   * List recent transactions for an agent.
   * @param agentDid - The agent's DID
   * @param limit - Optional maximum number of transactions to return
   * @returns Array of agent transactions
   */
  async listAgentTransactions(
    agentDid: string,
    limit?: number
  ): Promise<AgentTransaction[]> {
    return this.rpc.call<AgentTransaction[]>('tenzro_listAgentTransactions', [
      { agent_did: agentDid, limit },
    ]);
  }
}
