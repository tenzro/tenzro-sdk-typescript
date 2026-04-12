import type { RpcClient } from './rpc';

// ── Types ──

/** A blockchain event emitted by the Tenzro Ledger. */
export interface BlockchainEvent {
  /** Event type (e.g. "Transfer", "Mint", "Stake", "Slash", "ProposalCreated") */
  event_type: string;
  /** Block number where the event was emitted */
  block_number: number;
  /** Transaction hash that produced the event */
  tx_hash?: string;
  /** Event-specific data payload */
  data: Record<string, unknown>;
  /** ISO-8601 timestamp */
  timestamp?: string;
}

/** Parameters for querying events. */
export interface GetEventsParams {
  /** Start block number (inclusive) */
  from_block?: number;
  /** End block number (inclusive) */
  to_block?: number;
  /** Filter by event type */
  event_type?: string;
  /** Filter by emitting contract address */
  address?: string;
  /** Maximum number of events to return */
  limit?: number;
}

/** An active event subscription. */
export interface Subscription {
  /** Unique subscription identifier */
  subscription_id: string;
  /** WebSocket URL for receiving events (if available) */
  ws_url?: string;
  /** gRPC URL for receiving events (if available) */
  grpc_url?: string;
  /** Event types included in this subscription */
  event_types: string[];
  /** Subscription status */
  status: string;
}

/** A registered webhook for event notifications. */
export interface WebhookRegistration {
  /** Unique webhook identifier */
  webhook_id: string;
  /** Callback URL where events will be POSTed */
  url: string;
  /** Event types the webhook is subscribed to */
  event_types?: string[];
  /** Whether HMAC verification is enabled */
  hmac_enabled: boolean;
  /** Webhook status */
  status: string;
}

/** Result of unsubscribing from events. */
export interface UnsubscribeResult {
  /** Subscription identifier that was removed */
  subscription_id: string;
  /** Whether the unsubscription succeeded */
  success: boolean;
}

/** Result of removing a webhook registration. */
export interface WebhookRemoveResult {
  /** Webhook identifier that was removed */
  webhook_id: string;
  /** Whether the removal succeeded */
  success: boolean;
}

// ── Client ──

/**
 * Client for blockchain event queries, subscriptions, and webhooks.
 * Supports querying historical events, subscribing to real-time events
 * via WebSocket/gRPC, and registering webhooks for push notifications.
 */
export class EventsClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Query historical blockchain events with optional filters.
   * @param params - Optional filter parameters (block range, event type, address)
   * @returns Array of matching events
   */
  async getEvents(params?: GetEventsParams): Promise<BlockchainEvent[]> {
    return this.rpc.call<BlockchainEvent[]>('tenzro_getEvents', [params ?? {}]);
  }

  /**
   * Subscribe to real-time blockchain events.
   * Returns connection details for receiving events via WebSocket or gRPC.
   * @param eventTypes - Array of event types to subscribe to (e.g. ["Transfer", "Stake"])
   * @returns Subscription details with connection URLs
   */
  async subscribeEvents(eventTypes: string[]): Promise<Subscription> {
    return this.rpc.call<Subscription>('tenzro_subscribeEvents', [
      { event_types: eventTypes },
    ]);
  }

  /**
   * Unsubscribe from a previously created event subscription.
   * @param subscriptionId - Subscription identifier to remove
   * @returns Unsubscription result
   */
  async unsubscribeEvents(subscriptionId: string): Promise<UnsubscribeResult> {
    return this.rpc.call<UnsubscribeResult>('tenzro_unsubscribeEvents', [
      { subscription_id: subscriptionId },
    ]);
  }

  /**
   * Register a webhook to receive event notifications via HTTP POST.
   * Events matching the specified types will be POSTed to the callback URL.
   * An optional HMAC secret enables signature verification on the receiver side.
   * @param url - Callback URL (must be HTTPS in production)
   * @param eventTypes - Optional event type filter; omit to receive all events
   * @param secret - Optional HMAC-SHA256 secret for webhook signature verification
   * @returns Webhook registration details
   */
  async registerWebhook(
    url: string,
    eventTypes?: string[],
    secret?: string
  ): Promise<WebhookRegistration> {
    return this.rpc.call<WebhookRegistration>('tenzro_registerWebhook', [
      { url, event_types: eventTypes, secret },
    ]);
  }

  /**
   * Remove a previously registered webhook.
   * @param webhookId - Webhook identifier to remove
   * @returns Removal result
   */
  async removeWebhook(webhookId: string): Promise<WebhookRemoveResult> {
    return this.rpc.call<WebhookRemoveResult>('tenzro_removeWebhook', [
      { webhook_id: webhookId },
    ]);
  }
}
