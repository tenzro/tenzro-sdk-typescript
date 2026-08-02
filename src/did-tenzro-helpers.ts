/**
 * Pure helpers around the submitted `did:tenzro:` DID method spec.
 *
 * Three identity classes (per the spec §3.1):
 *   - Human: `did:tenzro:human:{uuid}`
 *   - Delegated agent: `did:tenzro:machine:{controller_uuid}:{uuid}`
 *   - Autonomous agent: `did:tenzro:machine:{uuid}`
 *
 * For runtime DID resolution against the network, use the
 * `IdentityClient` from `./identity.ts`.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TenzroDidClass = 'human' | 'machine-delegated' | 'machine-autonomous';

export interface ParsedTenzroDid {
  readonly raw: string;
  readonly class: TenzroDidClass;
  readonly uuid: string;
  /** Present only for `machine-delegated` — the controller's UUID. */
  readonly controllerUuid?: string;
}

/**
 * Parse a `did:tenzro:` DID into its class and UUID(s). Returns
 * `null` if the input doesn't match any of the three valid forms.
 */
export function parseTenzroDid(did: string): ParsedTenzroDid | null {
  if (!did.startsWith('did:tenzro:')) return null;
  const rest = did.slice('did:tenzro:'.length);
  const parts = rest.split(':');

  if (parts.length === 2 && parts[0] === 'human' && parts[1] && UUID_RE.test(parts[1])) {
    return { raw: did, class: 'human', uuid: parts[1] };
  }
  if (parts.length === 2 && parts[0] === 'machine' && parts[1] && UUID_RE.test(parts[1])) {
    return { raw: did, class: 'machine-autonomous', uuid: parts[1] };
  }
  if (
    parts.length === 3 &&
    parts[0] === 'machine' &&
    parts[1] &&
    parts[2] &&
    UUID_RE.test(parts[1]) &&
    UUID_RE.test(parts[2])
  ) {
    return {
      raw: did,
      class: 'machine-delegated',
      controllerUuid: parts[1],
      uuid: parts[2],
    };
  }
  return null;
}

/**
 * Validate a `did:tenzro:` DID without parsing — cheaper when the
 * caller only needs to gate input shape.
 */
export function isTenzroDid(did: string): boolean {
  return parseTenzroDid(did) !== null;
}

/** Build a human DID from a v4 UUID. */
export function buildHumanDid(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error(`invalid UUID: ${uuid}`);
  return `did:tenzro:human:${uuid}`;
}

/** Build an autonomous-machine DID from a v4 UUID. */
export function buildAutonomousMachineDid(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error(`invalid UUID: ${uuid}`);
  return `did:tenzro:machine:${uuid}`;
}

/** Build a delegated-machine DID from controller + machine UUIDs. */
export function buildDelegatedMachineDid(
  controllerUuid: string,
  machineUuid: string,
): string {
  if (!UUID_RE.test(controllerUuid))
    throw new Error(`invalid controller UUID: ${controllerUuid}`);
  if (!UUID_RE.test(machineUuid))
    throw new Error(`invalid machine UUID: ${machineUuid}`);
  return `did:tenzro:machine:${controllerUuid}:${machineUuid}`;
}
