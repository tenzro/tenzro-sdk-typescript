import type { RpcClient } from './rpc';

// ── Types ──

export type WorkflowStatus =
  | 'created'
  | 'open'
  | 'executing'
  | 'verifying'
  | 'compensating'
  | 'finalized'
  | 'failed';

export type SagaStepStatus =
  | 'pending'
  | 'executing'
  | 'verifying'
  | 'verified'
  | 'compensating'
  | 'compensated'
  | 'failed';

export interface SagaStep {
  step_id: string;
  status: SagaStepStatus;
  actor_did?: string;
  escrow_amount?: string;
  payload?: unknown;
  result?: unknown;
}

export interface SagaWorkflow {
  workflow_id: string;
  steps: SagaStep[];
  status: WorkflowStatus;
}

export interface WorkflowPayload {
  workflow_id?: string;
  creator_did: string;
  participants: string[];
  steps: SagaStep[];
  metadata?: Record<string, unknown>;
}

/**
 * A DID-signed envelope. The shape matches `tenzro_types::IdentityEnvelope`:
 * a canonical-JSON payload + signature + DID + algorithm tag.
 */
export interface DidEnvelope {
  payload: unknown;
  signature: string;
  signer_did: string;
  alg: string;
  [extra: string]: unknown;
}

// ── Client ──

/**
 * Multi-agent saga workflow client.
 *
 * A workflow is an ordered sequence of saga steps with per-step
 * Execute → Verify → Compensate lifecycles, optional per-step escrow,
 * durable lifecycle state, and optional mirroring to Canton DAML for
 * institutional counterparties. The full lifecycle is mediated by
 * `tenzro_workflow*` RPCs.
 *
 * @example
 * ```ts
 * const workflow = client.workflow;
 *
 * const opened = await workflow.open({
 *   creator_did: 'did:tenzro:human:...',
 *   participants: ['did:tenzro:machine:...'],
 *   steps: [{ step_id: 'step-1', status: 'pending' }],
 * });
 *
 * await workflow.stepExecute(opened.workflow_id, 'step-1');
 * await workflow.stepVerify(opened.workflow_id, 'step-1');
 * await workflow.finalize(opened.workflow_id);
 * ```
 */
export class WorkflowClient {
  constructor(private readonly rpc: RpcClient) {}

  /** Open a multi-agent saga workflow. */
  async open(workflow: WorkflowPayload): Promise<unknown> {
    return this.rpc.call('tenzro_workflowOpen', { workflow });
  }

  /** Transition a step Pending → Executing, optionally locking per-step escrow. */
  async stepExecute(
    workflowId: string,
    stepId: string,
    escrowAmount?: bigint,
  ): Promise<unknown> {
    const params: Record<string, unknown> = {
      workflow_id: workflowId,
      step_id: stepId,
    };
    if (escrowAmount !== undefined) {
      params.escrow_amount = escrowAmount.toString();
    }
    return this.rpc.call('tenzro_workflowStepExecute', params);
  }

  /** Verify a step's outcome. */
  async stepVerify(workflowId: string, stepId: string): Promise<unknown> {
    return this.rpc.call('tenzro_workflowStepVerify', {
      workflow_id: workflowId,
      step_id: stepId,
    });
  }

  /** Compensate a step (roll back). */
  async stepCompensate(workflowId: string, stepId: string): Promise<unknown> {
    return this.rpc.call('tenzro_workflowStepCompensate', {
      workflow_id: workflowId,
      step_id: stepId,
    });
  }

  /**
   * Finalize the workflow — emits a `WorkflowReceipt` when all steps have
   * completed successfully (or compensated cleanly).
   */
  async finalize(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_workflowFinalize', { workflow_id: workflowId });
  }

  /** Read the current state of a workflow. */
  async get(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getWorkflow', { workflow_id: workflowId });
  }

  /** Read the underlying saga (step-level execution state). */
  async getSaga(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getWorkflowSaga', { workflow_id: workflowId });
  }

  /** Read the durable lifecycle record. */
  async getLifecycle(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getWorkflowLifecycle', {
      workflow_id: workflowId,
    });
  }

  /** Read the receipt emitted when the workflow finalized. */
  async getReceipt(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getWorkflowReceipt', {
      workflow_id: workflowId,
    });
  }

  /** Read operational metrics for a workflow. */
  async getOperationalMetrics(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getWorkflowOperationalMetrics', {
      workflow_id: workflowId,
    });
  }

  /** List recent workflow receipts. */
  async listReceipts(limit?: number): Promise<unknown> {
    const params: Record<string, unknown> = {};
    if (limit !== undefined) params.limit = limit;
    return this.rpc.call('tenzro_listWorkflowReceipts', params);
  }

  /** List workflows authored by a creator DID. */
  async listByCreator(creatorDid: string): Promise<unknown> {
    return this.rpc.call('tenzro_listWorkflowsByCreator', {
      creator_did: creatorDid,
    });
  }

  /** List workflows where `participant_did` appears as a step actor. */
  async listByParticipant(participantDid: string): Promise<unknown> {
    return this.rpc.call('tenzro_listWorkflowsByParticipant', {
      participant_did: participantDid,
    });
  }

  /** List workflows currently in a given status. */
  async listByStatus(status: WorkflowStatus): Promise<unknown> {
    return this.rpc.call('tenzro_listWorkflowsByStatus', { status });
  }

  /** Mirror a workflow's receipt into Canton DAML. */
  async mirrorToCanton(workflowId: string): Promise<unknown> {
    return this.rpc.call('tenzro_mirrorWorkflowToCanton', {
      workflow_id: workflowId,
    });
  }

  /** Verify a DID-signed envelope (e.g. an off-chain signed step result). */
  async verifyDidEnvelope(envelope: DidEnvelope): Promise<unknown> {
    return this.rpc.call('tenzro_verifyDidEnvelope', { envelope });
  }
}
