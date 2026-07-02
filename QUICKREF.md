# Tenzro TypeScript SDK - Quick Reference

Fast reference guide for common operations.

## Installation & Setup

```typescript
import { TenzroClient, LOCAL_CONFIG } from "@tenzro/sdk";

const client = new TenzroClient(LOCAL_CONFIG);
```

## Wallet Operations

```typescript
// Create wallet
const wallet = await client.wallet().createWallet();

// Get balance
const balance = await client.wallet().getBalance("TENZRO");

// Send tokens
const txHash = await client.wallet().send("0x...", "100.0", "TENZRO");

// Sign message
const sig = await client.wallet().signMessage("Hello");
```

## AI Inference

```typescript
// List models
const models = await client.inference(address).listModels();

// Basic inference
const result = await client.inference(address).request(
  "gpt-4",
  "Your prompt here"
);

// With parameters
const result = await client.inference(address).request(
  "gpt-4",
  "Your prompt",
  { maxTokens: 100, temperature: 0.7 }
);

// Private inference (TEE)
const result = await client.inference(address).requestWithTee(
  "gpt-4",
  "Private prompt"
);

// Estimate cost
const cost = await client.inference(address).estimateCost(
  "gpt-4",
  100, // input tokens
  200  // output tokens
);
```

## Settlement

```typescript
// Simple settlement
const receipt = await client.settlement(address).createSettlement(
  "payee_address",
  "50.0",
  "USDC",
  ServiceType.Inference
);

// Escrow (consensus-mediated typed transactions; ambient OAuth 2.1 + DPoP auth)
// Signing happens server-side against the holder's MPC wallet — no raw key here.
// The SDK forwards `Authorization: DPoP <jwt>` + `DPoP: <proof>` from
// TENZRO_BEARER_JWT / TENZRO_DPOP_PROOF on every RPC call.
const txHash = await client.settlement(address).createEscrow(
  "0xpayer...",            // payer (the holder's MPC wallet address)
  "0xpayee...",            // payee
  1000000000000000000n,    // amount in wei
  "TNZO",                  // asset
  1735689600000n,          // expires_at (ms)
  "timeout"                // release conditions
);
// escrow_id is derived deterministically by the VM and emitted in the receipt log.

await client.settlement(address).releaseEscrow(
  "0xpayer...", escrowIdHex, "0xproof..."
);

await client.settlement(address).refundEscrow(
  "0xpayer...", escrowIdHex
);

const escrow = await client.settlement(address).getEscrow(escrowIdHex);

// Payment channel
const channelId = await client.settlement(address).openPaymentChannel(
  "payee_address",
  "1000.0"
);
```

## Agents

```typescript
// Register agent
const agent = await client.agent(address).registerAgent({
  name: "My Agent",
  description: "Agent description",
  capabilities: [Capability.Inference],
});

// List agents
const agents = await client.agent(address).listAgents();

// Delegate task
const taskId = await client.agent(address).delegateTask(
  agentId,
  {
    description: "Task description",
    taskType: "Inference",
    params: { modelId: "gpt-4" },
    maxPayment: "10.0",
  }
);

// Check status
const status = await client.agent(address).getTaskStatus(taskId);
```

## Governance

```typescript
// List proposals
const proposals = await client.governance(address).listProposals();

// Create proposal
const proposalId = await client.governance(address).createProposal(
  "Title",
  "Description",
  "ProposalType"
);

// Vote
await client.governance(address).vote(proposalId, VoteType.For);

// Delegate voting power
await client.governance(address).delegateVotingPower(
  "delegate_address",
  "100.0"
);
```

## Blockchain

```typescript
// Get block number
const height = await client.blockNumber();

// Get block
const block = await client.getBlock(12345);
const latest = await client.getLatestBlock();

// Get transaction
const tx = await client.getTransaction("0x...");

// Wait for confirmation
const receipt = await client.waitForTransaction("0x...", 3);

// Subscribe to blocks
const unsub = client.subscribeToBlocks((block) => {
  console.log("New block:", block.header.height);
});
// Later: unsub();
```

## Error Handling

```typescript
import { RpcError, RpcErrorCode } from "@tenzro/sdk";

try {
  await client.someOperation();
} catch (error) {
  if (error instanceof RpcError) {
    switch (error.code) {
      case RpcErrorCode.InvalidParams:
        // Handle invalid params
        break;
      case RpcErrorCode.MethodNotFound:
        // Handle method not found
        break;
      default:
        // Handle other RPC errors
    }
  }
}
```

## Network Configs

```typescript
import { MAINNET_CONFIG, TESTNET_CONFIG, LOCAL_CONFIG } from "@tenzro/sdk";

// Mainnet
const mainnet = TenzroClient.mainnet();

// Testnet
const testnet = TenzroClient.testnet();

// Local
const local = TenzroClient.local();

// Custom
const custom = new TenzroClient({
  endpoint: "https://custom.rpc",
  timeout: 30000,
});
```

## Common Patterns

### Retry with Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Max retries");
}

const result = await withRetry(() => client.someOperation());
```

### Batch Operations

```typescript
// Batch settlements
const receipts = await client.settlement(address).batchSettle([
  { payer, payee, amount: "10", asset: "USDC", serviceType },
  { payer, payee, amount: "20", asset: "USDC", serviceType },
]);
```

### Transaction Monitoring

```typescript
// Send and wait
const txHash = await client.wallet().send(to, amount);
const receipt = await client.waitForTransaction(txHash, 3, 120000);

if (receipt.status === "Success") {
  console.log("Transaction confirmed!");
}
```

## Type Imports

```typescript
import type {
  Block,
  Transaction,
  ModelInfo,
  InferenceResponse,
  SettlementReceipt,
  AgentIdentity,
  GovernanceProposal,
  WalletInfo,
} from "@tenzro/sdk";
```

## AP2 Agentic Payments

```typescript
// Create AP2 session
const session = await client.ap2().createSession(agentDid, providerDid, "inference", maxAmount);

// Authorize and execute
const auth = await client.ap2().authorizePayment(session.sessionId, amount);
const receipt = await client.ap2().executePayment(session.sessionId, auth.authorizationId);
```

## Agent Spending Policies

```typescript
// Set spending policy
await client.agentPayments().setSpendingPolicy(agentDid, {
  maxPerTransaction: "100000000000000000000",
  maxDailyTotal: "1000000000000000000000",
  allowedRecipients: [provider],
  requireTeeAttestation: true,
});

// Pay for service within policy
const receipt = await client.agentPayments().payForService(agentDid, provider, amount, "inference");

// Check spend
const spend = await client.agentPayments().getDailySpend(agentDid);
```

## Nanopayment Channels

```typescript
// Open channel → send many off-chain → settle batch
const ch = await client.nanopayment().openChannel(payer, payee, deposit);
await client.nanopayment().sendNanopayment(ch.channelId, amount, "memo");
const batch = await client.nanopayment().flushBatch(ch.channelId);
```

## Cross-Chain Bridge

```typescript
// Get routes
const routes = await client.bridge().getRoutes("tenzro", "ethereum");

// Bridge tokens
const transfer = await client.bridge().bridgeTokens("tenzro", "ethereum", "TNZO", amount, recipient);

// Track status
const status = await client.bridge().getTransferStatus(transfer.transferId);
```

## ERC-7802 Cross-Chain Tokens

```typescript
// Mint authorized by a verified inbound bridge payload
await client.erc7802().crosschainMint("TNZO", "ethereum", "wormhole", payloadHex, recipient, amount);

// Get supply breakdown
const supply = await client.erc7802().getCrossChainSupply("TNZO");
```

## Circuit Breakers

```typescript
// Check health
const health = await client.circuitBreaker().getProviderHealth("provider-001");

// Configure
await client.circuitBreaker().configureBreaker("provider-001", {
  failureThreshold: 5,
  recoveryTimeoutSecs: 30,
});
```

## Enums

```typescript
import {
  ServiceType,
  VoteType,
  Capability,
  ModelModality,
  ProposalStatus,
  StablecoinType,
} from "@tenzro/sdk";

// Usage
ServiceType.Inference
VoteType.For
Capability.DataProcessing
```
