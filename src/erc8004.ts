import type { RpcClient } from './rpc';

/**
 * Deterministic agent id derived from a Tenzro DID via
 * `keccak256(utf8(did))`.
 */
export interface Erc8004AgentId {
  /** DID echoed back. */
  did: string;
  /** 32-byte agent id as 0x-prefixed hex. */
  agent_id: string;
}

/**
 * Hex-encoded ABI calldata ready for `eth_sendRawTransaction` / `eth_call`.
 */
export interface Erc8004Calldata {
  /** Full hex-encoded calldata (selector + abi-encoded args). */
  calldata: string;
  /** Echoed agent id from `encodeRegister`; empty for other encoders. */
  agent_id?: string;
}

/**
 * Decoded agent record returned by `IdentityRegistry.getAgent()`.
 */
export interface Erc8004Agent {
  /** Agent owner / controller address. */
  agent_address: string;
  /** Off-chain metadata URI (e.g. IPFS, HTTPS). */
  metadata_uri: string;
}

/**
 * Decoded `bytes` value returned by `IdentityRegistry.getMetadata()`.
 */
export interface Erc8004Metadata {
  /** Hex-encoded value (`0x` prefix), or empty hex when unset. */
  metadata_value: string;
}

/**
 * Client for the ERC-8004 Trustless Agents Registry family
 * (IdentityRegistry, ReputationRegistry, ValidationRegistry).
 *
 * Covers the canonical v0.6+ surface — base register/feedback/validation
 * plus `setAgentURI` / `setAgentWallet` / `setMetadata` / `getMetadata`
 * / `getAgentURI` / `getAgentWallet` / `revokeFeedback` /
 * `appendResponse` / `isFeedbackRevoked` / `getFeedbackResponses` /
 * `getFeedback` / `getFeedbackCount` / `getValidation`.
 *
 * All `encode*` methods return hex calldata that callers can sign and
 * broadcast through any EVM wallet. `decode*` helpers round-trip
 * return data from `eth_call` into typed structs.
 */
export class Erc8004Client {
  constructor(private readonly rpc: RpcClient) {}

  // -----------------------------------------------------------------
  // Identity registry — base surface
  // -----------------------------------------------------------------

  /** Derive a canonical ERC-8004 `agentId = keccak256(utf8(did))`. */
  async deriveAgentId(did: string): Promise<Erc8004AgentId> {
    return this.rpc.call<Erc8004AgentId>('tenzro_erc8004DeriveAgentId', [
      { did },
    ]);
  }

  /** ABI-encode `IdentityRegistry.registerAgent(bytes32 agentId, address agentAddress, string metadataURI)`. */
  async encodeRegister(
    did: string,
    agentAddress: string,
    metadataUri: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeRegister', [
      { did, agent_address: agentAddress, metadata_uri: metadataUri },
    ]);
  }

  /** ABI-encode `IdentityRegistry.getAgent(bytes32 agentId)`. */
  async encodeGetAgent(agentId: string): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeGetAgent', [
      { agent_id: agentId },
    ]);
  }

  /** Decode `(address, string)` returndata from `getAgent()`. */
  async decodeGetAgent(returnData: string): Promise<Erc8004Agent> {
    return this.rpc.call<Erc8004Agent>('tenzro_erc8004DecodeGetAgent', [
      { return_data: returnData },
    ]);
  }

  // -----------------------------------------------------------------
  // Identity registry — v0.6+ mutators
  // -----------------------------------------------------------------

  /** ABI-encode `IdentityRegistry.setAgentURI(uint256 agentId, string metadataURI)`. */
  async encodeSetAgentURI(
    agentId: string,
    metadataUri: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeSetAgentURI', [
      { agent_id: agentId, metadata_uri: metadataUri },
    ]);
  }

  /** ABI-encode `IdentityRegistry.setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)`. */
  async encodeSetAgentWallet(
    agentId: string,
    newWallet: string,
    deadline: number,
    signature: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeSetAgentWallet',
      [
        {
          agent_id: agentId,
          new_wallet: newWallet,
          deadline,
          signature,
        },
      ],
    );
  }

  /** ABI-encode `IdentityRegistry.setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)`. */
  async encodeSetMetadata(
    agentId: string,
    metadataKey: string,
    metadataValue: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeSetMetadata', [
      {
        agent_id: agentId,
        metadata_key: metadataKey,
        metadata_value: metadataValue,
      },
    ]);
  }

  // -----------------------------------------------------------------
  // Identity registry — v0.6+ reads
  // -----------------------------------------------------------------

  /** ABI-encode `IdentityRegistry.getMetadata(uint256 agentId, string metadataKey)`. */
  async encodeGetMetadata(
    agentId: string,
    metadataKey: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeGetMetadata', [
      { agent_id: agentId, metadata_key: metadataKey },
    ]);
  }

  /** Decode `bytes` returndata from `getMetadata()`. */
  async decodeGetMetadata(returnData: string): Promise<Erc8004Metadata> {
    return this.rpc.call<Erc8004Metadata>('tenzro_erc8004DecodeGetMetadata', [
      { return_data: returnData },
    ]);
  }

  /** ABI-encode `IdentityRegistry.getAgentURI(uint256 agentId)`. */
  async encodeGetAgentURI(agentId: string): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeGetAgentURI', [
      { agent_id: agentId },
    ]);
  }

  /** ABI-encode `IdentityRegistry.getAgentWallet(uint256 agentId)`. */
  async encodeGetAgentWallet(agentId: string): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeGetAgentWallet',
      [{ agent_id: agentId }],
    );
  }

  // -----------------------------------------------------------------
  // Reputation registry
  // -----------------------------------------------------------------

  /** ABI-encode `ReputationRegistry.submitFeedback(bytes32 subjectAgentId, int8 rating, string contextURI)`. */
  async encodeFeedback(
    subjectAgentId: string,
    rating: number,
    contextUri: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeFeedback', [
      {
        subject_agent_id: subjectAgentId,
        rating,
        context_uri: contextUri,
      },
    ]);
  }

  /** ABI-encode `ReputationRegistry.getFeedback(bytes32 subject, uint256 index)`. */
  async encodeGetFeedback(
    subjectAgentId: string,
    index: number,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeGetFeedback', [
      { subject_agent_id: subjectAgentId, index },
    ]);
  }

  /** ABI-encode `ReputationRegistry.getFeedbackCount(bytes32 subject)`. */
  async encodeGetFeedbackCount(
    subjectAgentId: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeGetFeedbackCount',
      [{ subject_agent_id: subjectAgentId }],
    );
  }

  /** ABI-encode `ReputationRegistry.revokeFeedback(uint256 agentId, bytes32 feedbackId)` (v0.6+). */
  async encodeRevokeFeedback(
    agentId: string,
    feedbackId: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeRevokeFeedback',
      [{ agent_id: agentId, feedback_id: feedbackId }],
    );
  }

  /** ABI-encode `ReputationRegistry.appendResponse(uint256 agentId, bytes32 feedbackId, string responseURI)` (v0.6+). */
  async encodeAppendResponse(
    agentId: string,
    feedbackId: string,
    responseUri: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeAppendResponse',
      [
        {
          agent_id: agentId,
          feedback_id: feedbackId,
          response_uri: responseUri,
        },
      ],
    );
  }

  /** ABI-encode `ReputationRegistry.isFeedbackRevoked(uint256 agentId, bytes32 feedbackId)` (v0.6+). */
  async encodeIsFeedbackRevoked(
    agentId: string,
    feedbackId: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeIsFeedbackRevoked',
      [{ agent_id: agentId, feedback_id: feedbackId }],
    );
  }

  /** ABI-encode `ReputationRegistry.getFeedbackResponses(uint256 agentId, bytes32 feedbackId)` (v0.6+). */
  async encodeGetFeedbackResponses(
    agentId: string,
    feedbackId: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeGetFeedbackResponses',
      [{ agent_id: agentId, feedback_id: feedbackId }],
    );
  }

  // -----------------------------------------------------------------
  // Validation registry
  // -----------------------------------------------------------------

  /** ABI-encode `ValidationRegistry.validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash)`. */
  async encodeValidationRequest(
    validatorAddress: string,
    agentId: string,
    requestUri: string,
    requestHash: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeValidationRequest',
      [
        {
          validator_address: validatorAddress,
          agent_id: agentId,
          request_uri: requestUri,
          request_hash: requestHash,
        },
      ],
    );
  }

  /** ABI-encode `ValidationRegistry.validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)`. `response` is a 0-100 quality score. */
  async encodeValidationResponse(
    requestHash: string,
    response: number,
    responseUri: string,
    responseHash: string,
    tag: string,
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeValidationResponse',
      [
        {
          request_hash: requestHash,
          response,
          response_uri: responseUri,
          response_hash: responseHash,
          tag,
        },
      ],
    );
  }

  /** ABI-encode `ValidationRegistry.getValidation(bytes32 requestHash)`. */
  async encodeGetValidation(requestHash: string): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeGetValidation',
      [{ request_hash: requestHash }],
    );
  }
}
