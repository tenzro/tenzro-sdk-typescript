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
 * Uses Canton 3.5+ JSON Ledger API v2 endpoints:
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

  // ── Canton 3.5+ JSON Ledger API extension methods ──

  /**
   * Upload a DAR (DAML Archive) to the participant via
   * `POST /v2/packages`. `darBase64` is the base64-encoded DAR file
   * bytes.
   *
   * Returns Canton's structured response — typically the list of
   * package ids that got installed.
   */
  async uploadDar(darBase64: string): Promise<unknown> {
    return this.rpc.call('tenzro_canton_uploadDar', {
      dar_content_base64: darBase64,
    });
  }

  /**
   * List every party known to the participant. Note: on the Tenzro
   * DevNet the `daml_ledger_api` scope may not grant read access to
   * the party registry; expect `{partyDetails: []}` in that case.
   */
  async listParties(): Promise<unknown> {
    return this.rpc.call('tenzro_canton_listParties', {});
  }

  /**
   * Combined health probe — calls `/livez` + `/readyz` + `/v2/version`
   * on the JSON Ledger API root. Returns `{alive, ready, ready_detail,
   * version}` where `version` carries Canton CIP feature flags.
   */
  async health(): Promise<{
    alive: boolean;
    ready: boolean;
    ready_detail: string;
    version: unknown;
  }> {
    return this.rpc.call('tenzro_canton_health', {});
  }

  /**
   * Returns participant version + CIP feature flags via
   * `GET /v2/version`.
   */
  async version(): Promise<unknown> {
    return this.rpc.call('tenzro_canton_version', {});
  }

  /**
   * Fetch a Canton transaction tree by update id. The update id must
   * be a hex string (Canton 3.5+ rejects bare labels).
   */
  async getTransaction(updateId: string): Promise<unknown> {
    return this.rpc.call('tenzro_canton_getTransaction', {
      update_id: updateId,
    });
  }

  /**
   * List every DAML package installed on the participant via
   * `GET /v2/packages`. Returns `{packageIds: [<hex>...]}`. Useful
   * for capability discovery before contract creation.
   */
  async listPackages(): Promise<{ packageIds: string[] }> {
    return this.rpc.call('tenzro_canton_listPackages', {});
  }

  /**
   * Returns the Canton Coin (CIP-56) balance for the participant's
   * party. Sums every `Splice.Amulet:Amulet` contract the party is a
   * stakeholder on. Returns
   * `{party, amulet_count, total_initial_amount, token_standard:"CIP-56"}`.
   */
  async cantonCoinBalance(): Promise<unknown> {
    return this.rpc.call('tenzro_canton_coinBalance', {});
  }

  /**
   * Returns the latest `Splice.AmuletRules:AmuletRules` contract,
   * which carries the participant's Canton fee schedule. Returns
   * `{rules_count, latest}` or `{schedule: null, note}` if no rules
   * are visible to the party.
   */
  async feeSchedule(): Promise<unknown> {
    return this.rpc.call('tenzro_canton_feeSchedule', {});
  }

  /**
   * Returns the synchronizers the participant's party is currently
   * connected to via `GET /v2/state/connected-synchronizers`. Each
   * entry includes `synchronizerAlias`, `synchronizerId`, and
   * `permission` (SUBMISSION / CONFIRMATION / OBSERVATION).
   *
   * `reconnect()`-style synchronizer subscription management is a
   * Canton Admin Console gRPC operation that the JSON Ledger API does
   * not expose. Poll this method after an operator-triggered
   * reconnect to confirm subscriptions are back.
   */
  async connectedSynchronizers(): Promise<{
    connectedSynchronizers: Array<{
      synchronizerAlias: string;
      synchronizerId: string;
      permission: string;
    }>;
  }> {
    return this.rpc.call('tenzro_canton_connectedSynchronizers', {});
  }

  /**
   * Returns the OAuth principal's Canton user record via
   * `GET /v2/users/<client_id>@clients` (CIP-26). The Tenzro node
   * derives the user id from the configured OAuth client id; Canton
   * 3.5.1 has no `/users/me` alias (returns 404 USER_NOT_FOUND), so
   * the node constructs the explicit id. Returns
   * `{user: {id, primaryParty, isDeactivated, metadata, identityProviderId}}`.
   * The `primaryParty` value is the participant's fully-qualified
   * party id.
   */
  async getMyUser(): Promise<{
    user: {
      id: string;
      primaryParty: string;
      isDeactivated: boolean;
      metadata: Record<string, unknown>;
      identityProviderId: string;
    };
  }> {
    return this.rpc.call('tenzro_canton_getMyUser', {});
  }
}
