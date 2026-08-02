import type { RpcClient } from './rpc';
import type {
  StakingRole,
  StakeResult,
  UnstakeResult,
  StakingBalance,
  StakingRewards,
  UnbondingEntry,
} from './types';

/**
 * Client for TNZO token staking operations.
 * Stake as a validator, model provider, or TEE provider.
 */
export class StakingClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Stake TNZO tokens for a given provider type.
   * @param amount - Amount in wei (10^-18 TNZO) as decimal string, e.g. "1000000000000000000000" for 1000 TNZO
   * @param providerType - Provider type: "validator", "model_provider", "tee_provider", or "storage_provider"
   * @returns Stake result with transaction hash and status
   */
  async stake(amount: string, providerType: StakingRole): Promise<StakeResult> {
    return this.rpc.call<StakeResult>('tenzro_stake', [
      { amount, provider_type: providerType },
    ]);
  }

  /**
   * Unstake TNZO tokens (initiates the unbonding period).
   * @param amount - Amount in wei (10^-18 TNZO) as decimal string
   * @returns Unstake result with transaction hash, status, and unbonding end time
   */
  async unstake(amount: string): Promise<UnstakeResult> {
    return this.rpc.call<UnstakeResult>('tenzro_unstake', [{ amount }]);
  }

  /**
   * Get the staking balance for an address.
   * @param address - The address to query
   * @returns Staking balance with staked and available amounts
   */
  async getStakingBalance(address: string): Promise<StakingBalance> {
    return this.rpc.call<StakingBalance>('tenzro_getStakingBalance', [
      { address },
    ]);
  }

  /**
   * Get pending and claimed staking rewards for an address.
   * @param address - The address to query
   * @returns Rewards information
   */
  async getRewards(address: string): Promise<StakingRewards> {
    return this.rpc.call<StakingRewards>('tenzro_getStakingRewards', [
      { address },
    ]);
  }

  /**
   * Get unbonding entries for an address.
   * @param address - The address to query
   * @returns Array of unbonding entries with completion times
   */
  async getUnbonding(address: string): Promise<UnbondingEntry[]> {
    return this.rpc.call<UnbondingEntry[]>('tenzro_getUnbonding', [
      { address },
    ]);
  }
}
