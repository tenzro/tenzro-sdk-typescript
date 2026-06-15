// Primitive types
export type Hash = string; // Hex-encoded hash
export type Address = string; // Base58-encoded address
export type Signature = string; // Hex-encoded signature
export type BlockHeight = number;
export type Nonce = number;
export type Timestamp = number;
export type ChainId = number;

// Account types
export interface AccountInfo {
  address: Address;
  public_key: string;
  private_key: string;
  key_type: "ed25519" | "secp256k1";
}

// Wallet types
export interface WalletInfo {
  wallet_id: string;
  address: Address;
  public_key: string;
  key_type: "ed25519" | "secp256k1";
  threshold: number;
  total_shares: number;
}

export enum WalletType {
  Standard = "Standard",
  MultiSig = "MultiSig",
  Agent = "Agent",
  Contract = "Contract",
}

// Model availability — where the model can be used from
export type ModelAvailability = "local" | "downloaded" | "downloadable" | "network";

// Model pricing info (TNZO per token)
export interface ModelPricing {
  inputPerToken: number;
  outputPerToken: number;
  currency: string;
}

// Model types
export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  modality: ModelModality;
  parameters: ModelParameters;
  provider: string;
  status: ModelStatus;
  availability?: ModelAvailability;
  pricing?: ModelPricing;
  pricingConfig: PricingConfig;
  metadata?: Record<string, string>;
}

export interface ModelLoadInfo {
  active_requests: number;
  max_concurrent: number;
  utilization_percent: number;
  load_level: string;
}

export interface ModelEndpoint {
  model_name: string;
  model_id: string;
  instance_id: string;
  api_endpoint: string;
  mcp_endpoint: string;
  location: string;
  provider_name: string;
  status: string;
  availability?: ModelAvailability;
  pricing?: ModelPricing;
  load?: ModelLoadInfo;
}

export enum ModelModality {
  Text = "Text",
  Image = "Image",
  Audio = "Audio",
  Video = "Video",
  Multimodal = "Multimodal",
}

export interface ModelParameters {
  maxTokens: number;
  contextWindow: number;
  temperature: number;
  topP: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export enum ModelStatus {
  Active = "Active",
  Inactive = "Inactive",
  Deprecated = "Deprecated",
  Maintenance = "Maintenance",
}

// Inference types
export interface InferenceRequest {
  id: string;
  modelId: string;
  input: string;
  parameters: InferenceParameters;
  requester: Address;
  maxPrice: string;
  requireTee: boolean;
  metadata?: InferenceMetadata;
  createdAt: Timestamp;
}

export interface InferenceResponse {
  id: string;
  requestId: string;
  output: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: string;
  latencyMs: number;
  metadata?: InferenceMetadata;
  completedAt: Timestamp;
}

export interface InferenceResult {
  request_id: string;
  output: string;
  model: string;
  tokens_used: number;
  cost: string;
  latency_ms: number;
}

export interface InferenceParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface InferenceMetadata {
  teeAttestation?: string;
  proofOfInference?: string;
  zkProof?: string;
  [key: string]: string | undefined;
}

// Pricing types
export interface PricingConfig {
  model: PricingModel;
  basePrice: string;
  pricePerToken: string;
  currency: string;
  discounts?: Record<string, string>;
}

export enum PricingModel {
  PerToken = "PerToken",
  PerRequest = "PerRequest",
  Subscription = "Subscription",
  PayAsYouGo = "PayAsYouGo",
}

// Provider types
export interface InferenceProvider {
  id: string;
  address: Address;
  name: string;
  models: string[];
  capacity: ProviderCapacity;
  status: ProviderStatus;
  reputation: number;
  totalInferences: number;
  pricingConfig: PricingConfig;
  teeEnabled: boolean;
  metadata?: Record<string, string>;
}

export interface ProviderCapacity {
  totalGpu: number;
  availableGpu: number;
  maxConcurrentRequests: number;
  currentLoad: number;
}

export enum ProviderStatus {
  Online = "Online",
  Offline = "Offline",
  Busy = "Busy",
  Maintenance = "Maintenance",
}

// Settlement types
export interface SettlementParams {
  request_id: string;
  provider: Address;
  customer: Address;
  amount: string;
}

export interface SettlementRequest {
  id: string;
  serviceType: ServiceType;
  payer: Address;
  payee: Address;
  amount: string;
  assetId: string;
  paymentIntent: PaymentIntent;
  serviceProof?: string;
  escrowId?: string;
  metadata?: Record<string, string>;
  createdAt: Timestamp;
}

export interface SettlementReceipt {
  id: string;
  requestId: string;
  status: SettlementStatus;
  txHash?: Hash;
  blockHeight?: BlockHeight;
  finalizedAt?: Timestamp;
  fee: string;
  metadata?: Record<string, string>;
}

export enum SettlementStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Finalized = "Finalized",
  Failed = "Failed",
  Refunded = "Refunded",
}

export enum ServiceType {
  Inference = "Inference",
  Storage = "Storage",
  Compute = "Compute",
  DataAccess = "DataAccess",
  AgentService = "AgentService",
}

export enum PaymentIntent {
  Immediate = "Immediate",
  Escrow = "Escrow",
  Streaming = "Streaming",
  Deferred = "Deferred",
}

export interface ServiceProof {
  proofType: string;
  proofData: string;
  signature: Signature;
  timestamp: Timestamp;
}

// Agent types
export interface AgentIdentity {
  id: string;
  address: Address;
  name: string;
  agentType: string;
  capabilities: Capability[];
  reputation: number;
  owner: Address;
  config: AgentConfig;
  createdAt: Timestamp;
}

export interface AgentConfig {
  maxConcurrentTasks: number;
  allowedServices: ServiceType[];
  budget: string;
  trustThreshold: number;
  metadata?: Record<string, string>;
}

export interface AgentMessage {
  id: string;
  from: Address;
  to: Address;
  messageType: AgentMessageType;
  payload: string;
  signature: Signature;
  timestamp: Timestamp;
}

export enum AgentMessageType {
  Request = "Request",
  Response = "Response",
  Notification = "Notification",
  Command = "Command",
}

export interface Capability {
  name: string;
  version: string;
  description: string;
  parameters?: Record<string, string>;
}

/**
 * Mirrors the JSON shape returned by `tenzro_registerAgent`. The `byok`
 * flag distinguishes the two registration modes — when `true`,
 * `classical_public_key` and `pq_verifying_key_len` are absent because
 * the keys are caller-held.
 */
export interface RegisterAgentResponse {
  agent_id: string;
  name: string;
  creator: string;
  wallet_address: string;
  capabilities: number;
  status: string;
  created_at: string;
  tenzro_did: string;
  registration_fee: string;
  /** Hex-encoded 32-byte Ed25519 verifying key. Provisioner mode only. */
  classical_public_key?: string;
  /** Length of the ML-DSA-65 verifying key (1952 in production). Provisioner mode only. */
  pq_verifying_key_len?: number;
  /**
   * `true` for self-custodial (BYOK) registrations where the caller
   * supplied both the classical and PQ public keys; `false` for the
   * node-provisioned hybrid wallet path.
   */
  byok: boolean;
}

/**
 * Mirrors the JSON shape returned by `tenzro_sendAgentMessage`.
 */
export interface AgentMessageResponse {
  message_id: string;
  from: string;
  to: string;
  status: string;
  /** Unix-millis timestamp the server stamped on the constructed message. */
  timestamp: number;
  /**
   * `true` when the server attached both signature legs to the
   * message; `false` when accepted unsigned (only possible on
   * `enable_signing == false` routers).
   */
  signed: boolean;
}

export interface DelegateTaskResponse {
  id: string;
  status: string;
}

export interface SpawnAgentResponse {
  agent_id: string;
  parent_id: string;
  name: string;
}

export interface RunAgentTaskResponse {
  agent_id: string;
  result: string;
}

export interface CreateSwarmResponse {
  swarm_id: string;
  orchestrator_id: string;
}

export interface SwarmMemberInfo {
  agent_id: string;
  role: string;
  status: string;
  result?: string;
}

export interface SwarmStatus {
  swarm_id: string;
  orchestrator_id: string;
  status: string;
  member_count: number;
  members: SwarmMemberInfo[];
}

export interface TerminateSwarmResponse {
  swarm_id: string;
  status: string;
}

// Governance types
export interface GovernanceProposal {
  id: string;
  proposer: Address;
  title: string;
  description: string;
  proposalType: ProposalType;
  status: ProposalStatus;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  quorum: string;
  threshold: string;
  executionData?: string;
  createdAt: Timestamp;
  votingEndsAt: Timestamp;
  executedAt?: Timestamp;
}

export interface GovernanceVote {
  proposalId: string;
  voter: Address;
  voteType: VoteType;
  votingPower: string;
  justification?: string;
  timestamp: Timestamp;
}

export enum VoteType {
  For = "For",
  Against = "Against",
  Abstain = "Abstain",
}

export enum ProposalType {
  ParameterChange = "ParameterChange",
  ProtocolUpgrade = "ProtocolUpgrade",
  TreasurySpend = "TreasurySpend",
  EmergencyAction = "EmergencyAction",
}

export enum ProposalStatus {
  Active = "Active",
  Passed = "Passed",
  Rejected = "Rejected",
  Executed = "Executed",
  Cancelled = "Cancelled",
}

export interface VoteReceipt {
  vote_id: string;
  proposal_id: string;
  status: string;
}

export interface VotingPower {
  address: Address;
  power: string;
  delegated_to?: Address;
}

// Bridge types
export interface BridgeMessage {
  id: string;
  sourceChain: ChainId;
  targetChain: ChainId;
  protocol: BridgeProtocol;
  payload: string;
  sender: Address;
  recipient: Address;
  status: string;
  createdAt: Timestamp;
}

export interface BridgeTransfer {
  id: string;
  sourceChain: ChainId;
  targetChain: ChainId;
  assetId: string;
  amount: string;
  sender: Address;
  recipient: Address;
  status: string;
  txHash: Hash;
  bridgeFee: string;
  completedAt?: Timestamp;
}

export enum BridgeProtocol {
  Native = "Native",
  IBC = "IBC",
  LayerZero = "LayerZero",
  ChainlinkCCIP = "ChainlinkCCIP",
  DeBridge = "DeBridge",
  Canton = "Canton",
}

// Blockchain types
export interface Block {
  header: BlockHeader;
  transactions: Transaction[];
  hash: Hash;
}

/**
 * Paginated block range response from `tenzro_getBlockRange`.
 *
 * Each block summary is a free-form object (height, hash, prev_hash,
 * state_root, tx_root, timestamp millis, proposer, tx_count, gas_used,
 * gas_limit). `nextHeight` and `moreAvailable` drive pagination: a sync
 * loop keeps requesting until `moreAvailable` is false. `moreAvailable`
 * reflects whether the chain has further blocks beyond `nextHeight`,
 * independent of the requested `endHeight`, so it is safe to step over
 * pruning gaps.
 */
export interface BlockRange {
  blocks: Record<string, unknown>[];
  nextHeight: BlockHeight;
  moreAvailable: boolean;
  localTip: BlockHeight;
}

export interface BlockHeader {
  height: BlockHeight;
  timestamp: Timestamp;
  previousHash: Hash;
  stateRoot: Hash;
  txRoot: Hash;
  proposer: Address;
  signature: Signature;
  chainId: ChainId;
  /**
   * EIP-1559 base fee per gas in wei (hex-encoded). `null` for pre-fee-market
   * blocks. Use `eth_feeHistory` for time-series base-fee modeling.
   */
  baseFeePerGas?: string | null;
}

/**
 * EIP-1559 fee-history payload from `eth_feeHistory`.
 *
 * `baseFeePerGas` has length `blockCount + 1` — the trailing entry is the
 * predicted base fee for the next block, suitable as the floor of a Type-2
 * transaction's `maxFeePerGas`. `reward[i][j]` is the j-th requested
 * percentile of priority tips paid in block `oldestBlock + i`; absent when
 * no percentiles were requested.
 */
export interface FeeHistory {
  oldestBlock: string;
  baseFeePerGas: string[];
  gasUsedRatio: number[];
  reward?: string[][];
}

export interface Transaction {
  hash: Hash;
  txType: TransactionType;
  from: Address;
  to?: Address;
  amount: string;
  fee: string;
  nonce: Nonce;
  data?: string;
  signature: Signature;
  blockHeight?: BlockHeight;
  timestamp: Timestamp;
}

export enum TransactionType {
  Transfer = "Transfer",
  InferenceRequest = "InferenceRequest",
  Settlement = "Settlement",
  AgentRegistration = "AgentRegistration",
  GovernanceVote = "GovernanceVote",
  ContractDeploy = "ContractDeploy",
  ContractCall = "ContractCall",
}

// Account types
export interface Account {
  address: Address;
  balance: string;
  nonce: Nonce;
  state: AccountState;
  createdAt: Timestamp;
}

export interface AccountState {
  storageRoot: Hash;
  codeHash?: Hash;
  metadata?: Record<string, string>;
}

// Network types
export interface NetworkInfo {
  chainId: ChainId;
  blockHeight: BlockHeight;
  peers: number;
  version: string;
  networkName: string;
  genesisHash: Hash;
}

export interface PeerInfo {
  id: string;
  address: string;
  version: string;
  connectedAt: Timestamp;
  latency: number;
}

export interface NodeInfo {
  nodeId: string;
  version: string;
  networkInfo: NetworkInfo;
  peers: PeerInfo[];
  uptime: number;
}

export interface NodeStatus {
  node_state: string;
  role: string;
  health: string;
  block_height: number;
  peer_count: number;
  uptime_secs: number;
}

export interface FaucetResponse {
  success: boolean;
  tx_hash?: string;
  amount: string;
  message: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  verification_service: string;
}

/**
 * Snapshot of libp2p network metrics exposed by `tenzro_getNetworkStats`.
 *
 * Counter fields are monotonically-increasing totals since process start.
 * Gauge fields (`peers_connected`, `kad_routing_table_size`,
 * `gossipsub_mesh_size`) are instantaneous values.
 */
export interface NetworkStats {
  /** `false` when the network service has not been initialized. */
  available: boolean;
  /** Set when `available` is `false`. */
  reason?: string;
  events_dropped?: number;
  dials_rejected_per_ip?: number;
  dials_rejected_global?: number;
  gossip_rejected_validator_only?: number;
  gossip_rejected_invalid?: number;
  gossip_rejected_duplicate?: number;
  gossip_published?: number;
  gossip_accepted?: number;
  connections_established?: number;
  connections_inbound_total?: number;
  connections_outbound_total?: number;
  peers_banned?: number;
  peers_connected?: number;
  kad_routing_table_size?: number;
  gossipsub_mesh_size?: number;
  /**
   * Counter incremented on every observed remote-multiaddr change for an
   * already-known peer (QUIC path migration, mobile network switch, NAT rebinding).
   */
  peer_address_migrations_total?: number;
}

export interface VerificationResponse {
  valid: boolean;
  details?: string;
  verified_at?: Timestamp;
}

// Identity types (TDIP — Tenzro Decentralized Identity Protocol)
// Supports both human and machine identities natively

export enum IdentityType {
  Human = "Human",
  Machine = "Machine",
}

export interface IdentityInfo {
  did: string;
  status: string;
  display_name: string;
  is_human: boolean;
  is_machine: boolean;
  key_count: number;
  credential_count: number;
  service_count: number;
  public_keys: Array<{ key_id: string; key_type: string; public_key: string }>;
  credentials: Array<{ credential_type: string; issuer: string; subject: string; issued_at: string }>;
  services: Array<{ id: string; service_type: string; endpoint: string }>;
  metadata: Record<string, unknown>;
}

export interface DidDocument {
  "@context": string[];
  id: string;
  controller?: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod: string[];
  keyAgreement: string[];
  service: DidService[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: Record<string, unknown>;
}

export interface DidService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

// MicroNode types (zero-install full network participants)

export interface MicroNodeCapabilities {
  inference: boolean;
  payments: boolean;
  agent_collaboration: boolean;
  mcp_tools: boolean;
  task_execution: boolean;
  chain_query: boolean;
  smart_contracts: boolean;
  tee_services: boolean;
  bridge: boolean;
  governance: boolean;
}

export interface MicroNodeNetworkEndpoints {
  rpc: string;
  mcp: string;
  a2a: string;
}

export interface JoinAsMicroNodeResponse {
  identity: {
    did: string;
    identity_type: string;
    display_name: string;
    status: string;
  };
  wallet: {
    wallet_id: string;
    address: string;
    public_key: string;
  };
  capabilities: MicroNodeCapabilities;
  origin: string;
  participant_type: string;
  role: string;
  network: MicroNodeNetworkEndpoints;
  message: string;
}

// Payment types (MPP / x402)

export interface PaymentChallenge {
  challengeId: string;
  protocol: string;
  resource: string;
  amount: number;
  asset: string;
  recipient?: string;
}

export interface PaymentReceipt {
  receiptId: string;
  protocol: string;
  amount: number;
  asset: string;
  sessionId?: string;
  payerDid?: string;
  recipientDid?: string;
  timestamp?: Timestamp;
}

export interface PaymentSessionInfo {
  sessionId: string;
  protocol: string;
  resource: string;
  totalSpent: number;
  asset: string;
  active: boolean;
}

export interface GatewayInfo {
  status: string;
  protocols: string[];
  supportedAssets: string[];
}

/**
 * Description of a single x402 scheme backend registered on the node.
 *
 * Returned as an element of {@link X402SchemeRegistry.schemes}. Use
 * {@link X402SchemeDescriptor.id} as the value of `extra.scheme` in an x402
 * PaymentRequirement.
 */
export interface X402SchemeDescriptor {
  /** Scheme id (e.g. `tenzro-hybrid`, `exact-eip3009`, `permit2`, `erc7710`). */
  id: string;
  /** Human-readable description of the scheme's verification path. */
  description: string;
}

/**
 * Snapshot of the x402 scheme registry currently wired into the node.
 *
 * Returned by `PaymentClient.listX402Schemes()`. The `default` field is the
 * scheme used when no `extra.scheme` is set on the PaymentRequirement.
 */
export interface X402SchemeRegistry {
  /** Default scheme id when `extra.scheme` is absent. */
  default: string;
  /** All schemes registered on this node. */
  schemes: X402SchemeDescriptor[];
  /** Total number of registered schemes. */
  count: number;
}

// ─── Task Marketplace ──────────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'disputed';

export type TaskType = 'inference' | 'code_review' | 'data_analysis' | 'content_generation' | 'agent_execution' | 'translation' | 'research' | string;

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskInfo {
  task_id: string;
  title: string;
  description: string;
  task_type: TaskType;
  poster: string;
  assignee?: string;
  max_price: string;
  quoted_price?: string;
  status: TaskStatus;
  created_at: number;
  deadline?: number;
  required_model?: string;
  preferred_model_id?: string;
  input: string;
  output?: string;
  priority: TaskPriority;
  metadata: Record<string, string>;
  tx_hash?: string;
}

export interface TaskQuote {
  task_id: string;
  provider: string;
  price: string;
  estimated_duration_secs: number;
  model_id: string;
  confidence: number;
  expires_at: number;
  notes?: string;
}

export interface TaskFilter {
  task_type?: TaskType;
  status?: TaskStatus;
  poster?: string;
  assignee?: string;
  max_price?: string;
  required_model?: string;
  limit?: number;
  offset?: number;
}

export interface PostTaskParams {
  title: string;
  description: string;
  task_type: TaskType;
  max_price: string;
  input: string;
  /** Poster address (required by `tenzro_postTask` RPC handler). */
  poster: string;
  priority?: TaskPriority;
  deadline?: number;
  required_model?: string;
  preferred_model_id?: string;
}

// ─── Agent Marketplace ─────────────────────────────────────────────────────────

export type AgentTemplateStatus = 'published' | 'pending' | 'deprecated' | 'suspended';

export type AgentTemplateType = 'autonomous' | 'tool_agent' | 'orchestrator' | 'specialist' | 'multi_modal' | string;

export type AgentPricingModel =
  | { type: 'free' }
  | { type: 'per_execution'; price: string }
  | { type: 'per_token'; price_per_token: string }
  | { type: 'subscription'; monthly_rate: string }
  | { type: 'revenue_share'; creator_share_bps: number };

export interface AgentCapabilityDef {
  id: string;
  name: string;
  description: string;
  input_schema?: string;
  output_schema?: string;
}

export interface AgentRuntimeRequirements {
  min_model_size?: string;
  preferred_model_id?: string;
  required_mcp_tools: string[];
  required_permissions: string[];
  estimated_cost_per_run?: string;
  requires_tee: boolean;
}

export interface AgentExample {
  description: string;
  user_input: string;
  expected_output: string;
}

export interface AgentTemplate {
  template_id: string;
  name: string;
  description: string;
  template_type: AgentTemplateType;
  creator: string;
  version: string;
  status: AgentTemplateStatus;
  created_at: number;
  updated_at: number;
  capabilities: AgentCapabilityDef[];
  runtime_requirements: AgentRuntimeRequirements;
  pricing: AgentPricingModel;
  system_prompt: string;
  examples: AgentExample[];
  tags: string[];
  download_count: number;
  rating: number;
  content_hash?: string;
  docs_url?: string;
  metadata: Record<string, string>;
  /** Optional DID binding (`did:tenzro:...`) set at registration time. */
  creator_did?: string;
  /**
   * Creator payout wallet — **mandatory** for any non-free pricing; receives the
   * per-invocation fee minus the `AGENT_MARKETPLACE_COMMISSION_BPS` network commission.
   */
  creator_wallet?: string;
  /** Total successful invocations via `tenzro_runAgentTemplate`. */
  invocation_count?: number;
  /** Total TNZO revenue (pre-split) collected across all invocations, as u128 decimal string. */
  total_revenue?: string;
}

export interface AgentTemplateFilter {
  template_type?: AgentTemplateType;
  creator?: string;
  tag?: string;
  required_model?: string;
  free_only?: boolean;
  status?: AgentTemplateStatus;
  limit?: number;
  offset?: number;
}

/**
 * Compact pricing string form accepted by `tenzro_registerAgentTemplate`:
 * `"free"`, `"per_execution:<u128>"`, `"per_token:<u128>"`,
 * `"subscription:<u128>"`, or `"revenue_share:<bps>"`.
 */
export type AgentPricingSpec = string | AgentPricingModel;

export interface RegisterAgentTemplateParams {
  /**
   * Stable template id (e.g. reference templates use `ref-*` ids). When
   * omitted the node mints a UUID. Registration fails if the id already
   * exists — updates flow through `updateAgentTemplate`.
   */
  template_id?: string;
  name: string;
  description: string;
  template_type: AgentTemplateType;
  system_prompt: string;
  /** Hex-encoded (0x-prefixed) creator address. Required by the node. */
  creator: string;
  tags?: string[];
  /**
   * Pricing model. May be supplied either as the canonical object form
   * (`AgentPricingModel`) or as the compact string form (e.g.
   * `"per_execution:5000000000000000000"`).
   */
  pricing?: AgentPricingSpec;
  /** Optional DID binding set at registration time (immutable afterwards). */
  creator_did?: string;
  /**
   * Creator payout wallet. **Mandatory** for any non-free pricing — receives
   * the per-invocation fee minus the `AGENT_MARKETPLACE_COMMISSION_BPS` (5%)
   * network commission that flows to the treasury.
   */
  creator_wallet?: string;
}

export interface UpdateAgentTemplateParams {
  name?: string;
  description?: string;
  template_type?: AgentTemplateType;
  system_prompt?: string;
  tags?: string[];
  pricing?: AgentPricingModel;
  status?: AgentTemplateStatus;
}

// ─── AgentKit (spawn / run / download / update) ──────────────────────────────

export interface SpawnAgentTemplateResponse {
  agent_id: string;
  template_id: string;
  name: string;
  status: string;
}

export interface RunAgentTemplateParams {
  /** Spawned agent instance to invoke. */
  agent_id: string;
  /**
   * Payer wallet. **Mandatory** for any non-free template — charged the
   * per-invocation fee which is split 95/5 between creator and treasury
   * (`AGENT_MARKETPLACE_COMMISSION_BPS = 500`). May be omitted for free
   * templates.
   */
  payer_wallet?: string;
  /** Estimated tokens (used for per-token pricing calculations). */
  tokens_estimate?: number;
  /** Maximum iterations the spawned agent may run. */
  max_iterations?: number;
  /** When true, no fees are collected and no state changes are committed. */
  dry_run?: boolean;
}

export interface RunAgentTemplateReport {
  agent_id?: string;
  template_id: string;
  /** Number of agent steps that were executed. */
  steps_executed: number;
  /** Number of agent steps that failed. */
  steps_failed: number;
  /** Number of agent steps skipped because `dry_run` was true. */
  steps_skipped_by_dry_run: number;
  /** TNZO fee charged for this invocation (u128 decimal string). */
  fee_paid: string;
  /** Commission in basis points that flows to the treasury (typically 500 = 5%). */
  commission_bps: number;
  /** Portion of `fee_paid` routed to the treasury (u128 decimal string). */
  network_commission: string;
  /** Portion of `fee_paid` paid to `creator_wallet` (u128 decimal string). */
  creator_share: string;
  /** Payer wallet the fee was charged to. */
  payer_wallet?: string;
  /** Creator wallet that received `creator_share`. */
  creator_wallet?: string;
  /** Treasury address that received `network_commission`. */
  treasury?: string;
  /** Total successful invocations on this template after this run. */
  invocation_count: number;
  /** Total TNZO revenue (pre-split) on this template after this run. */
  total_revenue: string;
}

// ─── Skills Registry ─────────────────────────────────────────────────────────

export interface SkillInfo {
  skill_id: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  input_schema?: string;
  output_schema?: string;
  category?: string;
  creator_did?: string;
  tags?: string[];
  status: string;
  created_at?: number;
  updated_at?: number;
}

export interface RegisterSkillParams {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  input_schema?: string;
  output_schema?: string;
  category?: string;
  tags?: string[];
}

export interface UpdateSkillParams {
  name?: string;
  description?: string;
  version?: string;
  capabilities?: string[];
  input_schema?: string;
  output_schema?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export interface SkillFilter {
  category?: string;
  capability?: string;
  creator_did?: string;
  tag?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SkillExecutionResult {
  skill_id: string;
  output: string;
  status: string;
  duration_ms: number;
  metadata?: Record<string, string>;
}

// ─── Tool Registry ───────────────────────────────────────────────────────────

export interface ToolInfo {
  tool_id: string;
  name: string;
  description: string;
  version: string;
  tool_type?: string;
  input_schema?: string;
  output_schema?: string;
  category?: string;
  creator_did?: string;
  provider_id?: string;
  tags?: string[];
  status: string;
  created_at?: number;
  updated_at?: number;
}

export interface RegisterToolParams {
  name: string;
  description: string;
  version: string;
  tool_type?: string;
  input_schema?: string;
  output_schema?: string;
  category?: string;
  tags?: string[];
}

export interface UpdateToolParams {
  name?: string;
  description?: string;
  version?: string;
  tool_type?: string;
  input_schema?: string;
  output_schema?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export interface ToolFilter {
  tool_type?: string;
  category?: string;
  creator_did?: string;
  tag?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ToolExecutionResult {
  tool_id: string;
  output: string;
  status: string;
  duration_ms: number;
  metadata?: Record<string, string>;
}

// ─── Canton / DAML (Canton 3.5+ JSON Ledger API v2) ──────────────────────────
// Commands use /v2/commands/submit-and-wait-for-transaction
// Active contracts use /v2/state/active-contracts with identifierFilter
// Events use /v2/events/events-by-contract-id

export interface CantonDomain {
  /** Synchronizer / domain identifier */
  id: string;
  /** Human-readable domain name */
  name: string;
  /** Native settlement token for this domain */
  native_token: string;
  /** Expected finality time in seconds */
  finality_time_secs: number;
}

/** Response envelope from `tenzro_listCantonDomains`. */
export interface CantonDomainList {
  /** Whether Canton/DAML is enabled on this node */
  enabled: boolean;
  /** Configured synchronizer domains */
  domains: CantonDomain[];
  /** Optional human-readable status (present when `enabled` is false) */
  message?: string;
}

export interface DamlContract {
  contract_id: string;
  /** DAML template ID (e.g. "Tenzro.Workflow:WorkflowAnchor") */
  template_id: string;
  /** Contract payload (create arguments) */
  payload: Record<string, unknown>;
}

/**
 * Query parameters for `tenzro_listDamlContracts`.
 *
 * The Canton v2 active-contracts endpoint requires at least one template id —
 * pass them via `template_ids`. The optional `query` object is applied
 * client-side against `createArguments` as a structural filter.
 */
export interface ListDamlContractsParams {
  template_ids: string[];
  query?: Record<string, unknown>;
}

/** Response envelope from `tenzro_listDamlContracts`. */
export interface DamlContractsResponse {
  contracts: DamlContract[];
  /** Template ids echoed back for traceability */
  template_ids: string[];
  /** Structural filter echoed back for traceability */
  query: unknown;
}

/** Parameters for a DAML `create` command. */
export interface DamlCreateCommandParams {
  command_type: 'create';
  template_id: string;
  create_arguments: Record<string, unknown>;
  /**
   * Optional override for the party the command is submitted as.
   *
   * When omitted, the node resolves the party from the calling API
   * key's bound `canton_user_id` (`primaryParty`). Pass a fully-
   * qualified party id (`<hint>::<participant-hash>`) to pin the
   * command to a specific party — the node verifies the caller is
   * authorized on that party before forwarding to Canton.
   */
  act_as?: string;
}

/** Parameters for a DAML `exercise` command. */
export interface DamlExerciseCommandParams {
  command_type: 'exercise';
  template_id: string;
  contract_id: string;
  choice: string;
  choice_argument: Record<string, unknown>;
  /** Optional override for the party. See `DamlCreateCommandParams.act_as`. */
  act_as?: string;
}

export type DamlCommandParams =
  | DamlCreateCommandParams
  | DamlExerciseCommandParams;

export interface DamlCommandResult {
  /** "create" or "exercise" */
  command_type: string;
  /** DAML template ID the command was submitted against */
  template_id: string;
  /** Created contract ID (for create commands) */
  contract_id?: string;
  /** Contract payload returned by the participant (for create commands) */
  payload?: Record<string, unknown>;
  /** Choice name (for exercise commands) */
  choice?: string;
  /** Exercise result (for exercise commands) */
  exercise_result?: unknown;
  /** Ledger events produced by the command (for exercise commands) */
  events?: unknown;
}

// ─── Staking ─────────────────────────────────────────────────────────────────

export type StakingRole = 'validator' | 'model_provider' | 'tee_provider';

export interface StakeResult {
  tx_hash: string;
  amount: string;
  role: StakingRole;
  status: string;
}

export interface UnstakeResult {
  tx_hash: string;
  amount: string;
  status: string;
  unbonding_end?: number;
}

// ─── Task Marketplace (assign / complete) ────────────────────────────────────

export interface AssignTaskResult {
  task_id: string;
  status: string;
}

export interface TaskSettlement {
  final_price_wei?: string;
  remainder_wei?: string;
  agent_balance_wei?: string;
  poster_balance_wei?: string;
  skipped?: string;
}

export interface CompleteTaskResult {
  task_id: string;
  status: string;
  settlement?: TaskSettlement;
  tx_hash?: string;
}

// ─── AP2 Agentic Payment Protocol ──────────────────────────────────────────

/** An AP2 payment session between an agent and a provider. */
export interface Ap2Session {
  /** Unique session identifier */
  session_id: string;
  /** DID of the agent initiating payments */
  agent_did: string;
  /** DID of the service provider */
  provider_did: string;
  /** Service identifier */
  service: string;
  /** Maximum authorized amount for this session */
  max_amount: string;
  /** Asset used for payments (default: "TNZO") */
  asset: string;
  /** Total amount spent in this session */
  total_spent: string;
  /** Session status */
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  /** Session creation timestamp */
  created_at: Timestamp;
  /** Session expiry timestamp */
  expires_at?: Timestamp;
}

/** An authorization for a specific payment within an AP2 session. */
export interface Ap2Authorization {
  /** Unique authorization identifier */
  authorization_id: string;
  /** Session this authorization belongs to */
  session_id: string;
  /** Authorized amount */
  amount: string;
  /** Authorization status */
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  /** Timestamp of authorization */
  created_at: Timestamp;
}

/** Result of cancelling an AP2 session. */
export interface CancelResult {
  /** Session that was cancelled */
  session_id: string;
  /** Final status */
  status: string;
  /** Amount refunded, if any */
  refunded_amount?: string;
}

// ─── Bridge ────────────────────────────────────────────────────────────────

/** A route available for cross-chain bridging. */
export interface BridgeRoute {
  /** Source chain identifier */
  from_chain: string;
  /** Destination chain identifier */
  to_chain: string;
  /** Bridge adapter used */
  adapter: string;
  /** Estimated fee */
  estimated_fee: string;
  /** Estimated time in seconds */
  estimated_time_secs: number;
  /** Supported tokens on this route */
  supported_tokens: string[];
}

/** Information about a registered bridge adapter. */
export interface BridgeAdapter {
  /** Adapter identifier */
  adapter_id: string;
  /** Adapter name (e.g. "LayerZero", "CCIP") */
  name: string;
  /** Supported source chains */
  supported_chains: string[];
  /** Adapter status */
  status: string;
}

/** Fee estimate for a bridge transfer. */
export interface BridgeFee {
  /** Source chain */
  from_chain: string;
  /** Destination chain */
  to_chain: string;
  /** Token being bridged */
  token: string;
  /** Estimated fee in native token */
  native_fee: string;
  /** Estimated fee in USD */
  usd_fee?: string;
  /** Adapter used for the estimate */
  adapter: string;
}

/** Status of a bridge transfer. */
export interface TransferStatus {
  /** Transfer identifier */
  transfer_id: string;
  /** Current status */
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  /** Source chain transaction hash */
  source_tx_hash?: string;
  /** Destination chain transaction hash */
  destination_tx_hash?: string;
  /** Last updated timestamp */
  updated_at: Timestamp;
}

// ─── Agent Payments ────────────────────────────────────────────────────────

/** A spending policy for an agent. */
export interface SpendingPolicy {
  /** Agent DID this policy applies to */
  agent_did: string;
  /** Maximum amount per transaction */
  max_per_transaction: string;
  /** Maximum daily spend */
  max_daily_spend: string;
  /** Allowed service types */
  allowed_services: string[];
  /** Whether the policy is active */
  active: boolean;
}

/** Result of setting a spending policy. */
export interface PolicyResult {
  /** Agent DID */
  agent_did: string;
  /** Operation status */
  status: string;
}

/** Receipt for an agent-initiated payment. */
export interface AgentPaymentReceipt {
  /** Receipt identifier */
  receipt_id: string;
  /** Agent DID that initiated the payment */
  agent_did: string;
  /** Provider address */
  provider: string;
  /** Amount paid */
  amount: string;
  /** Service type */
  service_type: string;
  /** Transaction hash */
  tx_hash: string;
  /** Timestamp */
  timestamp: Timestamp;
}

/** Daily spend summary for an agent. */
export interface DailySpend {
  /** Agent DID */
  agent_did: string;
  /** Total spent today */
  total_spent: string;
  /** Daily limit */
  daily_limit: string;
  /** Remaining allowance */
  remaining: string;
  /** Number of transactions today */
  transaction_count: number;
}

/** A single agent transaction record. */
export interface AgentTransaction {
  /** Transaction identifier */
  tx_id: string;
  /** Agent DID */
  agent_did: string;
  /** Provider or recipient */
  recipient: string;
  /** Amount */
  amount: string;
  /** Service type */
  service_type: string;
  /** Transaction status */
  status: string;
  /** Timestamp */
  timestamp: Timestamp;
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────

/** Health information for a provider. */
export interface ProviderHealth {
  /** Provider identifier */
  provider_id: string;
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Success rate (0.0 - 1.0) */
  success_rate: number;
  /** Average latency in milliseconds */
  avg_latency_ms: number;
  /** Total requests served */
  total_requests: number;
  /** Number of failures */
  failure_count: number;
  /** Circuit breaker state */
  circuit_state: 'closed' | 'open' | 'half_open';
}

/** Status of a circuit breaker for a provider. */
export interface CircuitBreakerStatus {
  /** Provider identifier */
  provider_id: string;
  /** Current circuit state */
  state: 'closed' | 'open' | 'half_open';
  /** Number of consecutive failures */
  consecutive_failures: number;
  /** Failure threshold before opening */
  failure_threshold: number;
  /** Recovery timeout in seconds */
  recovery_timeout_secs: number;
  /** Last state change timestamp */
  last_state_change: Timestamp;
}

/** Configuration for a circuit breaker. */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failure_threshold: number;
  /** Seconds to wait before attempting recovery */
  recovery_timeout_secs: number;
  /** Success threshold to close from half-open */
  success_threshold?: number;
}

/** Result of configuring or resetting a circuit breaker. */
export interface ConfigResult {
  /** Provider identifier */
  provider_id: string;
  /** Operation status */
  status: string;
}

/** Result of resetting a circuit breaker. */
export interface ResetResult {
  /** Provider identifier */
  provider_id: string;
  /** New circuit state after reset */
  state: string;
  /** Operation status */
  status: string;
}

// ─── Nanopayment ───────────────────────────────────────────────────────────

/** Information about a nanopayment channel. */
export interface ChannelInfo {
  /** Channel identifier */
  channel_id: string;
  /** Payer address */
  payer: string;
  /** Payee address */
  payee: string;
  /** Initial deposit amount */
  deposit: string;
  /** Current balance remaining */
  balance: string;
  /** Total amount paid through this channel */
  total_paid: string;
  /** Asset used (default: "TNZO") */
  asset: string;
  /** Number of nanopayments sent */
  payment_count: number;
  /** Channel status */
  status: 'open' | 'closing' | 'closed' | 'disputed';
  /** Channel creation timestamp */
  created_at: Timestamp;
}

/** Receipt for a single nanopayment. */
export interface NanopaymentReceipt {
  /** Payment identifier */
  payment_id: string;
  /** Channel this payment was sent through */
  channel_id: string;
  /** Amount of this nanopayment */
  amount: string;
  /** Optional memo */
  memo?: string;
  /** Sequence number within the channel */
  sequence: number;
  /** Timestamp */
  timestamp: Timestamp;
}

/** Result of flushing a batch of nanopayments to on-chain settlement. */
export interface BatchSettlement {
  /** Channel identifier */
  channel_id: string;
  /** Number of payments in this batch */
  payment_count: number;
  /** Total amount settled */
  total_amount: string;
  /** On-chain transaction hash */
  tx_hash: string;
  /** Settlement status */
  status: string;
}

/** Result of closing a nanopayment channel. */
export interface CloseResult {
  /** Channel identifier */
  channel_id: string;
  /** Final settled amount */
  final_amount: string;
  /** Refunded deposit */
  refunded: string;
  /** Transaction hash */
  tx_hash: string;
  /** Status */
  status: string;
}

// ─── ERC-7802 Cross-Chain Token ────────────────────────────────────────────

/** Result of a cross-chain mint operation. */
export interface MintResult {
  /** Transaction hash */
  tx_hash: string;
  /** Token address */
  token: string;
  /** Recipient address */
  recipient: string;
  /** Minted amount */
  amount: string;
  /** Source chain that authorized the mint */
  source_chain: string;
  /** Status */
  status: string;
}

/** Result of a cross-chain burn operation. */
export interface BurnResult {
  /** Transaction hash */
  tx_hash: string;
  /** Token address */
  token: string;
  /** Address burned from */
  from: string;
  /** Burned amount */
  amount: string;
  /** Target chain where tokens will be minted */
  target_chain: string;
  /** Status */
  status: string;
}

/** Cross-chain supply information for a token. */
export interface CrossChainSupply {
  /** Token address */
  token: string;
  /** Total supply across all chains */
  total_supply: string;
  /** Per-chain supply breakdown */
  chain_supplies: Record<string, string>;
}

// ─── Gas Policy ────────────────────────────────────────────────────────────

/** Gas policy for an agent's on-chain operations. */
export interface GasPolicy {
  /** Policy type: "accept_any" or "pay_up_to" */
  type: 'accept_any' | 'pay_up_to';
  /** Maximum gas budget (only for "pay_up_to") */
  max_budget?: string;
}

// ─── Username ─────────────────────────────────────────────────────────────

/** Result of setting or resolving a username. */
export interface UsernameResult {
  /** The username */
  username: string;
  /** The DID associated with the username */
  did: string;
}

// ─── JSON Web Keys (RFC 7517 / RFC 9421 keyid resolution) ─────────────────

/**
 * JSON Web Key (RFC 7517 §4) as published by `tenzro_listAgentJwks` /
 * `tenzro_getAgentJwk`.
 *
 * Only the public-key half is ever published. Algorithm-dependent fields
 * (`x`, `y`, `n`, `e`, `crv`) are populated according to RFC 7518; unused
 * fields are omitted from the wire form.
 */
export interface Jwk {
  /** Key type — `OKP` (Ed25519), `EC` (P-256, P-384), `RSA`. */
  kty: string;
  /** Key ID — canonical form `<did>#<key_fragment>` for Tenzro keys. */
  kid?: string;
  /** JWA algorithm identifier (`EdDSA`, `ES256`, `ES384`, `PS256`, ...). */
  alg?: string;
  /** Curve identifier for `OKP` / `EC` keys (`Ed25519`, `P-256`, `P-384`). */
  crv?: string;
  /** Public-key use — typically `sig`. */
  use?: string;
  /** Permitted key operations (e.g., `["verify"]`). */
  key_ops?: string[];
  /** X coordinate (`OKP` raw key, `EC` x). */
  x?: string;
  /** Y coordinate (`EC` only). */
  y?: string;
  /** RSA modulus (`RSA` only). */
  n?: string;
  /** RSA public exponent (`RSA` only). */
  e?: string;
}

/**
 * JSON Web Key Set (RFC 7517 §5) — the wire format published at
 * `/.well-known/jwks.json` and returned from `tenzro_listAgentJwks`.
 */
export interface JwkSet {
  /** The set of published JWKs. */
  keys: Jwk[];
}

// ─── Skill Usage ──────────────────────────────────────────────────────────

/** Usage statistics for a skill. */
export interface SkillUsage {
  /** Skill identifier */
  skill_id: string;
  /** Total number of invocations */
  total_invocations: number;
  /** Timestamp of last usage (ISO 8601), or null if never used */
  last_used: string | null;
}

// ─── Tool Usage ───────────────────────────────────────────────────────────

/** Usage statistics for a tool. */
export interface ToolUsage {
  /** Tool identifier */
  tool_id: string;
  /** Total number of invocations */
  total_invocations: number;
  /** Timestamp of last usage (ISO 8601), or null if never used */
  last_used: string | null;
}

// ─── Agent Template Stats ─────────────────────────────────────────────────

/** Statistics for an agent template. */
export interface AgentTemplateStats {
  /** Template identifier */
  template_id: string;
  /** Total number of spawns */
  total_spawns: number;
  /** Average rating */
  average_rating: number;
  /** Total number of reviews */
  total_reviews: number;
  /** Total number of downloads */
  total_downloads: number;
}

// ─── Staking Extended ──────────────────────────────────────────────────────

/** Staking balance information. */
export interface StakingBalance {
  /** Address queried */
  address: Address;
  /** Total staked amount */
  staked: string;
  /** Available (unstaked) balance */
  available: string;
  /** Staking role */
  role?: string;
}

/** Staking rewards information. */
export interface StakingRewards {
  /** Address queried */
  address: Address;
  /** Pending (unclaimed) rewards */
  pending: string;
  /** Total claimed rewards to date */
  total_claimed: string;
  /** Current epoch */
  epoch: number;
}

/** An entry in the unbonding queue. */
export interface UnbondingEntry {
  /** Amount being unbonded */
  amount: string;
  /** Timestamp when unbonding completes */
  completion_time: Timestamp;
  /** Whether this entry is ready to withdraw */
  ready: boolean;
}
