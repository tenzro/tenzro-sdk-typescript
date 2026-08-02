import type { RpcClient } from "./rpc";

/**
 * Key class — controls who can revoke the key.
 *
 * - `subject`: default. Subject can self-revoke via `revokeMine`; admin
 *   can revoke via `revoke`.
 * - `operator_internal`: operator-only ops key. Admin can revoke; subject
 *   path does not apply.
 * - `operator_protected`: operator-only locked-down key. Not revokable
 *   via RPC by anyone (including admin). Rotate by updating the operator
 *   secret + restarting the node.
 */
export type KeyClass = "subject" | "operator_internal" | "operator_protected";

/** Parameters for {@link ApiKeyClient.create}. */
export interface CreateApiKeyParams {
  /** Free-form label shown in `list`. */
  label: string;
  /**
   * Optional subject identifier — typically a Tenzro DID. Required if
   * the operator wants the holder to self-revoke later.
   */
  subject?: string;
  /** Scopes to grant. Defaults to `["canton"]` server-side when empty. */
  scopes?: string[];
  /** Revocability class. Defaults to `subject` when omitted. */
  class?: KeyClass;
  /**
   * Canton networks this key may reach — `"devnet"` and/or `"mainnet"`.
   * Fail-closed: left empty, the key reaches no Canton network and every
   * canton-scoped call through it is refused. A network is a distinct
   * ledger with distinct parties and assets, so there is no "all
   * networks" default. The node refuses a network it does not serve.
   */
  canton_networks?: string[];
  /**
   * Service tier — `"free"`, `"standard"`, or `"priority"`. Governs the
   * per-minute request budget and whether the key may call write
   * methods. Defaults to `free` (read-only) server-side.
   */
  tier?: "free" | "standard" | "priority";
  /**
   * Optional Canton User Management Service user id (e.g.
   * `tenzro-labs@clients`). When set with the `canton` scope, the node
   * automatically:
   * 1. Allocates a tenant party on the Canton participant.
   * 2. Creates the Canton user with that party as primaryParty.
   * 3. Grants the user `CanActAs` on its primary party.
   *
   * After issuance the key auto-forwards `actAs` /
   * `requestingParties` as the user's primary party on every
   * canton-scoped call. The response carries `canton_primary_party`
   * + `canton_provisioning` summarizing the auto-provision step.
   * Pass {@link autoProvisionCanton}=false to skip provisioning.
   */
  canton_user_id?: string;
  /** Skip the Canton user/party auto-provision. Defaults to true. */
  auto_provision_canton?: boolean;
}

/**
 * Response from {@link ApiKeyClient.create}. The `key` field is the
 * plaintext `tnz_...` token and is shown exactly once — persist it
 * immediately.
 */
export interface CreatedApiKey {
  key: string;
  key_id: string;
  label: string;
  subject?: string | null;
  scopes: string[];
  class?: string | null;
  created_at: number;
  /** Service tier granted — `free`, `standard`, or `priority`. */
  tier?: string | null;
  /**
   * Canton networks this key may reach. Empty means no Canton access;
   * canton-scoped calls through the key are refused.
   */
  canton_networks?: string[];
  /** Bound Canton User Management Service user id, if any. */
  canton_user_id?: string | null;
  /** FQ party id (`<hint>::<participant-hash>`) auto-provisioned for this user. */
  canton_primary_party?: string | null;
  /**
   * Stage 2.b: Canton IdentityProviderConfig id auto-registered for
   * this tenant when `canton.identity_providers.enabled` is on and a
   * tenant-IdP provisioner is wired. The party + user live under this
   * IDP so Canton's AuthService routes tenant JWTs to the tenant's
   * IDP, not the operator default.
   */
  canton_identity_provider_id?: string | null;
  /** Summary of the Canton provision step (allocate + create + grant). */
  canton_provisioning?: CantonProvisioningSummary | null;
  /**
   * Stage 2.b: non-secret metadata about the per-tenant OAuth2 client
   * minted upstream. The credentials stay on the node, which mints
   * and forwards the tenant's Canton JWT internally on every
   * canton-scoped call — the `tnz_...` API key is the tenant's only
   * credential.
   */
  tenant_oauth_client?: TenantOAuthClient | null;
  note?: string | null;
}

/** Non-secret per-tenant OAuth2 client metadata (Stage 2.b). */
export interface TenantOAuthClient {
  client_id: string;
  issuer_url: string;
  audience: string;
}

/** Summary of the auto-provision step on Canton when `canton_user_id` is set. */
export interface CantonProvisioningSummary {
  /** `provisioned` if just created; `already_exists` for idempotent reissue. */
  status: "provisioned" | "already_exists";
  user_id: string;
  primary_party?: string | null;
  party_hint?: string;
  rights_granted?: string[];
}

/** One row of the keyring as returned by `list` / `listMine`. */
export interface ApiKeyRecord {
  key_id: string;
  subject?: string | null;
  label: string;
  scopes: string[];
  class?: string | null;
  /** Service tier granted — `free`, `standard`, or `priority`. */
  tier?: string | null;
  /** Rate ceiling granted by `tier`. */
  requests_per_minute?: number;
  /** Whether `tier` permits write methods. */
  allows_write?: boolean;
  /** Canton networks this key may reach. Empty means no Canton access. */
  canton_networks?: string[];
  /**
   * Canton User Management Service user bound to this key. `null` means
   * the key reaches the node but cannot act as a Canton party — node
   * access without ledger access.
   */
  canton_user_id?: string | null;
  /**
   * Canton identity provider the bound user resolves in. `null` means the
   * participant's default provider.
   */
  canton_identity_provider_id?: string | null;
  /** Parties this key may submit on behalf of, beyond the bound user's primary party. */
  can_act_as_parties?: string[];
  /** Parties this key may read as. */
  can_read_as_parties?: string[];
  /** Template ids this key may touch. Empty means unrestricted. */
  allowed_templates?: string[];
  /** Command names this key may issue. Empty means unrestricted. */
  allowed_commands?: string[];
  created_at: number;
  revoked_at?: number | null;
  active: boolean;
}

/** Response from {@link ApiKeyClient.list}. */
export interface ApiKeyList {
  keys: ApiKeyRecord[];
}

/** Response from {@link ApiKeyClient.listMine}. */
export interface MyApiKeyList {
  keys: ApiKeyRecord[];
  subject: string;
}

/** Response from {@link ApiKeyClient.revoke} / {@link ApiKeyClient.revokeMine}. */
export interface RevokeApiKeyResult {
  key_id: string;
  revoked: boolean;
}

/**
 * API-key management client.
 *
 * Two control planes:
 *
 * 1. **Operator** (`X-Tenzro-Admin-Token`): {@link create} / {@link list}
 *    / {@link revoke} any key on the operator's own node. Sourced from
 *    the `TENZRO_ADMIN_TOKEN` env var by the underlying `RpcClient`.
 * 2. **Subject** (`X-Tenzro-Api-Key`): {@link listMine} / {@link revokeMine}
 *    keys belonging to the caller's own subject. Sourced from `TENZRO_API_KEY`.
 *
 * Every Tenzro node operator holds their own admin token for *their
 * own* node. There is no global "Tenzro Labs token," and admin
 * capabilities do not extend to network-wide state (validator set,
 * treasury, fee schedule, system contracts — those flow through
 * on-chain governance via `tenzro-token`). See `docs/api-keys.md`.
 */
export class ApiKeyClient {
  constructor(private readonly rpc: RpcClient) {}

  // ── Operator surface (admin-token-gated) ─────────────────────────

  /**
   * Mint a new API key on this node. Requires `TENZRO_ADMIN_TOKEN` in
   * the environment.
   *
   * `class` controls revocability:
   * - `subject` (default): subject can self-revoke, admin can revoke.
   * - `operator_internal`: admin-only revoke.
   * - `operator_protected`: not revokable via RPC — rotate by updating
   *   the operator secret and restarting the node. The SDK injects the
   *   `confirm_operator_protected` interlock automatically.
   *
   * For Canton access, name the networks the key may reach in
   * {@link CreateApiKeyParams.canton_networks} and pick a
   * {@link CreateApiKeyParams.tier}. Both are fail-closed: no networks
   * means no Canton access, and the default `free` tier is read-only.
   */
  async create(params: CreateApiKeyParams): Promise<CreatedApiKey> {
    const body: Record<string, unknown> = {
      label: params.label,
      scopes: params.scopes ?? [],
      class: params.class ?? "subject",
    };
    if (params.subject !== undefined) {
      body.subject = params.subject;
    }
    if ((params.class ?? "subject") === "operator_protected") {
      body.confirm_operator_protected = true;
    }
    if (params.canton_networks !== undefined && params.canton_networks.length > 0) {
      body.canton_networks = params.canton_networks;
    }
    if (params.tier !== undefined) {
      body.tier = params.tier;
    }
    if (params.canton_user_id !== undefined) {
      body.canton_user_id = params.canton_user_id;
    }
    if (params.auto_provision_canton !== undefined) {
      body.auto_provision_canton = params.auto_provision_canton;
    }
    return this.rpc.call<CreatedApiKey>("tenzro_createApiKey", body);
  }

  /**
   * List every API key the node has issued — active and revoked.
   * Admin-token-gated.
   */
  async list(): Promise<ApiKeyList> {
    return this.rpc.call<ApiKeyList>("tenzro_listApiKeys", {});
  }

  /**
   * Revoke an API key by its non-secret `key_id`. Admin-token-gated.
   *
   * Fails with `-32004` if the target is an `operator_protected` key
   * (those cannot be revoked via RPC, by anyone, including an admin).
   * Rotate that class by updating the operator secret + restart.
   */
  async revoke(keyId: string): Promise<RevokeApiKeyResult> {
    return this.rpc.call<RevokeApiKeyResult>("tenzro_revokeApiKey", {
      key_id: keyId,
    });
  }

  // ── Subject surface (X-Tenzro-Api-Key authenticated) ─────────────

  /**
   * List every API key belonging to the caller's own subject.
   * Requires `TENZRO_API_KEY` in the environment.
   *
   * This is the entitlement self-read: each {@link ApiKeyRecord} carries
   * the scopes, tier ceiling, Canton networks, and Canton party binding
   * the node enforces. A row with a non-empty `canton_networks` but a
   * null `canton_user_id` has node access without ledger access — it
   * authenticates, but is bound to no Canton party, so command
   * submission is refused.
   */
  async listMine(): Promise<MyApiKeyList> {
    return this.rpc.call<MyApiKeyList>("tenzro_listMyApiKeys", {});
  }

  /**
   * Revoke an API key belonging to the caller's own subject.
   * Requires `TENZRO_API_KEY` in the environment.
   *
   * Only `subject`-class keys are eligible. The error for "no such key"
   * and "not your key" is intentionally the same so ownership cannot be
   * probed.
   */
  async revokeMine(keyId: string): Promise<RevokeApiKeyResult> {
    return this.rpc.call<RevokeApiKeyResult>("tenzro_revokeMyApiKey", {
      key_id: keyId,
    });
  }
}
