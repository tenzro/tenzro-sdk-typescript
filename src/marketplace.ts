import type { RpcClient } from './rpc';
import type {
  AgentTemplate,
  AgentTemplateFilter,
  RegisterAgentTemplateParams,
  UpdateAgentTemplateParams,
  AgentTemplateStats,
  RunAgentTemplateParams,
  RunAgentTemplateReport,
} from './types';

export class MarketplaceClient {
  constructor(private readonly rpc: RpcClient) {}

  async listAgentTemplates(filter?: AgentTemplateFilter): Promise<AgentTemplate[]> {
    return this.rpc.call<AgentTemplate[]>('tenzro_listAgentTemplates', [filter ?? {}]);
  }

  /**
   * Register a new agent template on the marketplace.
   *
   * Paid-agent marketplace semantics:
   * - `creator_did` (optional): bind the template to a `did:tenzro:` identity at
   *   registration time (immutable afterwards).
   * - `creator_wallet` (**mandatory** for non-free pricing): payout wallet. Each
   *   invocation fee is split 95/5 — 5% flows to the network treasury as
   *   `AGENT_MARKETPLACE_COMMISSION_BPS`, the remainder is paid here.
   * - `pricing`: either the canonical `AgentPricingModel` object or the compact
   *   string form (`"free"`, `"per_execution:<u128>"`, `"per_token:<u128>"`,
   *   `"subscription:<u128>"`, `"revenue_share:<bps>"`).
   */
  async registerAgentTemplate(params: RegisterAgentTemplateParams): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>('tenzro_registerAgentTemplate', [params]);
  }

  /**
   * Invoke (run) a spawned agent template through its full task cycle.
   *
   * For paid templates, `payer_wallet` is charged the per-invocation fee and
   * the report contains the detailed fee-split breakdown (treasury commission,
   * creator share, invocation counters, total revenue).
   */
  async runAgentTemplate(params: RunAgentTemplateParams): Promise<RunAgentTemplateReport> {
    return this.rpc.call<RunAgentTemplateReport>('tenzro_runAgentTemplate', [params]);
  }

  async getAgentTemplate(templateId: string): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>('tenzro_getAgentTemplate', [{ template_id: templateId }]);
  }

  /**
   * Update a registered agent template (must be the creator).
   * @param templateId - The template to update
   * @param params - Fields to update (partial)
   * @returns Updated agent template
   */
  async updateAgentTemplate(
    templateId: string,
    params: UpdateAgentTemplateParams
  ): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>('tenzro_updateAgentTemplate', [
      { template_id: templateId, ...params },
    ]);
  }

  /**
   * Spawn a new agent instance from a template.
   *
   * When `parentMachineDid` is supplied, the spawned agent's effective
   * delegation scope is the strict intersection of the parent's scope and
   * the template's spec — the child can never be broader than its parent
   * on any axis (numeric ceilings, allow-lists, time bound).
   *
   * @param templateId - The template to spawn from
   * @param name - Name for the new agent instance
   * @param parentMachineDid - Optional parent machine DID to attenuate against
   * @returns Spawn result with agent ID
   */
  async spawnAgentFromTemplate(
    templateId: string,
    name: string,
    parentMachineDid?: string
  ): Promise<any> {
    return this.rpc.call('tenzro_spawnAgentFromTemplate', [
      {
        template_id: templateId,
        name,
        parent_machine_did: parentMachineDid,
      },
    ]);
  }

  /**
   * Rate an agent template.
   * @param templateId - The template to rate
   * @param rating - Rating value (1-5)
   * @param review - Optional review text
   * @returns Rating result
   */
  async rateAgentTemplate(
    templateId: string,
    rating: number,
    review?: string
  ): Promise<any> {
    return this.rpc.call('tenzro_rateAgentTemplate', [
      { template_id: templateId, rating, review },
    ]);
  }

  /**
   * Search agent templates by free-text query.
   * @param query - Search query string
   * @returns Array of matching agent templates ranked by relevance
   */
  async searchAgentTemplates(query: string): Promise<AgentTemplate[]> {
    return this.rpc.call<AgentTemplate[]>('tenzro_searchAgentTemplates', [
      { query },
    ]);
  }

  /**
   * Get usage and rating statistics for an agent template.
   * @param templateId - The template identifier
   * @returns Template statistics including spawns, ratings, and downloads
   */
  async getAgentTemplateStats(templateId: string): Promise<AgentTemplateStats> {
    return this.rpc.call<AgentTemplateStats>('tenzro_getAgentTemplateStats', [
      { template_id: templateId },
    ]);
  }
}
