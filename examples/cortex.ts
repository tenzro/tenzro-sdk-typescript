/**
 * Tenzro Network TypeScript SDK — Cortex Recurrent-Depth Reasoning Example
 *
 * Demonstrates:
 * - Listing locally-registered Cortex workers
 * - Listing remote Cortex workers (gossip-discovered)
 * - Submitting a Standard-tier reasoning request
 * - Submitting an Institutional-tier request with TEE attestation
 * - Inspecting the signed CortexReceipt
 * - Computing cost via DEFAULT_CORTEX_PRICING / computeCortexCost
 */

import {
  TenzroClient,
  DEFAULT_CORTEX_PRICING,
  computeCortexCost,
  type CortexRequest,
} from "../src/index";

async function main(): Promise<void> {
  console.log("=== Tenzro SDK Cortex Reasoning Example ===\n");

  const client = TenzroClient.testnet();
  const cortex = client.cortex;

  // 1. Local worker discovery
  console.log("Listing locally-registered Cortex workers...");
  try {
    const list = await cortex.listWorkers();
    console.log(`  Local workers: ${list.count}`);
    for (const w of list.workers.slice(0, 5)) {
      console.log(`    ${JSON.stringify(w)}`);
    }
  } catch (e) {
    console.log(`  (failed: ${(e as Error).message})`);
  }
  console.log();

  // 2. Remote worker discovery (gossip-learned)
  console.log("Listing remote Cortex workers learned via gossip...");
  try {
    const list = await cortex.listRemoteWorkers();
    console.log(`  Remote workers: ${list.count}`);
    for (const w of list.workers.slice(0, 5)) {
      console.log(`    ${JSON.stringify(w)}`);
    }
  } catch (e) {
    console.log(`  (failed: ${(e as Error).message})`);
  }
  console.log();

  // 3. Standard-tier reasoning request (8 loops, no attestation)
  const modelId = "openmythos-3b";
  console.log(`Submitting Standard-tier reasoning request to ${modelId}...`);
  try {
    const resp = await cortex.reason(
      modelId,
      "What is the capital of France?",
      "standard",
    );
    console.log(`  request_id: ${resp.request_id}`);
    console.log(
      `  output: ${
        typeof resp.output === "string"
          ? resp.output
          : Buffer.from(resp.output).toString("utf8")
      }`,
    );
    console.log(
      `  tokens_in=${resp.metadata.input_tokens} tokens_out=${resp.metadata.output_tokens} loops_used=${resp.metadata.loops_used} latency_ms=${resp.metadata.latency_ms}`,
    );
    console.log(`  price_tnzo=${resp.price_tnzo} settled=${resp.settled}`);
    console.log(`  receipt.worker_did=${resp.receipt.worker_did}`);
    console.log(`  receipt.weights_hash=${resp.receipt.weights_hash}`);
    console.log(
      `  receipt.loops_requested=${resp.receipt.loops_requested} loops_used=${resp.receipt.loops_used}`,
    );
  } catch (e) {
    console.log(`  (failed: ${(e as Error).message})`);
  }
  console.log();

  // 4. Institutional-tier reasoning request with TEE attestation + custom budget
  console.log(
    "Submitting Institutional-tier reasoning request with TEE attestation...",
  );
  const req: CortexRequest = {
    model_id: modelId,
    input: "Plan a multi-step trade strategy",
    tier: "institutional",
    min_loops: 16,
    max_loops: 32,
    max_cost_tnzo: 1_000_000_000_000_000_000, // 1 TNZO ceiling
    deadline_ms: 30_000,
    attestation: "tee",
  };
  try {
    const resp = await cortex.reasonWithRequest(req);
    console.log(
      `  receipt.tee_quote present: ${
        resp.receipt.tee_quote != null && resp.receipt.tee_quote.length > 0
      }`,
    );
    console.log(
      `  receipt.zk_proof present: ${
        resp.receipt.zk_proof != null && resp.receipt.zk_proof.length > 0
      }`,
    );
    console.log(`  price_tnzo=${resp.price_tnzo}`);
  } catch (e) {
    console.log(`  (failed: ${(e as Error).message})`);
  }
  console.log();

  // 5. Local cost estimation via DEFAULT_CORTEX_PRICING
  const estimated = computeCortexCost(DEFAULT_CORTEX_PRICING, 50, 100, 8, "none");
  const estimatedTee = computeCortexCost(DEFAULT_CORTEX_PRICING, 50, 100, 16, "tee");
  const estimatedFull = computeCortexCost(
    DEFAULT_CORTEX_PRICING,
    50,
    100,
    32,
    "tee_and_zk",
  );
  console.log("Cost estimates (smallest TNZO unit):");
  console.log(`  Standard      (8 loops, no attestation):  ${estimated}`);
  console.log(`  Deep          (16 loops, TEE attestation): ${estimatedTee}`);
  console.log(`  Institutional (32 loops, TEE+ZK):          ${estimatedFull}`);

  console.log("\n=== Cortex example completed ===");
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
