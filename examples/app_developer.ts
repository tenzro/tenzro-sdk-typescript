/**
 * App Developer example for Tenzro TypeScript SDK
 *
 * Demonstrates the developer-funded app pattern:
 * - Creating an AppClient with a master wallet
 * - Spawning and funding user sub-wallets
 * - Sponsoring transactions, inference, agents, bridges, and tasks
 * - Setting spending policies and session keys
 * - Tracking usage statistics
 */

import { AppClient } from "../src";

async function main() {
  console.log("=== Tenzro SDK App Developer Example ===\n");

  // ==========================================================================
  // 1. Initialize the AppClient with a master wallet
  // ==========================================================================
  console.log("1. Initializing AppClient with master wallet...");

  const masterKey =
    process.env.TENZRO_MASTER_KEY ??
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

  const app = await AppClient.create(
    "https://rpc.tenzro.xyz",
    masterKey,
  );

  console.log(`   Master wallet: ${app.masterWallet.address}`);
  const balance = await app.getMasterBalance();
  console.log(`   Master balance: ${balance} wei\n`);

  // ==========================================================================
  // 2. Create user wallets
  // ==========================================================================
  console.log("2. Creating user wallets...");

  const alice = await app.createUserWallet("alice", 500_000_000_000_000_000n);
  console.log(`   Alice: ${alice.address} (label: ${alice.label})`);

  const bob = await app.createUserWallet("bob", 100_000_000_000_000_000n);
  console.log(`   Bob:   ${bob.address} (label: ${bob.label})\n`);

  // ==========================================================================
  // 3. Set spending policies
  // ==========================================================================
  console.log("3. Setting spending policies...");

  const alicePolicy = await app.setUserLimits(
    alice.address,
    1_000_000_000_000_000_000n, // 1 TNZO daily
    200_000_000_000_000_000n, // 0.2 TNZO per tx
  );
  console.log(
    `   Alice policy: daily=${alicePolicy.dailyLimit} per_tx=${alicePolicy.perTxLimit}`,
  );

  const bobPolicy = await app.setUserLimits(
    bob.address,
    500_000_000_000_000_000n, // 0.5 TNZO daily
    100_000_000_000_000_000n, // 0.1 TNZO per tx
  );
  console.log(
    `   Bob policy:   daily=${bobPolicy.dailyLimit} per_tx=${bobPolicy.perTxLimit}\n`,
  );

  // ==========================================================================
  // 4. Create session keys
  // ==========================================================================
  console.log("4. Creating session keys...");

  const aliceSession = await app.createSessionKey(
    alice.address,
    3600, // 1 hour
    ["transfer", "inference"],
  );
  console.log(
    `   Alice session: ${aliceSession.sessionId} (expires: ${aliceSession.expiresAt}, ops: ${aliceSession.operations.join(", ")})\n`,
  );

  // ==========================================================================
  // 5. Sponsor transactions (master pays gas)
  // ==========================================================================
  console.log("5. Sponsoring a transfer for Alice...");

  const tx = await app.sponsorTransaction(
    alice.address,
    bob.address,
    50_000_000_000_000_000n, // 0.05 TNZO
  );
  console.log(`   Tx hash: ${tx.txHash}\n`);

  // ==========================================================================
  // 6. Sponsor inference (master pays)
  // ==========================================================================
  console.log("6. Sponsoring inference for Bob...");

  const inference = await app.sponsorInference(
    bob.address,
    "gemma3-270m",
    "Explain Tenzro Network in one sentence.",
  );
  console.log(`   Model: ${inference.modelId}`);
  console.log(`   Output: ${inference.output}`);
  console.log(`   Tokens: ${inference.tokens}, Cost: ${inference.cost} TNZO\n`);

  // ==========================================================================
  // 7. Sponsor agent registration (master pays)
  // ==========================================================================
  console.log("7. Sponsoring agent registration for Alice...");

  const agent = await app.sponsorAgent(alice.address, "alice-trading-bot", [
    "inference",
    "settlement",
  ]);
  console.log(`   Agent ID: ${agent.agentId}`);
  console.log(`   Agent wallet: ${agent.walletAddress}\n`);

  // ==========================================================================
  // 8. Sponsor bridge (master pays fees)
  // ==========================================================================
  console.log("8. Sponsoring bridge transfer for Bob...");

  const bridge = await app.sponsorBridge(
    bob.address,
    "TNZO",
    "tenzro",
    "ethereum",
    "100000000000000000", // 0.1 TNZO
    "0xRecipientOnEthereum",
  );
  console.log(`   Bridge tx: ${bridge.txHash}`);
  console.log(`   Status: ${bridge.status}\n`);

  // ==========================================================================
  // 9. Sponsor task posting (master pays budget)
  // ==========================================================================
  console.log("9. Sponsoring task posting for Alice...");

  const task = await app.sponsorTask(
    alice.address,
    "Summarize whitepaper",
    "Read and summarize the Tenzro Network whitepaper in 500 words.",
    "text_generation",
    100_000_000_000_000_000n, // 0.1 TNZO budget
  );
  console.log(`   Task ID: ${task.taskId}\n`);

  // ==========================================================================
  // 10. Fund an existing wallet
  // ==========================================================================
  console.log("10. Topping up Bob's wallet...");

  const fund = await app.fundUserWallet(
    bob.address,
    200_000_000_000_000_000n,
  );
  console.log(`   Fund tx: ${fund.txHash} (amount: ${fund.amount} wei)\n`);

  // ==========================================================================
  // 11. List user wallets
  // ==========================================================================
  console.log("11. Listing all user wallets...");

  const users = await app.listUserWallets();
  for (const u of users) {
    console.log(
      `   - ${u.address} (label: ${u.label}, created: ${u.createdAt})`,
    );
  }
  console.log();

  // ==========================================================================
  // 12. Usage statistics
  // ==========================================================================
  console.log("12. Usage statistics...");

  const stats = await app.getUsageStats();
  console.log(`   Users created:       ${stats.userCount}`);
  console.log(`   Transactions:        ${stats.transactionCount}`);
  console.log(`   Total gas spent:     ${stats.totalGasSpent} wei`);
  console.log(`   Total inference cost: ${stats.totalInferenceCost} TNZO`);
  console.log(`   Total bridge fees:   ${stats.totalBridgeFees} wei`);
  console.log();

  // ==========================================================================
  // 13. Access the full TenzroClient for advanced ops
  // ==========================================================================
  console.log("13. Using the underlying TenzroClient...");

  const block = await app.client.getBlockNumber();
  console.log(`   Current block: ${block}`);

  console.log("\n=== Done ===");
}

main().catch(console.error);
