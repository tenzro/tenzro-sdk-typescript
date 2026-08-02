import type { RpcClient } from './rpc';

// ── Types ──

/** Result of `tenzro_eip7702SigningHash`. */
export interface Eip7702SigningHash {
  /**
   * 32-byte keccak-256 signing hash, 0x-prefixed hex. Sign with the
   * EOA's secp256k1 private key.
   */
  signing_hash: string;
  /**
   * The full signing preimage
   * (`MAGIC(0x05) || rlp([chain_id, delegate_address, nonce])`),
   * 0x-prefixed hex. Provided for auditing / debugging.
   */
  signing_data: string;
  /** Always `"0x05"` — the EIP-7702 magic byte. */
  magic_byte: string;
}

/** Result of `tenzro_eip7702BuildDesignator`. */
export interface Eip7702Designator {
  /** 23-byte designator, 0x-prefixed hex. */
  designator: string;
  /** Always 23. */
  length: number;
  /** Always `"0xef0100"`. */
  prefix: string;
  /** The delegate address echoed back. */
  delegate_address: string;
}

/** Result of `tenzro_eip7702ParseDesignator`. */
export interface Eip7702ParsedDesignator {
  /** `true` if `code` is a valid 23-byte 7702 designator. */
  is_designator: boolean;
  /**
   * The delegate address (0x-prefixed hex) if `is_designator=true`,
   * otherwise `null`.
   */
  delegate_address: string | null;
}

/** Result of `tenzro_eip7702ProtocolInfo`. */
export interface Eip7702ProtocolInfo {
  /** EIP-7702 transaction type (`0x04` per the EIP). */
  tx_type: number;
  /** Authorization preimage magic byte (`"0x05"`). */
  magic_byte: string;
  /** Designator prefix (`"0xef0100"`). */
  designator_prefix: string;
  /** Designator length in bytes (always 23). */
  designator_length: number;
  /** Signing scheme used for the authorization (`"secp256k1"`). */
  signing_scheme: string;
  /** Wire format of the secp256k1 signature. */
  signature_format: string;
  /** Description of the signing preimage shape. */
  preimage: string;
  /**
   * Operator note describing the current state of transaction-side
   * support (`eth_sendRawTransaction` integration is a follow-up).
   */
  note: string;
}

// ── Client ──

/**
 * EIP-7702 (Set EOA Account Code) helper client.
 *
 * EIP-7702 lets an externally-owned account temporarily delegate its
 * code to a smart-contract address. The delegation is encoded as a
 * 23-byte designator (`0xef0100 || delegate_address`) written into the
 * EOA's code slot, signed by the EOA's secp256k1 key over a domain-
 * separated preimage.
 *
 * This client wraps the **stateless helper RPCs** the node exposes for
 * 7702 tooling:
 * - `tenzro_eip7702SigningHash` — compute the secp256k1 signing hash
 * - `tenzro_eip7702BuildDesignator` — build the 23-byte designator
 * - `tenzro_eip7702ParseDesignator` — decode an account's code
 * - `tenzro_eip7702ProtocolInfo` — static protocol metadata
 *
 * Full EIP-7702 txtype `0x04` decoding inside `eth_sendRawTransaction`
 * is a separate mainnet task. For now, produce the signing hash with
 * `signingHash`, sign client-side, and use `buildDesignator` + a
 * direct state write to install the delegation.
 */
export class Eip7702Client {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Compute the secp256k1 signing hash for an EIP-7702 authorization
   * tuple `(chainId, delegateAddress, nonce)`. The returned
   * `signing_hash` is what the EOA private key signs client-side.
   */
  async signingHash(
    chainId: number,
    delegateAddress: string,
    nonce: number
  ): Promise<Eip7702SigningHash> {
    return this.rpc.call<Eip7702SigningHash>('tenzro_eip7702SigningHash', [
      {
        chain_id: chainId,
        delegate_address: delegateAddress,
        nonce,
      },
    ]);
  }

  /**
   * Build the 23-byte EIP-7702 delegation designator
   * (`0xef0100 || delegateAddress`) that gets written into the EOA's
   * code slot once an authorization is accepted.
   */
  async buildDesignator(delegateAddress: string): Promise<Eip7702Designator> {
    return this.rpc.call<Eip7702Designator>('tenzro_eip7702BuildDesignator', [
      { delegate_address: delegateAddress },
    ]);
  }

  /**
   * Decode an account's `code` (hex with or without `0x` prefix) and
   * extract the delegate address if it is a valid EIP-7702 designator.
   * Returns `{ is_designator: false, delegate_address: null }` for
   * code that is not a 7702 designator.
   */
  async parseDesignator(code: string): Promise<Eip7702ParsedDesignator> {
    return this.rpc.call<Eip7702ParsedDesignator>(
      'tenzro_eip7702ParseDesignator',
      [{ code }]
    );
  }

  /**
   * Read static metadata about the EIP-7702 support surface (tx type,
   * magic byte, designator layout, signing scheme).
   */
  async protocolInfo(): Promise<Eip7702ProtocolInfo> {
    return this.rpc.call<Eip7702ProtocolInfo>(
      'tenzro_eip7702ProtocolInfo',
      []
    );
  }
}
