import { RpcClient } from "./rpc";

/** The engine catalog a node can serve. */
export interface EngineCatalog {
  /** One entry per engine the catalog knows about. */
  engines: Record<string, unknown>[];
  /** Number of engines. */
  count: number;
}

/** Result of {@link DatabaseClient.create}. */
export interface CreatedDatabase {
  /** The normalized database descriptor. */
  database: Record<string, unknown>;
  /** The computed partition placements. */
  partitions: Record<string, unknown>[];
}

/** A managed-database connection credential. */
export interface DatabaseConnection {
  database_id: string;
  /** The engine dialect the database speaks. */
  engine_id: string;
  /** The DID the credential was minted for. */
  bearer_did: string;
  /** `read_only` or `read_write`. */
  mode: string;
  /** The bearer token to present on every query. */
  capability: string;
  /** Credential lifetime in seconds. */
  ttl_secs: number;
  /** The RPC method the developer dials with this credential. */
  query_method: string;
}

/** The outcome of an access check. */
export interface AccessDecision {
  /** Whether the caller may read the database. */
  authorized: boolean;
  /** Human-readable reason for the decision. */
  reason: string;
}

/**
 * Managed-database client.
 *
 * A node can serve one or more database engines the operator wired up —
 * external processes the operator runs (Postgres, Qdrant, Valkey) and embedded
 * engines that run in-process (Lance, Tantivy). The catalog layer records what
 * databases exist and where their partitions land; the engine drivers answer
 * queries against the partitions a node holds.
 *
 * Every database is owned. Reads and writes are gated by the database's access
 * policy: the owner (or a caller holding an AAP capability that names the
 * database) may query it, and administrative operations — create, rescale,
 * drop, issue-connection — require the write action. {@link issueConnection}
 * mints a bearer token a developer plugs into a managed-DB client.
 *
 * The `body` passed to {@link query} is engine-dialect: a SQL `{sql, params}`
 * for Postgres, a `{op, ...}` document for Qdrant / Lance / Tantivy, a
 * `{command: [...]}` for Valkey. The node dispatches it verbatim to the backend
 * for the database's engine.
 */
export class DatabaseClient {
  private rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  /**
   * Lists the engine catalog a node can serve — each engine with its data
   * models, license, sharding model, and native-cluster topology.
   */
  async listEngines(): Promise<EngineCatalog> {
    return this.rpc.call<EngineCatalog>("tenzro_listDatabaseEngines", []);
  }

  /**
   * Registers a database this node serves, computing and persisting its
   * partition placement over the live cluster. `ownerDid` becomes the
   * database's admin authority (an owner-only access policy). `placement` is
   * `local | lan_cluster | network`. `replication` is the min/max
   * holders-per-partition policy — writes below `min` fail, repair never grows
   * past `max`; the node default is `{ min: 2, max: 4 }`.
   *
   * @example
   * ```typescript
   * const created = await client.database.create(
   *   "agent-memory",
   *   "qdrant",
   *   "did:tenzro:human:alice",
   *   "lan_cluster",
   *   3,
   *   { min: 2, max: 4 },
   *   { vector_size: 1536 },
   * );
   * console.log(`${created.partitions.length} partitions`);
   * ```
   */
  async create(
    databaseId: string,
    engineId: string,
    ownerDid: string,
    placement: "local" | "lan_cluster" | "network" = "local",
    partitions = 1,
    replication?: { min: number; max: number },
    engineConfig?: Record<string, unknown>,
  ): Promise<CreatedDatabase> {
    const params: Record<string, unknown> = {
      database_id: databaseId,
      engine_id: engineId,
      owner_did: ownerDid,
      placement,
      partitions,
    };
    if (replication !== undefined) {
      params.replication = {
        min_replication: replication.min,
        max_replication: replication.max,
      };
    }
    if (engineConfig !== undefined) {
      params.engine_config = engineConfig;
    }
    return this.rpc.call<CreatedDatabase>("tenzro_createDatabase", [params]);
  }

  /** Looks up a database descriptor by id. */
  async get(databaseId: string): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_getDatabase", [{ database_id: databaseId }]);
  }

  /** Lists every database this node serves. */
  async list(): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_listDatabases", []);
  }

  /** Lists every partition placement of a database. */
  async listPartitions(databaseId: string): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_listDatabasePartitions", [
      { database_id: databaseId },
    ]);
  }

  /** Returns the placement of one partition. */
  async getPartition(
    databaseId: string,
    partitionIndex: number,
  ): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_getDatabasePartition", [
      { database_id: databaseId, partition_index: partitionIndex },
    ]);
  }

  /**
   * Mints a managed-database connection credential bound to `bearerDid`, scoped
   * to this one database. The owner (`callerDid`) — or a caller holding the
   * write-action capability — issues it. When `write` is true the token also
   * carries the admin action. The returned `capability` + a `bearerDid` are
   * what a developer presents on every {@link query}.
   */
  async issueConnection(
    databaseId: string,
    callerDid: string,
    opts: {
      bearerDid?: string;
      write?: boolean;
      ttlSecs?: number;
      capability?: string;
    } = {},
  ): Promise<DatabaseConnection> {
    const params: Record<string, unknown> = {
      database_id: databaseId,
      caller_did: callerDid,
      write: opts.write ?? false,
    };
    if (opts.bearerDid !== undefined) params.bearer_did = opts.bearerDid;
    if (opts.ttlSecs !== undefined) params.ttl_secs = opts.ttlSecs;
    if (opts.capability !== undefined) params.capability = opts.capability;
    return this.rpc.call<DatabaseConnection>(
      "tenzro_issueDatabaseConnection",
      [params],
    );
  }

  /**
   * Runs an engine-dialect query against a database partition. `callerDid` is
   * authorized against the access policy (writes require the admin action,
   * reads the read action) before any engine is touched. `body` is the engine
   * dialect; `write` gates the query against the admin action; `capability` is
   * an AAP token when the caller is not the owner. `consistency` is the write
   * acknowledgement level — `"quorum"` (default) or `"all"`; ignored on the
   * read path.
   *
   * When this node holds the target partition the result carries
   * `served_here=true` and the engine `result`; otherwise it carries the holder
   * endpoints so the caller can reach a node that does.
   *
   * @example
   * ```typescript
   * const res = await client.database.query(
   *   "ledger",
   *   "did:tenzro:human:alice",
   *   { sql: "select id, name from tz_ledger_0.rows limit $1", params: [10] },
   * );
   * ```
   */
  async query(
    databaseId: string,
    callerDid: string,
    body: Record<string, unknown>,
    opts: {
      partitionIndex?: number;
      write?: boolean;
      capability?: string;
      consistency?: "quorum" | "all";
    } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      database_id: databaseId,
      caller_did: callerDid,
      body,
      partition_index: opts.partitionIndex ?? 0,
      write: opts.write ?? false,
    };
    if (opts.capability !== undefined) params.capability = opts.capability;
    if (opts.consistency !== undefined) params.consistency = opts.consistency;
    return this.rpc.call("tenzro_databaseQuery", [params]);
  }

  /**
   * Checks — without side effects — whether `callerDid` may read the database.
   * Returns `{authorized, reason}`.
   */
  async authorizeRead(
    databaseId: string,
    callerDid: string,
    capability?: string,
  ): Promise<AccessDecision> {
    const params: Record<string, unknown> = {
      database_id: databaseId,
      caller_did: callerDid,
    };
    if (capability !== undefined) params.capability = capability;
    return this.rpc.call<AccessDecision>("tenzro_authorizeDatabaseRead", [
      params,
    ]);
  }

  /**
   * Grows or shrinks a database along the local → LAN-cluster → network
   * continuum in place. Administrative — gated on the write action.
   * `partitions`/`replication` default to the database's current values when
   * omitted; `replication` is the min/max holders-per-partition policy.
   */
  async rescale(
    databaseId: string,
    callerDid: string,
    placement: "local" | "lan_cluster" | "network",
    opts: {
      partitions?: number;
      replication?: { min: number; max: number };
      capability?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      database_id: databaseId,
      caller_did: callerDid,
      placement,
    };
    if (opts.partitions !== undefined) params.partitions = opts.partitions;
    if (opts.replication !== undefined) {
      params.replication = {
        min_replication: opts.replication.min,
        max_replication: opts.replication.max,
      };
    }
    if (opts.capability !== undefined) params.capability = opts.capability;
    return this.rpc.call("tenzro_rescaleDatabase", [params]);
  }

  /**
   * Removes a database and all its partition placements, tearing down the
   * engine backing for every partition this node holds.
   */
  async drop(databaseId: string): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_dropDatabase", [{ database_id: databaseId }]);
  }
}
