import type { RpcClient } from './rpc';

// ── Types ──

/**
 * Compact summary returned by `tenzro_listSnapshots`. Per-chunk hashes
 * are elided here — fetch the full manifest with
 * `getSnapshotManifest(height)` to verify chunks.
 */
export interface SnapshotSummary {
  height: number;
  state_root_hex: string;
  num_chunks: number;
  created_at: string;
  format: number;
}

/** Result of `tenzro_listSnapshots`. */
export interface SnapshotList {
  snapshots: SnapshotSummary[];
}

/**
 * Full snapshot manifest with per-chunk SHA-256 hashes. Returned by
 * `tenzro_getSnapshotManifest` and consumed by `tenzro_offerSnapshot`.
 */
export interface SnapshotManifest {
  /** Block height at which this snapshot was taken. */
  height: number;
  /**
   * State root committed at `height`. The caller MUST verify this
   * against a trusted QC at the same height before offering or
   * applying this snapshot.
   */
  state_root_hex: string;
  /** Number of chunks. Chunk indices are `0..num_chunks`. */
  num_chunks: number;
  /**
   * Per-chunk SHA-256 hash (hex), indexed by chunk number. Used by the
   * receiver to verify chunks before disk write.
   */
  chunk_hashes_hex: string[];
  /** Wall-clock time the snapshot was produced (ISO 8601, UTC). */
  created_at: string;
  /** Manifest format version. */
  format: number;
}

/**
 * Result of `tenzro_getSnapshotChunk`. `data_b64` is the base64-encoded
 * chunk bytes.
 */
export interface SnapshotChunk {
  height: number;
  chunk_index: number;
  data_b64: string;
}

/** Result of `tenzro_offerSnapshot`. */
export interface SnapshotOfferAccepted {
  accepted: boolean;
  height: number;
  num_chunks: number;
}

/**
 * Result of `tenzro_applySnapshotChunk`. `complete` flips to `true` on
 * the final chunk, after which the snapshot has been atomically
 * committed via `write_batch_sync`.
 */
export interface SnapshotChunkApplied {
  complete: boolean;
  height: number;
  chunk_index: number;
}

// ── Client ──

/**
 * State-sync snapshot client.
 *
 * Wraps the five snapshot RPCs that drive state-sync between nodes:
 * - `tenzro_listSnapshots` — enumerate local snapshots
 * - `tenzro_getSnapshotManifest` — full manifest including per-chunk hashes
 * - `tenzro_getSnapshotChunk` — fetch a single chunk by index
 * - `tenzro_offerSnapshot` — register an inbound manifest from a peer
 * - `tenzro_applySnapshotChunk` — write one inbound chunk
 *
 * **Trust model:** Callers MUST verify `manifest.state_root_hex` against
 * a trusted QC at the same height before calling `offerSnapshot` /
 * `applySnapshotChunk`. The node verifies per-chunk SHA-256 against
 * the manifest before any disk write, and atomically commits on the
 * final chunk via `write_batch_sync`.
 */
export class SnapshotClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Enumerate local snapshots. Per-chunk hashes are elided for
   * compactness — use `getSnapshotManifest(height)` to retrieve the
   * full manifest.
   */
  async listSnapshots(): Promise<SnapshotList> {
    return this.rpc.call<SnapshotList>('tenzro_listSnapshots', []);
  }

  /**
   * Fetch the full manifest for the snapshot at `height`, including
   * per-chunk SHA-256 hashes. Returns the node's `-32004 no snapshot
   * at height` error if no snapshot is taken at that height.
   */
  async getSnapshotManifest(height: number): Promise<SnapshotManifest> {
    return this.rpc.call<SnapshotManifest>('tenzro_getSnapshotManifest', [
      { height },
    ]);
  }

  /**
   * Fetch one chunk by `(height, chunkIndex)`. The returned `data_b64`
   * is the base64-encoded chunk bytes; verify against
   * `manifest.chunk_hashes_hex[chunkIndex]` before applying.
   */
  async getSnapshotChunk(
    height: number,
    chunkIndex: number
  ): Promise<SnapshotChunk> {
    return this.rpc.call<SnapshotChunk>('tenzro_getSnapshotChunk', [
      { height, chunk_index: chunkIndex },
    ]);
  }

  /**
   * Register an inbound manifest from a peer.
   *
   * **Caller MUST verify `manifest.state_root_hex` against a trusted QC
   * at the same height before invoking.** This RPC only registers the
   * offer and provisions the spool directory; it does not itself
   * validate the manifest against chain state.
   */
  async offerSnapshot(
    manifest: SnapshotManifest
  ): Promise<SnapshotOfferAccepted> {
    return this.rpc.call<SnapshotOfferAccepted>('tenzro_offerSnapshot', [
      manifest,
    ]);
  }

  /**
   * Write one inbound chunk. The chunk's SHA-256 is verified against
   * `manifest.chunk_hashes_hex[chunkIndex]` before any disk write. On
   * the final chunk, all chunks are decoded and atomically committed
   * via `write_batch_sync`; `complete` will be `true` on that call.
   */
  async applySnapshotChunk(
    height: number,
    chunkIndex: number,
    dataB64: string
  ): Promise<SnapshotChunkApplied> {
    return this.rpc.call<SnapshotChunkApplied>('tenzro_applySnapshotChunk', [
      { height, chunk_index: chunkIndex, data_b64: dataB64 },
    ]);
  }
}
