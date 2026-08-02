/**
 * Task marketplace settlement cycle — run in full against the live testnet.
 *
 * Walks through the full money-moving path:
 *
 *   participate (poster)  → faucet → postTask
 *   participate (provider)         → quoteTask
 *                                  → assignTask    (locks price)
 *                                  → completeTask  (TNZO transfer)
 *   getTokenBalance                → reconcile poster/provider deltas
 *
 * `completeTask` is the moneyed step: the RPC handler transfers
 * `final_price` (the quoted price, or `max_price` if unquoted) from the
 * poster's wallet to the provider's wallet through the unified token
 * registry. The settlement block in the response contains the
 * post-transfer balances; the example confirms them via
 * `tenzro_getTokenBalance`.
 *
 * Run with: `npx tsx examples/task-settlement-cycle.ts`
 *
 * Honest caveat: `participate` currently takes a password string that
 * the live RPC handler silently ignores. We pass empty strings to make
 * that explicit.
 */

import { TenzroClient } from '../src/index';

const POST_PRICE_WEI = '1000000000000000000';  // 1 TNZO
const QUOTE_PRICE_WEI = '900000000000000000'; // 0.9 TNZO
const FAUCET_POLL_SECS = 180;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('=== Tenzro TS SDK — Task Marketplace Settlement Cycle ===\n');

  const client = TenzroClient.testnet();

  // --------------------------------------------------------------------
  // 1. Spawn poster + provider
  // --------------------------------------------------------------------
  console.log('1. Spawning poster and provider identities...');
  const poster = await client.provider.participate('');
  const provider = await client.provider.participate('');
  console.log(`   poster   ${poster.address}`);
  console.log(`   provider ${provider.address}\n`);

  // --------------------------------------------------------------------
  // 2. Fund poster from faucet
  // --------------------------------------------------------------------
  console.log('2. Requesting faucet TNZO for poster...');
  const faucet = await client.requestFaucet(poster.address);
  console.log(`   faucet response: ${JSON.stringify(faucet)}`);

  console.log(`   polling balance (up to ${FAUCET_POLL_SECS}s)...`);
  const target = BigInt(POST_PRICE_WEI);
  const started = Date.now();
  let funded = false;
  while ((Date.now() - started) / 1000 < FAUCET_POLL_SECS) {
    let balance = 0n;
    try {
      balance = await client.getBalance(poster.address);
    } catch { /* transient — keep polling */ }
    if (balance >= target) {
      console.log(
        `   funded after ${Math.round((Date.now() - started) / 1000)}s — balance ${balance} wei\n`,
      );
      funded = true;
      break;
    }
    await sleep(3000);
  }
  if (!funded) {
    throw new Error(`poster never funded within ${FAUCET_POLL_SECS}s — testnet faucet busy`);
  }

  // --------------------------------------------------------------------
  // 3. Snapshot pre-settlement balances
  // --------------------------------------------------------------------
  const posterBefore = await client.getBalance(poster.address);
  const providerBefore = await client.getBalance(provider.address);
  console.log('3. Pre-settlement balances:');
  console.log(`   poster    ${posterBefore} wei`);
  console.log(`   provider  ${providerBefore} wei\n`);

  // --------------------------------------------------------------------
  // 4. Poster opens a task
  // --------------------------------------------------------------------
  console.log('4. Posting task (max_price 1 TNZO, type=inference)...');
  const posted = await client.task().postTask({
    title: 'Sentiment analysis: 2 reviews',
    description: 'Score sentiment 1-5 for each input review.',
    task_type: 'inference',
    max_price: POST_PRICE_WEI,
    input: '["Great product!", "Needs improvement."]',
    poster: poster.address,
  });
  console.log(`   task_id ${posted.task_id}`);
  console.log(`   status  ${posted.status}\n`);

  // --------------------------------------------------------------------
  // 5. Provider submits a quote
  // --------------------------------------------------------------------
  console.log('5. Provider quotes at 0.9 TNZO...');
  const quote = await client.task().quoteTask(
    posted.task_id,
    provider.address,
    QUOTE_PRICE_WEI,
    {
      modelId: 'gemma3-270m',
      confidence: 90,
      estimatedDurationSecs: 45,
      notes: 'Quick sentiment scoring with Gemma 3 270M.',
    },
  );
  console.log(`   price ${quote.price} wei, model ${quote.model_id}\n`);

  // --------------------------------------------------------------------
  // 6. Poster assigns, locking quoted price
  // --------------------------------------------------------------------
  console.log('6. Poster assigns task to provider (locks 0.9 TNZO)...');
  const assignment = await client.task().assignTask(
    posted.task_id,
    provider.address,
    QUOTE_PRICE_WEI,
  );
  console.log(`   assignment: ${JSON.stringify(assignment)}\n`);

  // --------------------------------------------------------------------
  // 7. Provider completes — settlement fires on-chain
  // --------------------------------------------------------------------
  console.log('7. Completing task (triggers on-chain TNZO transfer)...');
  const receipt = await client.task().completeTask(
    posted.task_id,
    '[{"review":"Great product!","score":5},{"review":"Needs improvement.","score":2}]',
  );
  console.log(`   status     ${receipt.status}`);
  console.log(`   settlement ${JSON.stringify(receipt.settlement)}\n`);

  // --------------------------------------------------------------------
  // 8. Reconcile via tenzro_getBalance
  // --------------------------------------------------------------------
  console.log('8. Post-settlement balances:');
  const posterAfter = await client.getBalance(poster.address);
  const providerAfter = await client.getBalance(provider.address);
  console.log(
    `   poster    ${posterAfter} wei  (Δ ${posterBefore - posterAfter} wei)`,
  );
  console.log(
    `   provider  ${providerAfter} wei  (Δ +${providerAfter - providerBefore} wei)`,
  );

  // Cross-VM view of the provider's settled balance
  console.log('\n9. Provider balance via cross-VM views (pointer model):');
  const mv = await client.token.getTokenBalance(provider.address);
  console.log(JSON.stringify(mv, null, 2));

  console.log('\n=== Settlement cycle complete ===');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
