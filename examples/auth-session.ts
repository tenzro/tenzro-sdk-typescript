/**
 * Tenzro TypeScript SDK — OAuth 2.1 + DPoP auth session example.
 *
 * Walks through the full auth lifecycle a Tenzro client cares about:
 *
 *   1. Onboard a human  — provisions a TDIP `did:tenzro:human:*` identity,
 *      a fresh MPC wallet, and an OAuth 2.1 access + refresh token pair
 *      (RFC 6749 successor). The access token is an HS256 JWT (1h TTL);
 *      the refresh token is an opaque UUID (30-day TTL, no rotation in V1).
 *   2. Refresh the access token — exchange the refresh token for a fresh
 *      access token without re-onboarding.
 *   3. Link an existing wallet — mint a fresh access + refresh token pair
 *      against an existing MPC wallet (e.g. one provisioned earlier via
 *      `tenzro_createWallet`).
 *
 * Pass the holder's RFC 7638 SHA-256 thumbprint (`dpopJkt`) on every call
 * to bind the issued token to a specific Ed25519 holder key. Every
 * subsequent privileged RPC must then accompany the bearer with a fresh
 * DPoP proof in the `DPoP` header signed by the same key (RFC 9449).
 *
 * Run with: `npx ts-node examples/auth-session.ts`
 */

import { TenzroClient } from "../src/index";

async function main() {
  console.log("=== Tenzro TypeScript SDK — Auth Session Example ===\n");

  const client = TenzroClient.testnet();

  // 1. Onboard a human. `dpopJkt` is optional but strongly recommended:
  // pass the RFC 7638 thumbprint of the holder's Ed25519 key so the JWT
  // is DPoP-bound to that key.
  console.log("Onboarding a new human participant...");
  const session = await client.auth.onboardHuman("Alice");

  const did = (session.identity as Record<string, unknown>)?.did ?? "(unknown)";
  const walletAddr =
    (session.wallet as Record<string, unknown>)?.address ?? "(unknown)";

  console.log(`  did:           ${did}`);
  console.log(`  wallet:        ${walletAddr}`);
  console.log(
    `  access_token:  ${session.access_token.slice(0, 32)}…`
  );
  console.log(`  expires_in:    ${session.expires_in ?? 3600}s`);
  if (session.refresh_token) {
    console.log(
      `  refresh_token: ${session.refresh_token.slice(0, 8)}…`
    );
  }
  console.log(`  dpop_bound:    ${session.dpop_bound ?? false}\n`);

  // 2. Refresh the access token. The refresh token is NOT rotated in V1
  // — only the access token changes. Run this whenever the access token
  // nears expiry.
  if (session.refresh_token) {
    console.log("Refreshing the access token...");
    const refreshed = await client.auth.refreshToken(session.refresh_token);
    console.log(
      `  new access_token: ${refreshed.access_token.slice(0, 32)}…`
    );
    console.log(`  expires_in:       ${refreshed.expires_in ?? 3600}s`);
    console.log(`  dpop_bound:       ${refreshed.dpop_bound ?? false}\n`);
  }

  // 3. Link an existing wallet to a new auth session. This is useful
  // when the holder already provisioned a wallet via `tenzro_createWallet`
  // (or imported one) and now wants OAuth-style auth credentials without
  // re-running onboarding.
  const walletId = (session.wallet as Record<string, unknown>)?.wallet_id as
    | string
    | undefined;

  if (walletId) {
    console.log("Linking the existing wallet to a fresh auth session...");
    const linked = await client.auth.linkWalletForAuth(walletId, {
      displayName: "Alice (linked)",
    });
    console.log(
      `  access_token:  ${linked.access_token.slice(0, 32)}…`
    );
    if (linked.refresh_token) {
      console.log(
        `  refresh_token: ${linked.refresh_token.slice(0, 8)}…\n`
      );
    }
  }

  console.log("Auth lifecycle exercised in full.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
