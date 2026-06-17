// Main client
export { TenzroClient } from "./client";

// App client (developer-funded app pattern / paymaster)
export { AppClient } from "./app";

// Sub-clients
export { ApiKeyClient } from "./api-key";
export type {
  ApiKeyList,
  ApiKeyRecord,
  CreateApiKeyParams,
  CreatedApiKey,
  KeyClass,
  MyApiKeyList,
  RevokeApiKeyResult,
} from "./api-key";
export { AuthClient } from "./auth";
export { WalletClient } from "./wallet";
export { PasskeyRpcClient } from "./passkey-rpc";
export type {
  EnrollPasskeyParams,
  EnrollPasskeyResponse,
  SignWithPasskeyParams,
  SignWithPasskeyResponse,
  AddGuardianParams,
  AddGuardianResponse,
  InitiateRecoveryParams,
  InitiateRecoveryResponse,
  SubmitRecoverySignatureParams,
  SubmitRecoverySignatureResponse,
  FinalizeRecoveryParams,
  FinalizeRecoveryResponse,
  GrantSessionKeyParams,
  GrantSessionKeyResponse,
  RevokeSessionKeyParams,
  RevokeSessionKeyResponse,
  SetSpendingLimitParams,
  SetSpendingLimitResponse,
  AddHardwareSignerParams,
  AddHardwareSignerResponse,
  HardwareDeviceKind,
  SmartAccountSummary,
  ListSmartAccountsResponse,
  PendingRecoverySummary,
  ListPendingRecoveriesResponse,
  InstalledValidatorSummary,
} from "./passkey-rpc";
export { InferenceClient } from "./inference";
export { CortexClient } from "./cortex";
export { SettlementClient } from "./settlement";
export { AgentClient } from "./agent";
export { GovernanceClient } from "./governance";
export { IdentityClient } from "./identity";
export { PaymentClient } from "./payment";
export { ProviderClient } from "./provider";
export { TaskClient } from "./task";
export { MarketplaceClient } from "./marketplace";
export { SkillClient } from "./skill";
export { ToolClient } from "./tool";
export { CantonClient } from "./canton";
export { CantonAgentClient } from "./canton-agent";
export type {
  Mandate,
  SubmitWithMandateParams,
  MandateBoundReceipt,
  WatchPartySnapshot,
  AggregateAnalytics,
  AnalyticsBucket,
} from "./canton-agent";
export {
  ResourcesClient,
  KnowledgeClient,
  McpHostClient,
} from "./resources-and-mcp";
export type {
  ResourceFilter,
  ResourceDescriptor,
  UseResourceParams,
  SpawnChildAgentParams,
  SpawnChildAgentResponse,
  KnowledgeKind,
  RegisterKnowledgeParams,
  KnowledgeFilter,
  KnowledgeInfo,
  UseKnowledgeParams,
  KnowledgeInvocationResult,
  UpstreamAuth,
  StdioSpawnSpec,
  StoreSecretResponse,
  ForgetSecretResponse,
  EvictSubprocessResponse,
} from "./resources-and-mcp";
export { StakingClient } from "./staking";
export { TokenClient } from "./token";
export { ContractClient } from "./contract";
export { CryptoClient } from "./crypto";
export { CustodyClient } from "./custody";
export {
  Erc7579ModuleType,
  RecoveryError,
  SignerError,
  StorageError,
  ValidatorError,
} from "./signer";
export type {
  GuardianSignature,
  KeyId,
  KeyStorage,
  PackedUserOperation,
  RecoveryErrorKind,
  RecoveryGuardian,
  RecoveryProposal,
  SignContext,
  SignerSignature,
  Signer,
  SignerErrorKind,
  SignerKind,
  StorageCapabilities,
  StorageErrorKind,
  StoragePolicy,
  TeeBackend,
  TxHash,
  Validator,
  ValidatorErrorKind,
} from "./signer";
export {
  BrowserWebAuthnAuthenticator,
  SoftwareP256Authenticator,
  WebAuthnSigner,
  WebAuthnValidator,
  createPasskeyWallet,
  defaultAuthenticator,
  developmentConfig,
  productionConfig,
  signWithPasskey,
} from "./passkey";
export type {
  AuthenticatorAssertion,
  AuthenticatorRegistration,
  CrossDeviceLink,
  PasskeyConfig,
  PasskeyCredential,
  PasskeyWallet,
  PlatformAuthenticator,
  ResolvedPasskeyConfig,
} from "./passkey";
export { TeeClient } from "./tee";
export { ZkClient } from "./zk";
export { StreamingClient } from "./streaming";
export { Ap2Client } from "./ap2";
export { BridgeClient } from "./bridge";
export { AgentPaymentClient } from "./agent-payments";
export { CircuitBreakerClient } from "./circuit-breaker";
export { NanopaymentClient } from "./nanopayment";
export { Eip7702Client } from "./eip7702";
export type {
  Eip7702SigningHash,
  Eip7702Designator,
  Eip7702ParsedDesignator,
  Eip7702ProtocolInfo,
} from "./eip7702";
export { Erc7683Client } from "./erc7683";
export { Erc7802Client } from "./erc7802";
export { Erc8004Client } from "./erc8004";
export { Permit2Client } from "./permit2";
export type {
  Permit2DomainSeparator,
  Permit2DigestRequest,
  Permit2Digest,
  Permit2VerifyAndConsumeRequest,
  Permit2VerifyAndConsumeResult,
  Permit2NonceUsed,
} from "./permit2";
export { SecureMintClient } from "./secure-mint";
export type {
  SecureMintPolicy,
  SecureMintSetResult,
  SecureMintGetResult,
  SecureMintClearResult,
  SecureMintCheck,
  SecureMintApply,
  SecureMintBurn,
} from "./secure-mint";

export { UrwaClient } from "./urwa";
export type {
  UrwaKillSwitchState,
  UrwaFrozenAmount,
  UrwaSetFrozenRequest,
  UrwaFrozenRecord,
  UrwaTriggerKillSwitchRequest,
  UrwaKillSwitchTriggered,
  UrwaKillSwitchCleared,
} from "./urwa";

export { Ivms101Client } from "./ivms101";
export type { Ivms101HashResult } from "./ivms101";

export { AttestedClockClient } from "./attested-clock";
export type { AttestedTimestampEnvelope } from "./attested-clock";

export { SignedAgentCardClient } from "./signed-agent-card";
export type { SignedAgentCardHash } from "./signed-agent-card";

export { WormholeNttClient } from "./wormhole-ntt";
export type { WormholeNttChain, WormholeNttChains } from "./wormhole-ntt";

export { BridgeFeeClient } from "./bridge-fee";
export type {
  QuoteBridgeFeeRequest,
  QuoteBridgeFeeResponse,
  BridgeSponsorshipPool,
  BridgeSponsorshipPools,
} from "./bridge-fee";
export { HyperlaneClient } from "./hyperlane";
export type {
  HyperlaneChain,
  HyperlaneDispatchRequest,
  HyperlaneDispatchQuote,
  HyperlaneDispatchResult,
  HyperlaneMessage,
} from "./hyperlane";
export { AxelarClient } from "./axelar";
export type {
  AxelarChain,
  AxelarCallContractRequest,
  AxelarCallContractResult,
  AxelarPayGasRequest,
  AxelarPayGasResult,
  AxelarMessage,
} from "./axelar";
export { BabylonClient } from "./babylon";
export type {
  RegisterFinalityProviderRequest,
  FinalityProvider,
  BabylonTotalStake,
  SubmitFinalitySignatureRequest,
  BtcDelegation,
} from "./babylon";
export { CaipClient } from "./caip";
export type { Caip2Info, Caip10Info, Caip19Request, Caip19Info } from "./caip";

export { DiscoveryClient } from "./discovery";
export type { SiwtBuildPayload } from "./discovery";

// Pure helpers for the submitted `tenzro` CASA namespace — parsing,
// validation, and constants. Safe to use without an RPC round-trip.
export {
  TENZRO_CAIP2_NAMESPACE,
  TENZRO_SLIP44_COIN_INDEX,
  isTenzroCaip2,
  buildTenzroCaip2,
  parseTenzroCaip2,
  isTenzroCaip10,
  parseTenzroCaip19,
} from "./caip-helpers";
export type { CaipAssetNamespace } from "./caip-helpers";

// Pure helpers for the submitted did:tenzro DID method.
export {
  parseTenzroDid,
  isTenzroDid,
  buildHumanDid,
  buildAutonomousMachineDid,
  buildDelegatedMachineDid,
} from "./did-tenzro-helpers";
export type { TenzroDidClass, ParsedTenzroDid } from "./did-tenzro-helpers";

// Tenzro A2A protocol extension constants + extraction helper.
export {
  TENZRO_A2A_EXTENSION_NAMESPACE,
  TENZRO_A2A_DID_KEY,
  TENZRO_A2A_SIG_KEY,
  TENZRO_A2A_PUBKEY_KEY,
  TENZRO_A2A_DELEGATION_KEY,
  TENZRO_A2A_MANDATE_REF_KEY,
  TENZRO_A2A_RECEIPT_REF_KEY,
  extractTenzroA2aExtension,
} from "./a2a-extension";
export type { TenzroA2aExtension } from "./a2a-extension";

export { WormholeClient } from "./wormhole";
export { CcipClient } from "./ccip";
export type {
  CcipTokenAmount,
  CcipFeeQuote,
  CcipSendEnvelope,
  CcipExecutionState,
  CcipTransferResult,
} from "./ccip";
export { IrohClient } from "./iroh";
export { CctClient } from "./cct";
export { NftClient } from "./nft";
export { ComplianceClient } from "./compliance";
export { EventsClient } from "./events";
export { DebridgeClient } from "./debridge";
export { BondClient } from "./bond";
export type { ControllerBonds } from "./bond";
export { InsuranceClient } from "./insurance";
export type {
  FileClaimParams,
  InsurancePool,
  ClaimList,
} from "./insurance";
export { AdaptiveBurnClient } from "./adaptive-burn";
export { SeedAgentClient } from "./seed-agent";
export { QuotaClient } from "./quota";
export { PrincipalChainClient } from "./principal-chain";
export { LifecycleClient } from "./lifecycle";
export { MultimodalClient } from "./multimodal";
export type {
  ForecastCatalogEntry,
  LoadForecastModelParams,
  ForecastParams,
  VisionCatalogEntry,
  LoadVisionModelParams,
  ImageEmbedParams,
  ImageEmbedResult,
  ImageTextSimilarityResult,
  TextEmbeddingCatalogEntry,
  TextEmbedParams,
  SegmentationCatalogEntry,
  SegmentPrompt,
  SegmentParams,
  DetectionCatalogEntry,
  DetectParams,
  Detection,
  AudioCatalogEntry,
  AudioFamily,
  WhisperVariant,
  LoadAudioModelParams,
  TranscribeParams,
  VideoCatalogEntry,
  VideoEmbedParams,
  LoadedModelsList,
  LoadModelResult,
  UnloadModelResult,
} from "./multimodal";
export { MemoryClient } from "./memory";
export type {
  MemoryKind,
  MemorySource,
  MemorySearchMode,
  MemoryRecord,
  RecallResult,
  ListMemoryResult,
  MemoryGrantParams,
  MemoryRecallParams,
} from "./memory";
export { ValidatorClient } from "./validator";
export type {
  ValidatorStatus,
  ValidatorRegistryEntry,
  ListValidatorsResult,
} from "./validator";
export { SlaClient } from "./sla";
export type {
  SlaProbeIssued,
  SlaOutstandingProbe,
  SlaOutstandingProbes,
  SlaParams,
} from "./sla";
export { SnapshotClient } from "./snapshot";
export type {
  SnapshotSummary,
  SnapshotList,
  SnapshotManifest,
  SnapshotChunk,
  SnapshotOfferAccepted,
  SnapshotChunkApplied,
} from "./snapshot";
export { TrainingInspectionClient, TrainingClient } from "./training";
export type { ConfidentialEnrollment } from "./training";
export type {
  TrainingRunStatus,
  TrainingRun,
  TrainingReceipt,
  SealedDatasetManifest,
  SealedShardEnvelope,
  ListTrainingRunsResult,
} from "./training";
export { CapitalClient } from "./capital";
export type {
  CapitalSide,
  AssetWeight,
  CapitalObjective,
  CapitalConstraints,
  CapitalComplianceReq,
  CapitalAuthorization,
  CapitalSettlementReq,
  CapitalIntent,
  CapitalQuote,
  CapitalLeg,
  ReserveSource,
  ReserveAttestation,
} from "./capital";
export { WorkflowClient } from "./workflow";
export type {
  WorkflowStatus,
  SagaStepStatus,
  SagaStep,
  SagaWorkflow,
  WorkflowPayload,
  DidEnvelope,
} from "./workflow";

// SVM Cross-VM (native program) instruction builders
export {
  TENZRO_CROSS_VM_PROGRAM_ID,
  TENZRO_CROSS_VM_PROGRAM_ID_BASE58,
  TENZRO_CROSS_VM_PROGRAM_ID_HEX,
  PROGRAM_ID_DERIVATION_DOMAIN,
  CROSS_VM_DISCRIMINATORS,
  CROSS_VM_PAYLOAD_SIZE,
  VM_TYPE,
  encodeBridgeToEvm,
  encodeBridgeFromEvm,
  encodeRegisterTokenPointer,
  encodeTransferCrossVm,
  decodeCrossVmInstruction,
} from "./svm-cross-vm";
export type {
  VmType,
  BridgeToEvmArgs,
  BridgeFromEvmArgs,
  RegisterTokenPointerArgs,
  TransferCrossVmArgs,
  CrossVmInstruction,
} from "./svm-cross-vm";

// Configuration
export {
  TenzroConfig,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  LOCAL_CONFIG,
} from "./config";

// RPC
export { RpcClient, RpcCallError, Eip1193Transport } from "./rpc";
export type { RpcTransport } from "./rpc";

// EIP-6963 injected-provider discovery (used by TenzroClient.fromInjected)
export {
  discoverEip6963Provider,
  TenzroNotInstalledError,
  TENZRO_PROVIDER_RDNS,
} from "./eip6963";
export type {
  EIP1193Provider,
  EIP6963ProviderInfo,
  EIP6963ProviderDetail,
} from "./eip6963";

// Types
export type {
  MicroNodeCapabilities,
  MicroNodeNetworkEndpoints,
  JoinAsMicroNodeResponse,
} from "./types";

export type {
  Hash,
  Address,
  Signature,
  BlockHeight,
  Nonce,
  Timestamp,
  ChainId,
  AccountInfo,
  WalletInfo,
  WalletType,
  ModelInfo,
  ModelModality,
  ModelParameters,
  ModelStatus,
  InferenceRequest,
  InferenceResponse,
  InferenceResult,
  InferenceParameters,
  InferenceMetadata,
  InferenceProvider,
  ProviderCapacity,
  ProviderStatus,
  PricingConfig,
  PricingModel,
  SettlementParams,
  SettlementRequest,
  SettlementReceipt,
  SettlementStatus,
  ServiceType,
  PaymentIntent,
  ServiceProof,
  AgentIdentity,
  AgentConfig,
  AgentMessage,
  AgentMessageType,
  Capability,
  RegisterAgentResponse,
  AgentMessageResponse,
  DelegateTaskResponse,
  SpawnAgentResponse,
  RunAgentTaskResponse,
  CreateSwarmResponse,
  SwarmMemberInfo,
  SwarmStatus,
  TerminateSwarmResponse,
  GovernanceProposal,
  GovernanceVote,
  VoteType,
  ProposalType,
  ProposalStatus,
  VoteReceipt,
  VotingPower,
  BridgeMessage,
  BridgeTransfer,
  BridgeProtocol,
  Block,
  BlockHeader,
  BlockRange,
  FeeHistory,
  Transaction,
  TransactionType,
  Account,
  AccountState,
  NetworkInfo,
  NodeInfo,
  NodeStatus,
  PeerInfo,
  FaucetResponse,
  HealthResponse,
  VerificationResponse,
  IdentityInfo,
  IdentityType,
  DidDocument,
  VerificationMethod,
  DidService,
  PaymentChallenge,
  PaymentReceipt,
  PaymentSessionInfo,
  GatewayInfo,
  X402SchemeDescriptor,
  X402SchemeRegistry,
  ModelLoadInfo,
  ModelEndpoint,
  UsernameResult,
  Jwk,
  JwkSet,
} from "./types";

// Provider types
export type {
  ParticipateResponse,
  ProviderStats,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  DownloadProgress,
  HardwareProfile,
} from "./provider";

// Task marketplace types
export type {
  TaskInfo,
  TaskStatus,
  TaskType,
  TaskPriority,
  TaskQuote,
  TaskFilter,
  PostTaskParams,
} from "./types";

// Agent marketplace types
export type {
  AgentTemplate,
  AgentTemplateStatus,
  AgentTemplateType,
  AgentPricingModel,
  AgentPricingSpec,
  AgentCapabilityDef,
  AgentRuntimeRequirements,
  AgentExample,
  AgentTemplateFilter,
  RegisterAgentTemplateParams,
  UpdateAgentTemplateParams,
  AgentTemplateStats,
} from "./types";

// AgentKit types
export type {
  SpawnAgentTemplateResponse,
  RunAgentTemplateParams,
  RunAgentTemplateReport,
} from "./types";

// Skills registry types
export type {
  SkillInfo,
  SkillFilter,
  RegisterSkillParams,
  UpdateSkillParams,
  SkillExecutionResult,
  SkillUsage,
} from "./types";

// Tool registry types
export type {
  ToolInfo,
  ToolFilter,
  RegisterToolParams,
  UpdateToolParams,
  ToolExecutionResult,
  ToolUsage,
} from "./types";

// Canton / DAML types
export type {
  CantonDomain,
  CantonDomainList,
  DamlContract,
  DamlContractsResponse,
  ListDamlContractsParams,
  DamlCommandParams,
  DamlCreateCommandParams,
  DamlExerciseCommandParams,
  DamlCommandResult,
} from "./types";

// Staking types
export type {
  StakingRole,
  StakeResult,
  UnstakeResult,
  StakingBalance,
  StakingRewards,
  UnbondingEntry,
} from "./types";

// AP2 types
export type {
  Ap2Session,
  Ap2Authorization,
  CancelResult,
} from "./types";

// AP2 mandate verification types
export type {
  Ap2MandateVerification,
  Ap2MandatePairValidation,
  Ap2ProtocolInfo,
} from "./ap2";

// ERC-8004 types
export type {
  Erc8004AgentId,
  Erc8004Calldata,
  Erc8004Agent,
  Erc8004Metadata,
} from "./erc8004";

// Wormhole types
export type {
  WormholeChainId,
  WormholeVaaId,
  WormholeTransferResult,
} from "./wormhole";

// ERC-7683 types
export type {
  Erc7683Output,
  Erc7683OrderList,
} from "./erc7683";

// Iroh types
export type {
  IrohInfo,
  IrohEndpointId,
  IrohAlpnEntry,
  IrohAlpnList,
  IrohPublishResult,
} from "./iroh";

// CCT (Chainlink Cross-Chain Token) types
export type {
  CctPool,
  CctPoolList,
} from "./cct";

// Bridge types (extended)
export type {
  BridgeRoute,
  BridgeAdapter,
  BridgeFee,
  TransferStatus,
} from "./types";

// Agent payment types
export type {
  SpendingPolicy,
  PolicyResult,
  AgentPaymentReceipt,
  DailySpend,
  AgentTransaction,
} from "./types";

// Circuit breaker types
export type {
  ProviderHealth,
  CircuitBreakerStatus,
  CircuitBreakerConfig,
  ConfigResult,
  ResetResult,
} from "./types";

// Nanopayment types
export type {
  ChannelInfo,
  NanopaymentReceipt,
  BatchSettlement,
  CloseResult,
} from "./types";

// ERC-7802 types
export type {
  MintResult,
  BurnResult,
  CrossChainSupply,
} from "./types";

// Gas policy types
export type {
  GasPolicy,
} from "./types";

// Task marketplace additional types
export type {
  AssignTaskResult,
  CompleteTaskResult,
} from "./types";

// NFT types
export type {
  CollectionInfo,
  NftMintResult,
  NftInfo,
  NftTransferResult,
  NftPointerResult,
} from "./nft";

// Compliance types
export type {
  ComplianceRules,
  ComplianceResult,
  FreezeResult,
} from "./compliance";

// Events types
export type {
  BlockchainEvent,
  GetEventsParams,
  Subscription,
  WebhookRegistration,
  WebhookList,
  WebhookDeletion,
  UnsubscribeResult,
} from "./events";

// deBridge types
export type {
  DebridgeChain,
  DebridgeToken,
  DebridgeOrder,
  DebridgeSwapResult,
  DebridgeInstructions,
} from "./debridge";

// Token registry types
export type {
  CreateTokenParams,
  GetTokenInfoParams,
  ListTokensParams,
  CrossVmTransferParams,
  TokenInfo,
  TokenListResult,
  TokenBalance,
  NativeBalance,
  EvmBalance,
  SvmBalance,
  DamlBalance,
  WrapResult,
  TransferResult,
} from "./token";

// Token constants
export { WTNZO_EVM_ADDRESS } from "./token";

// Contract deployment types
export type {
  DeployContractParams,
  DeployResult,
  CallResult,
} from "./contract";

// App client types (developer-funded app pattern / paymaster)
export type {
  MasterWallet,
  UserWallet,
  FundResult as AppFundResult,
  SpendingPolicy as AppSpendingPolicy,
  SessionKey as AppSessionKey,
  UsageStats,
  InferenceResult as AppInferenceResult,
  AgentResult as AppAgentResult,
  BridgeResult as AppBridgeResult,
  TaskResult as AppTaskResult,
  TxResult as AppTxResult,
} from "./app";

// Crypto types
export type {
  SignatureResult,
  VerifyResult,
  EncryptResult,
  DecryptResult,
  DerivedKey,
  KeyPair,
  SharedSecret,
} from "./crypto";

// TEE types
export type {
  TeeInfo,
  AttestationResult,
  TeeVerifyResult,
  SealedData,
  UnsealedData,
  TeeProvider,
  TeeProviderList,
} from "./tee";

// ZK types
export type {
  ZkProof,
  ZkVerifyResult,
  ProvingKey,
  CircuitInfo,
} from "./zk";

// Cortex (recurrent-depth reasoning) types
export type {
  ReasoningTier,
  AttestationRequirement,
  CortexMetadata,
  CortexReceipt,
  CortexRequest,
  CortexResponse,
  CortexWorkerEntry,
  CortexWorkerList,
  CortexPricing,
} from "./cortex";
export { DEFAULT_CORTEX_PRICING, computeCortexCost } from "./cortex";

// Custody types
export type {
  MpcWallet,
  EncryptedKeystore,
  KeyShare,
  RotationResult,
  SpendingPolicy as CustodySpendingPolicy,
  SessionKey as CustodySessionKey,
} from "./custody";

// Streaming types
export type {
  StreamResult,
  SubscriptionHandle as StreamSubscriptionHandle,
  SseConnection,
  StreamEvent,
} from "./streaming";

// OAuth 2.1 onboarding types
export type {
  OnboardSession,
  RefreshedToken,
  RevokeResponse,
  PendingApprovals,
  ApprovalDecision,
  ApprovalRecord,
  TokenExchangeResult,
  IntrospectionResult,
  OAuthDiscovery,
} from "./auth";
