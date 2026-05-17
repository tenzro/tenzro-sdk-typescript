import { RpcClient } from "./rpc";

/**
 * Validator registry status. Mirrors the Rust
 * `tenzro_token::validator_registry::ValidatorStatus` enum, projected
 * to its `Debug`-formatted string on the wire.
 */
export type ValidatorStatus =
  | "Active"
  | "Candidate"
  | "PendingActive"
  | "PendingExit"
  | "Exited"
  | "Jailed";

/**
 * A single entry in the on-chain validator registry. `address` and
 * `withdrawal_address` are base58-encoded (Solana-style, matching
 * Tenzro's `Address::Display` impl). Pubkeys are plain lowercase hex
 * without `0x` prefix. `self_stake` is a u128 encoded as a decimal
 * string. `tee_attestation_hash` is `null` when the validator has
 * no recorded TEE attestation; `metadata_uri` defaults to `""`.
 */
export interface ValidatorRegistryEntry {
  /** Base58-encoded 32-byte address. */
  address: string;
  /** Ed25519 consensus pubkey, hex-encoded (32 bytes → 64 hex chars). */
  consensus_pubkey: string;
  /** Byte length of the post-quantum (ML-DSA-65) pubkey blob — always 1952. */
  pq_pubkey_len: number;
  /** BLS12-381 G1 (min-pk) pubkey, hex-encoded (48 bytes → 96 hex chars). */
  bls_pubkey: string;
  /** Base58-encoded 32-byte withdrawal address. */
  withdrawal_address: string;
  /** u128 decimal string. */
  self_stake: string;
  status: ValidatorStatus;
  registered_at_epoch: number;
  activated_at_epoch: number | null;
  exited_at_epoch: number | null;
  jailed_until_epoch: number | null;
  tee_attestation_hash: string | null;
  metadata_uri: string;
  /** Unix ms timestamp of last registry mutation. */
  updated_at: number;
}

export interface ListValidatorsResult {
  count: number;
  validators: ValidatorRegistryEntry[];
}

/**
 * Read-only client for the on-chain validator registry — used by
 * operator dashboards, SREs, and any client that needs to enumerate
 * the active validator set or inspect a single validator's stake,
 * activation epoch, or TEE-attestation status.
 *
 * Backed by the `tenzro_getValidatorState` / `tenzro_listValidators` /
 * `tenzro_listActiveValidators` RPCs. All three are pure reads — no
 * write surface is exposed (validators self-register via the staking
 * transaction path, not via RPC).
 */
export class ValidatorClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Fetch a single validator's registry entry by 32-byte address
   * (hex form, with or without `0x` prefix — the node decodes hex,
   * not base58, on the request path even though responses are
   * base58-encoded). Returns `null` if the address is not registered.
   */
  async getState(address: string): Promise<ValidatorRegistryEntry | null> {
    return this.rpc.call("tenzro_getValidatorState", [{ address }]);
  }

  /**
   * List validators in the registry, optionally filtered by status.
   * Omit `status` to return every entry regardless of state.
   */
  async list(status?: ValidatorStatus): Promise<ListValidatorsResult> {
    const params = status ? [{ status }] : [{}];
    return this.rpc.call("tenzro_listValidators", params);
  }

  /**
   * Convenience over `list("Active")` — returns only the validators
   * currently producing blocks. The node returns the same shape, so
   * the result type is identical to `list()`.
   */
  async listActive(): Promise<ListValidatorsResult> {
    return this.rpc.call("tenzro_listActiveValidators", []);
  }
}
