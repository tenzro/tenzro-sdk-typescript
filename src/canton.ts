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
 * Interacts with the Canton participant the Tenzro node is configured
 * against. The node mediates all calls — callers never handle the
 * upstream credentials.
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

  /**
   * Allocate a new party on the participant via `POST /v2/parties`.
   *
   * Returns the fully-qualified party id
   * `<partyIdHint>::<participant-hash>`. The newly-allocated party
   * has no `CanActAs` / `CanReadAs` grants on any user by default —
   * follow up with `grantUserRights()` so the operator's OAuth user
   * can submit DAML commands on behalf of the new party.
   */
  async allocateParty(
    partyIdHint: string,
    displayName?: string,
  ): Promise<{ party_id: string; party_id_hint: string }> {
    const params: Record<string, unknown> = { party_id_hint: partyIdHint };
    if (displayName !== undefined) params.display_name = displayName;
    return this.rpc.call('tenzro_allocateParty', params);
  }

  /**
   * Grant `CanActAs` / `CanReadAs` rights on a party to a user
   * (Canton 3.5+ User Management Service / CIP-26 via
   * `POST /v2/users/{userId}/rights`).
   *
   * Without these grants, the operator's OAuth user cannot submit
   * DAML commands on behalf of a newly-allocated party even if the
   * party exists — Canton returns "security-sensitive error" on
   * active-contracts / submit calls.
   *
   * Pass `userId = undefined` to grant to the calling principal's own
   * Canton user. `canActAs` defaults to `true`; `canReadAs` defaults
   * to `false`.
   */
  async grantUserRights(args: {
    userId?: string;
    party: string;
    canActAs?: boolean;
    canReadAs?: boolean;
  }): Promise<unknown> {
    return this.rpc.call('tenzro_canton_grantUserRights', {
      user_id: args.userId,
      party: args.party,
      can_act_as: args.canActAs ?? true,
      can_read_as: args.canReadAs ?? false,
    });
  }

  /**
   * List the rights granted to a Canton user (CIP-26
   * `GET /v2/users/{userId}/rights`). Returns
   * `{ rights: [{ kind: { CanActAs: { value: { party } } } }, ...] }`.
   *
   * Pass `userId = undefined` to list rights for the OAuth principal's
   * own user.
   */
  async listUserRights(userId?: string): Promise<unknown> {
    return this.rpc.call('tenzro_canton_listUserRights', { user_id: userId });
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
   * Returns the Canton user record for the calling principal via
   * CIP-26 User Management. Returns
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

  /**
   * Subject self-read: returns Canton call aggregates for the API
   * key presented by this RPC client. Counters are maintained
   * server-side in RocksDB (`CF_CANTON_ANALYTICS`) — every
   * canton-scoped JSON-RPC call increments `calls_total` (or
   * `errors_total`) plus the corresponding per-method bucket. Lets
   * a tenant answer "how many DAML transactions have I submitted,
   * and which methods am I hitting?" without operator help.
   */
  async getMyAnalytics(): Promise<{
    key_id: string;
    canton_user_id: string | null;
    calls_total: number;
    errors_total: number;
    calls_by_method: Record<string, number>;
    errors_by_method: Record<string, number>;
    first_seen_at: number | null;
    last_called_at: number | null;
  }> {
    return this.rpc.call('tenzro_canton_getMyAnalytics', {});
  }

  /**
   * Operator admin-read: returns every per-tenant aggregate. Gated
   * behind the operator admin token (`X-Tenzro-Admin-Token`) at the
   * node — non-admin callers see `-32001`. Optional `keyId` filter
   * narrows to a single tenant. Rows are sorted by
   * `last_called_at` descending.
   */
  async listApiKeyAnalytics(keyId?: string): Promise<{
    analytics: Array<{
      key_id: string;
      canton_user_id: string | null;
      calls_total: number;
      errors_total: number;
      calls_by_method: Record<string, number>;
      errors_by_method: Record<string, number>;
      first_seen_at: number | null;
      last_called_at: number | null;
    }>;
  }> {
    const params: Record<string, unknown> = {};
    if (keyId !== undefined) params.key_id = keyId;
    return this.rpc.call('tenzro_canton_listApiKeyAnalytics', params);
  }
}
