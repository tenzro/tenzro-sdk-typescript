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
peer-reported network tips (gossiped on `tenzro/status/1.0.0`); pair it with
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
   the signing wallet from the ambient DPoP-bound bearer JWT, constructs
   the hash preimage, signs both legs, verifies them, and submits to the
   mempool — all in one call. Private keys never travel over the wire.

   ```typescript
   const txHash = await client.wallet.signAndSend({
     from: '0x...',
     to: '0x...',
     value: 1_000_000_000_000_000_000n,
   });
   ```

   `client.sendTransaction(...)` and `client.wallet.signAndSend(...)`
   are both thin wrappers over this RPC.

2. **Offline sign, then submit.** Call `tenzro_signTransaction` to obtain
   `{signature, public_key, pq_signature, pq_public_key, timestamp,
   tx_hash}`, then resubmit later via `eth_sendRawTransaction` with all
   six fields intact. Use this for batched or air-gapped submission.

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
| `agent` | `register()`, `spawnAgent()`, `createSwarm()`, `delegateTask()` |
| `inference` | `listModels()`, `request()`, `estimateCost()`, plus multi-modal helpers for forecast, vision embed/similarity, text embedding, segmentation, detection, audio ASR, video embed (modality-aware routing via `tenzro_forecast`, `tenzro_visionEmbed`, `tenzro_textEmbed`, `tenzro_segment`, `tenzro_detect`, `tenzro_transcribe`, `tenzro_videoEmbed`) |
| `token` | `createToken()`, `listTokens()`, `crossVmTransfer()` |
| `nft` | `createCollection()`, `mintNft()`, `transferNft()` |
| `bridge` | `bridgeTokens()`, `getRoutes()`, `getBridgeStatus()` |
| `wormhole` | `wormholeBridge()`, `getVaa()`, `redeemVaa()` |
| `cct` | `cctListPools()`, `cctGetPool()` (Chainlink CCT v1.6+ pool registry) |
| `erc8004` | `register8004Agent()`, `submit8004Feedback()`, `request8004Validation()`, `submit8004Validation()` (Trustless Agents Registry) |
| `ap2` | `createAp2Mandate()`, `validateMandatePair()` (Agent Payments Protocol intent/cart/payment VDCs) |
| `agentPayments` | Per-agent runtime spending policies (max-per-tx, daily-cap, enforce_operation pre-check) |
| `nanopayment` | Per-token streaming micropayment channels |
| `circuitBreaker` | Provider health management for inference routing |
| `erc7802` | Cross-chain token mint/burn primitive |
| `provider` | Hardware detection, model serving, scheduling |
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
| `canton` | `listDomains()`, `submitCommand()` |
| `skill` | `listSkills()`, `registerSkill()` |
| `tool` | `listTools()`, `registerTool()` |
| `svm-cross-vm` | Tenzro Cross-VM SVM-native program: `TENZRO_CROSS_VM_PROGRAM_ID_BASE58`, `encodeBridgeToEvm()`, `encodeBridgeFromEvm()`, `encodeRegisterTokenPointer()`, `encodeTransferCrossVm()`, `decodeCrossVmInstruction()` |

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

## Live Testnet

| Endpoint | URL |
|----------|-----|
| JSON-RPC | `https://rpc.tenzro.network` |
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
