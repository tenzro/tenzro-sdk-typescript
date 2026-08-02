/**
 * App developer example — on-chain app registry + non-custodial settlement.
 *
 * Demonstrates the flow a developer follows to bill fiat-priced usage on
 * Tenzro without Tenzro ever holding custody of their payment-provider secrets
 * or their funds:
 *
 *   1. register an app on-chain (permissionless — signed with the developer's
 *      own DID key)
 *   2. (fund the app's own TNZO wallet — omitted here; a normal transfer)
 *   3. after charging the end user fiat on the developer's own PSP, sign a
 *      settlement authorization and have any node execute the TNZO movement
 *   4. deactivate the app when done
 *
 * The developer's key never leaves this process — the SDK computes the
 * canonical hashes and asks a local signer to sign them. For a fully
 * non-custodial backend the signature + DID envelope can be produced in the
 * developer's own service and passed to the `*Presigned` methods instead.
 *
 * Ed25519 here comes from Node's built-in `node:crypto`; the SDK itself carries
 * no runtime dependencies.
 */

import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as nodeSign,
} from "node:crypto";
import type { KeyObject } from "node:crypto";
import {
  AppClient,
  didKeyFromEd25519,
  type AppSigningKeySpec,
  type EnvelopeSigner,
  type SettlementAuthorization,
  type SignContext,
  type Signer,
  type SignerKind,
  type SignerSignature,
} from "../src";

/** Raw 32-byte Ed25519 seed → a `node:crypto` PrivateKey. */
function privateKeyFromSeed(seed: Buffer): KeyObject {
  // PKCS#8 prefix for an Ed25519 private key, followed by the 32-byte seed.
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}

/** Extract the raw 32-byte Ed25519 verifying key from a private key. */
function verifyingKeyFromPrivate(priv: KeyObject): Uint8Array {
  // Node exports the public key as SPKI DER; the last 32 bytes are the key.
  const der = createPublicKey(priv).export({ format: "der", type: "spki" });
  return new Uint8Array(der.subarray(der.length - 32));
}

/**
 * A local Ed25519 key that satisfies both SDK signing seams:
 *  - {@link EnvelopeSigner} signs the RAW DID-envelope preimage (the node
 *    verifies Ed25519 over those exact bytes).
 *  - {@link Signer} signs the 32-byte settlement authorization hash.
 */
class LocalEd25519 implements EnvelopeSigner, Signer {
  readonly verifyingKey: Uint8Array;
  private readonly key: KeyObject;

  constructor(seed: Buffer) {
    this.key = privateKeyFromSeed(seed);
    this.verifyingKey = verifyingKeyFromPrivate(this.key);
  }

  static generate(): LocalEd25519 {
    return new LocalEd25519(randomBytes(32));
  }

  describe(): SignerKind {
    return { kind: "ed25519" };
  }

  async sign(hash: Uint8Array, _ctx: SignContext): Promise<SignerSignature> {
    const sig = nodeSign(null, Buffer.from(hash), this.key);
    return { bytes: new Uint8Array(sig), aux: new Uint8Array(0) };
  }

  async signPreimage(preimage: Uint8Array): Promise<Uint8Array> {
    const sig = nodeSign(null, Buffer.from(preimage), this.key);
    return new Uint8Array(sig);
  }
}

function nowMs(): bigint {
  return BigInt(Date.now());
}

async function main() {
  console.log(
    "=== Tenzro SDK — app registry + non-custodial settlement ===\n",
  );

  const app = AppClient.connect("https://rpc.tenzro.xyz");

  // ------------------------------------------------------------------
  // Developer identity: a did:key derived from a local Ed25519 key.
  // ------------------------------------------------------------------
  const dev = LocalEd25519.generate();
  const developerDid = didKeyFromEd25519(dev.verifyingKey);
  console.log(`developer DID: ${developerDid}`);

  // ------------------------------------------------------------------
  // Backend signing key: a separate Ed25519 key the developer's server
  // uses to authorize settlements. Its verifying key goes on-chain.
  // ------------------------------------------------------------------
  const backend = LocalEd25519.generate();

  // ------------------------------------------------------------------
  // 1. Register the app on-chain (5% developer margin).
  // ------------------------------------------------------------------
  console.log("\n1. Registering app...");
  const appWallet =
    "0x00000000000000000000000000000000000000000000000000000000000000aa";
  const keys: AppSigningKeySpec[] = [
    { keyId: "backend-1", publicKey: backend.verifyingKey },
  ];
  const record = await app.registerApp(
    dev,
    "demo-app",
    developerDid,
    appWallet,
    keys,
    500, // marginBps = 5%
    0n, // minBalance
    true,
  );
  console.log(
    `   registered ${record.app_id} (margin ${record.margin_bps} bps, active=${record.active})`,
  );

  // ------------------------------------------------------------------
  // 2. (Fund the app wallet with the developer's own TNZO — a normal
  //    transfer via WalletClient; omitted for brevity.)
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // 3. After charging the end user fiat on the developer's own PSP,
  //    authorize a TNZO settlement to the payer. `externalRef` is the
  //    PSP charge id and is the idempotency key.
  // ------------------------------------------------------------------
  console.log("\n3. Settling an authorized charge...");
  const auth: SettlementAuthorization = {
    appId: "demo-app",
    chainId: 1337n,
    payerDid: "did:tenzro:human:payer",
    amountTnzo: 1_000_000_000_000_000_000n, // 1 TNZO
    externalRef: "pi_3NqSampleCharge",
    nonce: new Uint8Array(randomBytes(32)),
    expiry: nowMs() + 60_000n,
    keyId: "backend-1",
  };
  const outcome = await app.settleAuthorized(backend, auth);
  console.log(
    `   success=${outcome.success} gross=${outcome.amount_tnzo} net=${outcome.payer_net_tnzo} commission=${outcome.commission_tnzo} duplicate=${outcome.duplicate}`,
  );

  // A replay of the same (appId, externalRef) returns the recorded outcome
  // with duplicate=true — no double charge.
  const replay = await app.settleAuthorized(backend, auth);
  console.log(`   replay duplicate=${replay.duplicate}`);

  // ------------------------------------------------------------------
  // 4. Deactivate the app.
  // ------------------------------------------------------------------
  console.log("\n4. Deactivating app...");
  const updated = await app.setAppStatus(dev, developerDid, "demo-app", false);
  console.log(`   active=${updated.active}`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
