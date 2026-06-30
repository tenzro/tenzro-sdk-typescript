import type { RpcClient } from './rpc';

/** Off-chain custodial reserve, attested by a DID. */
export interface CustodialReserve {
  kind: 'custodial';
  /** Attester DID whose attestation gates the reserve. */
  attester_did: string;
  /** Backing asset, CAIP-19 (e.g. `iso4217:USD`). */
  asset_caip19: string;
}

/** On-chain vault holding the backing asset. */
export interface OnChainVaultReserve {
  kind: 'on_chain_vault';
  /** Vault address, 32-byte hex (`0x`-prefixed). */
  vault: string;
  /** Backing asset, CAIP-19 (e.g. `iso4217:USD`). */
  asset_caip19: string;
}

export type StableReserveSource = CustodialReserve | OnChainVaultReserve;

/** Parameters for registering an issuer's stable-asset policy. */
export interface RegisterStableAsset {
  /** Issuer address, 32-byte hex (`0x`-prefixed). */
  issuer: string;
  /** Unit token address, 20-byte hex (`0x`-prefixed). */
  unit_token: string;
  /** Human label for the unit (e.g. `USDX`). */
  symbol: string;
  /** Reserve backing source. */
  reserve_source: StableReserveSource;
  /** Proof-of-reserve feed id. */
  por_feed_id: string;
  /** Allowed settlement rails: x402 ap2 mpp visa_tap mastercard tempo native. */
  allowed_rails: string[];
  /** Settlement destination address, 32-byte hex (`0x`-prefixed). */
  settlement_dst: string;
}

/**
 * Stable-asset issuance client — issuer-agnostic stable-unit policies layered
 * on the Secure-Mint reserve floor. Mints are hard-gated so `circulating +
 * amount ≤ reserve` always holds. Registration requires the `issuer` API-key
 * scope.
 */
export class StableAssetClient {
  constructor(private readonly rpc: RpcClient) {}

  /** Register or replace an issuer's stable-asset policy. */
  async register(params: RegisterStableAsset): Promise<unknown> {
    return this.rpc.call('tenzro_registerStableAsset', [params]);
  }

  /** Read an issuer's stable-asset policy. */
  async get(issuer: string, unitToken: string): Promise<unknown> {
    return this.rpc.call('tenzro_getStableAsset', [
      { issuer, unit_token: unitToken },
    ]);
  }

  /** Mint units, gated by the Secure-Mint reserve floor. */
  async mint(
    issuer: string,
    unitToken: string,
    amount: string
  ): Promise<unknown> {
    return this.rpc.call('tenzro_mintStableAsset', [
      { issuer, unit_token: unitToken, amount },
    ]);
  }

  /** Redeem (burn) units, decrementing circulating supply. */
  async redeem(
    issuer: string,
    unitToken: string,
    amount: string
  ): Promise<unknown> {
    return this.rpc.call('tenzro_redeemStableAsset', [
      { issuer, unit_token: unitToken, amount },
    ]);
  }
}
