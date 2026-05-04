# Tenzro Network TypeScript SDK - API Reference

Complete API reference for the Tenzro Network TypeScript SDK.

## Table of Contents

- [TenzroClient](#tenzroclient)
- [WalletClient](#walletclient)
- [InferenceClient](#inferenceclient)
- [SettlementClient](#settlementclient)
- [PaymentClient](#paymentclient)
- [Ap2Client](#ap2client)
- [AgentPaymentClient](#agentpaymentclient)
- [NanopaymentClient](#nanopaymentclient)
- [BridgeClient](#bridgeclient)
- [Erc7802Client](#erc7802client)
- [CircuitBreakerClient](#circuitbreakerclient)
- [AgentClient](#agentclient)
- [IdentityClient](#identityclient)
- [GovernanceClient](#governanceclient)
- [StakingClient](#stakingclient)
- [TokenClient](#tokenclient)
- [ContractClient](#contractclient)
- [CantonClient](#cantonclient)
- [TaskClient](#taskclient)
- [MarketplaceClient](#marketplaceclient)
- [SkillClient](#skillclient)
- [ToolClient](#toolclient)
- [ProviderClient](#providerclient)
- [Types](#types)
- [Configuration](#configuration)
- [RPC Client](#rpc-client)

---

## TenzroClient

Main client for interacting with Tenzro Network.

### Constructor

```typescript
static async connect(config: SdkConfig): Promise<TenzroClient>
```

Connects to Tenzro Network.

**Parameters:**
- `config`: SDK configuration (endpoint, timeout, etc.)

**Returns:** Connected client instance

**Example:**
```typescript
const client = await TenzroClient.connect(LOCAL_CONFIG);
```

### Chain Methods

#### blockNumber()
```typescript
async blockNumber(): Promise<number>
```

Gets the current block number.

#### getBlock(height)
```typescript
async getBlock(height: BlockHeight): Promise<Block>
```

Gets a block by height.

#### getLatestBlock()
```typescript
async getLatestBlock(): Promise<Block>
```

Gets the most recent block.

#### getTransaction(hash)
```typescript
async getTransaction(hash: Hash): Promise<Transaction | null>
```

Gets a transaction by hash. Resolves from finalized storage first, then falls
back to the consensus mempool. The returned object's `status` field is
`"pending"` while the transaction is in-mempool and `"finalized"` once it has
been included in a block — callers polling immediately after broadcast can
distinguish "not yet finalized" from "unknown hash" (the call returns `null`
only when the hash is unknown to both storage and mempool).

#### getTransactionReceipt(hash)
```typescript
async getTransactionReceipt(hash: Hash): Promise<Receipt>
```

Gets the receipt for a transaction.

#### getBalance(address, asset?)
```typescript
async getBalance(address: Address, asset?: AssetId): Promise<string>
```

Gets balance for an address and asset.

#### sendTransaction(tx)
```typescript
async sendTransaction(tx: Partial<Transaction>): Promise<string>
```

Sends a transaction to the network.

#### nodeInfo()
```typescript
async nodeInfo(): Promise<NodeInfo>
```

Gets information about the connected node.

#### networkInfo()
```typescript
async networkInfo(): Promise<NetworkInfo>
```

Gets network statistics and information.

### Sub-Client Getters

#### wallet(address?)
```typescript
wallet(address?: Address): WalletClient
```

Gets or creates a wallet client instance.

#### inference(walletAddress?)
```typescript
inference(walletAddress?: Address): InferenceClient
```

Gets or creates an inference client instance.

#### settlement(walletAddress?)
```typescript
settlement(walletAddress?: Address): SettlementClient
```

Gets or creates a settlement client instance.

#### agent(walletAddress?)
```typescript
agent(walletAddress?: Address): AgentClient
```

Gets or creates an agent client instance.

#### governance(walletAddress?)
```typescript
governance(walletAddress?: Address): GovernanceClient
```

Gets or creates a governance client instance.

### Utility Methods

#### waitForTransaction(hash, confirmations?, timeout?)
```typescript
async waitForTransaction(
  hash: Hash,
  confirmations?: number,
  timeout?: number
): Promise<Receipt>
```

Waits for a transaction to be confirmed.

**Parameters:**
- `hash`: Transaction hash
- `confirmations`: Number of confirmations (default: 1)
- `timeout`: Timeout in milliseconds (default: 60000)

#### subscribeToBlocks(callback, pollInterval?)
```typescript
subscribeToBlocks(
  callback: (block: Block) => void,
  pollInterval?: number
): () => void
```

Subscribes to new blocks.

**Returns:** Unsubscribe function

---

## WalletClient

Manages wallets and transaction signing.

### Methods

#### createWallet()
```typescript
async createWallet(): Promise<WalletInfo>
```

Provisions a chain-agnostic 2-of-3 Ed25519 MPC wallet. Tenzro wallets are not
per-chain — a single wallet projects into EVM, SVM, and Canton via the
pointer-token model, so there is no `chain` parameter. Use
`client.token.crossVmTransfer` / `client.token.wrapTnzo` for VM-specific
operations, and the bridge clients (`client.bridge`, `client.debridge`,
`client.wormhole`, `client.lifi`) for sends to external chains.

#### importWallet(privateKey)
```typescript
async importWallet(privateKey: string): Promise<WalletInfo>
```

Imports a wallet from a private key.

#### importFromMnemonic(mnemonic, derivationPath?)
```typescript
async importFromMnemonic(
  mnemonic: string,
  derivationPath?: string
): Promise<WalletInfo>
```

Imports a wallet from a mnemonic phrase.

#### getAddress()
```typescript
getAddress(): Address
```

Gets the current wallet address.

#### getBalance(asset?)
```typescript
async getBalance(asset?: AssetId): Promise<WalletBalance>
```

Gets wallet balance for an asset or all assets.

#### send(to, amount, asset?)
```typescript
async send(
  to: Address,
  amount: string,
  asset?: AssetId
): Promise<string>
```

Sends tokens to another address. Default asset is TNZO.

#### signMessage(message)
```typescript
async signMessage(message: string): Promise<string>
```

Signs a message with the wallet's private key.

#### verifySignature(message, signature, address)
```typescript
async verifySignature(
  message: string,
  signature: string,
  address: Address
): Promise<boolean>
```

Verifies a message signature.

#### getTransactionHistory(limit?, offset?)
```typescript
async getTransactionHistory(
  limit?: number,
  offset?: number
): Promise<string[]>
```

Gets transaction history for the wallet.

#### getNonce()
```typescript
async getNonce(): Promise<number>
```

Gets the current nonce for the wallet.

---

## InferenceClient

Manages AI model inference operations.

### Methods

#### listModels(modality?)
```typescript
async listModels(modality?: string): Promise<ModelInfo[]>
```

Lists all available AI models.

#### getModel(modelId)
```typescript
async getModel(modelId: string): Promise<ModelInfo>
```

Gets information about a specific model.

#### request(modelId, input, params?)
```typescript
async request(
  modelId: string,
  input: string,
  params?: InferenceParams
): Promise<InferenceResponse>
```

Performs an inference request.

#### requestWithTee(modelId, input, params?)
```typescript
async requestWithTee(
  modelId: string,
  input: string,
  params?: InferenceParams
): Promise<InferenceResponse>
```

Performs inference with TEE for privacy.

#### streamRequest(modelId, input, params, onChunk)
```typescript
async streamRequest(
  modelId: string,
  input: string,
  params: InferenceParams,
  onChunk: (chunk: string) => void
): Promise<InferenceResponse>
```

Streams inference responses.

#### estimateCost(modelId, inputTokens, outputTokens?, useTee?)
```typescript
async estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens?: number,
  useTee?: boolean
): Promise<CostEstimate>
```

Estimates the cost of an inference request.

#### listProviders(modelId?)
```typescript
async listProviders(modelId?: string): Promise<InferenceProvider[]>
```

Lists inference providers.

#### registerProvider(name, models, teeEnabled?)
```typescript
async registerProvider(
  name: string,
  models: string[],
  teeEnabled?: boolean
): Promise<string>
```

Registers as an inference provider.

---

## SettlementClient

Manages payment settlement and escrow.

### Methods

#### settle(request)
```typescript
async settle(request: SettlementRequest): Promise<SettlementReceipt>
```

Settles a payment.

#### createSettlement(payee, amount, asset, serviceType, proof?, metadata?)
```typescript
async createSettlement(
  payee: Address,
  amount: string,
  asset: AssetId,
  serviceType: ServiceType,
  proof?: string,
  metadata?: Record<string, string>
): Promise<SettlementReceipt>
```

Creates a settlement for a service.

#### createEscrow(payer, payee, amount, asset, expiresAt, releaseConditions)
```typescript
async createEscrow(
  payer: string,
  payee: string,
  amount: bigint,
  asset: string,
  expiresAt: bigint,
  releaseConditions: string
): Promise<string>
```

Submits a `CreateEscrow` transaction (gas: 75,000) via
`tenzro_signAndSendTransaction`. Authentication is **ambient**: the bearer JWT
from `TENZRO_BEARER_JWT` and per-request DPoP proof from `TENZRO_DPOP_PROOF`
(set after onboarding via `client.auth`) are forwarded automatically. Signing
happens server-side against the holder's MPC wallet — no raw private key
crosses the SDK surface.

Funds are locked at a deterministically-derived vault address by the Native VM.
The `escrow_id` is derived as `SHA-256("tenzro/escrow/id/v1" || payer || nonce_le)`
and emitted in the receipt log. `releaseConditions` accepts: `"timeout"` |
`"provider"` | `"consumer"` | `"both"` | `"verifier"` | `"custom"`. Returns the
transaction hash.

#### releaseEscrow(payer, escrowId, proof?)
```typescript
async releaseEscrow(
  payer: string,
  escrowId: string,
  proof?: string
): Promise<string>
```

Submits a `ReleaseEscrow` transaction (gas: 60,000). Authentication is ambient
(see `createEscrow`). Only the original payer can submit — the VM rejects
releases from any other address. Returns the transaction hash.

#### refundEscrow(payer, escrowId)
```typescript
async refundEscrow(
  payer: string,
  escrowId: string
): Promise<string>
```

Submits a `RefundEscrow` transaction (gas: 50,000). Authentication is ambient
(see `createEscrow`). Only the original payer can submit, AND the escrow must
be expired (or use `Timeout`/`Custom` release conditions). Returns the
transaction hash.

#### getEscrow(escrowId)
```typescript
async getEscrow(escrowId: string): Promise<any>
```

Reads an escrow record by its 32-byte id (calls `tenzro_getEscrow`).

#### openPaymentChannel(payee, deposit, asset?, duration?)
```typescript
async openPaymentChannel(
  payee: Address,
  deposit: string,
  asset?: AssetId,
  duration?: number
): Promise<string>
```

Opens a payment channel.

#### closePaymentChannel(channelId, finalAmount, signature)
```typescript
async closePaymentChannel(
  channelId: string,
  finalAmount: string,
  signature: string
): Promise<SettlementReceipt>
```

Closes a payment channel.

#### batchSettle(settlements)
```typescript
async batchSettle(
  settlements: SettlementRequest[]
): Promise<SettlementReceipt[]>
```

Batch settles multiple payments.

---

## AgentClient

Manages AI agent registration and task delegation.

### Methods

#### registerAgent(config)
```typescript
async registerAgent(config: AgentConfig): Promise<AgentIdentity>
```

Registers a new AI agent.

#### getAgent(agentId)
```typescript
async getAgent(agentId: string): Promise<AgentIdentity>
```

Gets information about an agent.

#### updateAgent(agentId, config)
```typescript
async updateAgent(
  agentId: string,
  config: Partial<AgentConfig>
): Promise<string>
```

Updates an agent's configuration.

#### deregisterAgent(agentId)
```typescript
async deregisterAgent(agentId: string): Promise<string>
```

Deregisters an agent.

#### sendMessage(agentId, message)
```typescript
async sendMessage(
  agentId: string,
  message: Omit<AgentMessage, "messageId" | "timestamp" | "from">
): Promise<string>
```

Sends a message to an agent.

#### listAgents(capability?, limit?, offset?)
```typescript
async listAgents(
  capability?: string,
  limit?: number,
  offset?: number
): Promise<AgentIdentity[]>
```

Lists all registered agents.

#### delegateTask(agentId, task)
```typescript
async delegateTask(
  agentId: string,
  task: TaskRequest
): Promise<string>
```

Delegates a task to an agent.

#### getTaskStatus(taskId)
```typescript
async getTaskStatus(taskId: string): Promise<TaskStatus>
```

Gets the status of a delegated task.

#### stakeOnAgent(agentId, amount)
```typescript
async stakeOnAgent(agentId: string, amount: string): Promise<string>
```

Stakes tokens on an agent.

---

## GovernanceClient

Manages network governance operations.

### Methods

#### listProposals(status?, limit?, offset?)
```typescript
async listProposals(
  status?: ProposalStatus,
  limit?: number,
  offset?: number
): Promise<GovernanceProposal[]>
```

Lists all governance proposals.

#### getProposal(proposalId)
```typescript
async getProposal(proposalId: string): Promise<GovernanceProposal>
```

Gets a specific proposal.

#### createProposal(title, description, proposalType, votingPeriod?)
```typescript
async createProposal(
  title: string,
  description: string,
  proposalType: string,
  votingPeriod?: number
): Promise<string>
```

Creates a new governance proposal.

#### vote(proposalId, voteType, votingPower?)
```typescript
async vote(
  proposalId: string,
  voteType: VoteType,
  votingPower?: string
): Promise<string>
```

Votes on a proposal.

#### getVotingPower(address?)
```typescript
async getVotingPower(address?: Address): Promise<string>
```

Gets voting power for an address.

#### delegateVotingPower(delegatee, amount)
```typescript
async delegateVotingPower(
  delegatee: Address,
  amount: string
): Promise<string>
```

Delegates voting power to another address.

#### getDelegations(address?)
```typescript
async getDelegations(address?: Address): Promise<DelegationInfo>
```

Gets delegation information.

---

## Types

### Core Types

- `Address` - Blockchain address (string)
- `Hash` - Hash value (string)
- `BlockHeight` - Block height (number)
- `Timestamp` - Unix timestamp in milliseconds (number)
- `ChainId` - Chain identifier (string)
- `AssetId` - Asset identifier (string)

### Blockchain Types

- `Block` - Block containing transactions
- `BlockHeader` - Block header information
- `Transaction` - Transaction on the network
- `NodeInfo` - Node information

### AI/Inference Types

- `ModelInfo` - AI model information
- `ModelModality` - Model modality enum
- `InferenceRequest` - Inference request
- `InferenceResponse` - Inference response
- `InferenceProvider` - Provider information
- `InferenceParams` - Inference parameters
- `CostEstimate` - Cost estimate

### Settlement Types

- `SettlementRequest` - Settlement request
- `SettlementReceipt` - Settlement receipt
- `ServiceType` - Service type enum

### Agent Types

- `AgentIdentity` - Agent identity
- `AgentConfig` - Agent configuration
- `AgentMessage` - Agent message
- `TaskRequest` - Task request
- `Capability` - Agent capability enum

### Governance Types

- `GovernanceProposal` - Governance proposal
- `GovernanceVote` - Vote on a proposal
- `VoteType` - Vote type enum
- `ProposalStatus` - Proposal status enum

### Wallet Types

- `WalletInfo` - Wallet information
- `WalletBalance` - Balance information

---

## Configuration

### SdkConfig

```typescript
interface SdkConfig {
  endpoint: string;
  timeout?: number;
  maxRetries?: number;
  apiKey?: string;
  headers?: Record<string, string>;
  chainId?: string;
}
```

### Preset Configurations

- `MAINNET_CONFIG` - Mainnet configuration
- `TESTNET_CONFIG` - Testnet configuration
- `LOCAL_CONFIG` - Local development configuration

---

## RPC Client

Low-level JSON-RPC 2.0 client.

### RpcClient

```typescript
class RpcClient {
  constructor(config: SdkConfig);

  async call<T>(
    method: string,
    params?: unknown[] | Record<string, unknown>
  ): Promise<T>;

  async batch<T>(
    calls: Array<{ method: string; params?: unknown[] }>
  ): Promise<T[]>;
}
```

### RpcError

```typescript
class RpcError extends Error {
  constructor(code: number, message: string, data?: unknown);
  code: number;
  data?: unknown;
}
```

### RpcErrorCode

Standard JSON-RPC error codes:
- `ParseError` (-32700)
- `InvalidRequest` (-32600)
- `MethodNotFound` (-32601)
- `InvalidParams` (-32602)
- `InternalError` (-32603)
- `ServerError` (-32000)

---

## Ap2Client

AP2 (Agentic Payment Protocol) for autonomous agent-to-agent commerce.

### `createSession(agentDid, providerDid, service, maxAmount, asset?)`
Create an AP2 payment session with spending bounds.

### `authorizePayment(sessionId, amount)`
Authorize a payment within the session's spending policy.

### `executePayment(sessionId, authorizationId)`
Execute an authorized payment and trigger on-chain settlement.

### `cancelSession(sessionId)`
Cancel session and refund unspent deposit.

### `getSession(sessionId)`
Get session details including spend tracking.

### `listAgentSessions(agentDid)`
List all sessions for an agent.

---

## AgentPaymentClient

Agent transaction executor with spending policy enforcement.

### `setSpendingPolicy(agentDid, policy)`
Set spending policy with per-transaction limits, daily budgets, allowed recipients, and operations.

### `getSpendingPolicy(agentDid)`
Get current spending policy for an agent.

### `payForService(agentDid, provider, amount, serviceType)`
Pay for a service — enforced by the agent's spending policy.

### `getDailySpend(agentDid)`
Get daily spend tracking (total spent, remaining budget, reset time).

### `listAgentTransactions(agentDid, limit?)`
List agent transaction history.

---

## NanopaymentClient

Off-chain nanopayment channels with batched on-chain settlement.

### `openChannel(payer, payee, deposit, asset?)`
Open a nanopayment channel with an initial deposit.

### `sendNanopayment(channelId, amount, memo?)`
Send an off-chain nanopayment (instant, zero gas).

### `flushBatch(channelId)`
Settle accumulated batch on-chain (1 transaction for N payments).

### `closeChannel(channelId)`
Close channel and settle final balances.

### `getChannel(channelId)`
Get channel info (deposit, spent, pending batch).

### `listChannels(address)`
List all channels for an address.

---

## BridgeClient

Cross-chain bridge operations via LayerZero, Chainlink CCIP, deBridge, and Canton.

### `bridgeTokens(fromChain, toChain, token, amount, recipient, adapter?)`
Bridge tokens between chains. Adapter is auto-selected if omitted.

### `getRoutes(fromChain, toChain, token?)`
Get available bridge routes with fees and estimated times.

### `listAdapters()`
List registered bridge adapters and their supported chains.

### `getTransferStatus(transferId)`
Track cross-chain transfer status and confirmations.

### `estimateFee(fromChain, toChain, token, amount)`
Estimate bridge fee in native token and USD.

---

## Erc7802Client

ERC-7802 (SuperchainERC20) cross-chain token mint/burn interface.

### `crosschainMint(token, recipient, amount, sourceChain)`
Mint tokens from cross-chain transfer (called by bridge adapter).

### `crosschainBurn(token, from, amount, targetChain)`
Burn tokens for cross-chain transfer.

### `getCrossChainSupply(token)`
Get cross-chain supply breakdown by chain.

---

## CircuitBreakerClient

Provider health monitoring with automatic fallback.

### `getProviderHealth(providerId)`
Get provider health state, failure count, success count.

### `listCircuitBreakers()`
List all circuit breaker statuses.

### `configureBreaker(providerId, config)`
Configure failure threshold, recovery timeout, and half-open max calls.

### `resetBreaker(providerId)`
Force-reset breaker to closed (healthy) state.

---

## StakingClient

### `stake(amount, role, providerType?)`
Stake TNZO tokens as Validator, ModelProvider, or TeeProvider.

### `unstake(amount)`
Unstake TNZO (initiates 7-day unbonding period).

### `registerProvider(providerType, config?)`
Register as a provider with optional initial stake.

### `getProviderStats()`
Get provider statistics (models served, inferences, staking totals).

### `getStakingBalance(address)`
Get staking balance, pending rewards, and delegation info.

### `getRewards(address)`
Get accumulated staking rewards.

### `getUnbonding(address)`
Get unbonding entries with completion times.

---

## TokenClient

### `createToken(name, symbol, decimals, initialSupply, creator)`
Create ERC-20 token via factory, registered across all VMs.

### `getTokenInfo(query)`
Lookup token by symbol, EVM address, or token ID.

### `listTokens(vmFilter?)`
List registered tokens with optional VM type filter.

### `getTokenBalance(address)`
Get TNZO balance across all VMs with decimal conversion.

### `crossVmTransfer(token, amount, sourceVm, targetVm, sender, recipient)`
Atomic cross-VM token transfer (pointer model, no bridge).

### `wrapTnzo(amount, targetVm)`
Wrap native TNZO to VM representation (no-op in pointer model).

---

## ContractClient

### `deploy(bytecode, vmType, constructorArgs?, gasLimit?)`
Deploy smart contract to EVM, SVM, or DAML.

### `getContract(address)`
Get deployed contract information.

---

## IdentityClient

### `registerHuman(displayName)`
Register a human identity via TDIP.

### `registerMachine(controllerDid, capabilities)`
Register a machine identity under a controller.

### `resolve(did)`
Resolve DID to identity information.

### `resolveDidDocument(did)`
Get W3C DID Document.

### `listIdentities()`
List all registered identities.

### `addCredential(did, credential)`
Add verifiable credential to identity.

### `addService(did, service)`
Add service endpoint to DID Document.

---

## CantonClient

### `listDomains()`
List Canton synchronizer domains.

### `listContracts(templateId?)`
List DAML contracts.

### `submitCommand(command)`
Submit DAML command.

### `getEvents(contractId)`
Get events for a contract.

---

## ProviderClient

### `participate()`
One-click network join (provisions identity, wallet, hardware profile).

### `detectHardware()`
Detect TEE hardware capabilities.

### `serveModel(modelId, config?)`
Start serving a model.

### `stopModel(modelId)`
Stop serving a model.

### `chat(modelId, messages)`
Chat with a served model.

### `downloadModel(modelId)`
Download model from registry.

### `getDownloadProgress(modelId)`
Get download progress.
