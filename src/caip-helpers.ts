/**
 * Pure helpers around the submitted `tenzro` CASA namespace
 * (`ChainAgnostic/namespaces#184`). These functions reference the
 * frozen spec values and are safe to use without an RPC round-trip:
 * parsing, validation, and constants.
 *
 * For runtime-derived identifiers (the CAIP-2 reference, which depends
 * on the genesis block hash for the network the wallet is connected
 * to), use the `CaipClient` from `./caip.ts`.
 */

/** CAIP-2 namespace string for Tenzro. */
export const TENZRO_CAIP2_NAMESPACE = 'tenzro';

/**
 * SLIP-44 coin index for native TNZO. Pre-registered until
 * `satoshilabs/slips#2015` merges; the string form `"tenzro"` is also
 * accepted on input by the node-side helpers.
 */
export const TENZRO_SLIP44_COIN_INDEX = 1_414_421_071;

/** Asset namespaces supported by the CAIP-19 Tenzro encoding. */
export type CaipAssetNamespace = 'slip44' | 'token' | 'nft';

/**
 * Validate that a string looks like a Tenzro CAIP-2 chain id —
 * `tenzro:<32-hex chars>`. Does NOT verify the reference is the live
 * network's genesis hash; for that, compare against `CaipClient.caip2()`.
 */
export function isTenzroCaip2(chainId: string): boolean {
  return /^tenzro:[0-9a-f]{32}$/.test(chainId);
}

/**
 * Build a Tenzro CAIP-2 chain id from a 16-byte reference (the first
 * 16 bytes of the genesis block hash). Pass either a `Uint8Array` of
 * length 16, a 32-char lowercase hex string, or a `0x`-prefixed
 * 34-char hex string. Throws if the reference is the wrong length.
 */
export function buildTenzroCaip2(reference: Uint8Array | string): string {
  let hex: string;
  if (typeof reference === 'string') {
    hex = reference.toLowerCase().startsWith('0x')
      ? reference.slice(2).toLowerCase()
      : reference.toLowerCase();
    if (hex.length !== 32) {
      throw new Error(
        `CAIP-2 reference must be exactly 32 hex chars (16 bytes); got ${hex.length}`,
      );
    }
  } else {
    if (reference.length !== 16) {
      throw new Error(
        `CAIP-2 reference must be exactly 16 bytes; got ${reference.length}`,
      );
    }
    hex = Array.from(reference, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${TENZRO_CAIP2_NAMESPACE}:${hex}`;
}

/**
 * Parse a Tenzro CAIP-2 chain id into `{ namespace, reference }`.
 * Returns `null` if the input doesn't match the Tenzro shape.
 */
export function parseTenzroCaip2(
  chainId: string,
): { namespace: 'tenzro'; reference: string } | null {
  if (!isTenzroCaip2(chainId)) return null;
  return { namespace: 'tenzro', reference: chainId.slice('tenzro:'.length) };
}

/**
 * Validate a Tenzro CAIP-10 account id: `tenzro:<32-hex>:<address>`.
 * Tenzro addresses are 32 bytes (64-hex), but base58btc inputs are
 * accepted on the node side and normalized, so this validator only
 * checks the structural shape of the canonical hex form.
 */
export function isTenzroCaip10(accountId: string): boolean {
  return /^tenzro:[0-9a-f]{32}:[0-9a-f]{64}$/.test(accountId);
}

/**
 * Validate a Tenzro CAIP-19 asset id and return its parts. Returns
 * `null` if the input doesn't match the Tenzro shape.
 *
 * Forms:
 *   - `tenzro:<chainRef>/slip44:1414421071` (native TNZO)
 *   - `tenzro:<chainRef>/token:<64-hex>`
 *   - `tenzro:<chainRef>/nft:<64-hex>/<tokenId>`
 */
export function parseTenzroCaip19(assetId: string): {
  chainRef: string;
  namespace: CaipAssetNamespace;
  reference: string;
  tokenId?: string;
} | null {
  const m = assetId.match(
    /^tenzro:([0-9a-f]{32})\/(slip44|token|nft):([0-9a-zA-Z]+)(?:\/([0-9a-zA-Z]+))?$/,
  );
  if (!m) return null;
  const [, chainRef, ns, ref, tokenId] = m;
  if (!chainRef || !ns || !ref) return null;
  return {
    chainRef,
    namespace: ns as CaipAssetNamespace,
    reference: ref,
    ...(tokenId !== undefined ? { tokenId } : {}),
  };
}
