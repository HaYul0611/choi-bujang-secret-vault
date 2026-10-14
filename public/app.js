/**
* BYTE BACK - 점령된 자료실 클라이언트
*/
const $ = (id) => document.getElementById(id);
const on = (id, evt, fn) => $(id)?.addEventListener(evt, fn);
const api = async (url, opts = {}) => {
const token = AuthModule.currentSession?.access_token;
const res = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...opts.headers } });
const d = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(d.error || d.message || '요청 실패');
return d;
};
const ThemeModule = {
init() {
const apply = (t) => {
const dark = t === 'dark';
document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
$('themeToggle')?.setAttribute('aria-checked', String(dark));
const ic = $('themeIcon');
if (ic) {
ic.innerHTML = dark
? '<svg class="svg-moon" viewBox="0 0 24 24" width="15" height="15" fill="#facc15"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
: '<svg class="svg-sun" viewBox="0 0 24 24" width="15" height="15" fill="#f59e0b"><circle cx="12" cy="12" r="5"/></svg>';
ic.style.transform = dark ? 'rotate(360deg)' : 'rotate(0deg)';
}
};
apply(localStorage.getItem('theme') || (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'light' : 'dark'));
on('themeToggle', 'click', () => {
const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
localStorage.setItem('theme', next);
apply(next);
});
}
};
function feedback(el, msg, html = false) {
if (!el) return;
clearTimeout(el._t);
el[html ? 'innerHTML' : 'textContent'] = msg;
el.style.display = 'block';
el._t = setTimeout(() => { el.style.display = 'none'; }, 4500);
}
function checkStrength(p) {
const c = $('pwd-strength-container'), t = $('pwd-strength-text');
if (!c || !t) return;
if (!p) { c.style.display = 'none'; return; }
c.style.display = 'block';
const s = (p.length >= 6) + (p.length >= 8) + (/[A-Z]/.test(p) && /[a-z]/.test(p)) + /\d/.test(p) + /[^A-Za-z0-9]/.test(p);
c.className = 'pwd-strength-container ' + (p.length < 6 || s <= 2 ? 'level-weak' : s <= 4 ? 'level-medium' : 'level-strong');
t.textContent = p.length < 6 || s <= 2 ? '1단계: 취약 (위험)' : s <= 4 ? '2단계: 적정 (양호)' : '3단계: 안전 (강력)';
}
const NotesModule = {
cachedNotes: null, ctrl: null,
init() {
on('create-note-form', 'submit', (e) => this.create(e));
on('notes-search-input', 'input', (e) => this.filter(e.target.value.trim()));
on('btn-close-edit', 'click', () => this.close());
on('btn-cancel-edit', 'click', () => this.close());
on('edit-modal', 'click', (e) => { if (e.target.id === 'edit-modal') this.close(); });
on('edit-note-form', 'submit', (e) => this.saveEdit(e));
},
filter(kw) {
if (!this.cachedNotes) return;
if (!kw) return this.render(this.cachedNotes);
const q = kw.toLowerCase();
this.render(this.cachedNotes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.body || n.content || '').toLowerCase().includes(q)), true, kw);
},
render(notes, filtered = false, kw = '') {
const cnt = $('notes-count'), ul = $('notes');
if (cnt) cnt.textContent = filtered ? `검색: ${notes?.length || 0}개` : `${notes?.length || 0}개 안전 보관 중`;
if (!ul) return;
if (!notes?.length) {
const li = document.createElement('li');
li.className = 'empty-item';
li.innerHTML = '<div class="empty-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><p>' + (filtered ? "'" + kw + "' 검색 결과 없음" : '보관된 메모 없음') + '</p><small>' + (filtered ? '다른 검색어를 입력해 보세요.' : '새 메모를 작성해 보세요.') + '</small>';
return ul.replaceChildren(li);
}
ul.replaceChildren(...notes.map((n, i) => {
const li = document.createElement('li');
li.className = 'note-item';
li.style.animationDelay = `${i * 0.05}s`;
li.innerHTML = '<div class="note-content"><strong></strong><span></span></div><div class="note-actions"><button class="btn-secondary">수정</button><button class="btn-danger">삭제</button></div>';
li.querySelector('strong').textContent = n.title;
li.querySelector('span').textContent = n.body || n.content || '';
li.querySelector('.btn-secondary').onclick = () => this.open(n);
li.querySelector('.btn-danger').onclick = () => this.del(n);
return li;
}));
},
async fetchNotes(session, force = false) {
if (!session?.access_token) { this.cachedNotes = null; return; }
if (this.cachedNotes && !force) this.render(this.cachedNotes);
this.ctrl?.abort();
this.ctrl = new AbortController();
try {
const d = await api('/api/notes', { headers: { 'cache-control': 'no-store' }, signal: this.ctrl.signal });
if (!Array.isArray(d.notes)) throw new Error('자료 형식이 올바르지 않습니다.');
this.cachedNotes = d.notes;
const kw = $('notes-search-input')?.value?.trim();
kw ? this.filter(kw) : this.render(d.notes);
} catch (e) {
if (e.name !== 'AbortError' && !this.cachedNotes) {
const li = document.createElement('li');
li.className = 'empty-item';
li.textContent = e.message;
$('notes')?.replaceChildren(li);
}
}
},
async create(e) {
e.preventDefault();
if (!AuthModule.currentSession?.access_token) return;
const t = $('new-note-title')?.value.trim(), b = $('new-note-body')?.value.trim();
if (!t) return;
const btn = $('btn-create-note');
if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
try {
await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: t, body: b }) });
if ($('new-note-title')) $('new-note-title').value = '';
if ($('new-note-body')) $('new-note-body').value = '';
await this.fetchNotes(AuthModule.currentSession, true);
} catch (err) { alert(err.message); }
finally { if (btn) { btn.disabled = false; btn.textContent = '메모 저장'; } }
},
open(n) {
const m = $('edit-modal');
if (!m) return;
if ($('edit-note-id')) $('edit-note-id').value = n.id;
if ($('edit-title-input')) $('edit-title-input').value = n.title || '';
if ($('edit-body-input')) $('edit-body-input').value = n.body || n.content || '';
m.style.display = 'flex';
setTimeout(() => { $('edit-title-input')?.focus(); $('edit-title-input')?.select(); }, 60);
},
close() { if ($('edit-modal')) $('edit-modal').style.display = 'none'; },
async saveEdit(e) {
e.preventDefault();
if (!AuthModule.currentSession?.access_token) return;
const id = $('edit-note-id')?.value, title = $('edit-title-input')?.value.trim(), body = $('edit-body-input')?.value.trim();
if (!title) return alert('메모 제목을 입력해 주세요.');
const btn = $('btn-submit-edit');
if (btn) { btn.disabled = true; btn.textContent = '수정 중...'; }
try {
await api(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify({ title, body }) });
this.close();
await this.fetchNotes(AuthModule.currentSession, true);
} catch (err) { alert(err.message); }
finally { if (btn) { btn.disabled = false; btn.textContent = '수정 완료'; } }
},
async del(n) {
if (!confirm(`'${n.title}' 메모를 삭제하시겠습니까?`)) return;
try {
await api(`/api/notes/${n.id}`, { method: 'DELETE' });
await this.fetchNotes(AuthModule.currentSession, true);
} catch (err) { alert(err.message); }
}
};
const AuthModule = {
currentSession: null, mode: 'login',
init() {
this.bind();
try { localStorage.removeItem('auth_session'); } catch {}
this.refreshVisibility();
},
bind() {
on('tab-login', 'click', () => this.tab('login'));
on('tab-signup', 'click', () => this.tab('signup'));
on('login-form', 'submit', (e) => this.submit(e));
on('btn-logout', 'click', () => this.logout());
const caps = (id, wId) => {
const fn = (e) => { const w = $(wId); if (w) w.style.display = e.getModifierState?.('CapsLock') ? 'flex' : 'none'; };
on(id, 'keyup', fn); on(id, 'keydown', fn);
};
caps('login-password', 'login-caps-warning');
caps('mypage-new-password', 'mypage-caps-warning');
document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
btn.onclick = () => {
const inp = $(btn.getAttribute('data-target'));
if (!inp) return;
const pwd = inp.type === 'password';
inp.type = pwd ? 'text' : 'password';
btn.querySelector('.eye-open')?.style.setProperty('display', pwd ? 'none' : 'block');
btn.querySelector('.eye-closed')?.style.setProperty('display', pwd ? 'block' : 'none');
};
});
on('btn-toggle-mypage', 'click', () => {
const p = $('mypage-panel');
if (!p) return;
const vis = p.style.display !== 'none';
p.style.display = vis ? 'none' : 'block';
if (!vis && this.currentSession?.user) {
if ($('mypage-email-display')) $('mypage-email-display').textContent = this.currentSession.user.email;
if ($('mypage-current-password')) $('mypage-current-password').value = '';
if ($('mypage-new-password')) $('mypage-new-password').value = '';
checkStrength('');
}
});
on('btn-close-mypage', 'click', () => { if ($('mypage-panel')) $('mypage-panel').style.display = 'none'; });
on('mypage-new-password', 'input', (e) => checkStrength(e.target.value));
on('mypage-password-form', 'submit', async (e) => {
e.preventDefault();
const cur = $('mypage-current-password')?.value, next = $('mypage-new-password')?.value;
if (!cur) return feedback($('mypage-error'), '현재 비밀번호를 입력해 주세요.');
if (!next || next.length < 6) return feedback($('mypage-error'), '새 비밀번호 6자 이상 필요');
if (cur === next) return feedback($('mypage-error'), '새 비밀번호는 기존과 달라야 합니다.');
const btn = $('btn-submit-new-password');
if (btn) { btn.disabled = true; btn.textContent = '변경 중...'; }
try {
const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'update_password', currentPassword: cur, newPassword: next }) });
feedback($('mypage-msg'), d.message || '비밀번호가 변경되었습니다.');
$('mypage-current-password').value = $('mypage-new-password').value = '';
checkStrength('');
} catch (err) { feedback($('mypage-error'), err.message); }
finally { if (btn) { btn.disabled = false; btn.textContent = '비밀번호 변경 저장'; } }
});
on('btn-open-find', 'click', () => {
const m = $('find-modal');
if (m) m.style.display = 'flex';
if ($('find-email-input')) $('find-email-input').value = '';
setTimeout(() => $('find-email-input')?.focus(), 60);
});
on('btn-close-find', 'click', () => { if ($('find-modal')) $('find-modal').style.display = 'none'; });
on('find-modal', 'click', (e) => { if (e.target.id === 'find-modal') e.target.style.display = 'none'; });
on('find-password-form', 'submit', async (e) => {
e.preventDefault();
const email = $('find-email-input')?.value.trim();
if (!email) return;
const btn = $('btn-submit-find');
if (btn) { btn.disabled = true; btn.textContent = '발송 중...'; }
try {
const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'reset_password', email }) });
feedback($('find-msg'), d.message || '재설정 링크가 전송되었습니다.');
} catch (err) { feedback($('find-error'), err.message); }
finally { if (btn) { btn.disabled = false; btn.textContent = '재설정 링크 발송'; } }
});
},
tab(mode) {
this.mode = mode;
const login = mode === 'login';
$('auth-tabs')?.classList.toggle('is-signup', !login);
$('tab-login')?.classList.toggle('active', login);
$('tab-signup')?.classList.toggle('active', !login);
if ($('btn-login')) $('btn-login').textContent = login ? '로그인' : '회원가입 완료';
},
async submit(e) {
e.preventDefault();
const email = $('login-email')?.value.trim(), password = $('login-password')?.value;
if (!email || !password) return;
const btn = $('btn-login');
if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
try {
const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: this.mode, email, password }) });
if (this.mode === 'login' || d.access_token) {
this.updateState({ access_token: d.access_token, user: d.user });
} else {
feedback($('auth-msg'), '<strong>회원가입 완료!</strong><br>로그인 탭에서 로그인해 주세요.', true);
this.tab('login');
}
} catch (err) {
feedback($('login-error'), err.message);
} finally {
if (btn) { btn.disabled = false; btn.textContent = this.mode === 'login' ? '로그인' : '회원가입 완료'; }
}
},
logout() { this.updateState(null); },
updateState(session) {
this.currentSession = session;
const p = $('mypage-panel'); if (p) p.style.display = 'none';
this.refreshVisibility();
DeviceApprovalModule.updateStatus();
},
refreshVisibility() {
const ok = DeviceApprovalModule.isDeviceApproved, auth = !!this.currentSession?.user;
const set = (id, s) => { const el = $(id); if (el) el.style.display = s ? 'block' : 'none'; };
set('auth-container', ok);
set('notes-section', ok && auth);
set('user-section', ok && auth);
set('login-section', ok && !auth);
$('main-layout')?.classList.toggle('logged-in', ok && auth);
if (!ok) {
$('notes')?.replaceChildren();
} else if (auth) {
if ($('user-email-display')) $('user-email-display').textContent = this.currentSession.user.email;
NotesModule.fetchNotes(this.currentSession);
} else {
if ($('user-email-display')) $('user-email-display').textContent = '';
NotesModule.cachedNotes = null;
}
}
};
const DeviceApprovalModule = {
isDeviceApproved: false,
init() {
window.addEventListener('online', () => $('offline-banner')?.style.setProperty('display', 'none'));
window.addEventListener('offline', () => {
$('offline-banner')?.style.setProperty('display', 'flex');
if ($('notes')) $('notes').innerHTML = '<li class="notes-empty"><p>오프라인 상태입니다.</p></li>';
});
if (!navigator.onLine) $('offline-banner')?.style.setProperty('display', 'flex');
on('device-approval-form', 'submit', async (e) => {
e.preventDefault();
await this.requestApproval($('device-name-input')?.value.trim() || '웹 클라이언트 기기');
});
},
async requestApproval(deviceName) {
const btn = $('btn-request-device-approval'), msg = $('device-approval-msg'), err = $('device-approval-error');
if (btn) { btn.disabled = true; btn.textContent = '검증 중...'; }
if (msg) msg.style.display = 'none';
if (err) err.style.display = 'none';
try {
const d = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'request_device_approval', deviceName }) });
if (!d.approved) throw new Error(d.error || '기기 승인 검증 실패');
this.isDeviceApproved = true;
if (msg) { msg.textContent = d.message || '등록 기기 승인 완료'; msg.style.display = 'block'; }
this.updateStatus();
AuthModule.refreshVisibility();
} catch (e) {
this.isDeviceApproved = false;
if (err) { err.textContent = e.message; err.style.display = 'block'; }
this.updateStatus();
} finally {
if (btn) { btn.disabled = false; btn.textContent = '서버에 기기 승인 요청'; }
}
},
updateStatus() {
const ok = this.isDeviceApproved;
const badge = $('device-badge-display');
if (badge) { badge.className = 'device-badge' + (ok ? ' approved' : ''); badge.textContent = ok ? '서버 승인 완료 (등록 기기)' : '미승인 (서버 확인 대기)'; }
$('device-status-dot')?.setAttribute('class', 'device-status-dot' + (ok ? ' approved' : ''));
const txt = $('device-status-text');
if (txt) txt.textContent = ok ? '서버 승인 완료 (접속 허용됨)' : '서버 확인 대기 중 (등록 기기 확인 필요)';
}
};
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
NotesModule.close();
const fm = $('find-modal'); if (fm) fm.style.display = 'none';
const mp = $('mypage-panel'); if (mp) mp.style.display = 'none';
}
});
ThemeModule.init();
NotesModule.init();
DeviceApprovalModule.init();
AuthModule.init();
