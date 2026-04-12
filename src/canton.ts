import type { RpcClient } from './rpc';
import type {
  CantonDomain,
  DamlContract,
  ListDamlContractsParams,
  DamlCommandParams,
  DamlCommandResult,
} from './types';

/**
 * Client for Canton / DAML enterprise ledger operations.
 * Interact with Canton synchronization domains and DAML smart contracts.
 *
 * Uses Canton 3.x JSON Ledger API v2 endpoints:
 * - Commands: `POST /v2/commands/submit-and-wait-for-transaction`
 * - Active contracts: `POST /v2/state/active-contracts` (with `identifierFilter`)
 * - Events: `POST /v2/events/events-by-contract-id`
 */
export class CantonClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * List all Canton synchronization domains connected to this node.
   * @returns Array of domain information
   */
  async listDomains(): Promise<CantonDomain[]> {
    return this.rpc.call<CantonDomain[]>('tenzro_listCantonDomains', []);
  }

  /**
   * List DAML contracts with optional filtering.
   * Queries the Canton 3.x active-contracts endpoint with `identifierFilter`
   * for template-based filtering.
   * @param params - Optional filter by domain, template, party, with pagination
   * @returns Array of DAML contracts
   */
  async listContracts(params?: ListDamlContractsParams): Promise<DamlContract[]> {
    return this.rpc.call<DamlContract[]>('tenzro_listDamlContracts', [params ?? {}]);
  }

  /**
   * Submit a DAML command (create or exercise) to a Canton domain.
   * Uses the Canton 3.x `submit-and-wait-for-transaction` endpoint.
   * @param params - Command parameters including domain, template, payload, and optional choice
   * @returns Command result with status and events
   */
  async submitCommand(params: DamlCommandParams): Promise<DamlCommandResult> {
    return this.rpc.call<DamlCommandResult>('tenzro_submitDamlCommand', [params]);
  }
}
