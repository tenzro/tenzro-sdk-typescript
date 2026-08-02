/**
 * Multi-VM settlement — the pointer-model invariant against live testnet.
 *
 * One TNZO balance, four VM views:
 *
 *   native (18-dec wei)             ─┐
 *   evm_wtnzo  (ERC-20, 18-dec)     │  all share the same underlying
 *   svm_wtnzo  (SPL, 9-dec)         │  native balance via the Sei V2
 *   daml_holding (CIP-56, 18-dec)   ─┘  pointer model — no bridge
 *
 * Walks through:
 *   1. spawn two fresh agents (sender + receiver) via `participate`
 *   2. fund the sender from the faucet
 *   3. snapshot all four VM views of the sender's balance
 *   4. drive a `tenzro_crossVmTransfer` (native → evm)
 *   5. re-snapshot both addresses
 *   6. assert the pointer-model invariants:
 *        • native == evm_wtnzo       (EVM tracks native 1:1)
 *        • native == daml_holding    (Canton tracks native 1:1)
 *        • svm_wtnzo == native / 1e9 (SPL is 9-decimal truncation)
 *        • sender_before == sender_after + receiver_after  (conservation)
 *
 * Run with: `npx tsx examples/multivm-settlement.ts`
 *
 * Honest caveat: the testnet handler accepts `tenzro_submitDamlCommand`
 * and returns a typed Canton envelope, but no live Canton participant
 * is wired up. What this example demonstrates is that `daml_holding`
 * is a real view of the underlying balance — the post-transfer delta
 * confirms it.
 */

import { TenzroClient, TokenBalance } from '../src/index';

const TRANSFER_AMOUNT_WEI = '1000000000000000000'; // 1 TNZO
const FAUCET_POLL_SECS = 180;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function printBalance(b: TokenBalance) {
  console.log(`   native       ${b.native.balance_wei} wei`);
  console.log(`   evm_wtnzo    ${b.evm_wtnzo.balance_wei} wei`);
  console.log(`   svm_wtnzo    ${b.svm_wtnzo.balance_base_units} base units (9 dec)`);
  console.log(`   daml_holding ${b.daml_holding.amount_wei} wei`);
}

function assertEqualBig(actual: bigint, expected: bigint, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: actual ${actual}, expected ${expected}`);
  }
}

async function main() {
  console.log('=== Tenzro TS SDK — Multi-VM Settlement ===\n');

  const client = TenzroClient.testnet();

  // --------------------------------------------------------------------
  // 1. Spawn sender + receiver
  // --------------------------------------------------------------------
  console.log('1. Spawning sender and receiver identities...');
  const sender = await client.provider.participate('');
  const receiver = await client.provider.participate('');
  console.log(`   sender   ${sender.address}`);
  console.log(`   receiver ${receiver.address}\n`);

  // --------------------------------------------------------------------
  // 2. Fund sender from faucet
  // --------------------------------------------------------------------
  console.log('2. Requesting faucet TNZO for sender...');
  await client.requestFaucet(sender.address);

  console.log(`   polling balance (up to ${FAUCET_POLL_SECS}s)...`);
  const target = BigInt(TRANSFER_AMOUNT_WEI);
  const started = Date.now();
  let funded = false;
  while ((Date.now() - started) / 1000 < FAUCET_POLL_SECS) {
    let balance = 0n;
    try {
      balance = await client.getBalance(sender.address);
    } catch { /* transient */ }
    if (balance >= target) {
      console.log(`   funded after ${Math.round((Date.now() - started) / 1000)}s\n`);
      funded = true;
      break;
    }
    await sleep(3000);
  }
  if (!funded) {
    throw new Error(`sender never funded within ${FAUCET_POLL_SECS}s — testnet faucet busy`);
  }

  // --------------------------------------------------------------------
  // 3. Snapshot pre-transfer four-view balance
  // --------------------------------------------------------------------
  console.log('3. Pre-transfer balance (4 VM views):');
  const pre = await client.token.getTokenBalance(sender.address);
  printBalance(pre);

  const native = BigInt(pre.native.balance_wei);
  const evm = BigInt(pre.evm_wtnzo.balance_wei);
  const spl = BigInt(pre.svm_wtnzo.balance_base_units);
  const daml = BigInt(pre.daml_holding.amount_wei);
  assertEqualBig(evm, native, 'EVM view diverges from native');
  assertEqualBig(daml, native, 'DAML view diverges from native');
  assertEqualBig(spl, native / 1_000_000_000n, 'SVM truncation incorrect');
  console.log('   invariants pre-transfer hold\n');

  // --------------------------------------------------------------------
  // 4. Cross-VM transfer (native → evm)
  // --------------------------------------------------------------------
  console.log('4. tenzro_crossVmTransfer 1 TNZO sender(native) → receiver(evm)...');
  const result = await client.token.crossVmTransfer({
    token: 'TNZO',
    amount: TRANSFER_AMOUNT_WEI,
    from_vm: 'native',
    to_vm: 'evm',
    from_address: sender.address,
    to_address: receiver.address,
  });
  console.log(`   status: ${result.status}\n`);

  // --------------------------------------------------------------------
  // 5. Snapshot post-transfer views
  // --------------------------------------------------------------------
  console.log('5. Post-transfer sender balance:');
  const senderPost = await client.token.getTokenBalance(sender.address);
  printBalance(senderPost);

  console.log('\n   Post-transfer receiver balance:');
  const receiverPost = await client.token.getTokenBalance(receiver.address);
  printBalance(receiverPost);

  // --------------------------------------------------------------------
  // 6. Conservation + invariants post-transfer
  // --------------------------------------------------------------------
  const sNative = BigInt(senderPost.native.balance_wei);
  const rNative = BigInt(receiverPost.native.balance_wei);
  const sEvm = BigInt(senderPost.evm_wtnzo.balance_wei);
  const rEvm = BigInt(receiverPost.evm_wtnzo.balance_wei);
  const sSpl = BigInt(senderPost.svm_wtnzo.balance_base_units);
  const sDaml = BigInt(senderPost.daml_holding.amount_wei);

  assertEqualBig(sEvm, sNative, 'sender EVM view diverges from native');
  assertEqualBig(rEvm, rNative, 'receiver EVM view diverges from native');
  assertEqualBig(sDaml, sNative, 'sender DAML view diverges from native');
  assertEqualBig(sSpl, sNative / 1_000_000_000n, 'sender SVM truncation incorrect');
  assertEqualBig(sNative + rNative, native, 'conservation broken');

  console.log('\n6. Pointer-model invariants post-transfer: ALL PASS');
  console.log('   • native == evm_wtnzo (sender & receiver)');
  console.log('   • native == daml_holding (sender)');
  console.log('   • svm_wtnzo == native / 1e9 (sender)');
  console.log('   • conservation: sender_before == sender_after + receiver_after');

  console.log('\n=== Multi-VM settlement complete ===');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
