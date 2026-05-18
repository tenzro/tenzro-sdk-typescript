import type { RpcClient } from './rpc';

// ── Parameter types ──

/** Parameters for deploying a contract. */
export interface DeployContractParams {
  /** Hex-encoded bytecode to deploy */
  bytecode: string;
  /** Target VM: "evm", "svm", or "daml" */
  vm_type: string;
  /** Deployer address */
  from: string;
  /** Optional constructor arguments (ABI-encoded hex for EVM) */
  constructor_args?: string;
  /** Optional gas limit */
  gas_limit?: number;
}

// ── Return types ──

/** Result of a read-only contract call. */
export interface CallResult {
  /** Hex-encoded return data */
  data: string;
}

/** Result of a contract deployment. */
export interface DeployResult {
  /** Transaction hash */
  tx_hash: string;
  /** Deployed contract address */
  contract_address: string;
  /** VM the contract was deployed to */
  vm_type: string;
  /** Gas used */
  gas_used?: number;
  /** Deployment status */
  status: string;
}

// ── Client ──

/**
 * Client for smart contract deployment via the MultiVmRuntime.
 * Supports deploying bytecode to EVM, SVM, or DAML VMs.
 */
export class ContractClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Deploy a contract to the specified VM.
   * @param params - Deployment parameters including bytecode and target VM
   * @returns Deployment result with contract address and transaction hash
   */
  async deploy(params: DeployContractParams): Promise<DeployResult> {
    return this.rpc.call<DeployResult>('tenzro_deployContract', [params]);
  }

  /**
   * Perform a read-only contract call (eth_call).
   * @param to - Contract address (hex)
   * @param data - ABI-encoded call data (hex)
   * @param block - Block number or "latest" (default: "latest")
   */
  async callContract(to: string, data: string, block?: string): Promise<CallResult> {
    const result = await this.rpc.call<string>('eth_call', [
      { to, data },
      block ?? 'latest',
    ]);
    return { data: result };
  }

  /**
   * ABI-encode a function call.
   * @param functionSig - Function signature (e.g., "transfer(address,uint256)")
   * @param args - Function arguments
   * @returns Hex-encoded call data
   */
  async encodeFunction(functionSig: string, args: unknown[]): Promise<string> {
    return this.rpc.call<string>('tenzro_encodeFunction', [
      { function_sig: functionSig, args },
    ]);
  }

  /**
   * Decode ABI-encoded return data.
   * @param data - Hex-encoded return data
   * @param outputTypes - Expected output types (e.g., ["uint256", "address"])
   * @returns Decoded values
   */
  async decodeResult(data: string, outputTypes: string[]): Promise<unknown[]> {
    return this.rpc.call<unknown[]>('tenzro_decodeResult', [
      { data, output_types: outputTypes },
    ]);
  }
}
