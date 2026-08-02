import type { RpcClient } from './rpc';

// ── Types ──

/** A zero-knowledge proof. */
export interface ZkProof {
  /** Hex-encoded proof data */
  proof: string;
  /** Public inputs used in the proof */
  public_inputs: string[];
  /** Proof system type ("groth16", "plonk", etc.) */
  proof_type: string;
}

/** ZK proof verification result. */
export interface ZkVerifyResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Verification details or error message */
  message?: string;
}

/** Proving key for a ZK circuit. */
export interface ProvingKey {
  /** Key identifier */
  key_id: string;
  /** Circuit type this key is for */
  circuit_type: string;
}

/** Information about a ZK circuit. */
export interface CircuitInfo {
  /** Circuit name */
  name: string;
  /** Circuit type ("inference", "settlement", "identity") */
  circuit_type: string;
  /** Number of constraints */
  constraints: number;
}

// ── Client ──

/**
 * Client for zero-knowledge proof operations.
 *
 * Supports Groth16 SNARKs on BN254, PlonK, and hybrid ZK-in-TEE proofs.
 */
export class ZkClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a zero-knowledge proof.
   * @param circuitType - Circuit type: "inference", "settlement", or "identity"
   * @param privateInputs - Private witness values
   * @param publicInputs - Public input values (hex-encoded field elements)
   */
  async createProof(
    circuitType: string,
    privateInputs: Record<string, unknown>,
    publicInputs: string[],
  ): Promise<ZkProof> {
    return this.rpc.call<ZkProof>('tenzro_createZkProof', [
      {
        circuit_type: circuitType,
        private_inputs: privateInputs,
        public_inputs: publicInputs,
      },
    ]);
  }

  /**
   * Verify a zero-knowledge proof.
   * @param proof - Hex-encoded proof data
   * @param proofType - Proof system: "groth16", "plonk", "halo2", or "stark"
   * @param publicInputs - Public input values
   */
  async verifyProof(
    proof: string,
    proofType: string,
    publicInputs: string[],
  ): Promise<ZkVerifyResult> {
    return this.rpc.call<ZkVerifyResult>('tenzro_verifyZkProof', [
      { proof, proof_type: proofType, public_inputs: publicInputs },
    ]);
  }

  /**
   * Generate a proving key for a circuit.
   * @param circuitType - Circuit type: "inference", "settlement", or "identity"
   */
  async generateProvingKey(circuitType: string): Promise<ProvingKey> {
    return this.rpc.call<ProvingKey>('tenzro_generateProvingKey', [
      { circuit_type: circuitType },
    ]);
  }

  /**
   * List available ZK circuits.
   */
  async listCircuits(): Promise<CircuitInfo[]> {
    return this.rpc.call<CircuitInfo[]>('tenzro_listCircuits');
  }
}
