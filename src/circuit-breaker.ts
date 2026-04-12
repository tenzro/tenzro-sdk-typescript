import type { RpcClient } from './rpc';
import type {
  ProviderHealth,
  CircuitBreakerStatus,
  CircuitBreakerConfig,
  ConfigResult,
  ResetResult,
} from './types';

/**
 * Client for circuit breaker configuration and provider health monitoring.
 * Manages automatic failure detection and recovery for inference providers.
 */
export class CircuitBreakerClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Get health information for a specific provider.
   * @param providerId - The provider identifier
   * @returns Provider health status including success rate and circuit state
   */
  async getProviderHealth(providerId: string): Promise<ProviderHealth> {
    return this.rpc.call<ProviderHealth>('tenzro_getProviderHealth', [
      { provider_id: providerId },
    ]);
  }

  /**
   * List all circuit breakers and their current status.
   * @returns Array of circuit breaker statuses
   */
  async listCircuitBreakers(): Promise<CircuitBreakerStatus[]> {
    return this.rpc.call<CircuitBreakerStatus[]>('tenzro_listCircuitBreakers');
  }

  /**
   * Configure the circuit breaker for a specific provider.
   * @param providerId - The provider identifier
   * @param config - Circuit breaker configuration
   * @returns Configuration result
   */
  async configureBreaker(
    providerId: string,
    config: CircuitBreakerConfig
  ): Promise<ConfigResult> {
    return this.rpc.call<ConfigResult>('tenzro_configureCircuitBreaker', [
      { provider_id: providerId, ...config },
    ]);
  }

  /**
   * Reset a circuit breaker to closed state.
   * @param providerId - The provider identifier to reset
   * @returns Reset result with new circuit state
   */
  async resetBreaker(providerId: string): Promise<ResetResult> {
    return this.rpc.call<ResetResult>('tenzro_resetCircuitBreaker', [
      { provider_id: providerId },
    ]);
  }
}
