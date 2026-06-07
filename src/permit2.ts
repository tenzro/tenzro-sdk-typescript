import type { RpcClient } from './rpc';

export interface Permit2DomainSeparator {
  domain_separator: string;
  verifying_contract: string;
  chain_id: number;
}

export interface Permit2DigestRequest {
  chain_id: number;
  owner: string;
  token: string;
  amount: string;
  spender: string;
  nonce: string;
  deadline: number;
  witness?: string;
  witness_type_string?: string;
}

export interface Permit2Digest {
  digest: string;
  struct_hash: string;
  domain_separator: string;
}

export interface Permit2VerifyAndConsumeRequest extends Permit2DigestRequest {
  signature: string;
}

export interface Permit2VerifyAndConsumeResult {
  consumed: boolean;
  word_pos: string;
  bit_pos: number;
}

export interface Permit2NonceUsed {
  used: boolean;
  owner: string;
  nonce: string;
}

/**
 * Permit2 `SignatureTransfer` client. Wraps the canonical Tenzro
 * Permit2 contract at `0x0000…00001023` with optional witness binding
 * for ERC-7683 origin opens.
 */
export class Permit2Client {
  constructor(private readonly rpc: RpcClient) {}

  async domainSeparator(chainId: number): Promise<Permit2DomainSeparator> {
    return this.rpc.call<Permit2DomainSeparator>(
      'tenzro_permit2DomainSeparator',
      [{ chain_id: chainId }]
    );
  }

  async digest(req: Permit2DigestRequest): Promise<Permit2Digest> {
    return this.rpc.call<Permit2Digest>('tenzro_permit2Digest', [req]);
  }

  async verifyAndConsume(
    req: Permit2VerifyAndConsumeRequest
  ): Promise<Permit2VerifyAndConsumeResult> {
    return this.rpc.call<Permit2VerifyAndConsumeResult>(
      'tenzro_permit2VerifyAndConsume',
      [req]
    );
  }

  async nonceUsed(owner: string, nonce: string): Promise<Permit2NonceUsed> {
    return this.rpc.call<Permit2NonceUsed>('tenzro_permit2NonceUsed', [
      { owner, nonce },
    ]);
  }
}
