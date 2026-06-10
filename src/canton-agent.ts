/**
 * CantonAgentClient — the autonomous-agent Canton SDK surface.
 *
 * Mirrors the Rust `tenzro_sdk::canton_agent::CantonAgentClient` shape.
 * Methods cover mandate-bound DAML write, scoped read via watchParty,
 * and rolled-up analytics.
 */

import { RpcClient } from './rpc';

export interface Mandate {
  checkout: unknown;
  payment: unknown;
}

export interface SubmitWithMandateParams {
  mandate: Mandate;
  command_type: 'create' | 'exercise';
  template_id: string;
  create_arguments?: unknown;
  contract_id?: string;
  choice?: string;
  choice_argument?: unknown;
  act_as?: string;
}

export interface MandateBoundReceipt {
  ap2_receipt: unknown;
  canton_receipt: unknown;
}

export interface WatchPartySnapshot {
  party: string;
  template_ids: string[];
  active_contracts: unknown;
  count: number;
}

export interface AnalyticsBucket {
  key: string;
  total_calls: number;
  last_called_at: number;
}

export interface AggregateAnalytics {
  group_by: string;
  buckets: AnalyticsBucket[];
  row_count: number;
}

export class CantonAgentClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Submit a DAML command bound to an AP2 mandate pair. Validates the
   * cart against AP2 invariants + TDIP delegation + runtime
   * SpendingPolicy + optional escrow / SPT ceilings. Only when all
   * applicable ceilings pass does the DAML command submit.
   */
  async submitWithMandate(
    params: SubmitWithMandateParams,
  ): Promise<MandateBoundReceipt> {
    return this.rpc.call('tenzro_canton_submitWithMandate', params as unknown as Record<string, unknown>);
  }

  /**
   * Get the live active-contracts snapshot for a single party. The
   * presenting API key must allow reading for this party.
   */
  async watchParty(
    partyFq: string,
    templateIds: string[],
  ): Promise<WatchPartySnapshot> {
    return this.rpc.call('tenzro_canton_watchParty', {
      party: partyFq,
      template_ids: templateIds,
    });
  }

  /**
   * Operator admin-read of rolled-up per-key Canton call counters.
   * Admin-token-gated. `groupBy = 'subject' | 'key_id'`.
   */
  async aggregateAnalytics(
    groupBy: 'subject' | 'key_id',
  ): Promise<AggregateAnalytics> {
    return this.rpc.call('tenzro_canton_aggregateAnalytics', {
      group_by: groupBy,
    });
  }
}
