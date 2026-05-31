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
  note?: string | null;
}

/** One row of the keyring as returned by `list` / `listMine`. */
export interface ApiKeyRecord {
  key_id: string;
  subject?: string | null;
  label: string;
  scopes: string[];
  class?: string | null;
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
