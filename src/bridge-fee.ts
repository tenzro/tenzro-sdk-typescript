import type { RpcClient } from './rpc';

export interface QuoteBridgeFeeRequest {
  adapter: string;
  dest_chain: string;
  native_fee_smallest_unit: string;
}

export interface QuoteBridgeFeeResponse {
  adapter: string;
  dest_chain: string;
  native_fee_smallest_unit: string;
  tnzo_amount_wei: string;
  oracle_backing: string;
  note?: string;
  supported_adapters?: string[];
}

export interface BridgeSponsorshipPool {
  adapter: string;
  vault_address_hex: string;
  tnzo_balance_wei: string;
  native_outstanding_smallest_unit: string;
  refill_threshold_bps?: number;
}

export interface BridgeSponsorshipPools {
  pools: BridgeSponsorshipPool[];
  total: number;
  note?: string;
  wire_path?: string;
}

export interface SetBridgeFeeRateRequest {
  adapter: string;
  dest_chain: string;
  /** Q18 fixed-point as decimal string. */
  rate_q18: string;
  markup_bps: number;
  valid_window_ms: number;
}

export interface SponsorBridgeFeeRequest {
  quote_id_hex: string;
  adapter: string;
  dest_chain: string;
  native_fee_smallest_unit: string;
  tnzo_amount_wei: string;
  rate_q18_hex: string;
  issued_at_ms: number;
  valid_until_ms: number;
  /** `governance` | `chainlink_feed` | `fallback`. */
  oracle_backing?: string;
  payer_did: string;
}

export interface BridgeSponsorshipReceipt {
  sponsorship_id_hex: string;
  quote_id_hex: string;
  adapter: string;
  dest_chain: string;
  payer_did: string;
  tnzo_paid_wei: string;
  native_committed_smallest_unit: string;
  sponsored_at_ms: number;
  pool_address_hex: string;
}

export interface BridgeKeyAnalytics {
  key_id: string;
  calls_total: number;
  errors_total: number;
  calls_by_method: Record<string, number>;
  errors_by_method: Record<string, number>;
  /** Alchemy-style Compute Units consumed. */
  cu_consumed_total: number;
  first_seen_at?: number;
  last_called_at?: number;
  rate_limit_rejections: number;
}

export interface BridgeAnalyticsList {
  analytics: BridgeKeyAnalytics[];
}

/**
 * Bridge fee in TNZO client. Covers:
 * - Quoting destination-native bridge fee in TNZO (governance- or
 *   Chainlink-feed-backed).
 * - Sponsoring a quote against the per-adapter sponsorship pool.
 * - Operator-only rate-table + refill-threshold mutations
 *   (admin-token-gated).
 * - Per-tenant Chainlink/bridge analytics (subject self-read +
 *   operator cross-tenant read).
 */
export class BridgeFeeClient {
  constructor(private readonly rpc: RpcClient) {}

  async quote(req: QuoteBridgeFeeRequest): Promise<QuoteBridgeFeeResponse> {
    return this.rpc.call<QuoteBridgeFeeResponse>('tenzro_quoteBridgeFeeInTnzo', [req]);
  }

  async listSponsorshipPools(): Promise<BridgeSponsorshipPools> {
    return this.rpc.call<BridgeSponsorshipPools>(
      'tenzro_listBridgeSponsorshipPools',
      [],
    );
  }

  /** Admin-token-gated. */
  async setRate(req: SetBridgeFeeRateRequest): Promise<Record<string, unknown>> {
    return this.rpc.call<Record<string, unknown>>('tenzro_setBridgeFeeRate', [req]);
  }

  async sponsor(req: SponsorBridgeFeeRequest): Promise<BridgeSponsorshipReceipt> {
    return this.rpc.call<BridgeSponsorshipReceipt>('tenzro_sponsorBridgeFee', [req]);
  }

  /** Admin-token-gated. */
  async setRefillThreshold(
    adapter: string,
    refill_threshold_bps: number,
  ): Promise<Record<string, unknown>> {
    return this.rpc.call<Record<string, unknown>>('tenzro_setSponsorshipRefillThreshold', [
      { adapter, refill_threshold_bps },
    ]);
  }

  /** Subject self-read. */
  async getAnalytics(): Promise<BridgeKeyAnalytics> {
    return this.rpc.call<BridgeKeyAnalytics>('tenzro_getBridgeAnalytics', []);
  }

  /** Operator admin-token-gated cross-tenant read. */
  async listAnalytics(): Promise<BridgeAnalyticsList> {
    return this.rpc.call<BridgeAnalyticsList>('tenzro_listBridgeAnalytics', []);
  }
}
