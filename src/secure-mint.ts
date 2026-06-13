import type { RpcClient } from './rpc';

/**
 * A per-token reserve-attestation policy. The policy is keyed on-chain by
 * the token's 20-byte EVM address; `asset_id` is a human-readable label.
 */
export interface SecureMintPolicy {
  /** Token's 20-byte EVM address (hex, `0x`-prefixed). Primary key. */
  token: string;
  /** Human-readable asset label (e.g. ISIN, symbol). */
  asset_id: string;
  /** Attested reserve, base units (decimal string). */
  reserve: string;
  /** Current circulating supply, base units (decimal string). */
  circulating?: string;
  /** Proof-of-reserve feed id this policy reads from. */
  por_feed_id: string;
  /** Attester DID whose attestation gates this policy. */
  attester_did: string;
  /** 32-byte attestation hash (hex, `0x`-prefixed). */
  attestation_hash: string;
  /** Unix seconds the attestation was made. */
  attested_at: number;
  /** Attestation freshness window in seconds. */
  ttl_secs: number;
}

/** Result of `setPolicy`. */
export interface SecureMintSetResult {
  installed: boolean;
  token: string;
  policy: SecureMintPolicy;
  prior_policy?: SecureMintPolicy | null;
}

/** Result of `getPolicy`. */
export interface SecureMintGetResult {
  found: boolean;
  token: string;
  policy?: SecureMintPolicy;
}

/** Result of `clearPolicy`. */
export interface SecureMintClearResult {
  cleared: boolean;
  token: string;
}

/** Result of `check` — read-only invariant test. */
export interface SecureMintCheck {
  allowed: boolean;
  token: string;
  amount: string;
  now: number;
  reason?: string;
}

/** Result of `apply` — invariant test + circulating increment. */
export interface SecureMintApply {
  applied: boolean;
  token: string;
  amount: string;
  policy: SecureMintPolicy;
}

/** Result of `recordBurn` — circulating decrement on redemption. */
export interface SecureMintBurn {
  recorded: boolean;
  token: string;
  amount: string;
  policy: SecureMintPolicy;
}

/**
 * Secure-Mint registry client — enforces the per-token 1:1
 * reserve-attestation invariant `circulating + amount ≤ reserve` for
 * tokenized real-world assets. All methods key on the token's 20-byte
 * EVM address.
 */
export class SecureMintClient {
  constructor(private readonly rpc: RpcClient) {}

  /** Install or refresh a token's reserve-attestation policy. */
  async setPolicy(policy: SecureMintPolicy): Promise<SecureMintSetResult> {
    return this.rpc.call<SecureMintSetResult>('tenzro_setSecureMintPolicy', [
      policy,
    ]);
  }

  /** Read the active policy for a token. */
  async getPolicy(token: string): Promise<SecureMintGetResult> {
    return this.rpc.call<SecureMintGetResult>('tenzro_getSecureMintPolicy', [
      { token },
    ]);
  }

  /** Drop the policy for a token. */
  async clearPolicy(token: string): Promise<SecureMintClearResult> {
    return this.rpc.call<SecureMintClearResult>(
      'tenzro_clearSecureMintPolicy',
      [{ token }]
    );
  }

  /** Read-only: would minting `amount` of `token` stay within reserve? */
  async check(token: string, amount: string): Promise<SecureMintCheck> {
    return this.rpc.call<SecureMintCheck>('tenzro_secureMintCheck', [
      { token, amount },
    ]);
  }

  /** Apply the invariant and increment circulating supply on success. */
  async apply(token: string, amount: string): Promise<SecureMintApply> {
    return this.rpc.call<SecureMintApply>('tenzro_secureMintApply', [
      { token, amount },
    ]);
  }

  /** Decrement circulating supply on redemption/burn. */
  async recordBurn(token: string, amount: string): Promise<SecureMintBurn> {
    return this.rpc.call<SecureMintBurn>('tenzro_secureMintRecordBurn', [
      { token, amount },
    ]);
  }
}
