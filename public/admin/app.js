import { config } from './config.js';

export const namespaces = ['test_store', 'app_store_sandbox', 'app_store_production'];
const testActions = ['advance_24h', 'advance_day', 'achievement_grant', 'achievement_reset'];
const actions = ['credit', ...testActions, 'ownership_grant', 'ownership_revoke'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateMutation(value) {
  if (!uuid.test(value.userID) || !uuid.test(value.requestID)) throw Error('계정 또는 요청 ID가 올바르지 않습니다.');
  if (!namespaces.includes(value.namespace) || !actions.includes(value.action)) throw Error('작업 환경을 확인하세요.');
  if (testActions.includes(value.action) && value.namespace !== 'test_store') throw Error('이 작업은 Test Store에서만 가능합니다.');
  if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) throw Error('계정을 새로 조회하세요.');
  if (typeof value.reason !== 'string' || value.reason.trim().length < 3 || value.reason.length > 500) throw Error('작업 사유를 3~500자로 입력하세요.');
  if (value.confirmation !== 'APPLY') throw Error('확인 문구 APPLY를 입력하세요.');
  if (value.action === 'credit' && (!Number.isSafeInteger(value.points) || value.points < 1 || value.points > 1000000)) throw Error('포인트는 1~1,000,000 사이의 정수여야 합니다.');
  if (value.action.startsWith('achievement_') && !/^A(0[1-9]|[12][0-9]|3[0-2])$/.test(value.achievementID)) throw Error('업적 ID를 확인하세요.');
  if (value.action.startsWith('ownership_') && (typeof value.sku !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(value.sku))) throw Error('상품 SKU를 확인하세요.');
  if (value.action === 'advance_day') { try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format(); } catch { throw Error('시간대를 확인하세요.'); } }
  return value;
}
export function safeDashboardURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'supabase.com' ? url.href : null; } catch { return null; }
}
export async function makePKCE() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const verifier = encode(bytes);
  return { verifier, challenge: encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))) };
}
export function walletState(envelope) {
  const wallet = envelope?.wallet?.wallet;
  if (!wallet || !Number.isSafeInteger(wallet.revision) || !Number.isFinite(wallet.balance)) throw Error('서버 지갑 형식을 확인할 수 없습니다.');
  return wallet;
}

if (typeof document !== 'undefined') start();

function start() {
  const $ = id => document.getElementById(id);
  const sessionKey = 'pantrip.operator.session';
  const verifierKey = 'pantrip.operator.pkce';
  const state = { session: null, userID: null, wallet: null, cursor: null, users: [], busy: false, pending: null, operator: false };
  const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
  const showJSON = (id, value) => { $(id).textContent = JSON.stringify(value, null, 2); };
  const textCell = (row, value) => { const cell = document.createElement('td'); cell.textContent = value == null ? '—' : String(value); row.append(cell); return cell; };
  const formatDate = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
  function controls() {
    document.querySelectorAll('button,input,select,textarea').forEach(element => { element.disabled = state.busy; });
    $('prepare-action').disabled = state.busy || !state.wallet || !state.operator;
    $('more-users').disabled = state.busy || !state.cursor;
    if (!state.busy) for (const option of $('action').options) option.disabled = testActions.includes(option.value) && $('namespace').value !== 'test_store';
  }
  async function run(work) {
    if (state.busy) return;
    state.busy = true; controls();
    try { await work(); }
    catch (error) {
      if (error.status === 401 || error.status === 403) {
        state.operator = false; clearAccount(); $('workspace').hidden = true; $('login-panel').hidden = false;
      }
      status(error.message || '요청에 실패했습니다.', true);
    } finally { state.busy = false; controls(); }
  }
  function saveSession(value) {
    state.session = { access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: value.expires_at ?? Math.floor(Date.now() / 1000) + value.expires_in };
    sessionStorage.setItem(sessionKey, JSON.stringify(state.session));
  }
  async function tokenRequest(grant, body) {
    const response = await fetch(`${config.supabaseURL}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST', headers: { apikey: config.publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error('로그인을 완료하지 못했습니다. 다시 로그인하세요.');
    saveSession(await response.json());
  }
  async function accessToken() {
    if (!state.session?.access_token) throw Object.assign(Error('운영자 로그인이 필요합니다.'), { status: 401 });
    if (state.session.expires_at * 1000 < Date.now() + 60000) {
      try { await tokenRequest('refresh_token', { refresh_token: state.session.refresh_token }); }
      catch { sessionStorage.removeItem(sessionKey); state.session = null; throw Object.assign(Error('로그인이 만료되었습니다. 다시 로그인하세요.'), { status: 401 }); }
    }
    return state.session.access_token;
  }
  async function api(route, params = {}, body) {
    const url = new URL(`${config.supabaseURL}/functions/v1/operator/${route}`);
    for (const [key, value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key, value);
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: {
      apikey: config.publicKey, Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(30000) });
    let result; try { result = await response.json(); } catch { throw Error('서버 응답을 읽지 못했습니다. 재시도 전에 계정 상태를 확인하세요.'); }
    if (!response.ok) {
      const message = response.status === 403 ? '운영 권한이 없습니다. 승인된 운영 계정인지 확인하세요.' : response.status === 409 ? '지갑 상태가 변경되었거나 요청이 충돌했습니다. 계정을 다시 선택해 확인하세요.' : `요청 실패 (${response.status}): ${result.error || 'UNAVAILABLE'}`;
      throw Object.assign(Error(message), { status: response.status });
    }
    return result;
  }
  function clearAccount() {
    state.wallet = null; state.pending = null; $('confirm-dialog').close();
    for (const id of ['balance', 'revision', 'ownership-count']) $(id).textContent = '—';
    $('wallet-json').textContent = '계정을 조회하고 있습니다.'; $('audit').replaceChildren();
    $('table-json').textContent = '선택 계정으로 다시 조회하세요.';
  }
  function renderWallet(result) {
    state.wallet = walletState(result);
    $('balance').textContent = `${state.wallet.balance.toLocaleString()} P`;
    $('revision').textContent = state.wallet.revision;
    $('ownership-count').textContent = Object.keys(state.wallet.purchases || {}).length;
    showJSON('wallet-json', result.wallet);
    $('audit').replaceChildren();
    for (const record of result.audit || []) {
      const row = document.createElement('tr');
      [formatDate(record.created_at), record.kind, record.reason, record.id].forEach(value => textCell(row, value)); $('audit').append(row);
    }
  }
  async function loadAccount(id) {
    clearAccount(); state.userID = id; $('selected-account').textContent = id;
    const result = await api('user', { userID: id, namespace: $('namespace').value });
    renderWallet(result); status('계정을 불러왔습니다. 변경 전 지갑 환경을 확인하세요.');
  }
  async function loadUsers(next = false) {
    const result = await api('users', { search: $('search').value.trim(), cursor: next ? state.cursor : null });
    state.users = next ? [...state.users, ...result.items] : result.items;
    state.cursor = result.nextCursor || null; $('users').replaceChildren();
    for (const user of state.users) {
      const row = document.createElement('tr');
      [user.id, user.email, user.isAnonymous ? '익명' : (user.providers || []).join(', '), formatDate(user.createdAt), formatDate(user.lastSignInAt)].forEach(value => textCell(row, value));
      const cell = document.createElement('td'), button = document.createElement('button'); button.textContent = '조회';
      button.setAttribute('aria-label', `${user.id} 계정 조회`); button.onclick = () => run(() => loadAccount(user.id)); cell.append(button); row.append(cell); $('users').append(row);
    }
    $('user-count').textContent = `${state.users.length}명 표시`; status('사용자 목록을 불러왔습니다.');
  }
  async function loadHealth() {
    const result = await api('health');
    const size = bytes => Number.isFinite(Number(bytes)) ? `${(Number(bytes) / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB` : '—';
    $('db-size').textContent = `데이터베이스 사용 공간 ${size(result.databaseBytes)} · 행 수는 추정값입니다.`;
    $('table-health').replaceChildren();
    for (const table of result.tables || []) { const row = document.createElement('tr'); [table.name, table.approxRows, size(table.totalBytes)].forEach(value => textCell(row, value)); $('table-health').append(row); }
    $('dashboard-links').replaceChildren();
    for (const [label, value] of Object.entries(result.dashboard || {})) {
      const href = safeDashboardURL(value); if (!href) continue;
      const link = document.createElement('a'); link.href = href;
      link.textContent = ({ logs: '서버 로그', usage: '사용량', database: '데이터베이스', functions: '서버 함수', project: '프로젝트' })[label] || label;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; $('dashboard-links').append(link);
    }
  }
  function actionFields() {
    const action = $('action').value;
    $('points-field').hidden = action !== 'credit'; $('achievement-field').hidden = !action.startsWith('achievement_');
    $('sku-field').hidden = !action.startsWith('ownership_'); $('timezone-field').hidden = action !== 'advance_day';
    $('action-note').textContent = testActions.includes(action) ? 'Test Store 전용 작업입니다. 실제 운영 지갑에는 적용할 수 없습니다.' : '선택한 환경의 포인트 또는 상품 소유권을 변경합니다. 모든 변경은 감사 기록에 남습니다.';
  }
  for (let n = 1; n <= 32; n++) { const option = document.createElement('option'); option.value = option.textContent = `A${String(n).padStart(2, '0')}`; $('achievement').append(option); }
  $('action').onchange = actionFields;
  $('namespace').onchange = () => {
    if (testActions.includes($('action').value) && $('namespace').value !== 'test_store') $('action').value = 'credit';
    actionFields(); run(async () => { if (state.userID) await loadAccount(state.userID); });
  };
  $('search-form').onsubmit = event => { event.preventDefault(); run(() => loadUsers()); };
  $('refresh-users').onclick = () => run(() => loadUsers()); $('more-users').onclick = () => run(() => loadUsers(true));
  $('refresh-health').onclick = () => run(loadHealth);
  $('table-form').onsubmit = event => { event.preventDefault(); run(async () => {
    if (!state.userID) throw Error('먼저 계정을 선택하세요.');
    showJSON('table-json', await api('table', { table: $('table').value, namespace: $('namespace').value, userID: state.userID }));
  }); };
  $('action-form').onsubmit = event => {
    event.preventDefault(); if (state.busy || !state.wallet) return;
    try {
      const action = $('action').value;
      state.pending = validateMutation({ userID: state.userID, namespace: $('namespace').value, requestID: crypto.randomUUID(),
        expectedRevision: state.wallet.revision, reason: $('reason').value.trim(), confirmation: 'APPLY', action,
        ...(action === 'credit' ? { points: Number($('points').value) } : {}),
        ...(action.startsWith('achievement_') ? { achievementID: $('achievement').value } : {}),
        ...(action.startsWith('ownership_') ? { sku: $('sku').value.trim() } : {}),
        ...(action === 'advance_day' ? { timeZone: $('timezone').value.trim() } : {}),
      });
      showJSON('confirmation-summary', state.pending); $('confirmation').value = ''; $('confirm-dialog').showModal(); $('confirmation').focus();
    } catch (error) { status(error.message, true); }
  };
  $('confirm-dialog').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
  $('apply').onclick = () => run(async () => {
    if (!state.pending) throw Error('변경 내용을 다시 준비하세요.');
    const mutation = validateMutation({ ...state.pending, confirmation: $('confirmation').value });
    const result = await api('mutate', {}, mutation);
    // Keep the request ID through failures; retry cannot apply a second credit.
    renderWallet(result); state.pending = null; $('confirm-dialog').close();
    status(`변경을 적용했습니다. ${result.replayed ? '동일한 요청의 기존 결과입니다. ' : ''}작업 ID: ${result.auditID}`);
    await loadAccount(state.userID);
  });
  $('login').onclick = () => run(async () => {
    if (!config.publicKey) throw Error('공개 Supabase 키 설정이 필요합니다.');
    const pkce = await makePKCE(); sessionStorage.setItem(verifierKey, pkce.verifier);
    const url = new URL(`${config.supabaseURL}/auth/v1/authorize`);
    url.search = new URLSearchParams({ provider: 'google', redirect_to: new URL('./', location.href).href,
      code_challenge: pkce.challenge, code_challenge_method: 's256' }); location.assign(url);
  });
  $('logout').onclick = () => run(async () => {
    const token = state.session?.access_token;
    sessionStorage.removeItem(sessionKey); sessionStorage.removeItem(verifierKey); state.session = null; state.operator = false;
    clearAccount(); state.userID = null; $('workspace').hidden = true; $('login-panel').hidden = false; $('logout').hidden = true;
    $('users').replaceChildren(); $('table-json').textContent = ''; state.users = [];
    if (token) { try { await fetch(`${config.supabaseURL}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.publicKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }); } catch { /* Browser credentials are already removed. */ } }
    status('로그아웃했습니다.');
  });
  actionFields();
  run(async () => {
    if (!config.publicKey) { status('공개 Supabase 키를 설정한 뒤 로그인하세요.'); return; }
    const callback = new URL(location.href), code = callback.searchParams.get('code'), authError = callback.searchParams.get('error');
    if (code || authError) history.replaceState(null, '', callback.pathname);
    if (authError) throw Error('Google 로그인을 완료하지 못했습니다. 다시 시도하세요.');
    if (code) {
      const verifier = sessionStorage.getItem(verifierKey); sessionStorage.removeItem(verifierKey);
      if (!verifier) throw Error('로그인을 시작한 탭에서 다시 시도하세요.');
      await tokenRequest('pkce', { auth_code: code, code_verifier: verifier });
    } else { try { state.session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch { sessionStorage.removeItem(sessionKey); } }
    if (!state.session) { status('운영 계정으로 로그인하세요.'); return; }
    $('logout').hidden = false;
    await loadHealth(); state.operator = true; $('workspace').hidden = false; $('login-panel').hidden = true;
    await loadUsers();
    try {
      const catalog = await api('catalog', { namespace: $('namespace').value });
      for (const item of catalog.items || []) { const option = document.createElement('option'); option.value = item.sku; option.label = typeof item.title === 'string' ? item.title : item.sku; $('catalog-skus').append(option); }
    } catch { /* Manual SKU entry remains available; no writes are inferred. */ }
  });
}
