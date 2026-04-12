/**
 * Tenzro Network TypeScript SDK - Advanced Example
 *
 * This example demonstrates advanced features including:
 * - Error handling with RpcCallError
 * - Streaming inference
 * - Cross-chain bridge
 * - Staking
 * - NFTs
 * - ZK proofs
 * - TEE attestation
 */

import {
  TenzroClient,
  TESTNET_CONFIG,
  RpcCallError,
} from "../src/index";

async function main() {
  console.log("=== Tenzro Network TypeScript SDK - Advanced Examples ===\n");

  // ============================================================================
  // 1. Connect
  // ============================================================================
  console.log("1. Connecting to testnet...");
  const client = new TenzroClient(TESTNET_CONFIG);
  console.log("   Connected!\n");

  // ============================================================================
  // 2. Error Handling with Retry Logic
  // ============================================================================
  console.log("2. Advanced error handling...");

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
    const wallet = await client.wallet.createWallet();
    const balance = await requestWithRetry(async () => {
      return await client.wallet.getBalance(wallet.address);
    });
    console.log(`   Balance: ${balance}\n`);
  } catch (error) {
    console.log("   Operation failed after retries\n");
  }

  // ============================================================================
  // 3. Streaming Inference
  // ============================================================================
  console.log("3. Streaming inference...");

  try {
    let tokenCount = 0;
    for await (const token of client.streaming.chatStream("gemma3-270m", "What is Tenzro?")) {
      process.stdout.write(token);
      tokenCount++;
    }
    console.log(`\n   Streamed ${tokenCount} tokens\n`);
  } catch (error) {
    console.log("   Streaming not available (requires a served model)\n");
  }

  // ============================================================================
  // 4. Cross-Chain Bridge
  // ============================================================================
  console.log("4. Cross-chain bridge...");

  const bridge = client.bridge();

  try {
    // Get available routes
    const routes = await bridge.getRoutes("tenzro", "ethereum");
    console.log(`   Found ${routes.length} routes from Tenzro to Ethereum`);

    for (const route of routes) {
      console.log(`   - ${route.adapter}: fee=${route.estimated_fee}, time=${route.estimated_time_secs}s`);
    }

    // Estimate bridge fee
    const fee = await bridge.estimateFee("tenzro", "ethereum", "TNZO", "1000000000000000000");
    console.log(`   Estimated fee: ${fee.native_fee}\n`);
  } catch (error) {
    console.log("   Bridge not available\n");
  }

  // ============================================================================
  // 5. Staking
  // ============================================================================
  console.log("5. Staking operations...");

  try {
    const stakeResult = await client.staking.stake("1000", "model_provider");
    console.log(`   Staked: ${stakeResult.amount} as ${stakeResult.role}`);
    console.log(`   Tx: ${stakeResult.tx_hash}\n`);
  } catch (error) {
    console.log("   Staking not available (requires funded wallet)\n");
  }

  // ============================================================================
  // 6. NFT Collection
  // ============================================================================
  console.log("6. NFT operations...");

  const nft = client.nft();

  try {
    const collection = await nft.createCollection(
      "Tenzro Founders",
      "TFNDR",
      "ERC-721",
      "0x0000000000000000000000000000000000000001"
    );
    console.log(`   Collection: ${collection.name} (${collection.collection_id})`);

    const minted = await nft.mintNft(
      collection.collection_id,
      "1",
      "0x0000000000000000000000000000000000000001",
      "ipfs://QmExample..."
    );
    console.log(`   Minted NFT #${minted.token_id}\n`);
  } catch (error) {
    console.log("   NFT operations not available\n");
  }

  // ============================================================================
  // 7. ZK Proofs
  // ============================================================================
  console.log("7. ZK proof operations...");

  try {
    const circuits = await client.zk.listCircuits();
    console.log(`   Available circuits: ${circuits.length}`);

    for (const circuit of circuits) {
      console.log(`   - ${circuit.name} (${circuit.circuit_type}): ${circuit.constraints} constraints`);
    }
    console.log();
  } catch (error) {
    console.log("   ZK not available\n");
  }

  // ============================================================================
  // 8. TEE Attestation
  // ============================================================================
  console.log("8. TEE operations...");

  try {
    const teeInfo = await client.tee.detectTee();
    console.log(`   TEE available: ${teeInfo.available}`);
    console.log(`   Vendor: ${teeInfo.vendor}`);
    console.log(`   Capabilities: ${teeInfo.capabilities.join(", ")}\n`);
  } catch (error) {
    console.log("   TEE not available\n");
  }

  // ============================================================================
  // 9. Events and Webhooks
  // ============================================================================
  console.log("9. Event operations...");

  const events = client.events();

  try {
    const recentEvents = await events.getEvents({
      from_block: 0,
      limit: 5,
    });
    console.log(`   Recent events: ${recentEvents.length}`);

    for (const event of recentEvents) {
      console.log(`   - ${event.event_type} at block ${event.block_number}`);
    }
    console.log();
  } catch (error) {
    console.log("   Events not available\n");
  }

  // ============================================================================
  // 10. Node Info
  // ============================================================================
  console.log("10. Node information...");

  try {
    const nodeStatus = await client.nodeInfo();
    console.log(`   State: ${nodeStatus.node_state}`);
    console.log(`   Role: ${nodeStatus.role}`);
    console.log(`   Block height: ${nodeStatus.block_height}`);
    console.log(`   Peers: ${nodeStatus.peer_count}`);
    console.log(`   Uptime: ${nodeStatus.uptime_secs}s\n`);
  } catch (error) {
    console.log("   Node info not available\n");
  }

  console.log("=== Advanced Examples Complete ===");
}

// Run the example
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
