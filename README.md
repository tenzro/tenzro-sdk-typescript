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
