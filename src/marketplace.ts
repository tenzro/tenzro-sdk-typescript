import type { RpcClient } from './rpc';
import type { AgentTemplate, AgentTemplateFilter, RegisterAgentTemplateParams, UpdateAgentTemplateParams, AgentTemplateStats } from './types';

export class MarketplaceClient {
  constructor(private readonly rpc: RpcClient) {}

  async listAgentTemplates(filter?: AgentTemplateFilter): Promise<AgentTemplate[]> {
    return this.rpc.call<AgentTemplate[]>('tenzro_listAgentTemplates', [filter ?? {}]);
  }

  async registerAgentTemplate(params: RegisterAgentTemplateParams): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>('tenzro_registerAgentTemplate', [params]);
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
   * @param templateId - The template to spawn from
   * @param name - Name for the new agent instance
   * @returns Spawn result with agent ID
   */
  async spawnAgentFromTemplate(templateId: string, name: string): Promise<any> {
    return this.rpc.call('tenzro_spawnAgentFromTemplate', [
      { template_id: templateId, name },
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
