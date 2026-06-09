import type { RpcClient } from './rpc';

export interface UrwaKillSwitchState {
  token_id_hex: string;
  active: boolean;
  selectors: Record<string, string>;
  precompile_addresses: Record<string, string>;
}

export interface UrwaFrozenAmount {
  token_id_hex: string;
  account_hex: string;
  frozen_amount: string;
}

export interface UrwaSetFrozenRequest {
  token_id_hex: string;
  account_hex: string;
  amount: string;
  reason?: string;
}

export interface UrwaFrozenRecord {
  token_id_hex: string;
  account_hex: string;
  amount: string;
  reason: string | null;
  set_at_ms: number;
}

export interface UrwaTriggerKillSwitchRequest {
  token_id_hex: string;
  triggered_by_did?: string;
  reason?: string;
}

export interface UrwaKillSwitchTriggered {
  token_id_hex: string;
  active: boolean;
  triggered_by_did: string | null;
  reason: string | null;
  triggered_at_ms: number;
}

export interface UrwaKillSwitchCleared {
  token_id_hex: string;
  active: boolean;
}

/**
 * ERC-7943 (uRWA) client. Read paths
 * (`tenzro_urwaIsKillSwitched`, `tenzro_urwaGetFrozenTokens`) are
 * public; mutation paths
 * (`tenzro_urwaSetFrozenTokens`, `tenzro_urwaTriggerKillSwitch`,
 * `tenzro_urwaClearKillSwitch`) require the operator admin token to be
 * configured on the underlying RpcClient.
 */
export class UrwaClient {
  constructor(private readonly rpc: RpcClient) {}

  async isKillSwitched(tokenIdHex: string): Promise<UrwaKillSwitchState> {
    return this.rpc.call<UrwaKillSwitchState>('tenzro_urwaIsKillSwitched', [
      { token_id_hex: tokenIdHex },
    ]);
  }

  async getFrozenTokens(tokenIdHex: string, accountHex: string): Promise<UrwaFrozenAmount> {
    return this.rpc.call<UrwaFrozenAmount>('tenzro_urwaGetFrozenTokens', [
      { token_id_hex: tokenIdHex, account_hex: accountHex },
    ]);
  }

  async setFrozenTokens(req: UrwaSetFrozenRequest): Promise<UrwaFrozenRecord> {
    return this.rpc.call<UrwaFrozenRecord>('tenzro_urwaSetFrozenTokens', [req]);
  }

  async triggerKillSwitch(req: UrwaTriggerKillSwitchRequest): Promise<UrwaKillSwitchTriggered> {
    return this.rpc.call<UrwaKillSwitchTriggered>('tenzro_urwaTriggerKillSwitch', [req]);
  }

  async clearKillSwitch(tokenIdHex: string): Promise<UrwaKillSwitchCleared> {
    return this.rpc.call<UrwaKillSwitchCleared>('tenzro_urwaClearKillSwitch', [
      { token_id_hex: tokenIdHex },
    ]);
  }
}
