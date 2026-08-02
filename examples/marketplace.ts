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
  const client = new TenzroClient({
    ...TESTNET_CONFIG,
    timeout: 60000,
  });
  console.log("Connected to testnet\n");

  // A wallet used as task poster, quote provider, and template creator.
  const creatorWallet = await client.wallet.createWallet();
  console.log(`Using wallet ${creatorWallet.address}\n`);

  // ============================================================================
  // PART 1: TASK MARKETPLACE
  // ============================================================================
  console.log("--- TASK MARKETPLACE ---\n");

  // ============================================================================
  // 1. List open tasks
  // ============================================================================
  console.log("1. Listing open tasks...");
  const openTasks = await client.task().listTasks({
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
  // 2. List tasks filtered by type
  // ============================================================================
  console.log("2. Listing code_review tasks...");
  const reviewTasks = await client.task().listTasks({
    status: "open",
    task_type: "code_review",
    limit: 5,
    offset: 0,
  });
  console.log(`   Found ${reviewTasks.length} code review tasks\n`);

  // ============================================================================
  // 3. Post a new task to the marketplace
  // ============================================================================
  console.log("3. Posting a new task to the marketplace...");
  const posted = await client.task().postTask({
    title: "Code Review: TypeScript async refactor",
    description:
      "Review the attached TypeScript module and suggest improvements for " +
      "async patterns, error handling, and idiomatic TypeScript usage.",
    task_type: "code_review",
    max_price: "50000000000000000000", // 50 TNZO in wei
    input: "async function fetchData(): Promise<Data> { ... }",
    poster: creatorWallet.address,
    priority: "normal",
  });

  console.log("   Task posted!");
  console.log(`   Task ID: ${posted.task_id}`);
  console.log(`   Title: ${posted.title}`);
  console.log(`   Status: ${posted.status}\n`);

  // ============================================================================
  // 4. Get task details
  // ============================================================================
  console.log("4. Getting task details...");
  try {
    const details = await client.task().getTask(posted.task_id);
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
  // 5. Submit a quote (as a model provider)
  // ============================================================================
  console.log("5. Submitting a quote for the task...");
  try {
    const quote = await client.task().quoteTask(
      posted.task_id,
      creatorWallet.address,
      "45000000000000000000", // 45 TNZO
      {
        modelId: "gemma3-270m",
        estimatedDurationSecs: 120,
        confidence: 90,
        notes:
          "Can complete this within 2 minutes using Gemma 3 270M model. " +
          "Will provide detailed line-by-line review.",
      }
    );
    console.log("   Quote submitted!");
    console.log(`   Price: ${quote.price} wei`);
    console.log(`   Model: ${quote.model_id}`);
    console.log(`   ETA: ${quote.estimated_duration_secs}s`);
    console.log(`   Confidence: ${quote.confidence}%\n`);
  } catch (e) {
    console.log(`   Note: Could not submit quote: ${e}\n`);
  }

  // ============================================================================
  // 6. Post an inference task
  // ============================================================================
  console.log("6. Posting an AI inference task...");
  const inferenceTask = await client.task().postTask({
    title: "Summarize research paper",
    description:
      "Summarize the following abstract in 3 bullet points for a non-technical audience.",
    task_type: "inference",
    max_price: "10000000000000000000", // 10 TNZO
    input: "Abstract: We present a novel approach to zero-knowledge proofs...",
    poster: creatorWallet.address,
    priority: "normal",
  });
  console.log(`   Inference task posted: ${inferenceTask.task_id}\n`);

  // ============================================================================
  // 7. Cancel the inference task
  // ============================================================================
  console.log("7. Cancelling the inference task...");
  try {
    await client.task().cancelTask(inferenceTask.task_id);
    console.log(`   Task ${inferenceTask.task_id} cancelled successfully\n`);
  } catch (e) {
    console.log(`   Note: Could not cancel task: ${e}\n`);
  }

  // ============================================================================
  // PART 2: AGENT TEMPLATE MARKETPLACE
  // ============================================================================
  console.log("--- AGENT TEMPLATE MARKETPLACE ---\n");

  // ============================================================================
  // 8. Browse free templates
  // ============================================================================
  console.log("8. Browsing free agent templates...");
  const freeTemplates = await client.marketplace().listAgentTemplates({
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
  // 9. Browse all templates (including paid)
  // ============================================================================
  console.log("9. Browsing all templates...");
  const allTemplates = await client.marketplace().listAgentTemplates({
    limit: 20,
    offset: 0,
  });
  console.log(`   Found ${allTemplates.length} total templates\n`);

  // ============================================================================
  // 10. Register a free specialist agent template
  // ============================================================================
  console.log("10. Registering a free TypeScript code reviewer template...");
  const tsReviewer = await client.marketplace().registerAgentTemplate({
    name: "TypeScript Code Reviewer",
    creator: creatorWallet.address,
    description:
      "Autonomous agent that reviews TypeScript/JavaScript code for correctness, " +
      "type safety, performance, and adherence to modern best practices. " +
      "Provides specific, actionable feedback with examples.",
    template_type: "specialist",
    system_prompt:
      "You are an expert TypeScript code reviewer with deep knowledge of the " +
      "TypeScript/JavaScript ecosystem, type system, async/await patterns, and best practices. " +
      "When reviewing code, check for: type safety, proper error handling, " +
      "unnecessary any types, Promise handling, and modern TypeScript idioms. " +
      "Provide specific line-by-line feedback with suggested improvements.",
    tags: ["typescript", "javascript", "code-review", "programming"],
    pricing: { type: "free" },
  });

  console.log("   Template registered!");
  console.log(`   Template ID: ${tsReviewer.template_id}`);
  console.log(`   Name: ${tsReviewer.name}`);
  console.log(`   Type: ${tsReviewer.template_type}`);
  console.log(`   Downloads: ${tsReviewer.download_count}`);
  console.log(`   Rating: ${tsReviewer.rating}/100\n`);

  // ============================================================================
  // 11. Register a paid per-execution autonomous agent template
  // ============================================================================
  console.log(
    "11. Registering a paid autonomous data analysis agent template..."
  );
  const dataAgent = await client.marketplace().registerAgentTemplate({
    name: "Advanced Data Analyst",
    creator: creatorWallet.address,
    description:
      "Specialist agent for statistical analysis, chart generation, and data visualization. " +
      "Processes CSV, JSON, and Excel data. Generates summaries, identifies trends, " +
      "and produces actionable insights.",
    template_type: "specialist",
    system_prompt:
      "You are an expert data analyst. When given data, you will: " +
      "1) Parse and validate the data format, 2) Perform statistical analysis, " +
      "3) Identify patterns and anomalies, 4) Generate structured insights, " +
      "5) Suggest visualizations. Always return structured JSON output.",
    tags: ["data", "analytics", "statistics", "visualization"],
    pricing: {
      type: "per_execution",
      price: "5000000000000000000", // 5 TNZO per run
    },
    creator_wallet: creatorWallet.address,
  });

  console.log("   Template registered!");
  console.log(`   Template ID: ${dataAgent.template_id}`);
  console.log(`   Pricing: per_execution (5 TNZO)\n`);

  // ============================================================================
  // 12. Register a subscription-based orchestrator template
  // ============================================================================
  console.log(
    "12. Registering a subscription-based orchestrator template..."
  );
  const orchestrator = await client.marketplace().registerAgentTemplate({
    name: "Research Pipeline Orchestrator",
    creator: creatorWallet.address,
    description:
      "Workflow orchestrator that coordinates multiple specialist agents to conduct " +
      "comprehensive research. Spawns web search agents, data analysis agents, and " +
      "report generation agents, then synthesizes results into structured reports.",
    template_type: "orchestrator",
    system_prompt:
      "You are a research pipeline orchestrator. When given a research topic, you will: " +
      "1) Decompose the topic into subtasks, 2) Delegate to specialist agents, " +
      "3) Collect and validate results, 4) Synthesize findings, 5) Generate a structured report. " +
      "Coordinate up to 5 parallel agents. Track progress and handle failures gracefully.",
    tags: ["research", "orchestration", "multi-agent", "workflows"],
    pricing: {
      type: "subscription",
      monthly_rate: "50000000000000000000", // 50 TNZO per month
    },
    creator_wallet: creatorWallet.address,
  });

  console.log("   Template registered!");
  console.log(`   Template ID: ${orchestrator.template_id}`);
  console.log(`   Pricing: subscription (50 TNZO/month)\n`);

  // ============================================================================
  // 13. Get detailed information for a registered template
  // ============================================================================
  console.log("13. Fetching detailed template information...");
  try {
    const details = await client.marketplace().getAgentTemplate(
      tsReviewer.template_id
    );
    console.log(`   Template: ${details.name}`);
    console.log(`   Creator: ${details.creator}`);
    console.log(`   Version: ${details.version}`);
    console.log(`   Status: ${details.status}`);
    console.log(`   Downloads: ${details.download_count}`);
    console.log(`   Rating: ${details.rating}/100`);
    console.log(`   Tags: ${details.tags.join(", ")}`);
    console.log(
      `   Description: ${details.description.substring(0, 80)}...`
    );
    console.log();
  } catch (e) {
    console.log(`   Note: Could not fetch template details: ${e}\n`);
  }

  // ============================================================================
  // 14. Summary
  // ============================================================================
  console.log("14. Summary of registered templates:");
  console.log(
    `   - TypeScript Code Reviewer (ID: ${tsReviewer.template_id.substring(0, 8)}...)`
  );
  console.log(`     Type: Specialist | Pricing: Free`);
  console.log(
    `   - Advanced Data Analyst (ID: ${dataAgent.template_id.substring(0, 8)}...)`
  );
  console.log(`     Type: Specialist | Pricing: 5 TNZO per execution`);
  console.log(
    `   - Research Pipeline Orchestrator (ID: ${orchestrator.template_id.substring(0, 8)}...)`
  );
  console.log(`     Type: Orchestrator | Pricing: 50 TNZO/month subscription`);

  console.log("\n=== Marketplace Example Complete ===");
}

main().catch(console.error);
