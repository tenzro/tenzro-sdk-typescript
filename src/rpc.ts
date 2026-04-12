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

export class RpcClient {
  private endpoint: string;
  private apiEndpoint: string;
  private timeout: number;
  private requestId: number = 0;

  constructor(endpoint: string, apiEndpoint?: string, timeout: number = 30000) {
    this.endpoint = endpoint;
    this.timeout = timeout;

    // Derive API endpoint from RPC endpoint if not provided
    if (apiEndpoint) {
      this.apiEndpoint = apiEndpoint;
    } else if (endpoint.includes("rpc.tenzro.network")) {
      this.apiEndpoint = endpoint.replace("rpc.tenzro.network", "api.tenzro.network");
    } else if (endpoint.includes("localhost:8545") || endpoint.includes("127.0.0.1:8545")) {
      this.apiEndpoint = endpoint.replace("8545", "8080");
    } else {
      // Default: assume API endpoint is the same as RPC endpoint
      this.apiEndpoint = endpoint;
    }
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    // Use modular arithmetic to prevent overflow beyond Number.MAX_SAFE_INTEGER
    this.requestId = (this.requestId + 1) % Number.MAX_SAFE_INTEGER;
    const id = this.requestId;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
