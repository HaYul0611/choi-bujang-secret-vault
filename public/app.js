// 1. 시간대 감지 및 슬라이딩 스위치 토글 로직
(function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');

  function getTimeBasedTheme() {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (toggle) toggle.setAttribute('aria-checked', 'true');
      if (icon) {
        icon.textContent = '🌙';
        icon.style.transform = 'rotate(360deg)';
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (toggle) toggle.setAttribute('aria-checked', 'false');
      if (icon) {
        icon.textContent = '☀️';
        icon.style.transform = 'rotate(0deg)';
      }
    }
  }

  const savedTheme = localStorage.getItem('theme');
  const activeTheme = savedTheme || getTimeBasedTheme();
  applyTheme(activeTheme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      applyTheme(next);
    });
  }
})();

// 2. Supabase 클라이언트 및 메모 관리 로직
const SUPABASE_URL = 'https://jrsoosoflveipirsqokx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyc29vc29mbHZlaXBpcnNxb2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDE1NzUsImV4cCI6MjEwNzE3NzU3NX0.RqMp0GvBXLDbn0pYDaVnKLY177E6z7XMzYhPRi7yIec';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.querySelector('#login-section');
const userSection = document.querySelector('#user-section');
const loginForm = document.querySelector('#login-form');
const emailInput = document.querySelector('#login-email');
const passwordInput = document.querySelector('#login-password');
const loginError = document.querySelector('#login-error');
const userEmailDisplay = document.querySelector('#user-email-display');
const btnLogout = document.querySelector('#btn-logout');
const createNoteForm = document.querySelector('#create-note-form');
const newNoteTitle = document.querySelector('#new-note-title');
const newNoteBody = document.querySelector('#new-note-body');
const list = document.querySelector('#notes');

let currentSession = null;
let currentFetchController = null;
let cachedNotes = null;
let lastUserId = null;

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    const item = document.createElement('li');
    item.className = 'empty-item';
    item.textContent = '보관된 메모가 없습니다. 새 메모를 추가해 보세요.';
    list.replaceChildren(item);
    return;
  }

  list.replaceChildren(...notes.map(note => {
    const item = document.createElement('li');
    item.className = 'note-item';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';
    const title = document.createElement('strong');
    const content = document.createElement('span');
    title.textContent = note.title;
    content.textContent = note.body || note.content || '';
    contentDiv.append(title, content);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-secondary';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', async () => {
      const newTitle = prompt('수정할 제목:', note.title);
      if (newTitle === null) return;
      const newBody = prompt('수정할 내용:', note.body || note.content || '');
      if (newBody === null) return;

      const res = await fetch('/api/notes/' + note.id, {
        method: 'PUT',
        headers: {
          'authorization': 'Bearer ' + currentSession.access_token,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle, body: newBody })
      });
      if (res.ok) {
        loadNotes(true);
      } else {
        alert('수정 실패');
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.textContent = '삭제';
    delBtn.addEventListener('click', async () => {
      if (!confirm("'" + note.title + "' 메모를 삭제하시겠습니까?")) return;
      const res = await fetch('/api/notes/' + note.id, {
        method: 'DELETE',
        headers: {
          'authorization': 'Bearer ' + currentSession.access_token
        }
      });
      if (res.ok) {
        loadNotes(true);
      } else {
        alert('삭제 실패');
      }
    });

    actionsDiv.append(editBtn, delBtn);
    item.append(contentDiv, actionsDiv);
    return item;
  }));
}

async function loadNotes(force = false) {
  if (!currentSession || !currentSession.access_token) {
    cachedNotes = null;
    const item = document.createElement('li');
    item.className = 'empty-item';
    item.textContent = '로그인이 필요한 자료실입니다. 상단에서 로그인해 주세요.';
    list.replaceChildren(item);
    return;
  }

  // 캐시가 있으면 즉시 렌더링 (체감 대기시간 0ms)
  if (cachedNotes && !force) {
    renderNotes(cachedNotes);
  }

  // 이전 진행 중인 요청은 취소하여 네트워크 중복 낭비 방지
  if (currentFetchController) {
    currentFetchController.abort();
  }
  currentFetchController = new AbortController();

  try {
    const response = await fetch('/api/notes', {
      headers: {
        'authorization': 'Bearer ' + currentSession.access_token,
        'cache-control': 'no-store'
      },
      signal: currentFetchController.signal
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || '자료를 불러올 수 없습니다.');
    }

    const data = await response.json();
    if (!Array.isArray(data.notes)) throw new Error('자료 형식이 맞지 않습니다.');
    cachedNotes = data.notes;
    renderNotes(data.notes);
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (!cachedNotes) {
      const item = document.createElement('li');
      item.className = 'empty-item';
      item.textContent = error.message;
      list.replaceChildren(item);
    }
  }
}

function updateAuthState(session) {
  currentSession = session;
  const newUserId = session?.user?.id || null;
  if (session && session.user) {
    loginSection.style.display = 'none';
    userSection.style.display = 'block';
    userEmailDisplay.textContent = session.user.email;
    loginError.style.display = 'none';
  } else {
    loginSection.style.display = 'block';
    userSection.style.display = 'none';
    userEmailDisplay.textContent = '';
  }

  // 계정이 바뀌었을 때는 이전 캐시 비우기
  if (lastUserId !== newUserId) {
    cachedNotes = null;
    lastUserId = newUserId;
  }
  loadNotes();
}

// Supabase의 onAuthStateChange가 INITIAL_SESSION도 즉시 방출하므로 getSession 중복 호출 제거
supabase.auth.onAuthStateChange((_event, session) => {
  updateAuthState(session);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = '로그인 실패: ' + error.message;
    loginError.style.display = 'block';
  }
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

createNoteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSession || !currentSession.access_token) return;
  const title = newNoteTitle.value.trim();
  const body = newNoteBody.value.trim();

  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer ' + currentSession.access_token,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ title, body })
  });

  if (res.ok) {
    newNoteTitle.value = '';
    newNoteBody.value = '';
    loadNotes();
  } else {
    alert('메모 생성 실패');
  }
});
