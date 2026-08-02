import { RpcClient } from "./rpc";

/** Result of {@link StorageClient.storeObject}. */
export interface StoredObject {
  object_id: string;
  size_bytes: number;
  data_shards: number;
  parity_shards: number;
}

/** Outcome of one charge epoch. */
export interface ChargeOutcome {
  deal_id: string;
  /** `charged`, `missed`, `closed_completed`, or `closed_terminated`. */
  status: string;
  /** Whether the renter was billed this epoch. */
  charged: boolean;
  /** Amount streamed to the provider this epoch, in wei (string-encoded). */
  slice_wei: string;
}

/** Storage-provider status snapshot. */
export interface StorageStatus {
  is_storage_provider: boolean;
  /** Effective byte-epoch rate in wei (string-encoded). */
  effective_rate_wei: string;
  /** Number of objects this provider holds. */
  object_count: number;
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  // `btoa` in browsers and modern Node (≥16); fall back to a Buffer path on
  // older runtimes, reached through `globalThis` so it isn't a bare global.
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return (globalThis as unknown as {
    Buffer: { from(s: string, e: string): { toString(e: string): string } };
  }).Buffer.from(binary, "binary").toString("base64");
}

/**
 * Decentralized storage client.
 *
 * A node started with the `storage` role spawns a storage-provider runtime:
 * it erasure-codes objects, publishes their shards over the content-addressed
 * transport, and bills renters per epoch through a streaming deal. Each epoch
 * is charged only when a retrievability challenge passes — a provider that
 * cannot prove it still holds the data earns nothing that epoch, and repeated
 * misses terminate the deal.
 *
 * These calls target the provider node directly; they succeed only when that
 * node is serving the storage role.
 */
export class StorageClient {
  private rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  /**
   * Stores an object: erasure-codes `data` and publishes its shards over the
   * transport. `ownerDid` gates who may retrieve the object (owner-only); it
   * defaults to the `owner` address when omitted.
   *
   * @example
   * ```typescript
   * const stored = await client.storage.storeObject(
   *   "photo-1",
   *   "0xowner",
   *   new TextEncoder().encode("hello"),
   *   4,
   *   2,
   *   "did:tenzro:human:alice",
   * );
   * console.log(`stored ${stored.size_bytes} bytes`);
   * ```
   */
  async storeObject(
    objectId: string,
    owner: string,
    data: Uint8Array,
    dataShards = 4,
    parityShards = 2,
    ownerDid?: string,
  ): Promise<StoredObject> {
    const params: Record<string, unknown> = {
      object_id: objectId,
      owner,
      data: toBase64(data),
      data_shards: dataShards,
      parity_shards: parityShards,
    };
    if (ownerDid !== undefined) {
      params.owner_did = ownerDid;
    }
    return this.rpc.call<StoredObject>("tenzro_storageStoreObject", [params]);
  }

  /**
   * Opens a streaming storage deal for an already-stored object. The renter
   * pre-funds from their deposit; per-epoch price is `sizeBytes × rate`.
   */
  async openDeal(
    objectId: string,
    renter: string,
    sizeBytes: number,
    totalEpochs: number,
  ): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_storageOpenDeal", [
      {
        object_id: objectId,
        renter,
        size_bytes: sizeBytes,
        total_epochs: totalEpochs,
      },
    ]);
  }

  /**
   * Runs one proof-of-retrievability-gated charge epoch for a deal. The renter
   * is billed only when the challenge passes.
   */
  async chargeEpoch(dealId: string): Promise<ChargeOutcome> {
    return this.rpc.call<ChargeOutcome>("tenzro_storageChargeEpoch", [
      { deal_id: dealId },
    ]);
  }

  /** Looks up a storage deal by id. */
  async getDeal(dealId: string): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_storageGetDeal", [{ deal_id: dealId }]);
  }

  /**
   * Switches the provider to network-dynamic byte-epoch pricing seeded from the
   * current rate. `capacity` is the provider's byte-epoch capacity (the
   * utilization target is 50% of it); `minRate`/`maxRate` bound the rate.
   */
  async setDynamicPricing(
    capacity: bigint | string,
    minRate: bigint | string = "1",
    maxRate?: bigint | string,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      mode: "dynamic",
      capacity: capacity.toString(),
      min_rate: minRate.toString(),
    };
    if (maxRate !== undefined) {
      params.max_rate = maxRate.toString();
    }
    return this.rpc.call("tenzro_storageSetPricing", [params]);
  }

  /** Returns this node's storage-provider status (rate, object count). */
  async status(): Promise<StorageStatus> {
    return this.rpc.call<StorageStatus>("tenzro_storageStatus", []);
  }
}
