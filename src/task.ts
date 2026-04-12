import type { RpcClient } from './rpc';
import type { TaskInfo, TaskQuote, TaskFilter, PostTaskParams, AssignTaskResult, CompleteTaskResult } from './types';

export class TaskClient {
  constructor(private readonly rpc: RpcClient) {}

  async postTask(params: PostTaskParams): Promise<TaskInfo> {
    return this.rpc.call<TaskInfo>('tenzro_postTask', [params]);
  }

  async listTasks(filter?: TaskFilter): Promise<TaskInfo[]> {
    return this.rpc.call<TaskInfo[]>('tenzro_listTasks', [filter ?? {}]);
  }

  async getTask(taskId: string): Promise<TaskInfo> {
    return this.rpc.call<TaskInfo>('tenzro_getTask', [{ task_id: taskId }]);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    return this.rpc.call<boolean>('tenzro_cancelTask', [{ task_id: taskId }]);
  }

  async submitQuote(
    taskId: string,
    price: string,
    modelId: string,
    estimatedDurationSecs: number
  ): Promise<TaskQuote> {
    return this.rpc.call<TaskQuote>('tenzro_submitQuote', [{
      task_id: taskId,
      price,
      model_id: modelId,
      estimated_duration_secs: estimatedDurationSecs,
    }]);
  }

  /**
   * Submit a quote for a task with price and estimated completion time.
   * @param taskId - The task to quote
   * @param price - Quoted price (in TNZO wei)
   * @param estimatedTime - Estimated completion time (e.g., "120s", "5m", "1h")
   * @returns Quote result
   */
  async quoteTask(
    taskId: string,
    price: number,
    estimatedTime: string
  ): Promise<any> {
    return this.rpc.call('tenzro_quoteTask', [
      { task_id: taskId, price, estimated_time: estimatedTime },
    ]);
  }

  /**
   * Assign a task to a specific agent.
   * @param taskId - The task to assign
   * @param agentId - The agent to assign it to
   * @returns Assignment result with status
   */
  async assignTask(taskId: string, agentId: string): Promise<AssignTaskResult> {
    return this.rpc.call<AssignTaskResult>('tenzro_assignTask', [
      { task_id: taskId, agent_id: agentId },
    ]);
  }

  /**
   * Mark a task as completed with the final result.
   * @param taskId - The task to complete
   * @param result - The output / result of the task
   * @returns Completion result with status and optional settlement tx hash
   */
  async completeTask(taskId: string, result: string): Promise<CompleteTaskResult> {
    return this.rpc.call<CompleteTaskResult>('tenzro_completeTask', [
      { task_id: taskId, result },
    ]);
  }

  /**
   * Update an existing task.
   * @param taskId - The task to update
   * @param options - Fields to update (partial)
   * @returns Updated task information
   */
  async updateTask(
    taskId: string,
    options?: {
      title?: string;
      description?: string;
      status?: string;
      output?: string;
    }
  ): Promise<any> {
    return this.rpc.call('tenzro_updateTask', [
      { task_id: taskId, ...options },
    ]);
  }
}
