import type { RpcClient } from './rpc';

export interface AttestedTimestampEnvelope {
  wall_ms: number;
  monotonic_ns: number;
  tee_vendor: string | null;
  note?: string;
}

/**
 * TEE-attested clock client. Returns the canonical AttestedTimestamp
 * envelope used by long-running multi-party workflows for deadlines,
 * AP2 mandate expiry, parametric insurance trigger windows, and
 * margin-call grace periods.
 */
export class AttestedClockClient {
  constructor(private readonly rpc: RpcClient) {}

  async now(): Promise<AttestedTimestampEnvelope> {
    return this.rpc.call<AttestedTimestampEnvelope>('tenzro_attestedClockNow', []);
  }
}
