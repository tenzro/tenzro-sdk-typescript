import type { RpcClient } from './rpc';

export interface WormholeNttChain {
  wormhole_chain_id: number;
  name: string;
}

export interface WormholeNttChains {
  chains: WormholeNttChain[];
  transceiver_kinds: string[];
  scaffolding: boolean;
  note?: string;
}

/**
 * Wormhole NTT (Native Token Transfers) catalog client. Enumerates the
 * registered NttManager chain ids + supported Transceiver kinds so
 * relying parties can compose a quorum across attestation transports
 * (Wormhole / Axelar / LayerZero / custom).
 */
export class WormholeNttClient {
  constructor(private readonly rpc: RpcClient) {}

  async listChains(): Promise<WormholeNttChains> {
    return this.rpc.call<WormholeNttChains>('tenzro_wormholeNttListChains', []);
  }
}
