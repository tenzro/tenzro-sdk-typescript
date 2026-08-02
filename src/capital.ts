import type { RpcClient } from './rpc';

// ── Types ──

/**
 * Side of a capital intent leg.
 */
export type CapitalSide = 'acquire' | 'exit';

/**
 * A weighted asset entry in a Capital Intent basket.
 */
export interface AssetWeight {
  asset_id: string;
  weight_bps: number;
}

/**
 * Objective of a Capital Intent — the high-level outcome the principal authorizes.
 */
export type CapitalObjective =
  | { kind: 'acquire'; basket: AssetWeight[] }
  | { kind: 'exit'; basket: AssetWeight[] }
  | { kind: 'rebalance'; target: AssetWeight[] }
  | { kind: 'hedge'; basket: AssetWeight[] }
  | { kind: 'yield'; basket: AssetWeight[] };

export interface CapitalConstraints {
  max_price?: number;
  max_eta_secs?: number;
  max_slippage_bps?: number;
  [extra: string]: unknown;
}

export interface CapitalComplianceReq {
  reg_regime?: string;
  required_kya?: string[];
  jurisdictions?: string[];
  [extra: string]: unknown;
}

export interface CapitalAuthorization {
  principal_did: string;
  signature: string;
  expires_at: number;
}

export interface CapitalSettlementReq {
  payer: string;
  payee?: string;
  asset_id: string;
  amount: string;
  channel?: string;
}

/**
 * The full Capital Intent payload — the capital-markets analog of an
 * AP2 Intent Mandate.
 */
export interface CapitalIntent {
  intent_id?: string;
  objective: CapitalObjective;
  constraints: CapitalConstraints;
  compliance: CapitalComplianceReq;
  authorization: CapitalAuthorization;
  settlement_req: CapitalSettlementReq;
  [extra: string]: unknown;
}

/**
 * Solver bid against an opened intent.
 */
export interface CapitalQuote {
  solver_did: string;
  plan: string;
  price: number;
  eta_secs: number;
}

/**
 * Single execution leg.
 */
export interface CapitalLeg {
  venue: string;
  asset_id: string;
  side: CapitalSide;
  quantity: string;
  unit_price: string;
  settlement_ref?: string;
  proof?: unknown;
}

/**
 * Origin of a reserve attestation — who is asserting the backing.
 * Wire form is snake_case (`issuer` / `tee` / `chainlink_por` / `oracle`).
 */
export type ReserveSource = 'issuer' | 'tee' | 'chainlink_por' | 'oracle';

/**
 * 1:1-backed reserve attestation that gates `attestedMint`. Mirrors the
 * canonical on-chain `ReserveAttestation`: the attestor signs the canonical
 * payload (`signing_payload`) with their registered Ed25519 identity key, and
 * the node rejects any submission whose signature is empty or does not verify.
 */
export interface ReserveAttestation {
  /** Human-readable asset label the reserve backs (e.g. ISIN, symbol). */
  asset_id: string;
  /** Attested reserve, base units. */
  reserves: number;
  /** Who is attesting the backing. */
  source: ReserveSource;
  /** Attestor DID — must be registered and hold an Ed25519 key. */
  attestor_did: string;
  /** Unix seconds the attestation was made. */
  attested_at: number;
  /**
   * Ed25519 signature over `signing_payload()`, as a byte array. The node
   * is fail-closed: an empty signature is rejected before any persist.
   */
  signature: number[];
}

// ── Client ──

/**
 * Capital Intent + Reserve client.
 *
 * `CapitalIntent` is the capital-markets analog of an AP2 Intent Mandate:
 * a signed, expiring authorization that says "I want to acquire / exit /
 * rebalance / hedge / yield this basket, subject to these regulatory
 * constraints, KYA, and ceilings." Solvers bid; the principal (or an
 * authorized assigner) picks one; the intent runs through Execute → Settle
 * with optional Verify and Compensate steps.
 *
 * Companion read paths:
 * - `getCapitalIntent` for the current intent state.
 * - `getReserve` / `submitReserveAttestation` for the 1:1-backed
 *   reserve attestations that underpin `attestedMint`.
 *
 * @example
 * ```ts
 * const capital = client.capital;
 *
 * // Submit a signed intent (already authorized + signed by the principal).
 * const opened = await capital.open(myIntent);
 *
 * // Solver bids; assigner picks the best one (auto-rank).
 * const assigned = await capital.assign(opened.intent_id, { auto: true });
 *
 * // Execute, settle.
 * await capital.execute(opened.intent_id, leg);
 * await capital.settle(opened.intent_id);
 * ```
 */
export class CapitalClient {
  constructor(private readonly rpc: RpcClient) {}

  /** Open a new Capital Intent. */
  async open(intent: CapitalIntent): Promise<unknown> {
    return this.rpc.call('tenzro_capitalIntentOpen', { intent });
  }

  /** Submit a solver bid against an opened intent. */
  async quote(
    intentId: string,
    solverDid: string,
    plan: string,
    price: number,
    etaSecs: number,
  ): Promise<unknown> {
    return this.rpc.call('tenzro_capitalIntentQuote', {
      intent_id: intentId,
      solver_did: solverDid,
      plan,
      price,
      eta_secs: etaSecs,
    });
  }

  /**
   * Assign the intent to a solver. Pass `{ auto: true }` (with no `solverDid`)
   * to auto-rank by ERC-8004 reputation, then price, then eta.
   */
  async assign(
    intentId: string,
    opts: { solverDid?: string; auto?: boolean; payer?: string; payee?: string } = {},
  ): Promise<unknown> {
    const params: Record<string, unknown> = { intent_id: intentId };
    if (opts.solverDid !== undefined) params.solver_did = opts.solverDid;
    if (opts.auto !== undefined) params.auto = opts.auto;
    if (opts.payer !== undefined) params.payer = opts.payer;
    if (opts.payee !== undefined) params.payee = opts.payee;
    return this.rpc.call('tenzro_capitalIntentAssign', params);
  }

  /** Execute a single leg of an assigned intent. */
  async execute(intentId: string, leg: CapitalLeg): Promise<unknown> {
    return this.rpc.call('tenzro_capitalIntentExecute', {
      intent_id: intentId,
      leg,
    });
  }

  /** Verify a step. */
  async verify(intentId: string): Promise<unknown> {
    return this.rpc.call('tenzro_capitalIntentVerify', { intent_id: intentId });
  }

  /** Compensate (roll back) a step that failed verification. */
  async compensate(intentId: string): Promise<unknown> {
    return this.rpc.call('tenzro_capitalIntentCompensate', {
      intent_id: intentId,
    });
  }

  /** Settle the intent — release escrow to the payee. */
  async settle(intentId: string, payee?: string): Promise<unknown> {
    const params: Record<string, unknown> = { intent_id: intentId };
    if (payee !== undefined) params.payee = payee;
    return this.rpc.call('tenzro_capitalIntentSettle', params);
  }

  /** Read the current state of a capital intent. */
  async get(intentId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getCapitalIntent', { intent_id: intentId });
  }

  /** Submit a 1:1-backed reserve attestation for a tokenized asset. */
  async submitReserveAttestation(attestation: ReserveAttestation): Promise<unknown> {
    return this.rpc.call('tenzro_submitReserveAttestation', { attestation });
  }

  /** Read the latest reserve attestation for a tokenized asset. */
  async getReserve(assetId: string): Promise<unknown> {
    return this.rpc.call('tenzro_getReserve', { asset_id: assetId });
  }

  /** Attested 1:1 mint — token issuance gated by a fresh reserve attestation. */
  async attestedMint(
    tokenId: string,
    to: string,
    amount: string,
    caller: string,
  ): Promise<unknown> {
    return this.rpc.call('tenzro_attestedMint', {
      token_id: tokenId,
      to,
      amount,
      caller,
    });
  }
}
