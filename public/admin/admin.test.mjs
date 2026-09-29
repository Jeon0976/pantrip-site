import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMutation, safeDashboardURL, makePKCE, walletState } from './app.js';

const base = { userID: 'a0000000-0000-0000-0000-000000000001', requestID: 'b0000000-0000-0000-0000-000000000001',
  namespace: 'test_store', expectedRevision: 4, reason: '인증 이벤트 지급', confirmation: 'APPLY', action: 'credit', points: 30000 };
test('credit requires bounded integer, account, current revision and explicit confirmation', () => {
  assert.deepEqual(validateMutation(base), base);
  for (const change of [{ points: 0 }, { points: 1.5 }, { points: 1000001 }, { expectedRevision: undefined },
    { userID: 'other' }, { confirmation: '' }, { reason: 'a' }, { namespace: 'production' }, { action: 'delete_user' }]) {
    assert.throws(() => validateMutation({ ...base, ...change }));
  }
});
test('test-only time and achievement mutations cannot run in either App Store namespace', () => {
  for (const action of ['advance_24h', 'advance_day', 'achievement_grant', 'achievement_reset']) {
    for (const namespace of ['app_store_sandbox', 'app_store_production']) assert.throws(() => validateMutation({ ...base, action, namespace }));
  }
  assert.doesNotThrow(() => validateMutation({ ...base, action: 'advance_day', timeZone: 'Asia/Seoul' }));
  assert.throws(() => validateMutation({ ...base, action: 'advance_day', timeZone: 'not/a_zone' }));
  for (const achievementID of ['A00', 'A33', '<script>']) assert.throws(() => validateMutation({ ...base, action: 'achievement_grant', achievementID }));
  assert.doesNotThrow(() => validateMutation({ ...base, action: 'achievement_grant', achievementID: 'A32' }));
});
test('ownership accepts literal SKU and rejects markup; live actions remain explicitly scoped', () => {
  assert.doesNotThrow(() => validateMutation({ ...base, action: 'ownership_grant', namespace: 'app_store_production', sku: 'kitchen.napoli' }));
  assert.throws(() => validateMutation({ ...base, action: 'ownership_revoke', sku: '<img onerror=alert(1)>' }));
});
test('external dashboard links cannot inject scripts or redirect off Supabase', () => {
  assert.equal(safeDashboardURL('https://supabase.com/dashboard/project/test'), 'https://supabase.com/dashboard/project/test');
  for (const value of ['javascript:alert(1)', 'https://supabase.com.evil.test/', 'https://evil.test/', 'http://supabase.com/']) assert.equal(safeDashboardURL(value), null);
});
test('PKCE is random base64url and challenge is actual SHA256 of verifier', async () => {
  const value = await makePKCE(), other = await makePKCE();
  assert.match(value.verifier, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(value.verifier, other.verifier);
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.verifier))).toString('base64url');
  assert.equal(value.challenge, digest);
});
test('wallet uses server snapshot envelope and fails closed without revision', () => {
  const wallet = { balance: 30000, revision: 9 };
  assert.deepEqual(walletState({ wallet: { wallet } }), wallet);
  assert.throws(() => walletState({ wallet })); assert.throws(() => walletState({ wallet: { wallet: { balance: 1 } } }));
});
test('rendering does not use HTML sinks and page exposes visible confirmation', async () => {
  const script = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\.innerHTML\s*=|insertAdjacentHTML|document\.write\(/);
  assert.match(html, /<dialog id="confirm-dialog">/); assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(script, /localStorage|service_role/);
});
