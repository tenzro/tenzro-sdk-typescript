/**
 * Tenzro Network TypeScript SDK - Marketplace Examples
 *
 * This example demonstrates:
 * - Task Marketplace: post tasks, list tasks, submit quotes, cancel tasks
 * - Agent Template Marketplace: browse templates, register templates, get details
 */

import { TenzroClient, TESTNET_CONFIG } from "../src/index";

async function main() {
  console.log("=== Tenzro SDK Marketplace Examples ===\n");

  // Connect to testnet
  const client = new TenzroClient(TESTNET_CONFIG);
  console.log("Connected to testnet\n");

  const task = client.task();
  const marketplace = client.marketplace();

  // ============================================================================
  // PART 1: TASK MARKETPLACE
  // ============================================================================
  console.log("--- TASK MARKETPLACE ---\n");

  // ============================================================================
  // 1. List open tasks
  // ============================================================================
  console.log("1. Listing open tasks...");
  const openTasks = await task.listTasks({
    status: "open",
    limit: 10,
    offset: 0,
  });
  console.log(`   Found ${openTasks.length} open tasks\n`);

  for (const t of openTasks) {
    console.log(`   Task: ${t.title}`);
    console.log(`     ID: ${t.task_id}`);
    console.log(`     Type: ${t.task_type}`);
    console.log(`     Max price: ${t.max_price} wei`);
    console.log(`     Status: ${t.status}`);
    console.log();
  }

  // ============================================================================
  // 2. Post a new task to the marketplace
  // ============================================================================
  console.log("2. Posting a new task to the marketplace...");
  const posted = await task.postTask({
    title: "Code Review: TypeScript async refactor",
    description:
      "Review the attached TypeScript module and suggest improvements for " +
      "async patterns, error handling, and idiomatic TypeScript usage.",
    task_type: "code_review",
    max_price: "50000000000000000000", // 50 TNZO in wei
    input: "async function fetchData(): Promise<Data> { ... }",
    priority: "normal",
  });

  console.log("   Task posted!");
  console.log(`   Task ID: ${posted.task_id}`);
  console.log(`   Title: ${posted.title}`);
  console.log(`   Status: ${posted.status}\n`);

  // ============================================================================
  // 3. Get task details
  // ============================================================================
  console.log("3. Getting task details...");
  try {
    const details = await task.getTask(posted.task_id);
    console.log(`   Task: ${details.title}`);
    console.log(`   Poster: ${details.poster}`);
    console.log(`   Status: ${details.status}`);
    console.log(`   Max price: ${details.max_price} wei`);
    console.log(`   Created at: ${details.created_at}`);
    console.log();
  } catch (e) {
    console.log(`   Note: Could not fetch task details: ${e}\n`);
  }

  // ============================================================================
  // 4. Submit a quote (as a model provider)
  // ============================================================================
  console.log("4. Submitting a quote for the task...");
  try {
    const quote = await task.submitQuote(
      posted.task_id,
      "45000000000000000000", // 45 TNZO
      "gemma3-270m",
      120,
    );
    console.log("   Quote submitted!");
    console.log(`   Price: ${quote.price} wei`);
    console.log(`   Model: ${quote.model_id}`);
    console.log(`   ETA: ${quote.estimated_duration_secs}s\n`);
  } catch (e) {
    console.log(`   Note: Could not submit quote: ${e}\n`);
  }

  // ============================================================================
  // 5. Cancel the task
  // ============================================================================
  console.log("5. Cancelling the task...");
  try {
    await task.cancelTask(posted.task_id);
    console.log(`   Task ${posted.task_id} cancelled successfully\n`);
  } catch (e) {
    console.log(`   Note: Could not cancel task: ${e}\n`);
  }

  // ============================================================================
  // PART 2: AGENT TEMPLATE MARKETPLACE
  // ============================================================================
  console.log("--- AGENT TEMPLATE MARKETPLACE ---\n");

  // ============================================================================
  // 6. Browse free templates
  // ============================================================================
  console.log("6. Browsing free agent templates...");
  const freeTemplates = await marketplace.listAgentTemplates({
    free_only: true,
    limit: 10,
    offset: 0,
  });
  console.log(`   Found ${freeTemplates.length} free templates\n`);

  for (const tmpl of freeTemplates) {
    console.log(`   Template: ${tmpl.name}`);
    console.log(`     ID: ${tmpl.template_id}`);
    console.log(`     Type: ${tmpl.template_type}`);
    console.log(`     Downloads: ${tmpl.download_count}`);
    console.log(`     Rating: ${tmpl.rating}/100`);
    console.log();
  }

  // ============================================================================
  // 7. Register a free specialist agent template
  // ============================================================================
  console.log("7. Registering a free TypeScript code reviewer template...");
  const tsReviewer = await marketplace.registerAgentTemplate({
    name: "TypeScript Code Reviewer",
    description:
      "Autonomous agent that reviews TypeScript/JavaScript code for correctness, " +
      "type safety, performance, and adherence to modern best practices.",
    template_type: "specialist",
    system_prompt:
      "You are an expert TypeScript code reviewer. " +
      "Check for: type safety, proper error handling, unnecessary any types, " +
      "Promise handling, and modern TypeScript idioms.",
    tags: ["typescript", "javascript", "code-review", "programming"],
    pricing: { type: "free" },
  });

  console.log("   Template registered!");
  console.log(`   Template ID: ${tsReviewer.template_id}`);
  console.log(`   Name: ${tsReviewer.name}\n`);

  // ============================================================================
  // 8. Get detailed template information
  // ============================================================================
  console.log("8. Fetching detailed template information...");
  try {
    const details = await marketplace.getAgentTemplate(tsReviewer.template_id);
    console.log(`   Template: ${details.name}`);
    console.log(`   Creator: ${details.creator}`);
    console.log(`   Version: ${details.version}`);
    console.log(`   Status: ${details.status}`);
    console.log(`   Tags: ${details.tags.join(", ")}`);
    console.log();
  } catch (e) {
    console.log(`   Note: Could not fetch template details: ${e}\n`);
  }

  console.log("=== Marketplace Example Complete ===");
}

main().catch(console.error);
