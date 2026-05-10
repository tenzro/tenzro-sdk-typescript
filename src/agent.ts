import { RpcClient } from "./rpc";
import {
  AgentIdentity,
  AgentTemplate,
  RegisterAgentResponse,
  AgentMessageResponse,
  DelegateTaskResponse,
  SpawnAgentResponse,
  SpawnAgentTemplateResponse,
  RunAgentTemplateReport,
  RunAgentTaskResponse,
  CreateSwarmResponse,
  SwarmStatus,
  TerminateSwarmResponse,
  UpdateAgentTemplateParams,
  GasPolicy,
} from "./types";

// Simple UUID v4 generator for browser/node compatibility
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Client for AI agent operations.
 * Supports agent registration, messaging, and task delegation.
 */
export class AgentClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Register a new AI agent on the network.
   * @param agentId - Unique identifier for the agent
   * @param name - Human-readable name
   * @param capabilities - List of agent capabilities
   * @returns Registration response with agent ID and status
   */
  async register(
    agentId: string,
    name: string,
    capabilities: string[]
  ): Promise<RegisterAgentResponse> {
    return this.rpc.call<RegisterAgentResponse>("tenzro_registerAgent", [
      {
        agent_id: agentId,
        name,
        capabilities,
      },
    ]);
  }

  /**
   * Send a message to another agent.
   * @param agentId - Target agent identifier
   * @param message - Message content
   * @returns Message response with payload and message ID
   */
  async sendMessage(
    agentId: string,
    message: string
  ): Promise<AgentMessageResponse> {
    return this.rpc.call<AgentMessageResponse>("tenzro_sendAgentMessage", [
      {
        agent_id: agentId,
        message,
      },
    ]);
  }

  /**
   * Delegate a task to an agent using the A2A protocol.
   * @param agentId - Target agent identifier
   * @param taskDescription - Description of the task to delegate
   * @returns Task delegation response with ID and status
   */
  async delegateTask(
    agentId: string,
    taskDescription: string
  ): Promise<DelegateTaskResponse> {
    return this.rpc.post<DelegateTaskResponse>("/a2a", {
      jsonrpc: "2.0",
      method: "tasks/send",
      params: {
        id: generateUUID(),
        message: {
          role: "user",
          parts: [{ type: "text", text: taskDescription }],
        },
      },
      id: 1,
    });
  }

  /**
   * List all registered agents on the network.
   * @returns Array of agent identities
   */
  async listAgents(): Promise<AgentIdentity[]> {
    return this.rpc.call<AgentIdentity[]>("tenzro_listAgents");
  }

  /**
   * Spawn a child agent under a parent agent.
   * @param parentId - The parent agent's ID
   * @param name - Name for the new child agent
   * @param capabilities - List of capability strings for the child agent
   * @returns Spawned agent info with agent_id, parent_id, and name
   */
  async spawnAgent(
    parentId: string,
    name: string,
    capabilities: string[]
  ): Promise<SpawnAgentResponse> {
    return this.rpc.call<SpawnAgentResponse>("tenzro_spawnAgent", [
      { parent_id: parentId, name, capabilities },
    ]);
  }

  /**
   * Run an agentic task loop for an agent.
   * The agent calls an LLM with built-in tools (spawn_agent, delegate_task,
   * collect_results, complete) and executes them iteratively until done.
   * @param agentId - The agent that will execute the task
   * @param task - Task description
   * @param inferenceUrl - Optional URL of the inference endpoint (default: localhost)
   * @returns Final task result
   */
  async runAgentTask(
    agentId: string,
    task: string,
    inferenceUrl?: string
  ): Promise<RunAgentTaskResponse> {
    return this.rpc.call<RunAgentTaskResponse>("tenzro_runAgentTask", [
      { agent_id: agentId, task, inference_url: inferenceUrl },
    ]);
  }

  /**
   * Create a swarm of member agents under an orchestrator.
   * @param orchestratorId - The orchestrator agent's ID
   * @param members - Array of member specs (name + capabilities)
   * @param options - Optional swarm configuration
   * @returns Swarm ID and orchestrator ID
   */
  async createSwarm(
    orchestratorId: string,
    members: Array<{ name: string; capabilities: string[] }>,
    options?: { max_members?: number; task_timeout_secs?: number; parallel?: boolean }
  ): Promise<CreateSwarmResponse> {
    return this.rpc.call<CreateSwarmResponse>("tenzro_createSwarm", [
      { orchestrator_id: orchestratorId, members, ...options },
    ]);
  }

  /**
   * Get the current status of a swarm.
   * @param swarmId - The swarm's ID
   * @returns Swarm status including member statuses
   */
  async getSwarmStatus(swarmId: string): Promise<SwarmStatus> {
    return this.rpc.call<SwarmStatus>("tenzro_getSwarmStatus", [
      { swarm_id: swarmId },
    ]);
  }

  /**
   * Terminate a swarm and all its member agents.
   * @param swarmId - The swarm's ID
   * @returns Confirmation with swarm_id and status "terminated"
   */
  async terminateSwarm(swarmId: string): Promise<TerminateSwarmResponse> {
    return this.rpc.call<TerminateSwarmResponse>("tenzro_terminateSwarm", [
      { swarm_id: swarmId },
    ]);
  }

  // ─── AgentKit: Template-based agent lifecycle ─────────────────────────────

  /**
   * Spawn a new agent from a registered template.
   *
   * When `parentMachineDid` is supplied, the spawned agent's effective
   * delegation scope is the strict intersection of the parent's scope and
   * the template's spec — the child can never be broader than its parent
   * on any axis (numeric ceilings, allow-lists, time bound).
   *
   * @param templateId - The template to instantiate
   * @param displayName - Optional human-readable name for the spawned agent
   * @param context - Optional key-value context passed to the agent at boot
   * @param parentMachineDid - Optional parent machine DID to attenuate against
   * @returns Spawned agent info with agent_id, template_id, name, and status
   */
  async spawnAgentTemplate(
    templateId: string,
    displayName?: string,
    context?: Record<string, string>,
    parentMachineDid?: string
  ): Promise<SpawnAgentTemplateResponse> {
    return this.rpc.call<SpawnAgentTemplateResponse>("tenzro_spawnAgentTemplate", [
      {
        template_id: templateId,
        display_name: displayName,
        context,
        parent_machine_did: parentMachineDid,
      },
    ]);
  }

  /**
   * Run an already-spawned template agent through its task loop.
   * @param agentId - The agent to run
   * @param maxIterations - Optional cap on loop iterations (default: server-side default)
   * @param dryRun - If true, simulate execution without side effects
   * @returns Execution report with iterations, status, result, and duration
   */
  async runAgentTemplate(
    agentId: string,
    maxIterations?: number,
    dryRun?: boolean
  ): Promise<RunAgentTemplateReport> {
    return this.rpc.call<RunAgentTemplateReport>("tenzro_runAgentTemplate", [
      { agent_id: agentId, max_iterations: maxIterations, dry_run: dryRun },
    ]);
  }

  /**
   * Download a template's full definition for offline inspection or forking.
   * @param templateId - The template to download
   * @returns Full agent template
   */
  async downloadAgentTemplate(templateId: string): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>("tenzro_downloadAgentTemplate", [
      { template_id: templateId },
    ]);
  }

  /**
   * Update a registered agent template (must be the creator).
   * @param templateId - The template to update
   * @param params - Fields to update (partial — only provided fields are changed)
   * @returns Updated agent template
   */
  async updateAgentTemplate(
    templateId: string,
    params: UpdateAgentTemplateParams
  ): Promise<AgentTemplate> {
    return this.rpc.call<AgentTemplate>("tenzro_updateAgentTemplate", [
      { template_id: templateId, ...params },
    ]);
  }

  // ─── Discovery & Lifecycle ──────────────────────────────────────────────────

  /**
   * Discover available models with optional filters.
   * @param options - Optional filters: modality, servingOnly, query
   * @returns Array of discovered models
   */
  async discoverModels(options?: {
    modality?: string;
    servingOnly?: boolean;
    query?: string;
  }): Promise<any> {
    return this.rpc.call("tenzro_discoverModels", [
      {
        modality: options?.modality,
        serving_only: options?.servingOnly,
        query: options?.query,
      },
    ]);
  }

  /**
   * Discover available agents with optional capability filter.
   * @param capability - Optional capability to filter by
   * @returns Array of discovered agents
   */
  async discoverAgents(capability?: string): Promise<any> {
    return this.rpc.call("tenzro_discoverAgents", [{ capability }]);
  }

  /**
   * Spawn an agent with a specific skill attached.
   * @param parentId - The parent agent's ID
   * @param name - Name for the new agent
   * @param skillId - Skill to attach to the agent
   * @param capabilities - Optional list of capabilities
   * @returns Spawned agent info
   */
  async spawnAgentWithSkill(
    parentId: string,
    name: string,
    skillId: string,
    capabilities?: string[]
  ): Promise<any> {
    return this.rpc.call("tenzro_spawnAgentWithSkill", [
      {
        parent_id: parentId,
        name,
        skill_id: skillId,
        capabilities,
      },
    ]);
  }

  /**
   * Fund an agent's wallet.
   * @param agentId - The agent to fund
   * @param fromAddress - Source address for the funds
   * @param amountTnzo - Amount of TNZO to transfer
   * @returns Funding result
   */
  async fundAgent(
    agentId: string,
    fromAddress: string,
    amountTnzo: number
  ): Promise<any> {
    return this.rpc.call("tenzro_fundAgent", [
      {
        agent_id: agentId,
        from_address: fromAddress,
        amount_tnzo: amountTnzo,
      },
    ]);
  }

  /**
   * Swap tokens for an agent.
   * @param agentId - The agent performing the swap
   * @param fromToken - Source token identifier
   * @param toToken - Destination token identifier
   * @param amount - Amount to swap
   * @param chain - Optional chain for the swap
   * @returns Swap result
   */
  async swapToken(
    agentId: string,
    fromToken: string,
    toToken: string,
    amount: string,
    chain?: string
  ): Promise<any> {
    return this.rpc.call("tenzro_swapToken", [
      {
        agent_id: agentId,
        from_token: fromToken,
        to_token: toToken,
        amount,
        chain,
      },
    ]);
  }

  /**
   * Run the full agent payment pipeline for inference.
   * @param agentId - The agent paying for inference
   * @param modelId - The model to use
   * @param prompt - The prompt to send
   * @param maxTokens - Optional max tokens for the response
   * @returns Inference result with payment details
   */
  async agentPayForInference(
    agentId: string,
    modelId: string,
    prompt: string,
    maxTokens?: number
  ): Promise<any> {
    return this.rpc.call("tenzro_agentPayForInference", [
      {
        agent_id: agentId,
        model_id: modelId,
        prompt,
        max_tokens: maxTokens,
      },
    ]);
  }

  /**
   * Set the gas policy for an agent's on-chain operations.
   * @param agentId - The agent identifier
   * @param policy - Gas policy configuration
   * @returns Updated gas policy
   */
  async setGasPolicy(agentId: string, policy: GasPolicy): Promise<GasPolicy> {
    return this.rpc.call<GasPolicy>("tenzro_setAgentGasPolicy", [
      { agent_id: agentId, ...policy },
    ]);
  }

  /**
   * Get the current gas policy for an agent.
   * @param agentId - The agent identifier
   * @returns Current gas policy
   */
  async getGasPolicy(agentId: string): Promise<GasPolicy> {
    return this.rpc.call<GasPolicy>("tenzro_getAgentGasPolicy", [
      { agent_id: agentId },
    ]);
  }

  /**
   * Operational suspend (Active → Suspended). The reversible counterpart of
   * `resumeAgent`. Distinct from the kill-switch `pauseAgent` /
   * `quarantineAgent` axes (those require signed transactions).
   * @param agentId - The agent identifier
   * @param reason - Free-form audit reason
   */
  async suspendAgent(agentId: string, reason: string): Promise<unknown> {
    return this.rpc.call<unknown>("tenzro_suspendAgent", {
      agent_id: agentId,
      reason,
    });
  }

  /**
   * Recover a Suspended agent back to Active. Used to recover from auto-
   * suspend (heartbeat monitor) or a manual `suspendAgent`.
   * @param agentId - The agent identifier
   */
  async resumeAgent(agentId: string): Promise<unknown> {
    return this.rpc.call<unknown>("tenzro_resumeAgent", {
      agent_id: agentId,
    });
  }

  /**
   * Send a liveness heartbeat for an agent. The heartbeat monitor uses
   * `last_heartbeat` to decide whether to auto-suspend on the next sweep.
   * @param agentId - The agent identifier
   */
  async agentHeartbeat(agentId: string): Promise<unknown> {
    return this.rpc.call<unknown>("tenzro_agentHeartbeat", {
      agent_id: agentId,
    });
  }
}
