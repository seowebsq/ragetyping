// Self-check for the Rage Pass signature. Run: node lib/pass.check.ts
import assert from "node:assert/strict";
import { signPass, verifyPass, hasPass, PASS_COOKIE } from "./pass.ts";

const secret = "test-secret";
const future = Date.now() + 60_000;

const token = await signPass(secret, { sid: "cs_test_123", exp: future });

assert.equal((await verifyPass(secret, token))?.sid, "cs_test_123", "valid token verifies");
assert.equal(await verifyPass("other-secret", token), null, "wrong secret rejected");
assert.equal(await verifyPass(secret, undefined), null, "missing token rejected");
assert.equal(await verifyPass(secret, "garbage"), null, "malformed token rejected");

// Tamper with the payload but keep the old signature.
const [, sig] = token.split(".");
const forged = Buffer.from(JSON.stringify({ sid: "cs_forged", exp: future }))
  .toString("base64url");
assert.equal(await verifyPass(secret, `${forged}.${sig}`), null, "forged payload rejected");

const expired = await signPass(secret, { sid: "cs_old", exp: Date.now() - 1 });
assert.equal(await verifyPass(secret, expired), null, "expired token rejected");

const req = (cookie: string) => new Request("https://x.test", { headers: { cookie } });
assert.equal(await hasPass(req(`${PASS_COOKIE}=${token}`), secret), true, "cookie accepted");
assert.equal(await hasPass(req(`other=1; ${PASS_COOKIE}=${token}`), secret), true, "cookie found among others");
assert.equal(await hasPass(req(`not${PASS_COOKIE}=${token}`), secret), false, "prefix not confused for the cookie");
assert.equal(await hasPass(req(""), secret), false, "no cookie rejected");
assert.equal(await hasPass(req(`${PASS_COOKIE}=${token}`), undefined), false, "no secret means no pass");

console.log("pass.ts: all checks passed");
