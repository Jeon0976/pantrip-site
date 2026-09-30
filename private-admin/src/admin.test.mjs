import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMutation, safeDashboardURL, makePKCE, walletState, erasureQuery, erasureSteps, restoreSection } from './app.js';

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

test('erasure queries use UUID filtering and explicit cursor pagination', () => {
  assert.deepEqual(erasureQuery(), { userID: null, cursor: null });
  assert.deepEqual(erasureQuery(` ${base.userID} `, base.requestID), { userID: base.userID, cursor: base.requestID });
  assert.throws(() => erasureQuery('email@example.com'));
  assert.throws(() => erasureQuery('', 'invalid'));
});
test('erasure lifecycle distinguishes Apple not required from incomplete work', () => {
  assert.equal(erasureSteps({ appleRequired: false })[0], 'Apple 연결 해제: 해당 없음');
  assert.equal(erasureSteps({ appleRequired: true })[0], 'Apple 연결 해제: 대기');
  assert.equal(erasureSteps({ appleRequired: true, appleRevoked: true })[0], 'Apple 연결 해제: 완료');
  assert.ok(erasureSteps({ authDeleted: true }).includes('인증 계정 삭제: 완료'));
  assert.equal(erasureSteps().filter(value => value.endsWith('대기')).length, 6);
});

test('page IDs are unique so rendering cannot replace a containing section', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate element IDs');
  assert.match(html, /<tbody id="erasures"><\/tbody>/);
});


test('section fragment is restored after authentication reveals the workspace and tables finish loading', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const workspace = { hidden: true };
  const calls = [];
  const nodes = Object.fromEntries(['accounts', 'account', 'erasure-section', 'database'].map(id => [id, {
    parentElement: workspace, tagName: 'SECTION',
    focus: options => calls.push([id, 'focus', options]),
    scrollIntoView: options => calls.push([id, 'scroll', options]),
  }]));
  const root = { getElementById: id => id === 'workspace' ? workspace : nodes[id] };
  assert.equal(restoreSection('#database', root), false);
  assert.deepEqual(calls, []);
  workspace.hidden = false;
  for (const id of Object.keys(nodes)) {
    assert.match(html, new RegExp(`<section id="${id}"[^>]*tabindex="-1"`));
    assert.equal(restoreSection(`#${id}`, root), true);
    assert.deepEqual(calls.splice(0), [[id, 'focus', { preventScroll: true }], [id, 'scroll', { block: 'start' }]]);
  }
  for (const hash of ['', '#unknown', '#workspace', 'database']) assert.equal(restoreSection(hash, root), false);
  assert.deepEqual(calls, []);
});


test('a section selected during an async table load is realigned after its position changes', async () => {
  const workspace = { hidden: false };
  let sectionTop = 100;
  const scrolled = [];
  const section = { parentElement: workspace, tagName: 'SECTION', focus() {}, scrollIntoView() { scrolled.push(sectionTop); } };
  const root = { getElementById: id => id === 'workspace' ? workspace : id === 'database' ? section : null };
  const tableLoad = Promise.resolve().then(() => { sectionTop = 700; });
  restoreSection('#database', root);
  await tableLoad;
  restoreSection('#database', root);
  assert.deepEqual(scrolled, [100, 700]);
});
