/**
 * Pluggable signing surface for custom wallet developers — the
 * TypeScript mirror of `tenzro-sdk::signer` (Rust). See
 * `docs/SPECIFICATION.md` §15.10.2 for the full contract.
 *
 * The high-level surface (`createPasskeyWallet` / `signWithPasskey`)
 * is built on these interfaces; there is no internal-only API.
 *
 * Why interfaces, not classes:
 *   - Custom MPC topologies, custom HSM integrations, air-gapped flows,
 *     and social-recovery topologies need to extend the surface without
 *     forking the SDK.
 *   - The SDK's defaults consume the same surface, so any feature that
 *     works for the SDK's `PasskeyWallet` works for a third-party
 *     wallet.
 *
 * Why this lives in the SDK and not in `tenzro-vm`:
 *   - `tenzro-vm` owns the on-chain validator modules; the SDK owns
 *     how an off-chain wallet produces the signature and the
 *     `validatorData` blob the user op carries.
 */

import type { Address } from "./types";

/** What the {@link Signer} is. Callers use this to pick a {@link Validator}. */
export type SignerKind =
  | { kind: "webauthn"; credentialId: Uint8Array }
  | { kind: "ed25519" }
  | { kind: "frost"; threshold: number; total: number }
  | { kind: "tee"; backend: TeeBackend }
  | { kind: "hsm"; vendor: string }
  | { kind: "custom"; name: string };

/** Which TEE attests a `tee` signer. */
export type TeeBackend =
  | "intel-tdx"
  | "amd-sev-snp"
  | "aws-nitro"
  | "nvidia-cc"
  | "apple-secure-enclave"
  | "android-strongbox"
  | "windows-tpm"
  | "linux-tpm";

/** ERC-7579 module type. Numeric values match the on-chain enum. */
export enum Erc7579ModuleType {
  Validator = 1,
  Executor = 2,
  Fallback = 3,
  Hook = 4,
}

/**
 * Bundle of the EIP-712 user-op hash + raw bytes. Mirrors
 * `tenzro_sdk::signer::PackedUserOperation`.
 */
export interface PackedUserOperation {
  /** 32-byte EIP-712 hash of the user op — what {@link Signer.sign} signs. */
  opHash: Uint8Array;
  /** Raw EntryPoint bytes for validators that need to inspect the op. */
  rawOp: Uint8Array;
}

/** Per-call signing context. */
export interface SignContext {
  /** User-facing reason shown in the biometric prompt. */
  promptReason?: string;
  /**
   * Domain tag the signer scopes the hash with. Implementations MUST
   * refuse to sign when this is set and the tag does not match.
   */
  domainTag?: Uint8Array;
  /** Wall-clock deadline (ms since epoch). */
  deadlineMs?: number;
}

/**
 * Opaque signature. Format is signer-specific — the matching
 * {@link Validator} unpacks it.
 */
export interface SignerSignature {
  /** Raw signature bytes. */
  bytes: Uint8Array;
  /**
   * Ancillary data the validator needs alongside `bytes`. WebAuthn:
   * `clientDataJSON || authenticatorData`. TEE-bound: attestation report.
   */
  aux: Uint8Array;
}

export class SignerError extends Error {
  constructor(public readonly kind: SignerErrorKind, message: string) {
    super(message);
    this.name = "SignerError";
  }
}

export type SignerErrorKind =
  | "user-cancelled"
  | "authentication-failed"
  | "timeout"
  | "domain-tag-mismatch"
  | "backend-unavailable"
  | "transport";

export class ValidatorError extends Error {
  constructor(public readonly kind: ValidatorErrorKind, message: string) {
    super(message);
    this.name = "ValidatorError";
  }
}

export type ValidatorErrorKind = "unsupported" | "assembly-failed";

/** Stable identifier for a key inside {@link KeyStorage}. */
export interface KeyId {
  value: string;
}

/** What a storage backend promises about its keys. */
export interface StorageCapabilities {
  /** Secret material never leaves dedicated hardware. */
  hardwareBacked: boolean;
  /** Every signing op forces a biometric / user-presence check. */
  biometricGated: boolean;
  /** Key can be exported as raw bytes. Hardware-backed keys MUST be false. */
  exportable: boolean;
  /** Key survives a device reboot. */
  persistent: boolean;
}

/** Per-key policy attached at store time. */
export interface StoragePolicy {
  biometricRequired?: boolean;
  noCloudBackup?: boolean;
  deviceBound?: boolean;
}

export class StorageError extends Error {
  constructor(public readonly kind: StorageErrorKind, message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export type StorageErrorKind = "not-found" | "rejected" | "unavailable";

/**
 * Produces a {@link SignerSignature} over a 32-byte hash. Implementations
 * are stateless wrt the hash — per-call state lives in
 * {@link SignContext}.
 */
export interface Signer {
  /** Self-describes the signer kind so callers can pick a {@link Validator}. */
  describe(): SignerKind;
  /** Signs `hash`. */
  sign(hash: Uint8Array, context: SignContext): Promise<SignerSignature>;
}

/**
 * Builds the `validatorData` blob that an ERC-7579 validator module
 * expects in `UserOperation.signature`. Off-chain mirror of the
 * on-chain validator the wallet has installed.
 */
export interface Validator {
  /** Address of the on-chain ERC-7579 module. */
  moduleAddress(): Address;
  /** Module type — Validator/Executor/Fallback/Hook. */
  moduleType(): Erc7579ModuleType;
  /** Assembles the `validatorData` blob for `userOp`. */
  buildValidatorData(userOp: PackedUserOperation): Promise<Uint8Array>;
}

/** Where secret material actually lives. */
export interface KeyStorage {
  store(keyId: KeyId, blob: Uint8Array, policy: StoragePolicy): Promise<void>;
  load(keyId: KeyId): Promise<Uint8Array>;
  capabilities(): StorageCapabilities;
}

/** Recovery proposal carried by the social-recovery flow. */
export interface RecoveryProposal {
  account: Address;
  /** 33- or 65-byte public key for the new owner. */
  newOwner: Uint8Array;
  /** Opaque proposal ID — implementations choose the format. */
  proposalId: Uint8Array;
}

/** Per-guardian signature on a {@link RecoveryProposal}. */
export interface GuardianSignature {
  guardianAddress: Address;
  signature: Uint8Array;
}

/** Hex-encoded transaction hash returned after `executeRecovery`. */
export interface TxHash {
  value: string;
}

export class RecoveryError extends Error {
  constructor(public readonly kind: RecoveryErrorKind, message: string) {
    super(message);
    this.name = "RecoveryError";
  }
}

export type RecoveryErrorKind =
  | "threshold"
  | "invalid-signature"
  | "not-found"
  | "transport";

/** Social-recovery surface for the `SocialRecoveryValidator` module. */
export interface RecoveryGuardian {
  proposeRecovery(
    account: Address,
    newOwner: Uint8Array
  ): Promise<RecoveryProposal>;
  approveRecovery(proposal: RecoveryProposal): Promise<GuardianSignature>;
  executeRecovery(
    proposal: RecoveryProposal,
    sigs: GuardianSignature[]
  ): Promise<TxHash>;
}
