import type { RpcClient } from './rpc';

// ── Types ──

/** TEE hardware information. */
export interface TeeInfo {
  /** Whether TEE hardware is available */
  available: boolean;
  /** TEE vendor name (e.g., "intel-tdx", "amd-sev-snp", "aws-nitro", "nvidia-gpu") */
  vendor: string;
  /** List of TEE capabilities */
  capabilities: string[];
}

/** TEE attestation report. */
export interface AttestationResult {
  /** Hex-encoded attestation report */
  report: string;
  /** Hex-encoded signature over the report */
  signature: string;
  /** X.509 certificate chain */
  certificate_chain: string[];
}

/** TEE attestation verification result. */
export interface TeeVerifyResult {
  /** Whether the attestation is valid */
  valid: boolean;
  /** Verification details */
  message?: string;
}

/** Data sealed within a TEE enclave. */
export interface SealedData {
  /** Hex-encoded sealed ciphertext */
  ciphertext: string;
  /** Key identifier used for sealing */
  key_id: string;
}

/** Unsealed plaintext data. */
export interface UnsealedData {
  /** Hex-encoded plaintext data */
  data: string;
}

/** TEE provider on the network. */
export interface TeeProvider {
  /** Provider address (hex) */
  address: string;
  /** TEE vendor type */
  vendor: string;
  /** Whether the provider is currently available */
  available: boolean;
}

// ── Client ──

/**
 * Client for Trusted Execution Environment operations.
 *
 * Supports Intel TDX, AMD SEV-SNP, AWS Nitro, and NVIDIA GPU TEE providers.
 */
export class TeeClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Detect available TEE hardware on the node.
   */
  async detectTee(): Promise<TeeInfo> {
    return this.rpc.call<TeeInfo>('tenzro_detectTee');
  }

  /**
   * Generate a TEE attestation report.
   * @param teeType - TEE type: "intel-tdx", "amd-sev-snp", "aws-nitro", "nvidia-gpu"
   */
  async getAttestation(teeType: string): Promise<AttestationResult> {
    return this.rpc.call<AttestationResult>('tenzro_getAttestation', [{ tee_type: teeType }]);
  }

  /**
   * Verify a TEE attestation report with full certificate chain verification.
   * @param attestation - Hex-encoded attestation report
   * @param teeType - TEE type used to generate the attestation
   */
  async verifyAttestation(attestation: string, teeType: string): Promise<TeeVerifyResult> {
    return this.rpc.call<TeeVerifyResult>('tenzro_verifyTeeAttestation', [
      { attestation, tee_type: teeType },
    ]);
  }

  /**
   * Seal data within a TEE enclave (encrypted with hardware-derived key).
   * @param data - Hex-encoded data to seal
   * @param keyId - Key identifier for the sealing key
   */
  async sealData(data: string, keyId: string): Promise<SealedData> {
    return this.rpc.call<SealedData>('tenzro_sealData', [{ data, key_id: keyId }]);
  }

  /**
   * Unseal TEE-protected data.
   * @param sealed - Hex-encoded sealed ciphertext
   * @param keyId - Key identifier used during sealing
   */
  async unsealData(sealed: string, keyId: string): Promise<UnsealedData> {
    return this.rpc.call<UnsealedData>('tenzro_unsealData', [{ sealed, key_id: keyId }]);
  }

  /**
   * List available TEE providers on the network.
   */
  async listTeeProviders(): Promise<TeeProvider[]> {
    return this.rpc.call<TeeProvider[]>('tenzro_listTeeProviders');
  }
}
