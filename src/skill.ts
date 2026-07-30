import type { RpcClient } from './rpc';
import type {
  SkillInfo,
  SkillFilter,
  SkillPin,
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
   * Search skills by free-text query over name, description and tags.
   * @param query - Search query string
   * @param filter - Optional narrowing applied on top of the text match
   * @returns Array of matching skills
   */
  async searchSkills(query: string, filter?: SkillFilter): Promise<SkillInfo[]> {
    return this.rpc.call<SkillInfo[]>('tenzro_searchSkills', [
      { ...(filter ?? {}), query },
    ]);
  }

  /**
   * Execute a skill with the given input.
   *
   * The registry is permissionless, so pinning is how a caller fixes exactly
   * which bytes it pays to run: a mismatch is refused before settlement, so a
   * refused call costs nothing. Omitting the pin accepts whatever the publisher
   * currently serves.
   *
   * @param skillId - The skill to invoke
   * @param input - Input payload conforming to the skill's input schema
   * @param pin - Optional version and/or artifact digest to require
   * @returns Execution result with output and duration
   */
  async useSkill(
    skillId: string,
    input: unknown,
    pin?: SkillPin,
  ): Promise<SkillExecutionResult> {
    return this.rpc.call<SkillExecutionResult>('tenzro_useSkill', [
      { skill_id: skillId, input, ...(pin ?? {}) },
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
