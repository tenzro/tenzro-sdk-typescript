/**
 * Tenzro Network TypeScript SDK - Quick Start Example
 *
 * This example demonstrates basic usage of the Tenzro TypeScript SDK.
 */

import { TenzroClient } from "../src/index";
import type { HybridSigner } from "../src/index";

/**
 * A stand-in for a real self-custody signer. In production this wraps a
 * TEE-sealed key (SEV-SNP / TDX / Nitro), a WebAuthn/passkey-backed signer,
 * or an offline hardware signer that holds the Ed25519 + ML-DSA-65 keypair
 * and never exposes the secret. The runner's raw 32-byte Ed25519 public key
 * IS its account address.
 */
class DemoSigner implements HybridSigner {
  ed25519PublicKey(): Uint8Array {
    return new Uint8Array(32);
  }

  mlDsaVerifyingKey(): Uint8Array {
    return new Uint8Array(1952);
  }

  async signHybrid(_message: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
    // A real signer returns an Ed25519 signature (64 bytes) and an
    // ML-DSA-65 signature (3309 bytes) over `message` (= Transaction::hash()).
    // Both legs are mandatory; the node rejects a raw send that omits either.
    return [new Uint8Array(64), new Uint8Array(3309)];
  }
}

async function main() {
  console.log("=== Tenzro Network TypeScript SDK - Quick Start ===\n");

  // ============================================================================
  // 1. Connect to Network
  // ============================================================================
  console.log("1. Connecting to Tenzro Network...");
  const client = TenzroClient.local();

  // Check if connected
  const connected = await client.isConnected();
  console.log(`   Connected: ${connected}`);

  if (connected) {
    const chainId = await client.getChainId();
    const blockNumber = await client.getBlockNumber();
    const peers = await client.peerCount();

    console.log(`   Chain ID: ${chainId}`);
    console.log(`   Block Height: ${blockNumber}`);
    console.log(`   Peers: ${peers}\n`);
  }

  // ============================================================================
  // 2. Wallet Operations
  // ============================================================================
  console.log("2. Creating wallet...");
  const wallet = await client.wallet.createWallet();
  console.log(`   Wallet ID: ${wallet.wallet_id}`);
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Key Type: ${wallet.key_type}`);
  console.log(`   Threshold: ${wallet.threshold}/${wallet.total_shares}\n`);

  // Create a simple account
  console.log("3. Creating account...");
  const account = await client.wallet.createAccount("ed25519");
  console.log(`   Address: ${account.address}`);
  console.log(`   Public Key: ${account.public_key.substring(0, 40)}...`);
  console.log(`   Key Type: ${account.key_type}\n`);

  // Get balance
  console.log("4. Checking balance...");
  const balance = await client.wallet.getBalance(account.address);
  console.log(`   Balance: ${balance}n (smallest unit)\n`);

  // Self-custody send (client-side hybrid signing).
  //
  // The signer holds the Ed25519 + ML-DSA-65 keypair locally. The SDK fetches
  // nonce + chain id, builds the canonical Transaction::hash() preimage
  // (including the PQ verifying key), asks the signer for both legs over that
  // hash, and submits via eth_sendRawTransaction — the node never sees the
  // secret. The signer's raw 32-byte Ed25519 public key is the `from` account.
  console.log("4b. Sending self-custody transaction...");
  const signer = new DemoSigner();
  try {
    const txHash = await client.wallet.sendSelfCustody({
      signer,
      to: account.address,
      value: 1_000_000_000_000_000_000n, // 1.0 TNZO in wei
    });
    console.log(`   Self-custody tx hash: ${txHash}\n`);
  } catch (err) {
    // The demo signer returns zeroed signatures, which the node rejects —
    // wire a real TEE / passkey / hardware signer to complete the submit.
    console.log(`   Self-custody submit (demo signer): ${err}\n`);
  }

  // ============================================================================
  // 3. AI Inference
  // ============================================================================
  console.log("5. AI Inference operations...");

  // List available models
  const models = await client.inference.listModels();
  console.log(`   Available models: ${models.length}`);

  if (models.length > 0) {
    console.log(`   - ${models[0].name} (${models[0].id})`);
    console.log(`     Provider: ${models[0].provider}`);
    console.log(`     Status: ${models[0].status}`);

    // Perform inference
    console.log("\n   Requesting inference...");
    const result = await client.inference.request(
      models[0].id,
      "What is Tenzro Network?",
      100 // max tokens
    );
    console.log(`   Request ID: ${result.request_id}`);
    console.log(`   Output: ${result.output.substring(0, 100)}...`);
    console.log(`   Tokens Used: ${result.tokens_used}`);
    console.log(`   Cost: ${result.cost}`);
    console.log(`   Latency: ${result.latency_ms}ms\n`);
  } else {
    console.log("   No models available\n");
  }

  // ============================================================================
  // 4. Identity (TDIP)
  // ============================================================================
  console.log("6. Identity operations...");

  // Register a human identity
  const human = await client.identity.registerHuman("Alice");
  console.log(`   Human DID: ${human.did}`);
  console.log(`   Display Name: ${human.displayName}`);
  console.log(`   Is Human: ${human.isHuman}\n`);

  // Register a machine identity
  const machine = await client.identity.registerMachine(
    human.did, // controller
    ["inference", "settlement"]
  );
  console.log(`   Machine DID: ${machine.did}`);
  console.log(`   Controller: ${machine.controllerDid}`);
  console.log(`   Is Machine: ${machine.isMachine}\n`);

  // Resolve a DID
  const resolved = await client.identity.resolve(human.did);
  console.log(`   Resolved DID: ${resolved.did}`);
  console.log(`   Status: ${resolved.status}`);
  console.log(`   Keys: ${resolved.keyCount}`);
  console.log(`   Credentials: ${resolved.credentialCount}\n`);

  // ============================================================================
  // 5. Settlement
  // ============================================================================
  console.log("7. Settlement operations...");

  // Settle a payment
  const receipt = await client.settlement.settle({
    request_id: "req_123",
    provider: "provider_addr",
    customer: account.address,
    amount: "1000000",
  });
  console.log(`   Settlement ID: ${receipt.id}`);
  console.log(`   Status: ${receipt.status}`);
  console.log(`   Fee: ${receipt.fee}\n`);

  // ============================================================================
  // 6. Agent Management
  // ============================================================================
  console.log("8. Agent operations...");

  // Register agent
  const agent = await client.agent.register(
    "agent_123",
    "Example AI Agent",
    ["inference", "settlement", "analysis"]
  );
  console.log(`   Agent ID: ${agent.agent_id}`);
  console.log(`   Status: ${agent.status}\n`);

  // List agents
  const agents = await client.agent.listAgents();
  console.log(`   Total agents: ${agents.length}\n`);

  // ============================================================================
  // 7. Payments (MPP / x402)
  // ============================================================================
  console.log("9. Payment operations...");

  // Create a payment challenge
  const challenge = await client.payment.createChallenge(
    "https://api.example.com/resource",
    100, // amount
    "USDC",
    "mpp"
  );
  console.log(`   Challenge ID: ${challenge.challengeId}`);
  console.log(`   Protocol: ${challenge.protocol}`);
  console.log(`   Amount: ${challenge.amount} ${challenge.asset}\n`);

  // Get gateway info
  const gateway = await client.payment.gatewayInfo();
  console.log(`   Gateway Status: ${gateway.status}`);
  console.log(`   Protocols: ${gateway.protocols.join(", ")}`);
  console.log(`   Assets: ${gateway.supportedAssets.join(", ")}\n`);

  // ============================================================================
  // 8. Governance
  // ============================================================================
  console.log("10. Governance operations...");

  // List proposals
  const proposals = await client.governance.listProposals();
  console.log(`   Total proposals: ${proposals.length}`);

  if (proposals.length > 0) {
    const proposal = proposals[0];
    console.log(`   - ${proposal.title}`);
    console.log(`     Status: ${proposal.status}`);
    console.log(`     Votes For: ${proposal.votesFor}`);
    console.log(`     Votes Against: ${proposal.votesAgainst}\n`);
  }

  // ============================================================================
  // 9. Blockchain Operations
  // ============================================================================
  console.log("11. Blockchain operations...");

  const currentBlock = await client.getBlockNumber();
  console.log(`   Current block: ${currentBlock}`);

  const latestBlock = await client.getLatestBlock();
  console.log(`   Latest block hash: ${latestBlock.hash}`);
  console.log(`   Transactions: ${latestBlock.transactions.length}`);
  console.log(`   Timestamp: ${latestBlock.header.timestamp}\n`);

  // Get total supply
  const supply = await client.totalSupply();
  console.log(`   Total supply: ${supply}\n`);

  // ============================================================================
  // 10. Health Check
  // ============================================================================
  console.log("12. Health check...");

  const health = await client.health();
  console.log(`   Status: ${health.status}`);
  console.log(`   Version: ${health.version}`);
  console.log(`   Verification Service: ${health.verification_service}\n`);

  console.log("=== Quick Start Complete ===");
}

// Run the example
main().catch((error) => {
  console.error("Error:", error.message);
  if (error.code !== undefined) {
    console.error(`Error Code: ${error.code}`);
  }
  process.exit(1);
});
