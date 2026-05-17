import type { RpcClient } from './rpc';
import type {
  TaskInfo,
  TaskQuote,
  TaskFilter,
  PostTaskParams,
  AssignTaskResult,
  CompleteTaskResult,
} from './types';

/**
 * Task-marketplace client.
 *
 * Full settlement cycle on the live testnet:
 *
 *   await client.task.postTask({ title, poster, max_price, task_type, input })
 *   await client.task.quoteTask(taskId, providerAddress, price, { model_id, ... })
 *   await client.task.assignTask(taskId, providerAddress, quotedPrice)
 *   await client.task.completeTask(taskId, output)   // <- triggers TNZO transfer
 *
 * `completeTask` performs the on-chain settlement: `tenzro-token`
 * transfers `final_price` (the quoted price, or `max_price` if unquoted)
 * from poster to assignee through the unified token registry.
 */
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

  /**
   * Submit a quote for a task.
   *
   * @param taskId - The task to quote.
   * @param provider - Provider address (hex). Required — the live RPC
   *   rejects quotes that lack a provider address.
   * @param price - Quoted price in TNZO wei (u128 as decimal string).
   * @param opts.modelId - Optional model identifier (default: `"any"`).
   * @param opts.confidence - Quote confidence 0–100 (default: 80).
   * @param opts.estimatedDurationSecs - Estimated runtime in seconds (default: 60).
   * @param opts.notes - Optional free-form notes.
   */
  async quoteTask(
    taskId: string,
    provider: string,
    price: string,
    opts?: {
      modelId?: string;
      confidence?: number;
      estimatedDurationSecs?: number;
      notes?: string;
    }
  ): Promise<TaskQuote> {
    return this.rpc.call<TaskQuote>('tenzro_quoteTask', [
      {
        task_id: taskId,
        provider,
        price,
        model_id: opts?.modelId,
        confidence: opts?.confidence,
        estimated_duration_secs: opts?.estimatedDurationSecs,
        notes: opts?.notes,
      },
    ]);
  }

  /**
   * Assign a task to a specific provider address.
   *
   * The live RPC handler keys assignment on the provider's wallet
   * address, not an agent_id — the task's `assignee` field is set to
   * `provider`, and `quoted_price` is stored on the task so that
   * `completeTask` can settle to it.
   *
   * @param taskId - The task to assign.
   * @param provider - Provider wallet address (hex).
   * @param quotedPrice - Optional locked-in price in TNZO wei
   *   (u128 as decimal string). If omitted, the task's `max_price`
   *   is used at settlement time.
   */
  async assignTask(
    taskId: string,
    provider: string,
    quotedPrice?: string
  ): Promise<AssignTaskResult> {
    return this.rpc.call<AssignTaskResult>('tenzro_assignTask', [
      {
        task_id: taskId,
        provider,
        quoted_price: quotedPrice,
      },
    ]);
  }

  /**
   * Mark a task as completed and trigger on-chain TNZO settlement.
   *
   * The live RPC handler:
   *   1. transfers `final_price` from poster to assignee via the token registry,
   *   2. sets `task.status = Completed`,
   *   3. stores `output` on the task,
   *   4. returns the new poster/assignee balances under `settlement`.
   *
   * @param taskId - The task to complete.
   * @param output - The result / output text to attach to the task.
   */
  async completeTask(taskId: string, output: string): Promise<CompleteTaskResult> {
    return this.rpc.call<CompleteTaskResult>('tenzro_completeTask', [
      { task_id: taskId, output },
    ]);
  }

  /**
   * Update an existing task (creator only).
   */
  async updateTask(
    taskId: string,
    options?: {
      title?: string;
      description?: string;
      status?: string;
      output?: string;
    }
  ): Promise<TaskInfo> {
    return this.rpc.call<TaskInfo>('tenzro_updateTask', [
      { task_id: taskId, ...options },
    ]);
  }
}
