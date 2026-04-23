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

## Transaction signing

The Tenzro node canonicalises the transaction hash over `Transaction::hash()`,
which includes the server-supplied `timestamp` field. Every transaction is
synchronously verified against its Ed25519 signature before acceptance; an
invalid or missing signature returns JSON-RPC error `-32003`.

Three supported flows:

1. **Atomic server-side sign + send (recommended):** forward the hex-encoded
   private key to `tenzro_signAndSendTransaction` — the node assembles,
   hashes, signs, verifies, and submits the transaction in one call.

   ```typescript
   const txHash = await client.rpc.call<string>(
     'tenzro_signAndSendTransaction',
     [{
       private_key: '0x...',
       from: '0x...',
       to: '0x...',
       value: '0x...',
       nonce: '0x0',
       chain_id: 1337,
     }]
   );
   ```

2. **Offline sign, then submit:** call `tenzro_signTransaction` to obtain
   `{signature, public_key, timestamp, tx_hash}` and resubmit later via
   `eth_sendRawTransaction` with all four fields intact.

3. **Pre-signed submission:** call `eth_sendRawTransaction` directly with
   `signature`, `public_key`, and explicit `timestamp` matching a
   client-computed `Transaction::hash()`. `wallet.sendTransaction()`
   dispatches the bare `{from, to, value, gas_limit?, gas_price?}` payload
   and will be rejected unless the caller adds these fields — prefer
   flow (1) for typical usage. See the `crates/tenzro-cli` `wallet send`
   command for a reference.

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
| `auth` | `issueOnboardingKey()`, `listOnboardingKeys()`, `revokeOnboardingKey()`, `validateOnboardingKey()` |
| `wallet` | `createWallet()`, `getBalance()`, `sendTransaction()` |
| `identity` | `registerHuman()`, `resolveDid()`, `setUsername()` |
| `agent` | `register()`, `spawnAgent()`, `createSwarm()`, `delegateTask()` |
| `inference` | `listModels()`, `request()`, `estimateCost()` |
| `token` | `createToken()`, `listTokens()`, `crossVmTransfer()` |
| `nft` | `createCollection()`, `mintNft()`, `transferNft()` |
| `bridge` | `bridgeTokens()`, `getRoutes()`, `getBridgeStatus()` |
| `settlement` | `createEscrow()`, `releaseEscrow()`, `openPaymentChannel()` |
| `payment` | `createChallenge()`, `payMpp()`, `payX402()` |
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

## Auth (Onboarding Keys)

```typescript
import { TenzroClient, TESTNET_CONFIG } from 'tenzro-sdk';

const client = new TenzroClient(TESTNET_CONFIG);

// Issue an onboarding key
const key = await client.auth.issueOnboardingKey(
  'Alice',
  'did:tenzro:human:abc123',
  '0x1234abcd',
  'Human'
);
console.log('Key:', key.key);
console.log('Expires:', key.expires_at);

// List all active keys
const keys = await client.auth.listOnboardingKeys();
for (const k of keys) {
  console.log(`${k.name} — ${k.did} (${k.status})`);
}

// Validate a key
const result = await client.auth.validateOnboardingKey(key.key);
if (result.valid) {
  console.log('Valid for DID:', result.did);
}

// Revoke a key
const revoke = await client.auth.revokeOnboardingKey('did:tenzro:human:abc123');
console.log('Revoked:', revoke.revoked);
```

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
