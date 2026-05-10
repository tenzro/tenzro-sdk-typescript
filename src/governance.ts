import { RpcClient } from "./rpc";
import {
  GovernanceProposal,
  VoteType,
  VoteReceipt,
  VotingPower,
} from "./types";

/**
 * Client for on-chain governance operations.
 * Supports proposal creation, voting, and delegation.
 */
export class GovernanceClient {
  constructor(private rpc: RpcClient) {}

  /**
   * List governance proposals.
   * @param status - Optional filter by proposal status
   * @returns Array of governance proposals
   */
  async listProposals(status?: string): Promise<GovernanceProposal[]> {
    return this.rpc.call<GovernanceProposal[]>("tenzro_listProposals", [
      status,
    ]);
  }

  /**
   * Get details of a specific proposal.
   * @param proposalId - The proposal identifier
   * @returns Proposal details
   */
  async getProposal(proposalId: string): Promise<GovernanceProposal> {
    return this.rpc.call<GovernanceProposal>("tenzro_getProposal", [
      { proposal_id: proposalId },
    ]);
  }

  /**
   * Create a new governance proposal.
   * @param params - Proposal parameters
   * @returns Created proposal
   */
  async createProposal(params: {
    title: string;
    description: string;
    proposalType: string;
    executionData?: string;
  }): Promise<GovernanceProposal> {
    return this.rpc.call<GovernanceProposal>("tenzro_createProposal", [params]);
  }

  /**
   * Vote on a governance proposal.
   * @param proposalId - The proposal to vote on
   * @param voteType - "For", "Against", or "Abstain"
   * @param justification - Optional justification for the vote
   * @returns Vote receipt
   */
  async vote(
    proposalId: string,
    voteType: VoteType,
    justification?: string
  ): Promise<VoteReceipt> {
    return this.rpc.call<VoteReceipt>("tenzro_vote", [
      proposalId,
      voteType,
      justification,
    ]);
  }

  /**
   * Get voting power for an address.
   * @param address - The address to query
   * @returns Voting power information
   */
  async getVotingPower(address: string): Promise<VotingPower> {
    return this.rpc.call<VotingPower>("tenzro_getVotingPower", [{ address }]);
  }

  /**
   * Delegate voting power to another address.
   * @param delegate - Address to delegate to
   * @param amount - Amount of voting power to delegate
   * @returns Transaction hash
   */
  async delegateVotingPower(delegate: string, amount: string): Promise<string> {
    return this.rpc.call<string>("tenzro_delegateVotingPower", [
      delegate,
      amount,
    ]);
  }
}
