import type { RpcClient } from './rpc';
import type {
  CantonDomainList,
  DamlCommandParams,
  DamlCommandResult,
  DamlContractsResponse,
  ListDamlContractsParams,
} from './types';

/**
 * Client for Canton / DAML enterprise ledger operations.
 *
 * Interacts with the shared Canton participant the Tenzro node is configured
 * against. The node proxies all calls using its own bearer JWT — callers never
 * see the Auth0 secret.
 *
 * Uses Canton 3.x JSON Ledger API v2 endpoints:
 * - Commands:        `POST /v2/commands/submit-and-wait-for-transaction`
 * - Active contracts:`POST /v2/state/active-contracts` (with `identifierFilter`)
 * - Events:          `POST /v2/events/events-by-contract-id`
 */
export class CantonClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * List the Canton synchronizer domains this node is configured against.
   *
   * The envelope is returned even when Canton is not enabled — check
   * `enabled` on the response before treating `domains` as live.
   */
  async listDomains(): Promise<CantonDomainList> {
    return this.rpc.call<CantonDomainList>('tenzro_listCantonDomains', {});
  }

  /**
   * Query active DAML contracts. Requires at least one template id.
   */
  async listContracts(
    params: ListDamlContractsParams,
  ): Promise<DamlContractsResponse> {
    return this.rpc.call<DamlContractsResponse>(
      'tenzro_listDamlContracts',
      params as unknown as Record<string, unknown>,
    );
  }

  /**
   * Submit a DAML `create` or `exercise` command to the Canton participant.
   */
  async submitCommand(params: DamlCommandParams): Promise<DamlCommandResult> {
    return this.rpc.call<DamlCommandResult>(
      'tenzro_submitDamlCommand',
      params as unknown as Record<string, unknown>,
    );
  }
}
