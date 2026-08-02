/**
 * Canton with API key — the full operator → subject lifecycle.
 *
 * Walks the full per-operator sovereignty flow for a node's
 * Canton-scoped key:
 *
 *   1. The operator (holder of this node's `X-Tenzro-Admin-Token`)
 *      mints a `subject`-class key bound to a Tenzro DID, scoped to
 *      `canton`. The plaintext `tnz_...` token is shown exactly once.
 *   2. The subject (holder of the `tnz_...` key, exported as
 *      `TENZRO_API_KEY`) uses it to call a scope-gated Canton RPC.
 *   3. The subject lists its own keys via `listMine` (subject-gated
 *      surface — no admin token required).
 *   4. The subject self-revokes the key via `revokeMine`. Operator
 *      involvement is not needed for the revocation, mirroring the
 *      "key-holder controls their own revocation" property of the
 *      `subject` class.
 *
 * Required environment for a full run against a live node:
 *
 *   TENZRO_ADMIN_TOKEN     — operator's admin token for the target node
 *   TENZRO_SUBJECT_DID     — subject identifier to bind the key to
 *                            (e.g. did:tenzro:human:<uuid>)
 *
 * If `TENZRO_ADMIN_TOKEN` is unset the example prints the plan and
 * exits cleanly — useful in CI where no operator credential is
 * configured.
 */

import { TenzroClient } from "../src/index";

async function main(): Promise<void> {
  console.log("=== Canton with API key — operator → subject lifecycle ===\n");

  const adminToken = process.env.TENZRO_ADMIN_TOKEN;
  const subjectDid =
    process.env.TENZRO_SUBJECT_DID ?? "did:tenzro:human:example-subject";

  if (!adminToken) {
    console.log("TENZRO_ADMIN_TOKEN is not set — dry run only.\n");
    console.log("To run the full flow against a live node, export:");
    console.log("  TENZRO_ADMIN_TOKEN=<operator token for the target node>");
    console.log("  TENZRO_SUBJECT_DID=did:tenzro:human:<uuid>");
    console.log("\nThen re-run this example.");
    return;
  }

  // ── Step 1: operator mints a subject-class key with `canton` scope ──
  //
  // The operator client picks up `TENZRO_ADMIN_TOKEN` from the env
  // and forwards it as `X-Tenzro-Admin-Token` on every request.
  const operator = TenzroClient.testnet();
  console.log("1. Operator mints a subject-class Canton key.");
  const created = await operator.apiKey.create({
    label: `canton-example-${Math.floor(Date.now() / 1000)}`,
    subject: subjectDid,
    scopes: ["canton"],
    class: "subject",
  });
  console.log(`   key_id:    ${created.key_id}`);
  console.log(`   subject:   ${created.subject}`);
  console.log(`   scopes:    ${JSON.stringify(created.scopes)}`);
  console.log(`   class:     ${created.class}`);
  console.log(
    `   plaintext: ${created.key} (shown EXACTLY once — persist immediately)\n`,
  );

  // ── Step 2: subject uses the key for a scope-gated Canton call ──
  //
  // In a live deployment the subject would export the plaintext
  // `tnz_...` key as `TENZRO_API_KEY` in their own environment, on
  // a machine that has no access to the operator's admin token.
  // Here we set both env vars for the lifetime of this process so the
  // example runs in one binary — and also clear `TENZRO_ADMIN_TOKEN`
  // so the subject client cannot accidentally piggyback on operator
  // privileges.
  process.env.TENZRO_API_KEY = created.key;
  delete process.env.TENZRO_ADMIN_TOKEN;
  const subject = TenzroClient.testnet();

  console.log("2. Subject uses the key to query Canton domains.");
  try {
    const domains = await subject.rpc.call<{ domains: unknown[] }>(
      "tenzro_listCantonDomains",
      {},
    );
    console.log(`   Domains returned: ${domains.domains.length}\n`);
  } catch (e) {
    console.log(`   list_domains failed: ${(e as Error).message}\n`);
  }

  // ── Step 3: subject lists its own keys (no admin token needed) ──
  console.log("3. Subject lists its own keys via listMine.");
  const mine = await subject.apiKey.listMine();
  console.log(`   Subject:   ${mine.subject}`);
  console.log(`   Key count: ${mine.keys.length}\n`);

  // ── Step 4: subject self-revokes the key ──
  console.log("4. Subject self-revokes the key via revokeMine.");
  const revoked = await subject.apiKey.revokeMine(created.key_id);
  console.log(`   key_id:    ${revoked.key_id}`);
  console.log(`   revoked:   ${revoked.revoked}\n`);

  console.log("Done. The key is now inactive — further Canton calls with");
  console.log("this key will fail with -32004 (unknown or revoked).");
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
