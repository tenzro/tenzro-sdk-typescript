/**
 * Tenzro Cross-VM (SVM-native) program — instruction builders.
 *
 * The Tenzro Cross-VM program is a native SVM program (no SBF ELF) that lets
 * SVM transactions initiate cross-VM token transfers. The SVM executor
 * recognizes {@link TENZRO_CROSS_VM_PROGRAM_ID_BASE58} and dispatches to the
 * native handlers in `tenzro_vm::svm::cross_vm`.
 *
 * Authoritative source: `crates/tenzro-vm/src/svm/cross_vm.rs`. Constants here
 * MUST stay byte-identical to the Rust constants.
 *
 * - **Program ID**: `SHA-256("tenzro/svm/program/cross_vm")`
 *   - Hex: `918f858b6b0dd134e9a1fcb73002428c5197093e76e536badc60382bb9f8ac78`
 *   - Base58: `AoD3kebB2bYjLKyJtaqkyXqwJy4oQ949SnVhMwEYzGXR`
 *
 * - **Instruction discriminators**: 8-byte Anchor-style
 *   `SHA-256("global:<snake_case_name>")[..8]`.
 *
 * - **Instruction data layout**: `[ discriminator (8) | payload (n) ]`. All
 *   integers are little-endian; byte arrays are inlined.
 */

/** Base58 encoding of the canonical Tenzro Cross-VM program ID. */
export const TENZRO_CROSS_VM_PROGRAM_ID_BASE58 =
  "AoD3kebB2bYjLKyJtaqkyXqwJy4oQ949SnVhMwEYzGXR";

/** Hex encoding of the canonical Tenzro Cross-VM program ID (no 0x prefix). */
export const TENZRO_CROSS_VM_PROGRAM_ID_HEX =
  "918f858b6b0dd134e9a1fcb73002428c5197093e76e536badc60382bb9f8ac78";

/** Raw 32-byte Tenzro Cross-VM program ID. */
export const TENZRO_CROSS_VM_PROGRAM_ID: Uint8Array = new Uint8Array([
  0x91, 0x8f, 0x85, 0x8b, 0x6b, 0x0d, 0xd1, 0x34,
  0xe9, 0xa1, 0xfc, 0xb7, 0x30, 0x02, 0x42, 0x8c,
  0x51, 0x97, 0x09, 0x3e, 0x76, 0xe5, 0x36, 0xba,
  0xdc, 0x60, 0x38, 0x2b, 0xb9, 0xf8, 0xac, 0x78,
]);

/** Domain string used to derive the program ID. */
export const PROGRAM_ID_DERIVATION_DOMAIN = "tenzro/svm/program/cross_vm";

/**
 * 8-byte Anchor-style instruction discriminators
 * (`SHA-256("global:<snake_case_name>")[..8]`).
 */
export const CROSS_VM_DISCRIMINATORS = {
  BRIDGE_TO_EVM: new Uint8Array([0x92, 0xa8, 0xa4, 0x5c, 0x33, 0x22, 0x5f, 0x25]),
  BRIDGE_FROM_EVM: new Uint8Array([0x30, 0x38, 0x73, 0x32, 0x89, 0xf4, 0xcd, 0x75]),
  REGISTER_TOKEN_POINTER: new Uint8Array([0x9a, 0x8e, 0x01, 0x39, 0x0f, 0x99, 0x45, 0x22]),
  TRANSFER_CROSS_VM: new Uint8Array([0xbc, 0x68, 0x41, 0x68, 0xab, 0xa7, 0xab, 0xb9]),
} as const;

/** Payload sizes (excluding the 8-byte discriminator). */
export const CROSS_VM_PAYLOAD_SIZE = {
  BRIDGE_TO_EVM: 68, // 32 + 20 + 8 + 8
  BRIDGE_FROM_EVM: 80, // 32 + 32 + 8 + 8
  REGISTER_TOKEN_POINTER: 84, // 32 + 20 + 32
  TRANSFER_CROSS_VM: 81, // 32 + 1 + 32 + 8 + 8
} as const;

/** VM type tag for `transferCrossVm.destVm` (matches `cross_vm_bridge::VM_TYPE_*`). */
export const VM_TYPE = {
  NATIVE: 0,
  EVM: 1,
  SVM: 2,
  DAML: 3,
} as const;

export type VmType = (typeof VM_TYPE)[keyof typeof VM_TYPE];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function u64ToLeBytes(v: bigint | number): Uint8Array {
  const value = typeof v === "bigint" ? v : BigInt(v);
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error(`u64 out of range: ${value}`);
  }
  const out = new Uint8Array(8);
  let n = value;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function u64FromLeBytes(b: Uint8Array, offset: number): bigint {
  let n = 0n;
  for (let i = 7; i >= 0; i--) {
    n = (n << 8n) | BigInt(b[offset + i]);
  }
  return n;
}

function expectLength(value: Uint8Array, expected: number, field: string): void {
  if (value.length !== expected) {
    throw new Error(
      `${field}: expected ${expected} bytes, got ${value.length}`,
    );
  }
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Typed instruction shapes
// ---------------------------------------------------------------------------

/** `bridge_to_evm(mint, evm_dest, amount, nonce)` — burn on SVM, credit EVM. */
export interface BridgeToEvmArgs {
  /** SPL mint (32-byte Pubkey). */
  mint: Uint8Array;
  /** EVM recipient (20-byte address). */
  evmDest: Uint8Array;
  /** Amount in SPL units (u64). */
  amount: bigint | number;
  /** Replay-protection nonce (u64). */
  nonce: bigint | number;
}

/** `bridge_from_evm(mint, svm_dest, amount, nonce)` — mint on SVM after EVM burn. */
export interface BridgeFromEvmArgs {
  mint: Uint8Array;
  /** SVM recipient ATA owner (32-byte Pubkey). */
  svmDest: Uint8Array;
  amount: bigint | number;
  nonce: bigint | number;
}

/** `register_token_pointer(mint, evm_token_address, token_id)` — register cross-VM mapping. */
export interface RegisterTokenPointerArgs {
  mint: Uint8Array;
  /** EVM ERC-20 contract (20-byte address). */
  evmTokenAddress: Uint8Array;
  /** Unified TokenId (32 bytes). */
  tokenId: Uint8Array;
}

/** `transfer_cross_vm(mint, dest_vm, dest_address, amount, nonce)` — generic cross-VM transfer. */
export interface TransferCrossVmArgs {
  mint: Uint8Array;
  destVm: VmType;
  /** Destination address right-padded to 32 bytes. */
  destAddress: Uint8Array;
  amount: bigint | number;
  nonce: bigint | number;
}

// ---------------------------------------------------------------------------
// Encoders — produce raw instruction-data bytes (discriminator + payload)
// ---------------------------------------------------------------------------

export function encodeBridgeToEvm(args: BridgeToEvmArgs): Uint8Array {
  expectLength(args.mint, 32, "mint");
  expectLength(args.evmDest, 20, "evmDest");
  return concat(
    CROSS_VM_DISCRIMINATORS.BRIDGE_TO_EVM,
    args.mint,
    args.evmDest,
    u64ToLeBytes(args.amount),
    u64ToLeBytes(args.nonce),
  );
}

export function encodeBridgeFromEvm(args: BridgeFromEvmArgs): Uint8Array {
  expectLength(args.mint, 32, "mint");
  expectLength(args.svmDest, 32, "svmDest");
  return concat(
    CROSS_VM_DISCRIMINATORS.BRIDGE_FROM_EVM,
    args.mint,
    args.svmDest,
    u64ToLeBytes(args.amount),
    u64ToLeBytes(args.nonce),
  );
}

export function encodeRegisterTokenPointer(
  args: RegisterTokenPointerArgs,
): Uint8Array {
  expectLength(args.mint, 32, "mint");
  expectLength(args.evmTokenAddress, 20, "evmTokenAddress");
  expectLength(args.tokenId, 32, "tokenId");
  return concat(
    CROSS_VM_DISCRIMINATORS.REGISTER_TOKEN_POINTER,
    args.mint,
    args.evmTokenAddress,
    args.tokenId,
  );
}

export function encodeTransferCrossVm(args: TransferCrossVmArgs): Uint8Array {
  expectLength(args.mint, 32, "mint");
  expectLength(args.destAddress, 32, "destAddress");
  if (args.destVm < 0 || args.destVm > VM_TYPE.DAML) {
    throw new Error(`destVm out of range: ${args.destVm}`);
  }
  return concat(
    CROSS_VM_DISCRIMINATORS.TRANSFER_CROSS_VM,
    args.mint,
    new Uint8Array([args.destVm]),
    args.destAddress,
    u64ToLeBytes(args.amount),
    u64ToLeBytes(args.nonce),
  );
}

// ---------------------------------------------------------------------------
// Decoders — parse raw instruction-data bytes into typed shapes
// ---------------------------------------------------------------------------

export type CrossVmInstruction =
  | { kind: "bridgeToEvm"; args: BridgeToEvmArgs }
  | { kind: "bridgeFromEvm"; args: BridgeFromEvmArgs }
  | { kind: "registerTokenPointer"; args: RegisterTokenPointerArgs }
  | { kind: "transferCrossVm"; args: TransferCrossVmArgs };

function discMatches(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function decodeCrossVmInstruction(data: Uint8Array): CrossVmInstruction {
  if (data.length < 8) {
    throw new Error(
      `instruction data too short: need at least 8 bytes for discriminator, got ${data.length}`,
    );
  }
  const disc = data.slice(0, 8);
  const payload = data.slice(8);

  if (discMatches(disc, CROSS_VM_DISCRIMINATORS.BRIDGE_TO_EVM)) {
    if (payload.length !== CROSS_VM_PAYLOAD_SIZE.BRIDGE_TO_EVM) {
      throw new Error(
        `bridge_to_evm payload size mismatch: expected ${CROSS_VM_PAYLOAD_SIZE.BRIDGE_TO_EVM}, got ${payload.length}`,
      );
    }
    return {
      kind: "bridgeToEvm",
      args: {
        mint: payload.slice(0, 32),
        evmDest: payload.slice(32, 52),
        amount: u64FromLeBytes(payload, 52),
        nonce: u64FromLeBytes(payload, 60),
      },
    };
  }

  if (discMatches(disc, CROSS_VM_DISCRIMINATORS.BRIDGE_FROM_EVM)) {
    if (payload.length !== CROSS_VM_PAYLOAD_SIZE.BRIDGE_FROM_EVM) {
      throw new Error(
        `bridge_from_evm payload size mismatch: expected ${CROSS_VM_PAYLOAD_SIZE.BRIDGE_FROM_EVM}, got ${payload.length}`,
      );
    }
    return {
      kind: "bridgeFromEvm",
      args: {
        mint: payload.slice(0, 32),
        svmDest: payload.slice(32, 64),
        amount: u64FromLeBytes(payload, 64),
        nonce: u64FromLeBytes(payload, 72),
      },
    };
  }

  if (discMatches(disc, CROSS_VM_DISCRIMINATORS.REGISTER_TOKEN_POINTER)) {
    if (payload.length !== CROSS_VM_PAYLOAD_SIZE.REGISTER_TOKEN_POINTER) {
      throw new Error(
        `register_token_pointer payload size mismatch: expected ${CROSS_VM_PAYLOAD_SIZE.REGISTER_TOKEN_POINTER}, got ${payload.length}`,
      );
    }
    return {
      kind: "registerTokenPointer",
      args: {
        mint: payload.slice(0, 32),
        evmTokenAddress: payload.slice(32, 52),
        tokenId: payload.slice(52, 84),
      },
    };
  }

  if (discMatches(disc, CROSS_VM_DISCRIMINATORS.TRANSFER_CROSS_VM)) {
    if (payload.length !== CROSS_VM_PAYLOAD_SIZE.TRANSFER_CROSS_VM) {
      throw new Error(
        `transfer_cross_vm payload size mismatch: expected ${CROSS_VM_PAYLOAD_SIZE.TRANSFER_CROSS_VM}, got ${payload.length}`,
      );
    }
    const destVm = payload[32];
    if (destVm > VM_TYPE.DAML) {
      throw new Error(`invalid destVm: ${destVm} (must be 0..=3)`);
    }
    return {
      kind: "transferCrossVm",
      args: {
        mint: payload.slice(0, 32),
        destVm: destVm as VmType,
        destAddress: payload.slice(33, 65),
        amount: u64FromLeBytes(payload, 65),
        nonce: u64FromLeBytes(payload, 73),
      },
    };
  }

  // Hex of unknown disc for the error message
  let hex = "";
  for (let i = 0; i < disc.length; i++) {
    hex += disc[i].toString(16).padStart(2, "0");
  }
  throw new Error(`unknown discriminator: ${hex}`);
}
