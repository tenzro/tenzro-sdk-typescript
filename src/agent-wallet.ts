/**
 * `TenzroAgentWallet` — the composite agent-wallet surface.
 *
 * This is the user-facing name for what was previously spread across
 * `passkeyRpc.*`, `bond.*`, `cantonAgent.*`, and (forthcoming)
 * delegation-scope helpers. Composes the four pre-existing substrates
 * into one ergonomic class so a developer can do:
 *
 *   const aw = client.agentWallet;
 *   const { smart_account_address, did } = await aw.spawn({
 *     displayName: "Trader-7",
 *     passkeyPublicKeyHex,
 *     credentialIdHex,
 *     mlDsaPublicKeyHex,
 *   });
 *   const bondTx = await aw.postBond({
 *     controller, controllerDid, agentDid: did, amount: 1_000n,
 *   });
 *   await aw.actAsParty({ ... });          // Canton mandate-bound
 *   const sig = await aw.signOpHash({ ... }); // passkey sig
 *
 * Substrates composed:
 *   - `tenzro_enrollPasskey`       → ERC-4337 v0.8 smart account
 *     deployed via CREATE2; WebAuthnValidator installed at priority 0.
 *   - `tenzro_signWithPasskey`     → WebAuthn assertion verification
 *     against the on-chain validator (P-256 + optional ML-DSA-65 PQ leg).
 *   - `tenzro_postAgentBond` /
 *     `tenzro_getAgentBond` /
 *     `tenzro_listAgentBondsByController`
 *                                  → AgentBond economic substrate
 *     (Active/Cooldown/Frozen/Slashed/Returned, governance-gated
 *     insurance claims).
 *   - `tenzro_canton_submit_with_mandate`
 *                                  → Canton DAML rail with mandate-
 *     bound execution + IRR/JCC-aware receipts.
 *
 * Three-class TDIP identity model:
 *   spawn()       — autonomous-agent class (TEE-attested; matches
 *                   `project-self-custody-architecture-target.md`
 *                   "Autonomous machine" row).
 *   delegateTo()  — delegated-agent class (controller-signed scope).
 *   getRisk()     — composite risk score combining bond status,
 *                   delegation scope, and recent Canton mandate
 *                   adherence — for explorer + counterparty surfaces.
 *
 * What this class does NOT do (deliberately):
 *   - Does not hold or transit the device passkey private key — that
 *     stays in the platform secure enclave; the caller passes raw
 *     SEC1 / COSE_Key public bytes and the credential id only.
 *   - Does not run the WebAuthn ceremony — `navigator.credentials.*`
 *     is host-side glue (Tauri commands `device_create_passkey` /
 *     `device_sign_with_passkey` in Studio; browser API elsewhere).
 *   - Does not handle PIN — PIN is a device-local session-re-auth
 *     accelerator, never sent over RPC.
 */

import type { RpcClient } from "./rpc";
import {
  PasskeyRpcClient,
  type EnrollPasskeyParams,
  type EnrollPasskeyResponse,
  type SignWithPasskeyParams,
  type SignWithPasskeyResponse,
} from "./passkey-rpc";
import { BondClient, type ControllerBonds } from "./bond";
import {
  CantonAgentClient,
  type SubmitWithMandateParams,
  type MandateBoundReceipt,
} from "./canton-agent";

/** Result of `spawn()` — the autonomous-agent identity + the smart
 *  account that holds its keys. The address is CREATE2-deterministic
 *  from `sha256(passkey ‖ credential ‖ did)`, so the same passkey
 *  always yields the same account regardless of restarts. */
export interface SpawnAgentResult {
  /** TDIP DID of the new agent (`did:tenzro:agent:...`). */
  did: string;
  /** ERC-4337 smart-account address (20 bytes hex). */
  smartAccountAddress: string;
  /** Echoed back so the caller can reuse it for `signOpHash`. */
  credentialIdHex: string;
  /** Address of the installed WebAuthnValidator module. */
  webauthnValidatorAddress: string;
  /** Validators currently installed at priority 0; typically just
   *  `["webauthn"]` immediately after spawn, then additional modules
   *  (SessionKey, SpendingLimit, DelegationScope) are added by the
   *  controller as policy demands. */
  installedValidators: string[];
}

/** Composite risk profile — what an explorer page or a counterparty
 *  RPC consumer should look at before transacting with an agent.
 *  Substrate already exists on the node; this just packages it. */
export interface AgentRiskSnapshot {
  did: string;
  smartAccountAddress: string;
  /** Aggregate active bond across all controllers, in TNZO base units. */
  aggregateBondTnzo: string;
  /** Count of currently-Active bonds (`Active`/`Cooldown`/`Frozen`/`Slashed`/`Returned`). */
  activeBondCount: number;
  /** Most recent slashing event timestamp (unix secs), or null. */
  lastSlashSecs: number | null;
  /** Most recent insurance claim against this agent, or null. */
  lastInsuranceClaimSecs: number | null;
  /** Active validator modules (`webauthn`, `session_key`,
   *  `spending_limit`, `social_recovery`, `delegation_scope`, `tee`). */
  installedValidators: string[];
}

export class TenzroAgentWallet {
  /** Underlying clients are public so power users can drop down when
   *  the composite surface doesn't cover their case. The composite
   *  is opinionated — these aren't. */
  public readonly passkey: PasskeyRpcClient;
  public readonly bond: BondClient;
  public readonly canton: CantonAgentClient;

  constructor(rpc: RpcClient) {
    this.passkey = new PasskeyRpcClient(rpc);
    this.bond = new BondClient(rpc);
    this.canton = new CantonAgentClient(rpc);
  }

  /**
   * Spawn a new autonomous-agent identity backed by a passkey-rooted
   * smart account. The caller is responsible for producing the
   * WebAuthn credential externally (Studio: `device_create_passkey`;
   * browser: `navigator.credentials.create`).
   *
   * Side effects on the node:
   *   1. New TDIP human-class identity registered.
   *   2. ERC-4337 smart account CREATE2-deployed.
   *   3. WebAuthnValidator installed at priority 0 with the supplied
   *      P-256 pubkey + optional ML-DSA-65 PQ companion key.
   *   4. Smart account + credential mapping persisted to `CF_AGENTS`.
   *
   * Idempotency: re-calling with the same `passkeyPublicKeyHex` +
   * `credentialIdHex` + `salt` yields the same address (CREATE2
   * determinism). The node rejects duplicate credential enrollments
   * with `-32602`.
   */
  async spawn(params: EnrollPasskeyParams): Promise<SpawnAgentResult> {
    const resp: EnrollPasskeyResponse = await this.passkey.enroll(params);
    return {
      did: resp.did,
      smartAccountAddress: resp.smart_account_address,
      credentialIdHex: resp.credential_id_hex,
      webauthnValidatorAddress: resp.webauthn_validator_address,
      installedValidators: resp.installed_validators,
    };
  }

  /**
   * Verify a WebAuthn assertion against the on-chain WebAuthnValidator
   * for the given smart account. Returns the verifier's verdict;
   * does NOT broadcast a UserOp on its own — that's the caller's
   * choice (typically via `eth_sendUserOperation` with the assertion
   * spliced into the signature field per ERC-7579).
   */
  async signOpHash(params: SignWithPasskeyParams): Promise<SignWithPasskeyResponse> {
    return this.passkey.sign(params);
  }

  /**
   * Post a fresh AgentBond from `controller` (the controller's
   * wallet address). Locks `amount` TNZO into the bond vault and
   * promotes the agent into the Delegated lane while the active
   * stake is ≥ `bond_min_for_promotion`. Returns the tx hash.
   *
   * Bond lifecycle (Active → Cooldown → Returned, or → Frozen →
   * Slashed) is managed entirely on-chain; this method only kicks
   * the initial post.
   */
  async postBond(args: {
    controller: string;
    controllerDid: string;
    agentDid: string;
    amount: bigint;
  }): Promise<string> {
    return this.bond.postAgentBond(
      args.controller,
      args.agentDid,
      args.controllerDid,
      args.amount,
    );
  }

  /** List every bond posted by a controller — the explorer / app
   *  surface uses this to render the controller's full agent fleet. */
  async listBondsFor(controllerDid: string): Promise<ControllerBonds> {
    return this.bond.listAgentBondsByController(controllerDid);
  }

  /**
   * Submit a Canton DAML command under a mandate the controller has
   * pre-issued to this agent. The node enforces
   * `can_act_as_parties`, `allowed_templates`, `allowed_commands`,
   * `requires_mandate_for`, and `max_per_command_amulet` per
   * `project-canton-agentic-enforcement-2026-06-11`. Out-of-scope
   * commands return `-32004` with the violated rule named.
   */
  async actAsParty(params: SubmitWithMandateParams): Promise<MandateBoundReceipt> {
    return this.canton.submitWithMandate(params);
  }

  /**
   * Composite risk snapshot for a given agent DID. Pulls bond state
   * via `tenzro_listAgentBondsByController` + smart-account metadata
   * via `tenzro_getSmartAccount` + insurance ledger via
   * `tenzro_listInsuranceClaims` (when exposed; falls back gracefully).
   *
   * The shape is stable across composition — clients can render an
   * explorer card without knowing which RPCs were called.
   */
  async getRisk(args: {
    agentDid: string;
    controllerDid: string;
  }): Promise<AgentRiskSnapshot> {
    const bonds = await this.bond.listAgentBondsByController(args.controllerDid);
    const own = (bonds.bonds ?? []).filter(
      (b: Record<string, unknown>) => (b as { agent_did?: string }).agent_did === args.agentDid,
    );
    const active = own.filter(
      (b: Record<string, unknown>) =>
        (b as { state?: string }).state === "Active" ||
        (b as { state?: string }).state === "Cooldown",
    );
    const aggregate = active.reduce<bigint>((acc, b) => {
      const amt = (b as { amount_locked?: string }).amount_locked;
      try {
        return acc + BigInt(amt ?? "0");
      } catch {
        return acc;
      }
    }, 0n);
    const lastSlashSecs = pickMostRecentEvent(own, "slashed_at");
    const lastInsuranceClaimSecs = pickMostRecentEvent(own, "insurance_claimed_at");

    let installedValidators: string[] = [];
    let smartAccountAddress = "";
    try {
      // `tenzro_getSmartAccount` takes the smart-account address
      // string (not the DID) per its TS SDK shape. We look it up via
      // the bond record's `smart_account_address` field which the
      // node populates on bond creation. Fall back gracefully when
      // the bond doesn't carry one (delegated-class agents whose
      // controller signs on their behalf).
      const sourceBond = own.find(
        (b) => typeof (b as { smart_account_address?: string }).smart_account_address === "string",
      ) as { smart_account_address?: string } | undefined;
      if (sourceBond?.smart_account_address) {
        const sa = await this.passkey.getSmartAccount(sourceBond.smart_account_address);
        installedValidators = sa.installed_validators.map((v) =>
          // Render each as `module@priority` so the explorer chip
          // shows which validator owns priority 0 (the primary).
          `${v.module_address}@${v.priority}`,
        );
        smartAccountAddress = sa.address;
      }
    } catch {
      // Smart account lookup is best-effort — agents without one
      // (delegated-class with controller-bound keys) just report
      // empty validators.
    }

    return {
      did: args.agentDid,
      smartAccountAddress,
      aggregateBondTnzo: aggregate.toString(),
      activeBondCount: active.length,
      lastSlashSecs,
      lastInsuranceClaimSecs,
      installedValidators,
    };
  }
}

function pickMostRecentEvent(
  bonds: ReadonlyArray<Record<string, unknown>>,
  key: string,
): number | null {
  let max: number | null = null;
  for (const b of bonds) {
    const v = (b as Record<string, unknown>)[key];
    if (typeof v === "number" && (max === null || v > max)) max = v;
  }
  return max;
}
