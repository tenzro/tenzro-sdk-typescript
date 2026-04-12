import type { RpcClient } from './rpc';

// ── Types ──

/** MPC threshold wallet information. */
export interface MpcWallet {
  /** Wallet identifier */
  wallet_id: string;
  /** Wallet address (hex) */
  address: string;
  /** Signing threshold (e.g., 2) */
  threshold: number;
  /** Total number of key shares (e.g., 3) */
  total_shares: number;
}

/** Encrypted keystore export. */
export interface EncryptedKeystore {
  /** Encrypted keystore data (JSON string) */
  encrypted: string;
  /** Key derivation function used ("argon2id") */
  kdf: string;
  /** Cipher used ("aes-256-gcm") */
  cipher: string;
}

/** Key share metadata (not the actual share material). */
export interface KeyShare {
  /** Share index (1-based) */
  index: number;
  /** When this share was created */
  created_at: string;
}

/** Result of a key rotation operation. */
export interface RotationResult {
  /** Whether the rotation succeeded */
  success: boolean;
  /** Number of shares rotated */
  shares_rotated: number;
  /** New rotation epoch */
  epoch: number;
}

/** Wallet spending policy. */
export interface SpendingPolicy {
  /** Maximum daily spending (in smallest unit, as string for BigInt support) */
  daily_limit: string;
  /** Maximum per-transaction spending (in smallest unit, as string) */
  per_tx_limit: string;
  /** Amount already spent today (in smallest unit, as string) */
  daily_spent: string;
}

/** Scoped session key for temporary wallet access. */
export interface SessionKey {
  /** Session key identifier */
  session_id: string;
  /** When the session expires (ISO 8601) */
  expires_at: string;
  /** Allowed operations */
  operations: string[];
}

// ── Client ──

/**
 * Client for key custody and wallet security operations.
 *
 * Provides MPC wallet creation, keystore management, key rotation,
 * spending policies, and session key authorization.
 */
export class CustodyClient {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Create a new MPC threshold wallet.
   * @param threshold - Minimum number of shares required to sign
   * @param totalShares - Total number of key shares
   * @param keyType - "ed25519" or "secp256k1"
   */
  async createMpcWallet(
    threshold: number,
    totalShares: number,
    keyType: 'ed25519' | 'secp256k1',
  ): Promise<MpcWallet> {
    return this.rpc.call<MpcWallet>('tenzro_createMpcWallet', [
      { threshold, total_shares: totalShares, key_type: keyType },
    ]);
  }

  /**
   * Export an encrypted keystore (Argon2id + AES-256-GCM).
   * @param walletId - Wallet identifier
   * @param password - Password to encrypt the keystore
   */
  async exportKeystore(walletId: string, password: string): Promise<EncryptedKeystore> {
    return this.rpc.call<EncryptedKeystore>('tenzro_exportKeystore', [
      { wallet_id: walletId, password },
    ]);
  }

  /**
   * Import a wallet from an encrypted keystore.
   * @param keystore - Encrypted keystore JSON string
   * @param password - Password to decrypt the keystore
   */
  async importKeystore(keystore: string, password: string): Promise<MpcWallet> {
    return this.rpc.call<MpcWallet>('tenzro_importKeystore', [{ keystore, password }]);
  }

  /**
   * Get key share metadata (not the actual shares).
   * @param walletId - Wallet identifier
   */
  async getKeyShares(walletId: string): Promise<KeyShare[]> {
    return this.rpc.call<KeyShare[]>('tenzro_getKeyShares', [{ wallet_id: walletId }]);
  }

  /**
   * Rotate MPC key shares (same public key, new shares).
   * @param walletId - Wallet identifier
   */
  async rotateKeys(walletId: string): Promise<RotationResult> {
    return this.rpc.call<RotationResult>('tenzro_rotateKeys', [{ wallet_id: walletId }]);
  }

  /**
   * Set spending limits for a wallet.
   * @param walletId - Wallet identifier
   * @param dailyLimit - Maximum daily spending (in smallest unit)
   * @param perTxLimit - Maximum per-transaction spending
   */
  async setSpendingLimits(
    walletId: string,
    dailyLimit: bigint,
    perTxLimit: bigint,
  ): Promise<SpendingPolicy> {
    return this.rpc.call<SpendingPolicy>('tenzro_setSpendingLimits', [
      {
        wallet_id: walletId,
        daily_limit: dailyLimit.toString(),
        per_tx_limit: perTxLimit.toString(),
      },
    ]);
  }

  /**
   * Get current spending limits for a wallet.
   * @param walletId - Wallet identifier
   */
  async getSpendingLimits(walletId: string): Promise<SpendingPolicy> {
    return this.rpc.call<SpendingPolicy>('tenzro_getSpendingLimits', [
      { wallet_id: walletId },
    ]);
  }

  /**
   * Create a session key with scoped permissions.
   * @param walletId - Wallet identifier
   * @param durationSecs - Session validity duration in seconds
   * @param operations - Allowed operations (e.g., "transfer", "stake")
   */
  async authorizeSession(
    walletId: string,
    durationSecs: number,
    operations: string[],
  ): Promise<SessionKey> {
    return this.rpc.call<SessionKey>('tenzro_authorizeSession', [
      { wallet_id: walletId, duration_secs: durationSecs, operations },
    ]);
  }
}
