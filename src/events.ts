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
  event_types: string[];
  /** Address filter (empty array = no address restriction) */
  addresses: string[];
  /** Whether the webhook is currently active. Defaults to true on freshly-registered hooks. */
  active: boolean;
  /** Cumulative deliveries attempted by the node */
  total_deliveries: number;
  /** Cumulative deliveries that returned a non-2xx response or timed out */
  failed_deliveries: number;
  /** Operation status (set on register/delete; empty on list) */
  status: string;
}

/** Result of `tenzro_listWebhooks`. */
export interface WebhookList {
  webhooks: WebhookRegistration[];
  total: number;
}

/** Result of `tenzro_deleteWebhook`. */
export interface WebhookDeletion {
  webhook_id: string;
  status: string;
}

/** Result of unsubscribing from events. */
export interface UnsubscribeResult {
  /** Subscription identifier that was removed */
  subscription_id: string;
  /** Whether the unsubscription succeeded */
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
   *
   * The node enforces: webhook URL must be `https://`; if a secret is provided
   * it must be at least 16 characters.
   * @param url - Callback URL (must be HTTPS in production)
   * @param ownerDid - DID that owns the row; only it can list or delete it
   * @param didEnvelope - Hex envelope proving control of `ownerDid`, bound to
   *   method `tenzro_registerWebhook` with the `url` bytes as the params hash
   * @param eventTypes - Optional event type filter; omit to receive all events
   * @param secret - Optional HMAC-SHA256 secret for webhook signature verification
   * @returns Webhook registration details
   */
  async registerWebhook(
    url: string,
    ownerDid: string,
    didEnvelope: string,
    eventTypes?: string[],
    secret?: string
  ): Promise<WebhookRegistration> {
    return this.registerWebhookWithAddresses(
      url,
      ownerDid,
      didEnvelope,
      eventTypes,
      undefined,
      secret
    );
  }

  /**
   * Register a webhook with an optional `addresses` filter. When `addresses`
   * is non-empty, the node only delivers events whose `addresses` array
   * intersects this list. Use this for per-tenant / per-user webhook
   * subscriptions.
   *
   * @param url - Callback URL (must be `https://`)
   * @param ownerDid - DID that owns the row; only it can list or delete it
   * @param didEnvelope - Hex envelope proving control of `ownerDid`, bound to
   *   method `tenzro_registerWebhook` with the `url` bytes as the params hash.
   *   The URL and not the id, because the id is minted by the node and does
   *   not exist when the caller signs.
   * @param eventTypes - Optional event type filter; omit to receive all events
   * @param addresses - Optional address filter; omit for no restriction
   * @param secret - Optional HMAC-SHA256 secret (≥16 characters when provided)
   */
  async registerWebhookWithAddresses(
    url: string,
    ownerDid: string,
    didEnvelope: string,
    eventTypes?: string[],
    addresses?: string[],
    secret?: string
  ): Promise<WebhookRegistration> {
    const params: Record<string, unknown> = {
      url,
      owner_did: ownerDid,
      did_envelope: didEnvelope,
    };
    if (eventTypes !== undefined) params.event_types = eventTypes;
    if (addresses !== undefined) params.addresses = addresses;
    if (secret !== undefined) params.secret = secret;
    return this.rpc.call<WebhookRegistration>('tenzro_registerWebhook', [params]);
  }

  /**
   * List the webhooks registered under one owner DID. Returns each webhook's
   * id, url, active flag, event_types/addresses filters, and delivery
   * counters. Secret hashes are NOT returned — secrets are write-only.
   *
   * Scoped to one owner rather than the whole node: a row carries its
   * delivery URL and the addresses its owner watches.
   * @param ownerDid - DID whose webhooks to list
   * @param didEnvelope - Hex envelope proving control of `ownerDid`, bound to
   *   method `tenzro_listWebhooks` with the DID string as the params hash
   */
  async listWebhooks(
    ownerDid: string,
    didEnvelope: string
  ): Promise<WebhookList> {
    return this.rpc.call<WebhookList>('tenzro_listWebhooks', [
      { owner_did: ownerDid, did_envelope: didEnvelope },
    ]);
  }

  /**
   * Delete a webhook by id. Returns JSON-RPC error `-32602` if the id is
   * unknown.
   * @param webhookId - Webhook identifier to delete
   * @param didEnvelope - Hex envelope proving control of the `owner_did`
   *   recorded at registration, bound to method `tenzro_deleteWebhook` with
   *   the `webhookId` bytes as the params hash. A webhook id comes back from
   *   every list call, so it identifies the row and authorizes nothing.
   */
  async deleteWebhook(
    webhookId: string,
    didEnvelope: string
  ): Promise<WebhookDeletion> {
    return this.rpc.call<WebhookDeletion>('tenzro_deleteWebhook', [
      { webhook_id: webhookId, did_envelope: didEnvelope },
    ]);
  }
}
