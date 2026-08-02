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
 * `tenzro_getSnapshotManifest`. The receiver verifies each fetched chunk
 * against `chunk_hashes_hex` before handing it to its own snapshot store.
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

// ── Client ──

/**
 * State-sync snapshot client.
 *
 * Wraps the three snapshot RPCs a syncing node calls on a serving one:
 * - `tenzro_listSnapshots` — enumerate local snapshots
 * - `tenzro_getSnapshotManifest` — full manifest including per-chunk hashes
 * - `tenzro_getSnapshotChunk` — fetch a single chunk by index
 *
 * All three are reads. The inbound half of state-sync — offering a manifest
 * and applying its chunks — is driven in-process by the node's own bootstrap
 * path and is deliberately not reachable over JSON-RPC, so there is nothing
 * here to wrap.
 *
 * **Trust model:** a manifest attests only to its own chunks; nothing inside
 * it binds the snapshot to the chain. Callers MUST verify
 * `manifest.state_root_hex` against a trusted QC at the same height before
 * applying it.
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

}
