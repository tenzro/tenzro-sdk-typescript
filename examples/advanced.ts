/**
 * Tenzro Network TypeScript SDK - Advanced Example
 *
 * This example demonstrates advanced features and patterns.
 */

import {
  TenzroClient,
  TESTNET_CONFIG,
  ServiceType,
  Capability,
  RpcError,
  RpcErrorCode,
} from "../src/index";

async function main() {
  console.log("=== Tenzro Network TypeScript SDK - Advanced Examples ===\n");

  // ============================================================================
  // 1. Custom Configuration with API Key
  // ============================================================================
  console.log("1. Connecting with custom configuration...");
  const client = await TenzroClient.connect({
    ...TESTNET_CONFIG,
    timeout: 60000,
    maxRetries: 5,
    apiKey: "your-api-key-here",
    headers: {
      "X-Custom-Header": "custom-value",
    },
  });
  console.log("   Connected!\n");

  // ============================================================================
  // 2. Batch Operations
  // ============================================================================
  console.log("2. Performing batch operations...");

  // Import multiple wallets
  const wallet1 = await client.wallet().createWallet();
  const wallet2 = await client.wallet().createWallet();

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
        if (error instanceof RpcError) {
          console.log(`   RPC Error [${error.code}]: ${error.message}`);

          // Don't retry on certain errors
          if (
            error.code === RpcErrorCode.InvalidParams ||
            error.code === RpcErrorCode.MethodNotFound
          ) {
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
    await requestWithRetry(async () => {
      return await client.getBalance(wallet1.address);
    });
    console.log("   Operation succeeded!\n");
  } catch (error) {
    console.log("   Operation failed after retries\n");
  }

  // ============================================================================
  // 4. Streaming Inference
  // ============================================================================
  console.log("4. Streaming inference...");

  const models = await client.inference(wallet1.address).listModels();
  if (models.length > 0) {
    let streamedOutput = "";

    await client.inference(wallet1.address).streamRequest(
      models[0].modelId,
      "Generate a long response about blockchain technology",
      { maxTokens: 500 },
      (chunk) => {
        streamedOutput += chunk;
        process.stdout.write(".");
      }
    );

    console.log(`\n   Streamed ${streamedOutput.length} characters\n`);
  }

  // ============================================================================
  // 5. Payment Channel Management
  // ============================================================================
  console.log("5. Payment channel workflow...");

  // Open payment channel
  const channelId = await client.settlement(wallet1.address).openPaymentChannel(
    wallet2.address,
    "1000.0",
    "TENZRO",
    86400 // 1 day duration
  );
  console.log(`   Channel opened: ${channelId}`);

  // Get channel info
  const channel = await client.settlement(wallet1.address).getPaymentChannel(channelId);
  console.log(`   Deposit: ${channel.deposit} ${channel.asset}`);
  console.log(`   Status: ${channel.status}`);

  // Close channel
  const closeReceipt = await client.settlement(wallet1.address).closePaymentChannel(
    channelId,
    "500.0",
    "signature_placeholder"
  );
  console.log(`   Channel closed: ${closeReceipt.receiptId}\n`);

  // ============================================================================
  // 6. Multi-Agent Task Orchestration
  // ============================================================================
  console.log("6. Multi-agent task orchestration...");

  // Register multiple agents with different capabilities
  const dataAgent = await client.agent(wallet1.address).registerAgent({
    name: "Data Processing Agent",
    description: "Specialized in data processing",
    capabilities: [Capability.DataProcessing],
    stake: "100.0",
  });

  const inferenceAgent = await client.agent(wallet1.address).registerAgent({
    name: "Inference Agent",
    description: "Specialized in AI inference",
    capabilities: [Capability.Inference],
    stake: "100.0",
  });

  console.log(`   Data Agent: ${dataAgent.agentId}`);
  console.log(`   Inference Agent: ${inferenceAgent.agentId}`);

  // Delegate tasks
  const task1 = await client.agent(wallet1.address).delegateTask(
    dataAgent.agentId,
    {
      description: "Process dataset",
      taskType: "DataProcessing",
      params: { dataset: "user_data.csv" },
      maxPayment: "50.0",
    }
  );

  const task2 = await client.agent(wallet1.address).delegateTask(
    inferenceAgent.agentId,
    {
      description: "Run inference on processed data",
      taskType: "Inference",
      params: { modelId: "gpt-4", input: "processed_data" },
      maxPayment: "30.0",
    }
  );

  console.log(`   Task 1: ${task1}`);
  console.log(`   Task 2: ${task2}\n`);

  // ============================================================================
  // 7. Transaction Monitoring
  // ============================================================================
  console.log("7. Transaction monitoring...");

  // Send transaction
  const txHash = await client.wallet(wallet1.address).send(
    wallet2.address,
    "10.0",
    "TENZRO"
  );

  console.log(`   Transaction sent: ${txHash}`);
  console.log("   Waiting for confirmation...");

  // Wait for confirmations
  const receipt = await client.waitForTransaction(txHash, 3, 120000);
  console.log(`   Confirmed in block: ${receipt.blockHeight}`);
  console.log(`   Status: ${receipt.status}`);
  console.log(`   Gas used: ${receipt.gasUsed}\n`);

  // ============================================================================
  // 8. Governance Participation
  // ============================================================================
  console.log("8. Advanced governance...");

  // Get governance parameters
  const params = await client.governance(wallet1.address).getGovernanceParams();
  console.log(`   Proposal threshold: ${params.proposalThreshold}`);
  console.log(`   Quorum: ${params.quorumPercentage}%`);
  console.log(`   Pass threshold: ${params.passPercentage}%`);

  // Delegate voting power
  await client.governance(wallet1.address).delegateVotingPower(
    wallet2.address,
    "500.0"
  );
  console.log("   Delegated 500.0 voting power");

  // Get delegations
  const delegations = await client.governance(wallet1.address).getDelegations();
  console.log(`   Total delegated: ${delegations.totalDelegated}`);
  console.log(`   Total received: ${delegations.totalReceived}\n`);

  // ============================================================================
  // 9. Batch Settlement
  // ============================================================================
  console.log("9. Batch settlement...");

  const settlements = [
    {
      payer: wallet1.address,
      payee: wallet2.address,
      amount: "10.0",
      asset: "USDC" as const,
      serviceType: ServiceType.Inference,
      proof: "proof1",
    },
    {
      payer: wallet1.address,
      payee: wallet2.address,
      amount: "20.0",
      asset: "USDC" as const,
      serviceType: ServiceType.Storage,
      proof: "proof2",
    },
    {
      payer: wallet1.address,
      payee: wallet2.address,
      amount: "15.0",
      asset: "USDC" as const,
      serviceType: ServiceType.Compute,
      proof: "proof3",
    },
  ];

  const receipts = await client.settlement(wallet1.address).batchSettle(settlements);
  console.log(`   Settled ${receipts.length} payments`);
  receipts.forEach((receipt, i) => {
    console.log(`   Receipt ${i + 1}: ${receipt.receiptId} (${receipt.status})`);
  });
  console.log();

  // ============================================================================
  // 10. Real-time Block Monitoring with Analytics
  // ============================================================================
  console.log("10. Block monitoring with analytics (20 seconds)...");

  const analytics = {
    blocksProcessed: 0,
    totalTransactions: 0,
    averageBlockTime: 0,
    lastBlockTime: 0,
  };

  const unsubscribe = client.subscribeToBlocks((block) => {
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

    console.log(`   Block ${block.header.height}: ${block.transactions.length} txs`);
  }, 2000); // Poll every 2 seconds

  await new Promise((resolve) => setTimeout(resolve, 20000));
  unsubscribe();

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
  process.exit(1);
});
