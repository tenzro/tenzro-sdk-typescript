/**
 * Tenzro Network TypeScript SDK - Advanced Example
 *
 * This example demonstrates advanced features and patterns:
 * - Retry logic with typed RPC errors
 * - AI inference
 * - Payment channels
 * - Multi-agent task delegation
 * - Transaction monitoring
 * - Governance delegation
 * - Block monitoring with analytics
 */

import { TenzroClient, TESTNET_CONFIG, RpcCallError } from "../src/index";

async function main() {
  console.log("=== Tenzro Network TypeScript SDK - Advanced Examples ===\n");

  // ============================================================================
  // 1. Custom Configuration
  // ============================================================================
  console.log("1. Connecting with custom configuration...");
  const client = new TenzroClient({
    ...TESTNET_CONFIG,
    timeout: 60000,
  });
  console.log("   Connected!\n");

  // ============================================================================
  // 2. Wallet Provisioning
  // ============================================================================
  console.log("2. Creating MPC wallets...");

  const wallet1 = await client.wallet.createWallet();
  const wallet2 = await client.wallet.createWallet();

  console.log(`   Wallet 1: ${wallet1.address}`);
  console.log(`   Wallet 2: ${wallet2.address}\n`);

  // ============================================================================
  // 3. Error Handling with Retry Logic
  // ============================================================================
  console.log("3. Advanced error handling...");

  async function requestWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof RpcCallError) {
          console.log(`   RPC Error [${error.code}]: ${error.message}`);

          // Don't retry on invalid params (-32602) or method not found (-32601)
          if (error.code === -32602 || error.code === -32601) {
            throw error;
          }
        }

        if (attempt === maxRetries) {
          throw error;
        }

        console.log(`   Retry ${attempt}/${maxRetries}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error("Max retries exceeded");
  }

  try {
    const balance = await requestWithRetry(() =>
      client.getBalance(wallet1.address)
    );
    console.log(`   Operation succeeded! Balance: ${balance} wei\n`);
  } catch {
    console.log("   Operation failed after retries\n");
  }

  // ============================================================================
  // 4. AI Inference
  // ============================================================================
  console.log("4. AI inference...");

  const models = await client.inference.listModels();
  console.log(`   ${models.length} models available`);

  if (models.length > 0) {
    try {
      const result = await client.inference.request(
        models[0].id,
        "Summarize blockchain technology in one sentence.",
        100
      );
      console.log(`   Model: ${models[0].name}`);
      console.log(`   Output: ${JSON.stringify(result).substring(0, 120)}...`);
    } catch (e) {
      console.log(`   Note: Inference not available: ${e}`);
    }
  }
  console.log();

  // ============================================================================
  // 5. Payment Channel Management
  // ============================================================================
  console.log("5. Payment channel workflow...");

  try {
    // Open payment channel with a 1 TNZO deposit
    const channelId = await client.settlement.openPaymentChannel(
      wallet2.address,
      1000000000000000000n // 1 TNZO in wei
    );
    console.log(`   Channel opened: ${channelId}`);

    // Close channel
    await client.settlement.closePaymentChannel(channelId);
    console.log("   Channel closed\n");
  } catch (e) {
    console.log(`   Note: Channel workflow failed: ${e}\n`);
  }

  // ============================================================================
  // 6. Multi-Agent Task Orchestration
  // ============================================================================
  console.log("6. Multi-agent task orchestration...");

  // Register multiple agents with different capabilities
  const dataAgent = await client.agent.register(
    "Data Processing Agent",
    wallet1.address,
    ["data"]
  );

  const inferenceAgent = await client.agent.register(
    "Inference Agent",
    wallet1.address,
    ["nlp"]
  );

  console.log(`   Data Agent: ${dataAgent.agent_id}`);
  console.log(`   Inference Agent: ${inferenceAgent.agent_id}`);

  // Delegate tasks via A2A
  try {
    const task1 = await client.agent.delegateTask(
      dataAgent.agent_id,
      "Process dataset user_data.csv and produce summary statistics"
    );
    const task2 = await client.agent.delegateTask(
      inferenceAgent.agent_id,
      "Run inference on the processed dataset and extract key insights"
    );

    console.log(`   Task 1: ${task1.id} (${task1.status})`);
    console.log(`   Task 2: ${task2.id} (${task2.status})\n`);
  } catch (e) {
    console.log(`   Note: Task delegation failed: ${e}\n`);
  }

  // ============================================================================
  // 7. Transaction Monitoring
  // ============================================================================
  console.log("7. Transaction monitoring...");

  try {
    // Send 10 TNZO from wallet1 to wallet2 (server-side FROST signing)
    const txHash = await client.wallet.signAndSend({
      from: wallet1.address,
      to: wallet2.address,
      value: 10000000000000000000n, // 10 TNZO in wei
    });

    console.log(`   Transaction sent: ${txHash}`);
    console.log("   Waiting for inclusion...");

    // Poll until the transaction appears in a block
    let included = false;
    for (let i = 0; i < 30; i++) {
      const tx = await client.getTransaction(txHash);
      if (tx && tx.blockHeight !== undefined && tx.blockHeight !== null) {
        console.log(`   Confirmed in block: ${tx.blockHeight}`);
        included = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!included) {
      console.log("   Transaction not yet included (timed out polling)");
    }
    console.log();
  } catch (e) {
    console.log(`   Note: Transfer failed: ${e}\n`);
  }

  // ============================================================================
  // 8. Governance Participation
  // ============================================================================
  console.log("8. Advanced governance...");

  try {
    const power = await client.governance.getVotingPower(wallet1.address);
    console.log(`   Voting power: ${power.power}`);

    // Delegate voting power
    const delegation = await client.governance.delegateVotingPower(
      wallet2.address,
      "500"
    );
    console.log(`   Delegated 500 voting power: ${delegation}\n`);
  } catch (e) {
    console.log(`   Note: Governance ops failed: ${e}\n`);
  }

  // ============================================================================
  // 9. Real-time Block Monitoring with Analytics
  // ============================================================================
  console.log("9. Block monitoring with analytics (20 seconds)...");

  const analytics = {
    blocksProcessed: 0,
    totalTransactions: 0,
    averageBlockTime: 0,
    lastBlockTime: 0,
  };

  let lastHeight = await client.getBlockNumber();
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    const height = await client.getBlockNumber();

    while (lastHeight < height) {
      lastHeight++;
      const block = await client.getBlock(lastHeight);
      const now = Date.now();

      if (analytics.lastBlockTime > 0) {
        const blockTime = now - analytics.lastBlockTime;
        analytics.averageBlockTime =
          (analytics.averageBlockTime * analytics.blocksProcessed + blockTime) /
          (analytics.blocksProcessed + 1);
      }

      analytics.blocksProcessed++;
      analytics.totalTransactions += block.transactions.length;
      analytics.lastBlockTime = now;

      console.log(
        `   Block ${block.header.height}: ${block.transactions.length} txs`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n   Analytics:");
  console.log(`   Blocks processed: ${analytics.blocksProcessed}`);
  console.log(`   Total transactions: ${analytics.totalTransactions}`);
  console.log(
    `   Average block time: ${analytics.averageBlockTime.toFixed(0)}ms\n`
  );

  console.log("=== Advanced Examples Complete ===");
}

// Run the example
main().catch((error) => {
  console.error("Error:", error);
});
