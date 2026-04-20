import type { RpcClient } from './rpc';

/**
 * Deterministic agent id derived from owner + salt.
 */
export interface Erc8004AgentId {
  /** 32-byte agent id as 0x-prefixed hex. */
  agent_id: string;
  /** Owner address echoed back. */
  owner: string;
  /** Salt used to derive the id. */
  salt: string;
}

/**
 * Hex-encoded ABI calldata ready for eth_sendTransaction or eth_call.
 */
export interface Erc8004Calldata {
  /** 4-byte function selector as 0x-prefixed hex. */
  selector: string;
  /** Full hex-encoded calldata (selector + abi-encoded args). */
  calldata: string;
}

/**
 * Decoded agent record returned by `IdentityRegistry.getAgent()`.
 */
export interface Erc8004Agent {
  /** Off-chain registration data URI (e.g. IPFS, HTTPS). */
  registration_data_uri: string;
  /** Agent owner / controller address. */
  owner: string;
}

/**
 * Client for the ERC-8004 Trustless Agents Registry family of contracts
 * (IdentityRegistry, ReputationRegistry, ValidationRegistry).
 *
 * All encode methods return hex calldata that callers can sign and
 * broadcast through any EVM wallet. Decoding helpers round-trip
 * return data from `eth_call` into typed structs.
 */
export class Erc8004Client {
  constructor(private readonly rpc: RpcClient) {}

  /**
   * Derive a deterministic ERC-8004 agent id from owner + salt.
   *
   * Matches the on-chain
   * `keccak256(abi.encode("TENZRO_ERC8004_AGENT", owner, salt))`
   * computation used by IdentityRegistry.
   */
  async deriveAgentId(owner: string, salt: string): Promise<Erc8004AgentId> {
    return this.rpc.call<Erc8004AgentId>('tenzro_erc8004DeriveAgentId', [
      { owner, salt },
    ]);
  }

  /**
   * ABI-encode `IdentityRegistry.register(agentId, registrationDataURI, owner)`.
   */
  async encodeRegister(
    agentId: string,
    registrationDataUri: string,
    owner: string
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeRegister', [
      {
        agent_id: agentId,
        registration_data_uri: registrationDataUri,
        owner,
      },
    ]);
  }

  /**
   * ABI-encode `IdentityRegistry.getAgent(agentId)`.
   */
  async encodeGetAgent(agentId: string): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeGetAgent', [
      { agent_id: agentId },
    ]);
  }

  /**
   * Decode return data from a `getAgent()` eth_call into typed agent info.
   */
  async decodeGetAgent(returndata: string): Promise<Erc8004Agent> {
    return this.rpc.call<Erc8004Agent>('tenzro_erc8004DecodeGetAgent', [
      { returndata },
    ]);
  }

  /**
   * ABI-encode
   * `ReputationRegistry.submitFeedback(agentId, score, feedbackAuthId, feedbackURI)`.
   * `score` must be 0-100.
   */
  async encodeFeedback(
    agentId: string,
    score: number,
    feedbackAuthId: string,
    feedbackUri: string
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>('tenzro_erc8004EncodeFeedback', [
      {
        agent_id: agentId,
        score,
        feedback_auth_id: feedbackAuthId,
        feedback_uri: feedbackUri,
      },
    ]);
  }

  /**
   * ABI-encode
   * `ValidationRegistry.requestValidation(agentId, validatorId, requestURI, dataHash)`.
   */
  async encodeRequestValidation(
    agentId: string,
    validatorId: string,
    requestUri: string,
    dataHash: string
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeRequestValidation',
      [
        {
          agent_id: agentId,
          validator_id: validatorId,
          request_uri: requestUri,
          data_hash: dataHash,
        },
      ]
    );
  }

  /**
   * ABI-encode
   * `ValidationRegistry.submitValidation(dataHash, response, responseURI, tag)`.
   * `response` is a 0-100 quality score.
   */
  async encodeSubmitValidation(
    dataHash: string,
    response: number,
    responseUri: string,
    tag: string
  ): Promise<Erc8004Calldata> {
    return this.rpc.call<Erc8004Calldata>(
      'tenzro_erc8004EncodeSubmitValidation',
      [
        {
          data_hash: dataHash,
          response,
          response_uri: responseUri,
          tag,
        },
      ]
    );
  }
}
