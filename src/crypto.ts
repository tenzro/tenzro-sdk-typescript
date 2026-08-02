import type { RpcClient } from './rpc';

// ── Types ──

/** Result of a message signing operation. */
export interface SignatureResult {
  /** Hex-encoded signature */
  signature: string;
  /** Hex-encoded public key of the signer */
  public_key: string;
}

/** Result of a signature verification. */
export interface VerifyResult {
  /** Whether the signature is valid */
  valid: boolean;
}

/** Result of an encryption operation. */
export interface EncryptResult {
  /** Hex-encoded ciphertext */
  ciphertext: string;
  /** Hex-encoded nonce (12 bytes) */
  nonce: string;
}

/** Result of a decryption operation. */
export interface DecryptResult {
  /** Hex-encoded plaintext */
  plaintext: string;
}

/** Key derived from a password. */
export interface DerivedKey {
  /** Hex-encoded derived key */
  key: string;
  /** Hex-encoded salt */
  salt: string;
}

/** Generated keypair. */
export interface KeyPair {
  /** Hex-encoded public key */
  public_key: string;
  /** Hex-encoded private key */
  private_key: string;
  /** Key algorithm ("ed25519" or "secp256k1") */
  key_type: string;
}

/** Shared secret from X25519 key exchange. */
export interface SharedSecret {
  /** Hex-encoded shared secret (32 bytes) */
  secret: string;
}

// ── Client ──

/**
 * Client for cryptographic operations.
 *
 * Provides signing, verification, encryption, hashing, key generation,
 * and X25519 Diffie-Hellman key exchange.
 */
export class CryptoClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Sign a message using Ed25519 or Secp256k1.
   * @param privateKey - Hex-encoded private key
   * @param message - Hex-encoded message bytes
   */
  async signMessage(privateKey: string, message: string): Promise<SignatureResult> {
    return this.rpc.call<SignatureResult>('tenzro_signMessage', [
      { private_key: privateKey, message },
    ]);
  }

  /**
   * Verify a signature against a message and public key.
   * @param publicKey - Hex-encoded public key
   * @param message - Hex-encoded message bytes
   * @param signature - Hex-encoded signature
   */
  async verifySignature(publicKey: string, message: string, signature: string): Promise<VerifyResult> {
    return this.rpc.call<VerifyResult>('tenzro_verifySignature', [
      { public_key: publicKey, message, signature },
    ]);
  }

  /**
   * Encrypt data using AES-256-GCM.
   * @param key - Hex-encoded 256-bit encryption key
   * @param plaintext - Hex-encoded plaintext
   */
  async encrypt(key: string, plaintext: string): Promise<EncryptResult> {
    return this.rpc.call<EncryptResult>('tenzro_encrypt', [{ key, plaintext }]);
  }

  /**
   * Decrypt data using AES-256-GCM.
   * @param key - Hex-encoded 256-bit encryption key
   * @param ciphertext - Hex-encoded ciphertext
   * @param nonce - Hex-encoded 12-byte nonce
   */
  async decrypt(key: string, ciphertext: string, nonce: string): Promise<DecryptResult> {
    return this.rpc.call<DecryptResult>('tenzro_decrypt', [{ key, ciphertext, nonce }]);
  }

  /**
   * Derive a key from a password using Argon2id (64MB, 3 iterations).
   * @param password - Password to derive key from
   * @param salt - Hex-encoded salt (16 bytes recommended)
   */
  async deriveKey(password: string, salt: string): Promise<DerivedKey> {
    return this.rpc.call<DerivedKey>('tenzro_deriveKey', [{ password, salt }]);
  }

  /**
   * Generate a new Ed25519 or Secp256k1 keypair.
   * @param keyType - "ed25519" or "secp256k1"
   */
  async generateKeypair(keyType: 'ed25519' | 'secp256k1'): Promise<KeyPair> {
    return this.rpc.call<KeyPair>('tenzro_generateKeypair', [{ key_type: keyType }]);
  }

  /**
   * Compute SHA-256 hash.
   * @param data - Hex-encoded data
   * @returns Hex-encoded hash
   */
  async hashSha256(data: string): Promise<string> {
    return this.rpc.call<string>('tenzro_hashSha256', [{ data }]);
  }

  /**
   * Compute Keccak-256 hash (Ethereum compatible).
   * @param data - Hex-encoded data
   * @returns Hex-encoded hash
   */
  async hashKeccak256(data: string): Promise<string> {
    return this.rpc.call<string>('tenzro_hashKeccak256', [{ data }]);
  }

  /**
   * Perform X25519 Diffie-Hellman key exchange.
   * @param privateKey - Hex-encoded X25519 private key
   * @param publicKey - Hex-encoded X25519 public key of the peer
   */
  async x25519KeyExchange(privateKey: string, publicKey: string): Promise<SharedSecret> {
    return this.rpc.call<SharedSecret>('tenzro_x25519KeyExchange', [
      { private_key: privateKey, public_key: publicKey },
    ]);
  }
}
