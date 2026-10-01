import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
assert.match(source, /new URLSearchParams\(location\.search\)/);
assert.match(source, /eliteEstimatingClaimContext/);
assert.match(source, /Claim-linked estimating session/);
assert.match(source, /safeReturnUrl/);
assert.match(source, /Back to Claims/);
assert.doesNotMatch(source, /tenant.*URLSearchParams/i);
console.log('Elite Estimating claim-context UI contract passed');
