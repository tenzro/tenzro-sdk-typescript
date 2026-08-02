import { RpcClient } from "./rpc";

/** A booked compute rental (mirrors the node's rental agreement). */
export interface ComputeRental {
  rental_id: string;
  /** Per-epoch price in wei. */
  price_per_epoch: number;
  /** Total epochs in the term. */
  total_epochs: number;
  /** Epochs delivered and paid so far. */
  epochs_settled: number;
}

/** Outcome of one settle epoch. */
export interface EpochOutcome {
  rental_id: string;
  /** `settled`, `missed`, or `closed`. */
  status: string;
  /** Whether the provider was paid this epoch. */
  settled: boolean;
  /**
   * Amount moved this epoch in wei (string-encoded): the slice paid to the
   * provider on `settled`, or the make-whole credited to the renter on `missed`.
   */
  amount_wei: string;
}

/** Compute-provider status snapshot. */
export interface ComputeStatus {
  is_compute_provider: boolean;
  /** Effective per-epoch rate in wei (string-encoded). */
  effective_rate_wei: string;
  /** Number of active rentals on this provider. */
  active_rentals: number;
}

/**
 * Compute-rental client.
 *
 * A node started with the `ai` role spawns a compute-rental runtime alongside
 * its inference: it rents out CPU/GPU capacity for fixed terms and bills
 * renters per epoch through a streaming deal. Each epoch settles only when an
 * availability proof passes — a provider that cannot serve the reserved
 * capacity earns nothing that epoch, and repeated misses terminate the rental
 * and make the renter whole from the provider's stake.
 *
 * These calls target the provider node directly; they succeed only when that
 * node is serving the AI role.
 */
export class ComputeClient {
  private rpc: RpcClient;

  constructor(rpc: RpcClient) {
    this.rpc = rpc;
  }

  /**
   * Books a fixed-term compute rental against this provider. The renter
   * pre-funds from their deposit; per-epoch price is the provider's effective
   * rate. The locked deposit streams to the provider as epochs settle.
   *
   * @example
   * ```typescript
   * const rental = await client.compute.bookRental("0xrenter", 24);
   * console.log(`booked rental ${rental.rental_id}`);
   * ```
   */
  async bookRental(renter: string, totalEpochs: number): Promise<ComputeRental> {
    return this.rpc.call<ComputeRental>("tenzro_computeBookRental", [
      { renter, total_epochs: totalEpochs },
    ]);
  }

  /**
   * Settles one epoch of an active rental, gated on the provider's availability
   * proof. A valid proof streams the epoch's slice to the provider; an
   * invalid/missing proof makes the renter whole from stake.
   */
  async settleEpoch(rentalId: string, proofValid = true): Promise<EpochOutcome> {
    return this.rpc.call<EpochOutcome>("tenzro_computeSettleEpoch", [
      { rental_id: rentalId, proof_valid: proofValid },
    ]);
  }

  /** Looks up a compute rental by id. */
  async getRental(rentalId: string): Promise<Record<string, unknown>> {
    return this.rpc.call("tenzro_computeGetRental", [{ rental_id: rentalId }]);
  }

  /**
   * Switches the provider to network-dynamic per-epoch pricing seeded from the
   * current rate. `capacity` is the provider's epoch-slot capacity (the
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
    return this.rpc.call("tenzro_computeSetPricing", [params]);
  }

  /** Returns this node's compute-provider status (rate, active rentals). */
  async status(): Promise<ComputeStatus> {
    return this.rpc.call<ComputeStatus>("tenzro_computeStatus", []);
  }
}
