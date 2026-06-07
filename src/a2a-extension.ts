/**
 * Tenzro's A2A (Agent-to-Agent) protocol extension constants.
 *
 * Tenzro extends Google's A2A protocol with DID-bound message
 * signing, allowing any A2A message to carry a `did:tenzro:`
 * signature that downstream parties can verify. The extension is
 * surfaced as JSON metadata keys (NOT URLs — per
 * `feedback_a2a_extension_metadata_keys` the parent `/v1` should
 * resolve but child keys like `/v1/did` are JSON keys, not URLs).
 *
 * These constants are exported so consumers don't hard-code the
 * key strings — if the extension version bumps, callers re-import.
 */

/** Top-level extension namespace as it appears in A2A message metadata. */
export const TENZRO_A2A_EXTENSION_NAMESPACE = 'tenzro/v1';

/** Metadata key carrying the sender's `did:tenzro:` DID. */
export const TENZRO_A2A_DID_KEY = 'tenzro/v1/did';

/** Metadata key carrying the Ed25519 + ML-DSA-65 hybrid signature. */
export const TENZRO_A2A_SIG_KEY = 'tenzro/v1/sig';

/** Metadata key carrying the signing pubkey (or KID for caching). */
export const TENZRO_A2A_PUBKEY_KEY = 'tenzro/v1/pubkey';

/** Metadata key for a TDIP delegation scope reference, if scoped. */
export const TENZRO_A2A_DELEGATION_KEY = 'tenzro/v1/delegation';

/** Metadata key for the optional mandate-ref payload (AP2 / x402 / etc.). */
export const TENZRO_A2A_MANDATE_REF_KEY = 'tenzro/v1/mandate-ref';

/** Metadata key for the message's audit-trail link to a prior receipt. */
export const TENZRO_A2A_RECEIPT_REF_KEY = 'tenzro/v1/receipt-ref';

/** Convenience type for the parsed Tenzro extension envelope. */
export interface TenzroA2aExtension {
  readonly did: string;
  readonly sig: string;
  readonly pubkey: string;
  readonly delegation?: string;
  readonly mandateRef?: string;
  readonly receiptRef?: string;
}

/**
 * Extract the Tenzro extension fields from an A2A message metadata
 * object. Returns `null` when no Tenzro extension is present.
 */
export function extractTenzroA2aExtension(
  metadata: Readonly<Record<string, unknown>>,
): TenzroA2aExtension | null {
  const did = metadata[TENZRO_A2A_DID_KEY];
  const sig = metadata[TENZRO_A2A_SIG_KEY];
  const pubkey = metadata[TENZRO_A2A_PUBKEY_KEY];
  if (typeof did !== 'string' || typeof sig !== 'string' || typeof pubkey !== 'string') {
    return null;
  }
  const delegation = metadata[TENZRO_A2A_DELEGATION_KEY];
  const mandateRef = metadata[TENZRO_A2A_MANDATE_REF_KEY];
  const receiptRef = metadata[TENZRO_A2A_RECEIPT_REF_KEY];
  return {
    did,
    sig,
    pubkey,
    ...(typeof delegation === 'string' ? { delegation } : {}),
    ...(typeof mandateRef === 'string' ? { mandateRef } : {}),
    ...(typeof receiptRef === 'string' ? { receiptRef } : {}),
  };
}
