import type { RpcClient } from './rpc';
import type {
  ToolInfo,
  ToolFilter,
  RegisterToolParams,
  UpdateToolParams,
  ToolExecutionResult,
  ToolUsage,
} from './types';

/**
 * Client for the Tenzro Tool Registry.
 * Register, discover, and invoke MCP-compatible tools on the network.
 */
export class ToolClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Register a new tool in the registry.
   * @param params - Tool definition including name, description, version, and type
   * @returns The registered tool
   */
  async registerTool(params: RegisterToolParams): Promise<ToolInfo> {
    return this.rpc.call<ToolInfo>('tenzro_registerTool', [params]);
  }

  /**
   * List tools with optional filtering.
   * @param filter - Optional filter criteria (transport, category, tag, etc.)
   * @returns Array of matching tools
   */
  async listTools(filter?: ToolFilter): Promise<ToolInfo[]> {
    return this.rpc.call<ToolInfo[]>('tenzro_listTools', [filter ?? {}]);
  }

  /**
   * Search tools by free-text query.
   * @param query - Search query string
   * @returns Array of matching tools ranked by relevance
   */
  async searchTools(query: string): Promise<ToolInfo[]> {
    return this.rpc.call<ToolInfo[]>('tenzro_searchTools', [{ query }]);
  }

  /**
   * Execute a tool with the given input.
   * @param toolId - The tool to invoke
   * @param input - Input payload (JSON-serializable string or object)
   * @returns Execution result with output and duration
   */
  async useTool(toolId: string, input: string): Promise<ToolExecutionResult> {
    return this.rpc.call<ToolExecutionResult>('tenzro_useTool', [
      { tool_id: toolId, input },
    ]);
  }

  /**
   * Get a tool by ID.
   * @param toolId - The tool identifier
   * @returns Tool information
   */
  async getTool(toolId: string): Promise<ToolInfo> {
    return this.rpc.call<ToolInfo>('tenzro_getTool', [{ tool_id: toolId }]);
  }

  /**
   * Update an existing tool (must be the creator).
   * @param toolId - The tool to update
   * @param params - Fields to update (partial)
   * @returns Updated tool
   */
  async updateTool(toolId: string, params: UpdateToolParams): Promise<ToolInfo> {
    return this.rpc.call<ToolInfo>('tenzro_updateTool', [
      { tool_id: toolId, ...params },
    ]);
  }

  /**
   * Get usage statistics for a tool.
   * @param toolId - The tool identifier
   * @returns Usage statistics including total invocations and last used timestamp
   */
  async getToolUsage(toolId: string): Promise<ToolUsage> {
    return this.rpc.call<ToolUsage>('tenzro_getToolUsage', [
      { tool_id: toolId },
    ]);
  }
}
