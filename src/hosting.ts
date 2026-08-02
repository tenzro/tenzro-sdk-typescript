import type { RpcClient } from './rpc';

/**
 * A single static-site route: a request path mapped to a content-addressed blob.
 */
export interface SiteRoute {
  /** Request path, e.g. `/index.html` or `/assets/app.js`. */
  path: string;
  /** BLAKE3 blob hash of the asset (from `iroh.publishBlob`). */
  blob_hash: string;
  /** MIME type served in the `Content-Type` header. */
  content_type: string;
  /** Byte length of the asset. */
  size?: number;
}

/** Optional fields for {@link HostingClient.publishSite}. */
export interface PublishSiteOptions {
  /** Override the default index path (`/index.html`). */
  index_path?: string;
  /** Route served for unmatched paths (custom 404 page). */
  not_found_path?: string;
  /** Serve the index for unmatched non-asset paths (single-page-app routing). */
  spa?: boolean;
  /** x402 price per request in base TNZO units (stringified integer). */
  price_per_request?: string;
  /** Number of serving replicas to place. */
  replicas?: number;
  /** Preferred region for placement. */
  region_hint?: string;
  /** Maximum price per hour a serving node may charge (stringified integer). */
  max_price_per_hour?: string;
}

/** Optional fields for {@link HostingClient.deployFunction}. */
export interface DeployFunctionOptions {
  /** Capability manifest (host imports the component is granted). */
  capabilities?: unknown;
  /** wasmtime fuel limit per request. */
  fuel_limit?: number;
  /** Wall-clock deadline per request, in milliseconds. */
  deadline_ms?: number;
  /** x402 price per request in base TNZO units (stringified integer). */
  price_per_request?: string;
  replicas?: number;
  region_hint?: string;
  max_price_per_hour?: string;
}

/** Optional fields for {@link HostingClient.deployMachine}. */
export interface DeployMachineOptions {
  /** Resource request (`vcpus`, `mem_mib`, `disk_mib`). */
  resources?: unknown;
  /** Sealed environment variables, each ciphertext wrapped to the node's sealing key. */
  sealed_env?: unknown;
  /** Require a TEE-capable serving node. */
  tee_required?: boolean;
  /** x402 price per request in base TNZO units (stringified integer). */
  price_per_request?: string;
  replicas?: number;
  region_hint?: string;
  max_price_per_hour?: string;
}

/**
 * App-hosting client for the site / function / machine / lease JSON-RPC
 * surface on a `tenzro-node`.
 *
 * Deploy a static site, a `wasi:http` function, or a Firecracker microVM and
 * serve it under a public hostname (`myapp.apps.tenzro.xyz`) routed from the
 * operator's ingress edge to any serving node over the `tenzro/http` ALPN.
 *
 * Content is uploaded as content-addressed blobs first (via
 * {@link IrohClient.publishBlob}); the deploy call references each blob by
 * hash. Mutations (publish / remove / set-alias / claim-domain …) are
 * DID-owner authenticated — attach the signed envelope with
 * {@link HostingClient.withDidEnvelope}.
 *
 * @example
 * ```ts
 * const client = new TenzroClient({ endpoint: 'https://rpc.tenzro.xyz' });
 * const iroh = client.iroh();
 * const hosting = client.hosting().withDidEnvelope('<signed-envelope>');
 *
 * const index = await iroh.publishBlob(new TextEncoder().encode('<!doctype html>...'));
 * const site = await hosting.publishSite('my-app', 'did:tenzro:human:...', [
 *   { path: '/index.html', blob_hash: index.blake3_hex, content_type: 'text/html', size: index.size_bytes },
 * ], { spa: true });
 *
 * await hosting.setAlias('my-app.apps.tenzro.xyz', site.site_id, 'did:tenzro:human:...');
 * ```
 */
export class HostingClient {
  constructor(
    private readonly rpc: RpcClient,
    private readonly didEnvelope?: string
  ) {}

  /**
   * Return a new client that forwards the signed DID envelope on every
   * mutating call so the node can verify the caller controls the owner DID.
   */
  withDidEnvelope(envelope: string): HostingClient {
    return new HostingClient(this.rpc, envelope);
  }

  private withEnv(params: Record<string, unknown>): Record<string, unknown> {
    if (this.didEnvelope !== undefined) {
      return { ...params, did_envelope: this.didEnvelope };
    }
    return params;
  }

  // ---- Static sites -----------------------------------------------------

  /** Publish a static site from a route map. */
  async publishSite(
    name: string,
    ownerDid: string,
    routes: SiteRoute[],
    options: PublishSiteOptions = {}
  ): Promise<any> {
    return this.rpc.call('tenzro_sitePublish', [
      this.withEnv({ name, owner_did: ownerDid, routes, ...options }),
    ]);
  }

  /** Fetch a site manifest by `site_id`. */
  async getSite(siteId: string): Promise<any> {
    return this.rpc.call('tenzro_siteGet', [{ site_id: siteId }]);
  }

  /** List sites, optionally filtered by owner DID. */
  async listSites(ownerDid?: string): Promise<any> {
    return this.rpc.call('tenzro_listSites', [ownerDid ? { owner_did: ownerDid } : {}]);
  }

  /** Remove a site. Owner-authenticated. */
  async removeSite(siteId: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteRemove', [
      this.withEnv({ site_id: siteId, owner_did: ownerDid }),
    ]);
  }

  // ---- Hostname aliases -------------------------------------------------

  /** Point a public hostname at a site so it serves by name. Owner-authenticated. */
  async setAlias(hostname: string, siteId: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteSetAlias', [
      this.withEnv({ hostname, site_id: siteId, owner_did: ownerDid }),
    ]);
  }

  /** Resolve a hostname to its alias record. */
  async getAlias(hostname: string): Promise<any> {
    return this.rpc.call('tenzro_siteGetAlias', [{ hostname }]);
  }

  /** List hostname aliases, optionally filtered by owner DID. */
  async listAliases(ownerDid?: string): Promise<any> {
    return this.rpc.call('tenzro_listSiteAliases', [ownerDid ? { owner_did: ownerDid } : {}]);
  }

  /** Remove a hostname alias. Owner-authenticated. */
  async removeAlias(hostname: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteRemoveAlias', [
      this.withEnv({ hostname, owner_did: ownerDid }),
    ]);
  }

  // ---- Ingress placement ------------------------------------------------

  /**
   * Set the serving nodes (iroh `EndpointId` strings) that answer
   * `tenzro/http` forwards for a site. An empty list serves locally.
   * Owner-authenticated (owner resolved from the manifest).
   */
  async setPlacement(siteId: string, servingNodes: string[]): Promise<any> {
    return this.rpc.call('tenzro_siteSetPlacement', [
      this.withEnv({ site_id: siteId, serving_nodes: servingNodes }),
    ]);
  }

  /** Get the ingress placement record for a site. */
  async getPlacement(siteId: string): Promise<any> {
    return this.rpc.call('tenzro_siteGetPlacement', [{ site_id: siteId }]);
  }

  /** List all ingress placement records. */
  async listPlacements(): Promise<any> {
    return this.rpc.call('tenzro_listSitePlacements', [{}]);
  }

  /** Remove a site's ingress placement (reverts to local serving). Owner-authenticated. */
  async removePlacement(siteId: string): Promise<any> {
    return this.rpc.call('tenzro_siteRemovePlacement', [this.withEnv({ site_id: siteId })]);
  }

  // ---- Custom domains ---------------------------------------------------

  /**
   * Claim a custom domain for a site. Returns the DNS records the owner must
   * publish (`dns_records` + `ownership_txt_name`). Owner-authenticated.
   */
  async claimDomain(hostname: string, siteId: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteClaimDomain', [
      this.withEnv({ hostname, site_id: siteId, owner_did: ownerDid }),
    ]);
  }

  /** Verify a claimed domain against its published DNS TXT proof. Owner-authenticated. */
  async verifyDomain(hostname: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteVerifyDomain', [
      this.withEnv({ hostname, owner_did: ownerDid }),
    ]);
  }

  /** Get a custom-domain record (status + DNS records). */
  async getDomain(hostname: string): Promise<any> {
    return this.rpc.call('tenzro_siteGetDomain', [{ hostname }]);
  }

  /** List custom domains, optionally filtered by owner DID. */
  async listDomains(ownerDid?: string): Promise<any> {
    return this.rpc.call('tenzro_listSiteDomains', [ownerDid ? { owner_did: ownerDid } : {}]);
  }

  /** Remove a custom domain. Owner-authenticated. */
  async removeDomain(hostname: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_siteRemoveDomain', [
      this.withEnv({ hostname, owner_did: ownerDid }),
    ]);
  }

  // ---- Functions (wasi:http components) ---------------------------------

  /** Deploy a `wasi:http` function from a component blob hash. */
  async deployFunction(
    name: string,
    ownerDid: string,
    wasmBlobHash: string,
    options: DeployFunctionOptions = {}
  ): Promise<any> {
    return this.rpc.call('tenzro_functionDeploy', [
      this.withEnv({ name, owner_did: ownerDid, wasm_blob_hash: wasmBlobHash, ...options }),
    ]);
  }

  /** Fetch a function deployment by id. */
  async getFunction(id: string): Promise<any> {
    return this.rpc.call('tenzro_functionGet', [{ id }]);
  }

  /** List function deployments, optionally filtered by owner DID. */
  async listFunctions(ownerDid?: string): Promise<any> {
    return this.rpc.call('tenzro_listFunctions', [ownerDid ? { owner_did: ownerDid } : {}]);
  }

  /** Remove a function deployment. Owner-authenticated. */
  async removeFunction(id: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_functionRemove', [
      this.withEnv({ id, owner_did: ownerDid }),
    ]);
  }

  // ---- Machines (Firecracker microVMs) ----------------------------------

  /**
   * Deploy a microVM from an image artifact CAID and the loopback port the
   * guest server listens on.
   */
  async deployMachine(
    name: string,
    ownerDid: string,
    artifactCaid: string,
    internalPort: number,
    options: DeployMachineOptions = {}
  ): Promise<any> {
    return this.rpc.call('tenzro_machineDeploy', [
      this.withEnv({
        name,
        owner_did: ownerDid,
        artifact_caid: artifactCaid,
        internal_port: internalPort,
        ...options,
      }),
    ]);
  }

  /** Fetch a machine deployment by id. */
  async getMachine(id: string): Promise<any> {
    return this.rpc.call('tenzro_machineGet', [{ id }]);
  }

  /** List machine deployments, optionally filtered by owner DID. */
  async listMachines(ownerDid?: string): Promise<any> {
    return this.rpc.call('tenzro_listMachines', [ownerDid ? { owner_did: ownerDid } : {}]);
  }

  /** Remove a machine deployment (stops any running microVM first). Owner-authenticated. */
  async removeMachine(id: string, ownerDid: string): Promise<any> {
    return this.rpc.call('tenzro_machineRemove', [
      this.withEnv({ id, owner_did: ownerDid }),
    ]);
  }

  /** Live run-state of a machine deployment. */
  async machineStatus(id: string): Promise<any> {
    return this.rpc.call('tenzro_machineStatus', [{ id }]);
  }

  /**
   * This node's X25519 machine-sealing public key. Wrap each environment
   * secret to this key before {@link deployMachine} so plaintext never leaves
   * the deployer.
   */
  async machineSealingKey(): Promise<any> {
    return this.rpc.call('tenzro_machineSealingKey', [{}]);
  }

  // ---- Placement leases -------------------------------------------------

  /** All placement leases across every hosted app on this node's scheduler. */
  async listLeases(): Promise<any> {
    return this.rpc.call('tenzro_listLeases', [{}]);
  }

  /** Placement leases for a single app (site / function / machine) id. */
  async leasesForApp(appId: string): Promise<any> {
    return this.rpc.call('tenzro_getLeasesForApp', [{ app_id: appId }]);
  }
}
