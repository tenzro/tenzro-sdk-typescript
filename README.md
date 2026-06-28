# Tenzro SDK for TypeScript

[![npm](https://img.shields.io/npm/v/tenzro-sdk)](https://www.npmjs.com/package/tenzro-sdk)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-tenzro.com-blue)](https://tenzro.com/docs/typescript-sdk)

The official TypeScript/JavaScript SDK for [Tenzro Network](https://tenzro.com) -- build AI-native applications with wallets, identity, agents, inference, cross-chain bridge, crypto, TEE, ZK proofs, and settlement.

## Installation

```bash
npm install tenzro-sdk
```

## Quick Start

```typescript
import { TenzroClient, TESTNET_CONFIG } from 'tenzro-sdk';

const client = new TenzroClient(TESTNET_CONFIG);

// Create wallet
const wallet = await client.wallet.createWallet();
console.log('Address:', wallet.address);

// Register identity
const identity = await client.identity.registerHuman('Alice');
console.log('DID:', identity.did);

// List AI models
const models = await client.inference.listModels();
console.log(`${models.length} models available`);

// Run inference
const result = await client.inference.request('gemma3-270m', 'Hello!', 100);
console.log(result.output);
```

## Browser-extension provider

Browser dApps can route SDK calls through `window.tenzro` (any
EIP-6963-announcing Tenzro extension) instead of opening a direct
fetch to the node. The extension owns auth (DPoP-bound JWT), session
management (CAIP-25), and user confirmation:

```typescript
import { TenzroClient, TenzroNotInstalledError } from 'tenzro-sdk';

try {
  const client = await TenzroClient.fromInjected();
  const block = await client.getLatestBlock();
} catch (err) {
  if (err instanceof TenzroNotInstalledError) {
    showInstallCta();
  } else {
    throw err;
  }
}
```

`fromInjected()` discovers the Tenzro provider via EIP-6963
(default `rdns: network.tenzro.wallet`, override with the `rdns`
option), wraps it in an `Eip1193Transport`, and returns a
`TenzroClient` whose `rpc.call(...)` becomes `provider.request(...)`.
No extra dependency to install — the EIP-6963 listener is bundled in
the SDK. Node consumers can ignore this entrypoint entirely.

## Catch-up sync

A node lagging behind the network can pull batches of historical blocks via
`getBlockRange`. The call returns up to 256 blocks per request along with a
`nextHeight` + `moreAvailable` cursor so a sync loop steps over pruning gaps:

```typescript
let cur = 0;
while (true) {
  const r = await client.getBlockRange(cur, cur + 255, 256);
  for (const b of r.blocks) { /* import block */ }
  if (!r.moreAvailable) break;
  cur = r.nextHeight;
}
```

`isSyncing()` reports the live gap by comparing the local tip against
peer-reported network tips (gossiped on `tenzro/status`); pair it with
`getBlockRange` to drive a catch-up loop only when needed.

## Transaction signing

Every Tenzro transaction is hybrid post-quantum signed: a classical Ed25519
signature **and** an ML-DSA-65 (FIPS 204) signature, both verified
synchronously by the node against the canonical `Transaction::hash()`
preimage (which commits to the PQ public key). An invalid or missing
signature on either leg returns JSON-RPC error `-32003`.

Two supported flows:

1. **Atomic server-side sign + send (recommended).** The SDK dispatches
   the request via `tenzro_signAndSendTransaction`. The node identifies
   the signing wallet from the ambient DPoP-bound bearer JWT, looks up
   the live nonce and gas price, constructs the hash preimage, signs
   both legs, verifies them, and submits to the mempool — all in one
   call. Private keys never travel over the wire. `nonce`, `chainId`,
   and `gasPrice` are optional; `value` accepts the alias `amount` for
   parity with the desktop and CLI clients. Self-sends (`from === to`)
   return a `cannot transfer to self` validation error.

   ```typescript
   const txHash = await client.wallet.signAndSend({
     from: '0x...',
     to: '0x...',
     value: 1_000_000_000_000_000_000n,
     // nonce, chainId, gasPrice all optional — looked up live
   });
   ```

   `client.sendTransaction(...)` and `client.wallet.signAndSend(...)`
   are both thin wrappers over this RPC.

2. **Offline sign, then submit.** Call `tenzro_signTransaction` to obtain
   `{signature, public_key, pq_signature, pq_public_key, timestamp,
   tx_hash}`, then resubmit later via `eth_sendRawTransaction` with all
   six fields intact. Use this for batched or air-gapped submission.

## Wallet model

`client.wallet.create()` provisions a chain-agnostic 2-of-3 Ed25519 MPC
wallet. Tenzro wallets are not per-chain — a single wallet projects into
EVM, SVM, and Canton via the pointer-token model, so there is no `chain`
parameter. VM-specific operations are exposed through `client.token`
(`crossVmTransfer`, `wrapTnzo`); transfers to external chains use
`client.bridge` (LayerZero V2, Chainlink CCIP), `client.debridge`,
`client.wormhole`, or `client.lifi`.

`client.getTransaction(hash)` resolves from finalized storage first, then
falls back to the consensus mempool — `status` is `"pending"` while the
transaction is in-mempool and `"finalized"` once block-included, so callers
polling immediately after broadcast can distinguish "not yet finalized" from
"unknown hash" (the call returns `null` only when the hash is unknown to
both storage and mempool).

## Durable state

The node persists AI infrastructure to RocksDB and restores it on restart —
SDK consumers see consistent state across node upgrades and reboots:

- **Model catalog** — `ModelRegistry` writes `ModelInfo` records under
  `info:<model_id>` in `CF_MODELS`; models survive restart without
  re-registration.
- **Agent runtime** — `AgentRuntime` persists `RegisteredAgent`,
  `AgentLifecycleInfo`, and parent→children spawn trees under
  `agent:`/`lifecycle:`/`children:` prefixes in `CF_AGENTS`. Terminated
  agents are retained for audit of `state_history`, `registration_fee`,
  and `tenzro_did`.
- **Swarms** — `SwarmManager` persists `SwarmState` under `swarm:<swarm_id>`
  in `CF_AGENTS` with write-through on create, status transitions, and
  termination.
- **Wallets** — FROST key shares persist across restarts **when the host node
  is built with a `KeystoreUnlocker`** (the source of the keystore password).
  This is a node-build concern, not an RPC-client one: a wallet created via
  `createPasskeyWallet` / `tenzro_createWallet` survives a node reboot only if
  the operator's node binary supplies an unlocker. Desktop hosts inject a
  biometric Secure-Enclave unlocker (macOS/iOS Touch ID, via the
  `tenzro-device-key` crate); headless hosts inject an env/file/KMS unlocker.
  Without one, the embedded node treats the wallet as **ephemeral** and
  recreates it each launch — the historical default. Cross-restart Secure
  Enclave persistence additionally requires the desktop app to ship a
  `keychain-access-groups` entitlement + provisioning profile.

## AppClient (Developer Pattern)

```typescript
import { AppClient } from 'tenzro-sdk';

// Developer funds a master wallet, users never see gas
const app = await AppClient.create('https://rpc.tenzro.network', process.env.MASTER_KEY!);

// Create user wallet (funded from master)
const user = await app.createUserWallet('alice', 1000000000000000000n);

// Sponsor inference (master pays)
const result = await app.sponsorInference(user.address, 'gemma3-270m', 'Hello');
```

## Modules

| Module | Key Methods |
|--------|------------|
| `auth` | `onboardHuman()`, `onboardDelegatedAgent()`, `onboardAutonomousAgent()`, `revokeJwt()`, `revokeDid()`, `listPendingApprovals()`, `decideApproval()` |
| `wallet` | `createWallet()`, `getBalance()`, `sendTransaction()` |
| `identity` | `registerHuman()`, `resolveDid()`, `setUsername()` |
| `agent` | `register(name, creator, capabilities)` (server-provisioned hybrid wallet), `registerWithKeys(name, creator, capabilities, publicKey, pqPublicKey)` (BYOK), `sendMessage(from, to, message)`, `sendMessageSigned({from, to, message, signature, pqSignature, messageType?, replyTo?})`, `spawnAgent()`, `createSwarm()`, `delegateTask()` |
| `inference` | `listModels()`, `request()`, `estimateCost()`, plus multi-modal helpers for forecast, vision embed/similarity, text embedding, segmentation, detection, audio ASR, video embed (modality-aware routing via `tenzro_forecast`, `tenzro_visionEmbed`, `tenzro_textEmbed`, `tenzro_segment`, `tenzro_detect`, `tenzro_transcribe`, `tenzro_videoEmbed`) |
| `token` | `createToken()`, `listTokens()`, `crossVmTransfer()` |
| `nft` | `createCollection()`, `mintNft()`, `transferNft()` |
| `bridge` | `bridgeTokens()`, `getRoutes()`, `getBridgeStatus()` |
| `wormhole` | `wormholeBridge()`, `getVaa()`, `redeemVaa()` |
| `cct` | `cctListPools()`, `cctGetPool()` (Chainlink CCT v1.6+ pool registry) |
| `erc8004` | `register8004Agent()`, `submit8004Feedback()`, `request8004Validation()`, `submit8004Validation()` (Trustless Agents Registry) |
| `ap2` | `createAp2Mandate()`, `validateMandatePair()` (Agent Payments Protocol intent/cart/payment VDCs) |
| `agentPayments` | Per-agent runtime spending policies (max-per-tx, daily-cap, enforce_operation pre-check) |
| `bond` | AgentBond stake operations (Spec 9): `getAgentBond()`, `listAgentBonds()`, `postAgentBond()`, `increaseAgentBond()`, `withdrawAgentBond()` |
| `insurance` | AgentBond insurance claims (Spec 9): `fileInsuranceClaim()`, `listInsuranceClaims()`, `getInsurancePool()` |
| `lifecycle` | Agent lifecycle + kill-switch audit trail: `getAgentLifecycle()`, `listKillSwitchReceiptsByTarget()` |
| `memory` | Per-agent memory tier — `grant()`, `recall()`, `archive()`, `listRecords()`. Lance vector kNN + Tantivy BM25 hybrid search (RRF k=60). **Requires DPoP+JWT auth** — bearer's DID must match `agent_did` (or its `controller_did` for delegated agents). |
| `principalChain` | Receipt principal-chain queries (Spec 5): walk every receipt back to its human/organisational controller |
| `cortex` | Reasoning-tier inference with TEE / TEE+ZK attestation; `DEFAULT_CORTEX_PRICING`, `computeCortexCost()` |
| `adaptiveBurn` | Adaptive-burn governance dial — `getBurnRateConfig()`, `getSupplyMetrics()`, `getBurnRateRecommendation()` |
| `seedAgent` | SeedAgent treasury earmark + protocol-owned bootstrap agent registry (Spec 10) |
| `quota` | Dual-rail burn quota (Spec 3), prioritised mempool lanes, hot-state contention, DA backend registry |
| `nanopayment` | Per-token streaming micropayment channels |
| `circuitBreaker` | Provider health management for inference routing |
| `erc7802` | Cross-chain token mint/burn primitive |
| `provider` | Hardware detection, model serving, scheduling. `serveModel(id)` auto-clusters when a model is too large for one host — the node reads the GGUF header for layer count, discovers LAN members from gossiped cluster announcements, and runs a layer-wise pipeline across them, no extra options needed. `serveModel(id, { forceCluster, forceSingle, visibility })` overrides placement (force a split or pin single-host) and `visibility` (`"network"` gossips the model; `"private"` keeps it local/LAN-only). Preview the layer split first with `discovery.clusterPreview(id, { force, forceSingle })` (live node view; derives the shape from the GGUF header and discovers LAN members) |
| `settlement` | `createEscrow()`, `releaseEscrow()`, `refundEscrow()`, `getEscrow()`, `openPaymentChannel()` |
| `payment` | `createChallenge()`, `payMpp()`, `payX402()`, `listX402Schemes()` (pluggable scheme adapters: `exact`, `permit2`) |
| `compliance` | `registerCompliance()`, `checkCompliance()`, `freezeAddress()` |
| `crypto` | `signMessage()`, `encrypt()`, `decrypt()`, `hashSha256()` |
| `tee` | `detectTee()`, `getAttestation()`, `sealData()` |
| `zk` | `createProof()`, `verifyProof()`, `listCircuits()` |
| `custody` | `createMpcWallet()`, `exportKeystore()`, `authorizeSession()` |
| `streaming` | `chatStream()`, `subscribeEvents()` |
| `app` | `AppClient` -- master wallet, paymaster, user management |
| `governance` | `listProposals()`, `vote()`, `getVotingPower()` |
| `staking` | `stake()`, `unstake()`, `getRewards()` |
| `task` | `postTask()`, `listTasks()`, `completeTask()` |
| `marketplace` | `registerAgentTemplate()`, `spawnAgentFromTemplate()` |
| `contract` | `deployContract()`, `callContract()`, `encodeFunction()` |
| `debridge` | `searchTokens()`, `getChains()`, `createTx()` |
| `events` | `getEvents()`, `subscribeEvents()`, `registerWebhook()` |
| `canton` | Canton 3.5+ JSON Ledger API surface. Reads: `listDomains()`, `listContracts()`, `listParties()`, `listPackages()`, `health()`, `version()`, `getMyUser()`, `cantonCoinBalance()` (CIP-56), `feeSchedule()`, `connectedSynchronizers()`, `getTransaction(updateId)`, `listUserRights(userId?)`, `getMyAnalytics()`, `listApiKeyAnalytics(keyId?)`. Writes: `submitCommand()`, `allocateParty(hint, displayName?)`, `grantUserRights({party, userId?, canActAs?, canReadAs?, identityProviderId?})`, `uploadDar(darBase64)`. Wire shape verified against Canton 3.5.1: the `submit-and-wait-for-transaction` request body nests `JsCommands` under a top-level `commands` key, each command is externally-tagged (`{CreateCommand: {...}}` / `{ExerciseCommand: {...}}`). When the presenting API key has a bound `canton_user_id`, the node auto-forwards `actAs` / `requestingParties` as the tenant's `primaryParty`. Stage 2.b (`identity_providers.enabled` on the node) auto-mints a per-tenant upstream OAuth client at issuance; the credentials stay on the node, which mints + forwards the tenant's Canton JWT internally — the `tnz_...` API key is the tenant's only credential. `apiKey.create(...)` returns non-secret `tenant_oauth_client` metadata (client_id + issuer_url + audience). Requires an API key with `canton` scope at the Tenzro node. |
| `skill` | `listSkills()`, `registerSkill()` |
| `tool` | `listTools()`, `registerTool()` |
| `svm-cross-vm` | Tenzro Cross-VM SVM-native program: `TENZRO_CROSS_VM_PROGRAM_ID_BASE58`, `encodeBridgeToEvm()`, `encodeBridgeFromEvm()`, `encodeRegisterTokenPointer()`, `encodeTransferCrossVm()`, `decodeCrossVmInstruction()` |
| `capital` | Regulated capital-allocation intents: `openCapitalIntent()`, `quoteCapitalIntent()`, `assignCapitalIntent()`, `executeCapitalLeg()`, `verifyCapitalLeg()`, `compensateCapitalLeg()`, `settleCapitalIntent()`, `getCapitalIntent()`, `submitReserveAttestation()`, `getReserve()`, `attestedMint()` |
| `workflow` | Multi-party saga workflows with AP2 / x402 / MPP / Stripe SPT / Visa TAP / Mastercard Agent Pay mandate binding: `openWorkflow()`, `executeStep()`, `verifyStep()`, `compensateStep()`, `finalizeWorkflow()`, `mirrorToCanton()`, `verifyDidEnvelope()`, `getWorkflow()`, `getWorkflowSaga()`, `getWorkflowLifecycle()`, `getWorkflowReceipt()`, `getWorkflowOperationalMetrics()`, `listWorkflowsByCreator()`, `listWorkflowsByParticipant()`, `listWorkflowsByStatus()`, `listWorkflowReceipts()` |
| `eip7702` | Pectra Type-4 delegation registry: `install7702Delegation()`, `get7702Delegation()`, `revoke7702Delegation()` |
| `erc7683` | Cross-chain intents origin opener + destination fill registry: `open7683Order()`, `get7683Order()`, `list7683Orders()`, `recordFill7683()`, `getFill7683()`, `listFills7683()` |
| `permit2` | Permit2 `SignatureTransfer`: `domainSeparator()`, `digest()`, `verifyAndConsume()`, `nonceUsed()` (optional witness binding for ERC-7683 origin opens) |
| `secureMint` | Per-token 1:1 reserve-attestation invariant for tokenized RWAs: `setPolicy()`, `getPolicy()`, `clearPolicy()`, `check()`, `apply()`, `recordBurn()` |
| `hyperlane` | Hyperlane V3 messaging with sovereign Tenzro-validator-set ISM: `listChains()`, `quoteDispatch()`, `dispatch()`, `getMessage()` |
| `axelar` | Axelar GMP — Cosmos / Move / Stellar / XRPL reach: `listChains()`, `callContract()`, `payGas()`, `getMessage()` |
| `babylon` | Babylon Bitcoin staking finality-providers + EOTS delegations: `registerFinalityProvider()`, `submitFinalitySignature()`, `totalStakeForProvider()`, `listDelegations()` |
| `caip` | Tenzro CAIP namespace identifiers per `ChainAgnostic/namespaces#184`: `caip2()`, `caip10()`, `caip19()` |
| `bridgeFee` | Cross-chain bridge fees in TNZO: `quote()` for destination-native fees, `listSponsorshipPools()` for per-adapter vault state, `sponsor()` against a previously-quoted envelope, `getAnalytics()` for self-read CU consumption, `listAnalytics()` for operator cross-tenant read. Admin-only: `setRate()`, `setRefillThreshold()`. Read paths require `chainlink` API key scope on the node. |
| `urwa` | ERC-7943 (uRWA) compliance surface: token freeze, kill-switch, forced-transfer mutations (admin-token-gated) |
| `ivms101` | FATF Travel Rule IVMS101 v1.1.0 canonical envelope helpers for KYC payloads on cross-border transfers |
| `attestedClock` | TEE-attested-timestamp envelope for saga step deadlines + obligation expiry (30s drift tolerance per Canton 3.5 guidance) |
| `signedAgentCard` | A2A v1.0 SignedAgentCard JWS envelope + canonical-hash computation for verifier rebinding |
| `wormholeNtt` | Wormhole NTT (Native Token Transfers) — NttManager registry + multi-transceiver chain catalog |

## Auth (OAuth 2.1 + DPoP Onboarding)

Onboarding uses OAuth 2.1 (RFC 6749 successor) + DPoP-bound JWTs (RFC 9449) +
Rich Authorization Requests (RFC 9396). Participants — humans, delegated agents
under a human controller, and fully autonomous agents — onboard via three RPCs
that each provision a TDIP identity + MPC wallet and return a JWT bound to a
holder-supplied DPoP `jkt` (RFC 7638 thumbprint).

```typescript
import { TenzroClient, TESTNET_CONFIG } from 'tenzro-sdk';

const client = new TenzroClient(TESTNET_CONFIG);

// Onboard a new human — returns identity, MPC wallet, and access token
const session = await client.auth.onboardHuman('Alice', /* dpopJkt */ undefined);
console.log('DID:    ', (session.identity as any).did);
console.log('Wallet: ', (session.wallet as any).address);
console.log('Token:  ', session.access_token.slice(0, 32), '…');

// Subsequent privileged calls (sign + send tx, escrow, etc.) authenticate
// ambiently via these env vars — the SDK forwards them as
// `Authorization: DPoP <jwt>` and `DPoP: <proof>` on every JSON-RPC call:
process.env.TENZRO_BEARER_JWT = session.access_token;
process.env.TENZRO_DPOP_PROOF = '<freshly minted DPoP proof>';

// Onboard a delegated agent under Alice's act-chain
const agent = await client.auth.onboardDelegatedAgent(
  (session.identity as any).did,
  ['inference', 'settlement'],
  { max_transaction_value: '1000000000000000000', allowed_chains: ['tenzro'] },
);

// Revoke (cascades through act-chain by DID)
await client.auth.revokeDid((session.identity as any).did, 'lost device');
```

Holder-side DPoP proof generation is left to the caller — sign a per-request
JWT with your Ed25519 holder key and the JWS-compact form lands in
`TENZRO_DPOP_PROOF`. See RFC 9449 §4.

## Examples

```bash
npx ts-node examples/quickstart.ts
npx ts-node examples/advanced.ts
npx ts-node examples/marketplace.ts        # 14 sections covering tasks, agents, skills, tools, NFTs, governance, payments, bridges
npx ts-node examples/app_developer.ts
npx ts-node examples/auth-session.ts
npx ts-node examples/cortex.ts
```

See the [examples/](examples/) directory and [Tenzro Cookbook](https://github.com/tenzro/tenzro-cookbook).

## Live Testnet

| Endpoint | URL |
|----------|-----|
| JSON-RPC | `https://rpc.tenzro.network` |
| Web API | `https://api.tenzro.network` |
| MCP Server | `https://mcp.tenzro.network/mcp` |
| A2A Server | `https://a2a.tenzro.network` |

## Documentation

- [TypeScript SDK Reference](https://tenzro.com/docs/typescript-sdk)
- [Tutorials](https://tenzro.com/tutorials)
- [Cookbook](https://github.com/tenzro/tenzro-cookbook)

## Contact

- Website: [tenzro.com](https://tenzro.com)
- Engineering: [eng@tenzro.com](mailto:eng@tenzro.com)
- GitHub: [github.com/tenzro](https://github.com/tenzro)

## License

Apache 2.0. See [LICENSE](LICENSE).
