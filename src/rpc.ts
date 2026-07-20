export interface RpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
  id: number;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: RpcError;
  id: number;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Pluggable transport for JSON-RPC calls.
 *
 * The default transport `fetch`es the configured endpoint with the
 * usual `Content-Type: application/json` body. Browser-extension dApps
 * can supply an EIP-1193 provider instead — `provider.request({method,
 * params})` then handles auth (DPoP, session), routing, and user
 * confirmation, and the SDK never touches a private key or token.
 */
export interface RpcTransport {
  call<T>(method: string, params: unknown[] | Record<string, unknown>): Promise<T>;
}

/**
 * Adapter that turns an EIP-1193 provider into an `RpcTransport`. Used
 * by `TenzroClient.fromInjected()` and any direct consumer that wants
 * to route SDK calls through `window.tenzro` rather than a network
 * endpoint.
 */
export class Eip1193Transport implements RpcTransport {
  constructor(
    private readonly provider: {
      request<T = unknown>(args: {
        method: string;
        params?: readonly unknown[] | Record<string, unknown>;
      }): Promise<T>;
    },
  ) {}

  async call<T>(method: string, params: unknown[] | Record<string, unknown> = []): Promise<T> {
    return this.provider.request<T>({ method, params });
  }
}

export class RpcClient {
  private endpoint: string;
  private apiEndpoint: string;
  private timeout: number;
  private requestId: number = 0;
  private readonly transport: RpcTransport | undefined;

  constructor(
    endpoint: string,
    apiEndpoint?: string,
    timeout: number = 30000,
    transport?: RpcTransport,
  ) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.transport = transport;

    // Derive API endpoint from RPC endpoint if not provided
    if (apiEndpoint) {
      this.apiEndpoint = apiEndpoint;
    } else if (endpoint.includes("rpc.tenzro.xyz")) {
      this.apiEndpoint = endpoint.replace("rpc.tenzro.xyz", "api.tenzro.xyz");
    } else if (endpoint.includes("localhost:8545") || endpoint.includes("127.0.0.1:8545")) {
      this.apiEndpoint = endpoint.replace("8545", "8080");
    } else {
      // Default: assume API endpoint is the same as RPC endpoint
      this.apiEndpoint = endpoint;
    }
  }

  async call<T>(method: string, params: unknown[] | Record<string, unknown> = []): Promise<T> {
    // Injected-provider path: the extension owns auth + routing.
    if (this.transport) {
      return this.transport.call<T>(method, params);
    }

    // Use modular arithmetic to prevent overflow beyond Number.MAX_SAFE_INTEGER
    this.requestId = (this.requestId + 1) % Number.MAX_SAFE_INTEGER;
    const id = this.requestId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Ambient auth: forward `Authorization: DPoP <jwt>` and `DPoP: <proof>`
    // headers from environment variables when set (Node only). This mirrors
    // the Rust SDK's RpcClient and keeps SDK callsites free of private-key
    // handling — the holder mints the JWT once during onboarding via
    // AuthClient, then exports the token + per-call DPoP proof through
    // TENZRO_BEARER_JWT / TENZRO_DPOP_PROOF.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const proc = (globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const env = proc && proc.env ? proc.env : undefined;
    if (env) {
      const bearer = env.TENZRO_BEARER_JWT;
      if (bearer && bearer.length > 0) {
        headers["Authorization"] = `DPoP ${bearer}`;
      }
      const dpop = env.TENZRO_DPOP_PROOF;
      if (dpop && dpop.length > 0) {
        headers["DPoP"] = dpop;
      }
      // API key for scope-gated namespaces (currently `tenzro_*Canton*`).
      // The operator (RPC node) mediates upstream calls on the caller's
      // behalf. Callers present a `tnz_<base64url>` key with the
      // required scope.
      const apiKey = env.TENZRO_API_KEY;
      if (apiKey && apiKey.length > 0) {
        headers["X-Tenzro-Api-Key"] = apiKey;
      }
      // Operator admin token for node-scoped mutation RPCs (API-key
      // issuance / revocation / listing, staking, provider registration).
      // Each node operator holds their own token on their own node — see
      // `docs/api-keys.md` for the per-operator sovereignty model.
      const adminToken = env.TENZRO_ADMIN_TOKEN;
      if (adminToken && adminToken.length > 0) {
        headers["X-Tenzro-Admin-Token"] = adminToken;
      }
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as RpcResponse<T>;

      if (json.error) {
        throw new RpcCallError(json.error.code, json.error.message, json.error.data);
      }

      return json.result as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`RPC request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiEndpoint}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiEndpoint}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST to the Web API where the node replies `204 No Content` (empty
   * body). Used by the `/wallet/new/{confirm,cancel}` routes — parsing
   * `response.json()` on an empty body would throw, so this variant only
   * checks the status.
   */
  async postNoContent(path: string, body: unknown): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiEndpoint}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Authenticated POST to the Web API. The `/wallet/*` endpoints
   * require a fresh DPoP proof per request that signs over the exact
   * `(method, htu)` pair — only the wallet kernel can produce that
   * proof, so the SDK accepts both the bearer JWT and the proof as
   * explicit arguments instead of reading them from ambient env.
   */
  async postWithAuth<T>(
    path: string,
    body: unknown,
    bearerJwt: string,
    dpopProof: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiEndpoint}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `DPoP ${bearerJwt}`,
          DPoP: dpopProof,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Authenticated GET counterpart to {@link postWithAuth}. */
  async getWithAuth<T>(
    path: string,
    bearerJwt: string,
    dpopProof: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiEndpoint}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `DPoP ${bearerJwt}`,
          DPoP: dpopProof,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getApiEndpoint(): string {
    return this.apiEndpoint;
  }
}

export class RpcCallError extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(`RPC Error ${code}: ${message}`);
    this.name = "RpcCallError";
  }
}
