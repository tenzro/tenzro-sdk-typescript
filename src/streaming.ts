import type { RpcClient } from './rpc';

// ── Types ──

/** Result from a streaming inference call. */
export interface StreamResult {
  /** Total number of tokens generated */
  total_tokens: number;
  /** Complete generated output */
  output: string;
}

/** Handle to an active event subscription. */
export interface SubscriptionHandle {
  /** Subscription identifier */
  id: string;
}

/** SSE connection handle. */
export interface SseConnection {
  /** SSE endpoint URL */
  url: string;
  /** Abort controller for closing the connection */
  abort: AbortController;
}

/** A real-time event from the node. */
export interface StreamEvent {
  /** Event type (e.g., "block", "transaction", "settlement") */
  type: string;
  /** Event data */
  data: unknown;
  /** Event timestamp */
  timestamp?: string;
}

// ── Client ──

/**
 * Client for streaming and real-time operations.
 *
 * Provides streaming chat inference via SSE, event subscriptions,
 * and SSE connections to A2A/MCP servers.
 */
export class StreamingClient {
  private readonly endpoint: string;
  private readonly apiEndpoint: string;

  constructor(private readonly rpc: RpcClient) {
    this.endpoint = rpc.getEndpoint();
    const ep = this.endpoint;
    if (ep.includes('rpc.tenzro.xyz')) {
      this.apiEndpoint = ep.replace('rpc.tenzro.xyz', 'api.tenzro.xyz');
    } else if (ep.includes('localhost:8545') || ep.includes('127.0.0.1:8545')) {
      this.apiEndpoint = ep.replace('8545', '8080');
    } else {
      this.apiEndpoint = ep;
    }
  }

  /**
   * Stream inference tokens using an async generator.
   *
   * @param modelId - Model identifier (e.g., "gemma4-9b")
   * @param message - User message to send
   * @yields Individual tokens as they are generated
   *
   * @example
   * ```typescript
   * const streaming = client.streaming();
   * for await (const token of streaming.chatStream("gemma4-9b", "Hello!")) {
   *   process.stdout.write(token);
   * }
   * ```
   */
  async *chatStream(modelId: string, message: string): AsyncGenerator<string> {
    const url = `${this.apiEndpoint.replace(/\/$/, '')}/api/chat`;
    const body = {
      model: modelId,
      messages: [{ role: 'user', content: message }],
      stream: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Streaming request failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null — streaming not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (typeof content === 'string' && content.length > 0) {
              yield content;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stream inference tokens with a callback.
   *
   * @param modelId - Model identifier
   * @param message - User message
   * @param onToken - Callback invoked for each token
   * @returns Stream result with total tokens and complete output
   */
  async chatStreamCallback(
    modelId: string,
    message: string,
    onToken: (token: string) => void,
  ): Promise<StreamResult> {
    let totalTokens = 0;
    let output = '';

    for await (const token of this.chatStream(modelId, message)) {
      totalTokens++;
      output += token;
      onToken(token);
    }

    return { total_tokens: totalTokens, output };
  }

  /**
   * Subscribe to real-time events from the node.
   *
   * @param eventTypes - Event types to subscribe to (e.g., "block", "transaction")
   * @param onEvent - Callback invoked for each event
   * @returns Subscription handle
   */
  async subscribeEvents(
    eventTypes: string[],
    onEvent: (event: StreamEvent) => void,
  ): Promise<SubscriptionHandle> {
    const subscriptionId = await this.rpc.call<string>('tenzro_subscribe', [
      { event_types: eventTypes },
    ]);

    // Poll for events in the background
    const poll = async () => {
      try {
        while (true) {
          const events = await this.rpc.call<StreamEvent[]>('tenzro_pollEvents', [
            { subscription_id: subscriptionId },
          ]);
          for (const event of events) {
            onEvent(event);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch {
        // Subscription ended
      }
    };
    poll(); // Fire and forget

    return { id: subscriptionId };
  }

  /**
   * Open an SSE connection to an A2A or MCP endpoint.
   *
   * @param endpoint - Full URL of the SSE endpoint
   * @param onMessage - Callback for incoming SSE messages
   * @returns SSE connection handle with abort controller
   */
  async openSseConnection(
    endpoint: string,
    onMessage?: (event: StreamEvent) => void,
  ): Promise<SseConnection> {
    const abort = new AbortController();

    if (onMessage) {
      // Start reading SSE in the background
      fetch(endpoint, {
        headers: { Accept: 'text/event-stream' },
        signal: abort.signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              for (const line of text.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const parsed = JSON.parse(line.slice(6));
                  onMessage(parsed);
                } catch {
                  // Skip non-JSON
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        })
        .catch(() => {
          // Connection closed
        });
    }

    return { url: endpoint, abort };
  }
}
