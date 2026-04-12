import type { RpcClient } from './rpc';
import type {
  SkillInfo,
  SkillFilter,
  RegisterSkillParams,
  UpdateSkillParams,
  SkillExecutionResult,
  SkillUsage,
} from './types';

/**
 * Client for the Tenzro Skills Registry.
 * Register, discover, and invoke reusable skills on the network.
 */
export class SkillClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Register a new skill in the registry.
   * @param params - Skill definition including name, description, version, and capabilities
   * @returns The registered skill
   */
  async registerSkill(params: RegisterSkillParams): Promise<SkillInfo> {
    return this.rpc.call<SkillInfo>('tenzro_registerSkill', [params]);
  }

  /**
   * List skills with optional filtering.
   * @param filter - Optional filter criteria (category, capability, tag, etc.)
   * @returns Array of matching skills
   */
  async listSkills(filter?: SkillFilter): Promise<SkillInfo[]> {
    return this.rpc.call<SkillInfo[]>('tenzro_listSkills', [filter ?? {}]);
  }

  /**
   * Search skills by free-text query.
   * @param query - Search query string
   * @returns Array of matching skills ranked by relevance
   */
  async searchSkills(query: string): Promise<SkillInfo[]> {
    return this.rpc.call<SkillInfo[]>('tenzro_searchSkills', [{ query }]);
  }

  /**
   * Execute a skill with the given input.
   * @param skillId - The skill to invoke
   * @param input - Input payload (JSON-serializable string or object)
   * @returns Execution result with output and duration
   */
  async useSkill(skillId: string, input: string): Promise<SkillExecutionResult> {
    return this.rpc.call<SkillExecutionResult>('tenzro_useSkill', [
      { skill_id: skillId, input },
    ]);
  }

  /**
   * Get a skill by ID.
   * @param skillId - The skill identifier
   * @returns Skill information
   */
  async getSkill(skillId: string): Promise<SkillInfo> {
    return this.rpc.call<SkillInfo>('tenzro_getSkill', [{ skill_id: skillId }]);
  }

  /**
   * Update an existing skill (must be the creator).
   * @param skillId - The skill to update
   * @param params - Fields to update (partial)
   * @returns Updated skill
   */
  async updateSkill(skillId: string, params: UpdateSkillParams): Promise<SkillInfo> {
    return this.rpc.call<SkillInfo>('tenzro_updateSkill', [
      { skill_id: skillId, ...params },
    ]);
  }

  /**
   * Get usage statistics for a skill.
   * @param skillId - The skill identifier
   * @returns Usage statistics including total invocations and last used timestamp
   */
  async getSkillUsage(skillId: string): Promise<SkillUsage> {
    return this.rpc.call<SkillUsage>('tenzro_getSkillUsage', [
      { skill_id: skillId },
    ]);
  }
}
