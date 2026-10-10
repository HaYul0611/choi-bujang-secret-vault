/**
 * BYTE BACK - 점령된 자료실 클라이언트 애플리케이션
 * 브라우저 코드에 데이터베이스 공개 키가 일체 포함되지 않으며,
 * 모든 인증 요청은 서버 함수(/api/auth)를 통해 안전하게 처리됩니다.
 */

// ==========================================
// 1. 테마 관리 모듈 (ThemeModule)
// ==========================================
const ThemeModule = {
  toggleBtn: null,
  themeIcon: null,

  init() {
    this.toggleBtn = document.getElementById('themeToggle');
    this.themeIcon = document.getElementById('themeIcon');

    const savedTheme = localStorage.getItem('theme');
    const initialTheme = savedTheme || this.getTimeBasedTheme();
    this.applyTheme(initialTheme);

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  },

  getTimeBasedTheme() {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'light' : 'dark';
  },

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (this.toggleBtn) this.toggleBtn.setAttribute('aria-checked', 'true');
      if (this.themeIcon) {
        this.themeIcon.textContent = '🌙';
        this.themeIcon.style.transform = 'rotate(360deg)';
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (this.toggleBtn) this.toggleBtn.setAttribute('aria-checked', 'false');
      if (this.themeIcon) {
        this.themeIcon.textContent = '☀️';
        this.themeIcon.style.transform = 'rotate(0deg)';
      }
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    this.applyTheme(next);
  }
};

// ==========================================
// 2. 메모 관리 모듈 (NotesModule)
// ==========================================
const NotesModule = {
  listEl: document.querySelector('#notes'),
  countEl: document.querySelector('#notes-count'),
  formEl: document.querySelector('#create-note-form'),
  titleInput: document.querySelector('#new-note-title'),
  bodyInput: document.querySelector('#new-note-body'),
  submitBtn: document.querySelector('#btn-create-note'),
  
  cachedNotes: null,
  abortController: null,

  init() {
    if (this.formEl) {
      this.formEl.addEventListener('submit', (e) => this.handleCreateNote(e));
    }
  },

  render(notes) {
    if (this.countEl) {
      const len = notes?.length || 0;
      this.countEl.textContent = `${len}개 안전 보관 중`;
    }

    if (!notes || notes.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-item';
      emptyLi.innerHTML = `
        <div class="empty-icon">📂</div>
        <p>보관된 메모가 없습니다.</p>
        <small>좌측 폼에서 새 메모를 작성해 보세요.</small>
      `;
      this.listEl.replaceChildren(emptyLi);
      return;
    }

    const items = notes.map((note, index) => {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.style.animationDelay = `${index * 0.05}s`;

      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content';
      
      const titleStrong = document.createElement('strong');
      titleStrong.textContent = note.title;
      
      const bodySpan = document.createElement('span');
      bodySpan.textContent = note.body || note.content || '';
      
      contentDiv.append(titleStrong, bodySpan);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'note-actions';

      // 수정 버튼
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-secondary';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', () => this.handleEditNote(note));

      // 삭제 버튼
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => this.handleDeleteNote(note));

      actionsDiv.append(editBtn, delBtn);
      li.append(contentDiv, actionsDiv);
      return li;
    });

    this.listEl.replaceChildren(...items);
  },

  async fetchNotes(session, force = false) {
    if (!session || !session.access_token) {
      this.cachedNotes = null;
      return;
    }

    if (this.cachedNotes && !force) {
      this.render(this.cachedNotes);
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/notes', {
        headers: {
          'authorization': 'Bearer ' + session.access_token,
          'cache-control': 'no-store'
        },
        signal: this.abortController.signal
      });

      if (!response.ok) {
        if (response.status === 401) {
          AuthModule.handleLogout();
          return;
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '자료를 불러올 수 없습니다.');
      }

      const data = await response.json();
      if (!Array.isArray(data.notes)) throw new Error('자료 형식이 올바르지 않습니다.');
      
      this.cachedNotes = data.notes;
      this.render(data.notes);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (!this.cachedNotes) {
        const errLi = document.createElement('li');
        errLi.className = 'empty-item';
        errLi.textContent = error.message;
        this.listEl.replaceChildren(errLi);
      }
    }
  },

  async handleCreateNote(e) {
    e.preventDefault();
    const session = AuthModule.currentSession;
    if (!session || !session.access_token) return;

    const title = this.titleInput.value.trim();
    const body = this.bodyInput.value.trim();
    if (!title) return;

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = '저장 중...';

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer ' + session.access_token,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ title, body })
      });

      if (!res.ok) throw new Error('메모 저장에 실패했습니다.');

      this.titleInput.value = '';
      this.bodyInput.value = '';
      await this.fetchNotes(session, true);
    } catch (err) {
      alert(err.message);
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = '메모 저장';
    }
  },

  async handleEditNote(note) {
    const session = AuthModule.currentSession;
    if (!session || !session.access_token) return;

    const newTitle = prompt('수정할 메모 제목:', note.title);
    if (newTitle === null) return;
    const newBody = prompt('수정할 메모 내용:', note.body || note.content || '');
    if (newBody === null) return;

    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'authorization': 'Bearer ' + session.access_token,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle, body: newBody })
      });

      if (!res.ok) throw new Error('메모 수정에 실패했습니다.');
      await this.fetchNotes(session, true);
    } catch (err) {
      alert(err.message);
    }
  },

  async handleDeleteNote(note) {
    const session = AuthModule.currentSession;
    if (!session || !session.access_token) return;

    if (!confirm(`'${note.title}' 메모를 영구 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
        headers: {
          'authorization': 'Bearer ' + session.access_token
        }
      });

      if (!res.ok) throw new Error('메모 삭제에 실패했습니다.');
      await this.fetchNotes(session, true);
    } catch (err) {
      alert(err.message);
    }
  }
};

// ==========================================
// 3. 서버 기반 인증 관리 모듈 (AuthModule)
// ==========================================
const AuthModule = {
  currentSession: null,
  authMode: 'login', // 'login' | 'signup'

  // DOM 엘리먼트
  mainLayout: document.querySelector('#main-layout'),
  loginSection: document.querySelector('#login-section'),
  userSection: document.querySelector('#user-section'),
  notesSection: document.querySelector('#notes-section'),
  loginForm: document.querySelector('#login-form'),
  tabLogin: document.querySelector('#tab-login'),
  tabSignup: document.querySelector('#tab-signup'),
  emailInput: document.querySelector('#login-email'),
  passwordInput: document.querySelector('#login-password'),
  submitBtn: document.querySelector('#btn-login'),
  loginError: document.querySelector('#login-error'),
  authMsg: document.querySelector('#auth-msg'),
  userEmailDisplay: document.querySelector('#user-email-display'),
  btnLogout: document.querySelector('#btn-logout'),

  // 마이페이지 요소
  btnToggleMypage: document.querySelector('#btn-toggle-mypage'),
  mypagePanel: document.querySelector('#mypage-panel'),
  btnCloseMypage: document.querySelector('#btn-close-mypage'),
  mypageEmailDisplay: document.querySelector('#mypage-email-display'),
  mypagePasswordForm: document.querySelector('#mypage-password-form'),
  mypageNewPassword: document.querySelector('#mypage-new-password'),
  btnSubmitNewPassword: document.querySelector('#btn-submit-new-password'),
  mypageMsg: document.querySelector('#mypage-msg'),
  mypageError: document.querySelector('#mypage-error'),

  // ID / PW 찾기 요소
  btnOpenFind: document.querySelector('#btn-open-find'),
  findModal: document.querySelector('#find-modal'),
  btnCloseFind: document.querySelector('#btn-close-find'),
  findPasswordForm: document.querySelector('#find-password-form'),
  findEmailInput: document.querySelector('#find-email-input'),
  btnSubmitFind: document.querySelector('#btn-submit-find'),
  findMsg: document.querySelector('#find-msg'),
  findError: document.querySelector('#find-error'),

  init() {
    this.bindEvents();
    this.restoreSession();
  },

  restoreSession() {
    const saved = localStorage.getItem('auth_session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session && session.access_token) {
          this.updateState(session);
        }
      } catch {
        localStorage.removeItem('auth_session');
      }
    }
  },

  // 일정 시간 후 자동으로 페이드아웃 및 숨김 처리하는 피드백 헬퍼
  showFeedback(el, content, isHtml = false, duration = 4500) {
    if (!el) return;
    if (el._timer) clearTimeout(el._timer);
    if (el._fadeTimer) clearTimeout(el._fadeTimer);

    if (isHtml) {
      el.innerHTML = content;
    } else {
      el.textContent = content;
    }
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.style.display = 'block';

    el._timer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';
      el._fadeTimer = setTimeout(() => {
        el.style.display = 'none';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 350);
    }, duration);
  },

  bindEvents() {
    this.tabLogin?.addEventListener('click', () => this.switchTab('login'));
    this.tabSignup?.addEventListener('click', () => this.switchTab('signup'));
    this.loginForm?.addEventListener('submit', (e) => this.handleSubmit(e));
    this.btnLogout?.addEventListener('click', () => this.handleLogout());

    // 마이페이지 토글 및 닫기
    this.btnToggleMypage?.addEventListener('click', () => {
      const isVisible = this.mypagePanel.style.display !== 'none';
      this.mypagePanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && this.currentSession?.user) {
        this.mypageEmailDisplay.textContent = this.currentSession.user.email;
        this.mypageMsg.style.display = 'none';
        this.mypageError.style.display = 'none';
        this.mypageNewPassword.value = '';
      }
    });
    this.btnCloseMypage?.addEventListener('click', () => {
      this.mypagePanel.style.display = 'none';
    });

    // 마이페이지 새 비밀번호 변경 저장
    this.mypagePasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = this.mypageNewPassword.value;
      if (!newPassword || newPassword.length < 6) {
        this.showFeedback(this.mypageError, '새 비밀번호는 최소 6자 이상이어야 합니다.');
        return;
      }
      this.btnSubmitNewPassword.disabled = true;
      this.btnSubmitNewPassword.textContent = '변경 처리 중...';
      this.mypageMsg.style.display = 'none';
      this.mypageError.style.display = 'none';

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${this.currentSession.access_token}`
          },
          body: JSON.stringify({
            action: 'update_password',
            newPassword
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
        }
        this.showFeedback(this.mypageMsg, data.message || '비밀번호가 성공적으로 변경되었습니다.');
        this.mypageNewPassword.value = '';
      } catch (err) {
        this.showFeedback(this.mypageError, err.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } finally {
        this.btnSubmitNewPassword.disabled = false;
        this.btnSubmitNewPassword.textContent = '변경 저장';
      }
    });

    // ID / PW 찾기 모달 열기 및 닫기
    this.btnOpenFind?.addEventListener('click', () => {
      this.findModal.style.display = 'flex';
      this.findMsg.style.display = 'none';
      this.findError.style.display = 'none';
      this.findEmailInput.value = '';
    });
    this.btnCloseFind?.addEventListener('click', () => {
      this.findModal.style.display = 'none';
    });
    this.findModal?.addEventListener('click', (e) => {
      if (e.target === this.findModal) {
        this.findModal.style.display = 'none';
      }
    });

    // 비밀번호 재설정 이메일 발송
    this.findPasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.findEmailInput.value.trim();
      if (!email) return;

      this.btnSubmitFind.disabled = true;
      this.btnSubmitFind.textContent = '발송 중...';
      this.findMsg.style.display = 'none';
      this.findError.style.display = 'none';

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_password',
            email
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '비밀번호 재설정 요청 실패');
        }
        this.showFeedback(this.findMsg, data.message || '재설정 안내 링크가 이메일로 전송되었습니다.');
      } catch (err) {
        let msg = err.message || '재설정 처리 중 오류가 발생했습니다.';
        const lower = msg.toLowerCase();
        if (lower.includes('rate limit') || lower.includes('too many requests')) {
          msg = '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.';
        } else if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format'))) {
          msg = '유효하지 않은 이메일 주소 형식입니다.';
        }
        this.showFeedback(this.findError, msg);
      } finally {
        this.btnSubmitFind.disabled = false;
        this.btnSubmitFind.textContent = '재설정 링크 발송';
      }
    });
  },

  switchTab(mode) {
    this.authMode = mode;
    this.loginError.style.display = 'none';
    this.authMsg.style.display = 'none';

    if (mode === 'login') {
      this.tabLogin.classList.add('active');
      this.tabSignup.classList.remove('active');
      this.submitBtn.textContent = '로그인';
    } else {
      this.tabSignup.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.submitBtn.textContent = '회원가입 완료';
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    this.loginError.style.display = 'none';
    this.authMsg.style.display = 'none';

    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) return;

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = this.authMode === 'login' ? '로그인 처리 중...' : '회원가입 처리 중...';

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: this.authMode,
          email,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '인증 처리에 실패했습니다.');
      }

      if (this.authMode === 'login') {
        const session = { access_token: data.access_token, user: data.user };
        localStorage.setItem('auth_session', JSON.stringify(session));
        this.updateState(session);
      } else {
        // 회원가입 성공
        if (data.access_token) {
          const session = { access_token: data.access_token, user: data.user };
          localStorage.setItem('auth_session', JSON.stringify(session));
          this.updateState(session);
        } else {
          this.showFeedback(
            this.authMsg,
            '<strong>회원가입 완료!</strong><br>계정이 생성되었습니다. 이제 상단 [로그인] 탭을 눌러 로그인해 주세요.',
            true,
            7000
          );
          this.switchTab('login');
        }
      }
    } catch (err) {
      let msg = err.message || '인증 오류가 발생했습니다.';
      const lower = msg.toLowerCase();
      if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format') || lower.includes('valid') || lower.includes('syntax'))) {
        msg = '유효하지 않은 이메일 주소 형식입니다. 올바른 이메일을 입력해 주세요.';
      } else if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
        msg = '이메일 또는 비밀번호가 일치하지 않습니다.';
      } else if (lower.includes('already registered') || lower.includes('user already exists') || lower.includes('already in use')) {
        msg = '이미 등록된 이메일 주소입니다. 로그인 탭에서 로그인해 주세요.';
      } else if (lower.includes('password') && (lower.includes('least 6') || lower.includes('characters') || lower.includes('short') || lower.includes('weak') || lower.includes('length'))) {
        msg = '비밀번호는 최소 6자 이상이어야 합니다.';
      } else if (lower.includes('rate limit') || lower.includes('too many requests')) {
        msg = '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.';
      } else if (lower.includes('signups not allowed')) {
        msg = '현재 회원가입이 허용되지 않은 환경입니다.';
      } else if (lower.includes('failed to fetch') || lower.includes('network')) {
        msg = '네트워크 연결 상태를 확인해 주세요.';
      }
      this.showFeedback(
        this.loginError,
        (this.authMode === 'login' ? '로그인 실패: ' : '회원가입 실패: ') + msg,
        false,
        5000
      );
    } finally {
      this.submitBtn.disabled = false;
      if (this.authMode === 'login') {
        this.submitBtn.textContent = '로그인';
      } else {
        this.submitBtn.textContent = '회원가입 완료';
      }
    }
  },

  handleLogout() {
    localStorage.removeItem('auth_session');
    this.updateState(null);
  },

  updateState(session) {
    this.currentSession = session;
    const isLoggedIn = !!(session && session.user);

    if (this.mypagePanel) this.mypagePanel.style.display = 'none';

    if (isLoggedIn) {
      this.loginSection.style.display = 'none';
      this.userSection.style.display = 'block';
      this.notesSection.style.display = 'block';
      this.mainLayout?.classList.add('logged-in');
      this.userEmailDisplay.textContent = session.user.email;
      this.loginError.style.display = 'none';
      this.authMsg.style.display = 'none';
      NotesModule.fetchNotes(session);
    } else {
      this.loginSection.style.display = 'block';
      this.userSection.style.display = 'none';
      this.notesSection.style.display = 'none';
      this.mainLayout?.classList.remove('logged-in');
      this.userEmailDisplay.textContent = '';
      NotesModule.cachedNotes = null;
    }
  }
};

// ==========================================
// 4. 애플리케이션 초기화
// ==========================================
ThemeModule.init();
NotesModule.init();
AuthModule.init();
