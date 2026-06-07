import type { RpcClient } from './rpc';

export interface HyperlaneChain {
  name: string;
  domain_id: number;
  mailbox?: string;
}

export interface HyperlaneDispatchRequest {
  origin_domain: number;
  destination_domain: number;
  recipient: string;
  body_hex: string;
  sender?: string;
  interchain_gas_payment?: string;
}

export interface HyperlaneDispatchQuote {
  gas_payment: string;
  gas_payment_token: string;
}

export interface HyperlaneDispatchResult {
  message_id: string;
  nonce: number;
  origin_domain: number;
  destination_domain: number;
}

export interface HyperlaneMessage {
  message_id: string;
  nonce: number;
  origin_domain: number;
  destination_domain: number;
  sender: string;
  recipient: string;
  body_hex: string;
  status: string;
}

/**
 * Hyperlane V3 messaging client. Tenzro runs a sovereign
 * Tenzro-validator-set ISM (Interchain Security Module).
 */
export class HyperlaneClient {
  constructor(private readonly rpc: RpcClient) {}

  async listChains(): Promise<HyperlaneChain[]> {
    return this.rpc.call<HyperlaneChain[]>('tenzro_hyperlaneListChains', []);
  }

  async quoteDispatch(
    req: HyperlaneDispatchRequest
  ): Promise<HyperlaneDispatchQuote> {
    return this.rpc.call<HyperlaneDispatchQuote>(
      'tenzro_hyperlaneQuoteDispatch',
      [req]
    );
  }

  async dispatch(
    req: HyperlaneDispatchRequest
  ): Promise<HyperlaneDispatchResult> {
    return this.rpc.call<HyperlaneDispatchResult>(
      'tenzro_hyperlaneDispatch',
      [req]
    );
  }

  async getMessage(messageId: string): Promise<HyperlaneMessage | null> {
    return this.rpc.call<HyperlaneMessage | null>(
      'tenzro_hyperlaneGetMessage',
      [{ message_id: messageId }]
    );
  }
}
