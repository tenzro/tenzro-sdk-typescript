import type { RpcClient } from './rpc';

export interface AxelarChain {
  chain_id: string;
  family: string;
  gateway?: string;
  gas_service?: string;
}

export interface AxelarCallContractRequest {
  source_chain: string;
  destination_chain: string;
  destination_address: string;
  payload_hex: string;
  gas_token?: string;
  gas_amount?: string;
}

export interface AxelarCallContractResult {
  payload_hash: string;
  source_chain: string;
  destination_chain: string;
}

export interface AxelarPayGasRequest {
  payload_hash: string;
  source_chain: string;
  destination_chain: string;
  destination_address: string;
  gas_token: string;
  gas_amount: string;
}

export interface AxelarPayGasResult {
  paid: boolean;
  gas_token: string;
  gas_amount: string;
}

export interface AxelarMessage {
  payload_hash: string;
  source_chain: string;
  destination_chain: string;
  destination_address: string;
  status: string;
}

/**
 * Axelar GMP client — Cosmos / Move / Stellar / XRPL / Hyperliquid /
 * Filecoin EVM / Kava reach via canonical `call_contract` + Gas
 * Service pre-pay; correlation id is `keccak256(payload)`.
 */
export class AxelarClient {
  constructor(private readonly rpc: RpcClient) {}

  async listChains(): Promise<AxelarChain[]> {
    return this.rpc.call<AxelarChain[]>('tenzro_axelarListChains', []);
  }

  async callContract(
    req: AxelarCallContractRequest
  ): Promise<AxelarCallContractResult> {
    return this.rpc.call<AxelarCallContractResult>(
      'tenzro_axelarCallContract',
      [req]
    );
  }

  async payGas(req: AxelarPayGasRequest): Promise<AxelarPayGasResult> {
    return this.rpc.call<AxelarPayGasResult>('tenzro_axelarPayGas', [req]);
  }

  async getMessage(payloadHash: string): Promise<AxelarMessage | null> {
    return this.rpc.call<AxelarMessage | null>('tenzro_axelarGetMessage', [
      { payload_hash: payloadHash },
    ]);
  }
}
