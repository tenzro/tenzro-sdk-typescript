import type { RpcClient } from './rpc';

export interface RegisterFinalityProviderRequest {
  validator: string;
  btc_pk: string;
  commission_bps: number;
}

export interface FinalityProvider {
  validator: string;
  btc_pk: string;
  commission_bps: number;
  active: boolean;
}

export interface BabylonTotalStake {
  validator: string;
  total_satoshis: number;
  delegation_count: number;
}

export interface SubmitFinalitySignatureRequest {
  validator: string;
  block_hash: string;
  eots_signature: string;
}

export interface BtcDelegation {
  delegator_btc_pk: string;
  validator: string;
  satoshis: number;
  start_height: number;
  end_height?: number | null;
}

/**
 * Babylon Bitcoin staking client. Register a Tenzro validator as a
 * Babylon finality provider so it is economically secured by native
 * BTC; submit EOTS (Extractable One-Time Signatures) over Tenzro block
 * hashes to avoid slashing.
 */
export class BabylonClient {
  constructor(private readonly rpc: RpcClient) {}

  async registerFinalityProvider(
    req: RegisterFinalityProviderRequest
  ): Promise<FinalityProvider> {
    return this.rpc.call<FinalityProvider>(
      'tenzro_babylonRegisterFinalityProvider',
      [req]
    );
  }

  async getFinalityProvider(
    validator: string
  ): Promise<FinalityProvider | null> {
    return this.rpc.call<FinalityProvider | null>(
      'tenzro_babylonGetFinalityProvider',
      [{ validator }]
    );
  }

  async listFinalityProviders(): Promise<FinalityProvider[]> {
    return this.rpc.call<FinalityProvider[]>(
      'tenzro_babylonListFinalityProviders',
      []
    );
  }

  async totalStakeForProvider(validator: string): Promise<BabylonTotalStake> {
    return this.rpc.call<BabylonTotalStake>(
      'tenzro_babylonTotalStakeForProvider',
      [{ validator }]
    );
  }

  async submitFinalitySignature(
    req: SubmitFinalitySignatureRequest
  ): Promise<unknown> {
    return this.rpc.call('tenzro_babylonSubmitFinalitySignature', [req]);
  }

  async listDelegations(validator: string): Promise<BtcDelegation[]> {
    return this.rpc.call<BtcDelegation[]>('tenzro_babylonListDelegations', [
      { validator },
    ]);
  }
}
