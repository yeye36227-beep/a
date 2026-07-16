// ============================================================
// 강의라운지 - 상태 관리 + 영속 저장(localStorage 데모 DB)
// ============================================================
// 실제 서비스에서는 이 저장소 레이어(getUsers/saveUsers 등)를
// 백엔드 REST API 호출로 교체하면 된다. 비밀번호를 평문으로 저장하는 것도
// 데모 전용이며, 실제로는 서버에서 해싱해야 한다.

// ============================================================
// [API 연동 설정] ★★★ 여기에 백엔드 서버 주소를 넣으세요 ★★★
// 예) 로컬 백엔드면  'http://localhost:8080'
//     배포된 서버면  'https://api.내도메인.com'
// 명세서 맨 위의 Base URL 을 그대로 넣으면 됩니다.
// ============================================================
const API_BASE = 'http://localhost:8081';

// ============================================================
// [API 연동] JWT 토큰 처리 도구
//  - 로그인 성공 시 서버가 준 토큰을 저장한다.
//  - 로그인이 필요한 API를 호출할 때 이 토큰을 Authorization 헤더에 실어 보낸다.
// ============================================================
const TOKEN_KEY = 'gl_token';
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// 서버 응답에서 토큰을 유연하게 찾아낸다(명세서 형식이 확정되면 정리)
function pickToken(body) {
  if (!body) return null;
  const d = body.data || {};
  return (
    body.token ||
    body.accessToken ||
    d.token ||
    d.accessToken ||
    d.accessToken?.token ||
    null
  );
}

// 로그인 토큰을 자동으로 붙여 주는 fetch 래퍼 (인증이 필요한 API용)
function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ============================================================
// 토스트 알림 - 투박한 브라우저 alert() 대신 앱다운 부드러운 알림 창
// 메시지 내용으로 성공/실패/안내를 자동 구분해 색을 입힌다.
// ============================================================
function showToast(message, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const msg = String(message);
  // 타입 자동 감지
  if (!type) {
    if (/실패|오류|없습니다|않|불가|에러|거절/.test(msg)) type = 'error';
    else if (/성공|환영|축하|완료|적립|충전|저장|게시|접수|🎁|🔑|🏷️|🎉|📝/.test(msg))
      type = 'success';
    else type = 'info';
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// 기존 코드의 모든 alert(...) 호출을 토스트로 대체 (native 팝업 제거)
window.alert = (msg) => showToast(msg);

const STORAGE_KEYS = {
  USERS: 'gl_users',           // { [email]: userRecord } - 계정별 데이터
  PROFESSORS: 'gl_professors', // 교수 목록(리뷰/태그/다이어그램 지표 포함) - 모든 계정 공유
  JOKBO: 'gl_jokbo',           // 족보 상점 데이터 - 모든 계정 공유
  SESSION: 'gl_session_email', // 현재 로그인 중인 계정 이메일
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('저장소 로드 실패:', key, e);
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('저장소 저장 실패:', key, e);
  }
}

function getUsers() {
  return loadJSON(STORAGE_KEYS.USERS, {});
}
function saveUsers(users) {
  saveJSON(STORAGE_KEYS.USERS, users);
}
function getCurrentUserEmail() {
  return localStorage.getItem(STORAGE_KEYS.SESSION) || null;
}
function setCurrentUserEmail(email) {
  if (email) localStorage.setItem(STORAGE_KEYS.SESSION, email);
  else localStorage.removeItem(STORAGE_KEYS.SESSION);
}
function saveProfessors() {
  saveJSON(STORAGE_KEYS.PROFESSORS, professorsData);
}
function saveJokboData() {
  saveJSON(STORAGE_KEYS.JOKBO, jokboStoreData);
}

// 현재 로그인된 세션의 유저 상태 전역 변수들을 users 저장소에 반영
function syncCurrentUserToStorage() {
  if (!isLoggedIn || !currentUserEmail) return;
  const users = getUsers();
  const prev = users[currentUserEmail] || {};
  users[currentUserEmail] = {
    ...prev,
    name: userName,
    nickname: userNickname,
    studentId: userStudentId,
    joinDate: userJoinDate,
    points: userPoints,
    isCertified,
    bookmarkedIds,
    purchasedJokboIds: purchasedJokbo.map((j) => j.id),
    taggedProfessorIds,
    pointHistoryLog,
    profileImage: userProfileImage,
  };
  saveUsers(users);
}

// users 저장소에서 계정을 찾아 전역 세션 변수에 로드
function loadUserIntoSession(email) {
  const users = getUsers();
  const u = users[email];
  if (!u) return false;

  userName = u.name;
  userNickname = u.nickname;
  userStudentId = u.studentId;
  userJoinDate = u.joinDate || '2024.02.10';
  userPoints = u.points;
  isCertified = !!u.isCertified;
  bookmarkedIds = u.bookmarkedIds || [];
  taggedProfessorIds = u.taggedProfessorIds || [];
  pointHistoryLog = u.pointHistoryLog || [];
  userProfileImage = u.profileImage || null;
  purchasedJokbo = (u.purchasedJokboIds || [])
    .map((id) => jokboStoreData.find((j) => j.id === id))
    .filter(Boolean);

  currentUserEmail = email;
  isLoggedIn = true;
  return true;
}

// ============================================================
// 전역 세션 상태 (비로그인 기본값)
// ============================================================
let isLoggedIn = false;
let isCertified = false;
let currentUserEmail = null;
let userPoints = 20;
let userName = '을지유저';
let userNickname = '을지대생';
let userStudentId = '20261234';
let userJoinDate = '2024.02.10'; // 가입일(표시용)
let userProfileImage = null; // base64 데이터 URL
let bookmarkedIds = [];
let currentProfId = 1;
let currentMode = 'search';
let selectedRating = 5;
let purchasedJokbo = [];
let taggedProfessorIds = [];
let pointHistoryLog = [];

function addPointHistory(label, delta) {
  pointHistoryLog.unshift({ label, delta });
  renderPointHistory();
  syncCurrentUserToStorage();
}

// ============================================================
// 기본(시드) 데이터 - localStorage에 아무것도 없을 때만 사용됨
// ============================================================
const DEFAULT_PROFESSORS = [
  {
    id: 1,
    name: '김을지 교수님',
    college: '보건과학대학',
    dept: '물리치료학과',
    rating: 4.6,
    reviewCount: 3,
    grade: '1',
    tags: ['시험 핵심위주', '학점 깔끔', '출결 엄격'],
    subjects: ['온열치방학', '재활운동학'],
    // 다이어그램 탭 4대 핵심 지표 (1~5 척도) - 리뷰가 새로 등록될 때마다 가중평균으로 갱신됨
    diagramMetrics: {
      examDifficulty: 4.2,
      gradeDifficulty: 3.8,
      attendanceDifficulty: 4.5,
      workload: 3.1,
      sampleCount: 3,
    },
    allTags: [
      { name: '시험난이도 높음', count: 68, max: 80 },
      { name: '과제 많음', count: 54, max: 80 },
      { name: '출결 간소화', count: 22, max: 80 },
    ],
    reviews: [
      {
        id: 101,
        writer: '익명 수강생',
        rating: 5,
        semester: '2024-1',
        text: '수업 내용을 이해하기 쉽게 설명해주셔서 좋았어요. 과제도 적절한 수준이었습니다!',
        date: '2024.05.12',
        timestamp: new Date('2024-05-12').getTime(),
      },
      {
        id: 102,
        writer: '익명 수강생',
        rating: 4,
        semester: '2024-1',
        text: '자료를 잘 제공해주셔서 시험 공부하기 편했어요. 시험 난이도는 중간 정도!',
        date: '2024.04.28',
        timestamp: new Date('2024-04-28').getTime(),
      },
      {
        id: 103,
        writer: '익명 수강생',
        rating: 5,
        semester: '2023-2',
        text: '피드백이 빨라서 질문하기 좋았습니다. 유쾌하셔서 수업 분위기도 좋아요!',
        date: '2023.03.15',
        timestamp: new Date('2023-03-15').getTime(),
      },
    ],
  },
  {
    id: 2,
    name: '박라운지 교수님',
    college: '보건과학대학',
    dept: '임상병리학과',
    rating: 4.5,
    reviewCount: 2,
    grade: '2',
    tags: ['과제 없음', '출결 프리'],
    subjects: ['기초임상학', '실습'],
    diagramMetrics: {
      examDifficulty: 2.5,
      gradeDifficulty: 4.6,
      attendanceDifficulty: 1.8,
      workload: 1.5,
      sampleCount: 2,
    },
    allTags: [{ name: '학점 혜자', count: 30, max: 50 }],
    reviews: [
      {
        id: 201,
        writer: '익명 수강생',
        rating: 5,
        semester: '2024-2',
        text: '과제 부담이 거의 없어서 다른 전공 공부에 집중하기 좋았어요.',
        date: '2024.06.02',
        timestamp: new Date('2024-06-02').getTime(),
      },
      {
        id: 202,
        writer: '익명 수강생',
        rating: 4,
        semester: '2024-1',
        text: '출결이 자유로운 편이고 학점도 잘 주시는 편이었습니다.',
        date: '2024.04.10',
        timestamp: new Date('2024-04-10').getTime(),
      },
    ],
  },
];

// 기본 예시 족보는 제거함(내용 없는 껍데기라 삭제). 상점은 사용자·서버 등록 족보로 채워진다.
const DEFAULT_JOKBO = [];

// localStorage에 저장된 값이 있으면 그걸 쓰고, 없으면 기본 시드 데이터를 사용
let professorsData = loadJSON(STORAGE_KEYS.PROFESSORS, DEFAULT_PROFESSORS);

// ============================================================
// [API 연동] 교수 목록을 서버에서 불러오기  (GET /api/professors)
// 서버 응답 형식: { status, code, message, data: [ { professorId, name, departmentId, departmentName } ] }
// 서버가 주는 값은 기본 정보뿐이라, 앱이 쓰는 나머지 필드는 기본값으로 채운다.
// 서버 연결 실패 시엔 기존(시드/로컬) 데이터를 그대로 유지한다.
// ============================================================
async function loadProfessorsFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/professors`);
    if (!res.ok) {
      console.warn('교수 목록 조회 실패:', res.status);
      return; // 기존 데이터 유지
    }
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : [];
    if (list.length === 0) return;

    professorsData = list.map((p) => ({
      id: p.professorId,
      name: p.name,
      departmentId: p.departmentId,
      dept: p.departmentName || '',
      college: '',
      rating: 0,
      reviewCount: 0,
      grade: '',
      tags: [],
      subjects: [],
      diagramMetrics: {
        examDifficulty: 0,
        gradeDifficulty: 0,
        attendanceDifficulty: 0,
        workload: 0,
        sampleCount: 0,
      },
      allTags: [],
      reviews: [],
    }));

    renderProfessorList(); // 서버 데이터로 화면 다시 그리기
  } catch (e) {
    // 서버 꺼짐 / 주소 틀림 / CORS 등 → 기존 데이터로 계속 동작
    console.warn('교수 목록 서버 연결 실패, 로컬 데이터 사용:', e);
  }
}
let jokboStoreData = loadJSON(STORAGE_KEYS.JOKBO, DEFAULT_JOKBO);
// 예전에 저장된 '껍데기 기본 족보'(등록자·내용 둘 다 없는 항목)를 정리
jokboStoreData = jokboStoreData.filter((j) => j.registeredBy || j.content);

// ============================================================
// 인증/프로필 UI 갱신
// ============================================================
function updateAuthUI() {
  const writeLockOverlay = document.getElementById('review-write-lock-overlay');
  const reviewLockMsg = document.getElementById('review-lock-msg');

  if (isLoggedIn) {
    document.getElementById('profile-logged-out').classList.add('hidden');
    document.getElementById('profile-logged-in').classList.remove('hidden');
    document.getElementById('header-auth-zone').innerHTML =
      `<button class="login-btn" id="btn-logout"><span class="material-icons-outlined">logout</span> 로그아웃</button>`;

    document.getElementById('diagram-lock-overlay').classList.add('hidden');
    document.getElementById('mypage-lock-overlay').classList.add('hidden');
    document.getElementById('mypage-content').classList.remove('hidden');

    document.getElementById('user-points').innerText = userPoints;
    document.getElementById('mypage-points-dynamic').innerText = userPoints;
    document.getElementById('sidebar-user-name').innerText = userNickname;
    document.getElementById('mypage-user-display').innerText = userNickname;
    document.getElementById('mypage-user-subdesc').innerText =
      `${userName} · 가입일: ${userJoinDate}`;
    updatePointTier();

    renderAvatar();
    updateTagButtonState();

    if (isCertified) {
      writeLockOverlay.classList.add('hidden');
    } else {
      writeLockOverlay.classList.remove('hidden');
      reviewLockMsg.innerHTML =
        '🔒 <strong>마이페이지</strong>에서 [수강확인서 파일]을 인증 완료해야 후기 작성이 가능합니다.';
    }
    renderPointHistory();
    renderPurchasedJokboList();
  } else {
    document.getElementById('profile-logged-out').classList.remove('hidden');
    document.getElementById('profile-logged-in').classList.add('hidden');
    document.getElementById('header-auth-zone').innerHTML =
      `<button class="login-btn" id="btn-top-login-trigger"><span class="material-icons-outlined">login</span> 로그인</button>`;

    writeLockOverlay.classList.remove('hidden');
    reviewLockMsg.innerText =
      '🔒 리뷰 작성은 로그인 및 수강확인서 인증이 필요합니다.';

    document.getElementById('diagram-lock-overlay').classList.remove('hidden');
    document.getElementById('mypage-lock-overlay').classList.remove('hidden');
    document.getElementById('mypage-content').classList.add('hidden');
  }
}

// 프로필 사진(또는 이니셜) 렌더링 - 사이드바 + 마이페이지 아바타 공통
function renderAvatar() {
  const sidebarEl = document.getElementById('sidebar-avatar-name');
  const mypageEl = document.getElementById('mypage-avatar');
  const initials = userNickname ? userNickname.substring(0, 2) : 'U';

  [sidebarEl, mypageEl].forEach((el) => {
    if (!el) return;
    if (userProfileImage) {
      el.style.backgroundImage = `url(${userProfileImage})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.innerText = '';
    } else {
      el.style.backgroundImage = '';
      el.innerText = initials;
    }
  });
}

// ============================================================
// 족보 상점
// ============================================================
function renderJokboStore() {
  const container = document.getElementById('jokbo-list-container');
  if (!container) return;

  container.innerHTML = jokboStoreData
    .map((item) => {
      const isOwned = purchasedJokbo.some((p) => p.id === item.id);
      const registrantText = item.registeredBy
        ? `등록자: ${item.registeredBy}`
        : '강의라운지 기본 제공';
      // 내가 등록한 족보만 삭제 버튼 노출
      const canDelete = isLoggedIn && item.registeredBy === userNickname;
      return `
      <div class="jokbo-card">
        <div>
          <span class="jokbo-badge">${item.profName}</span>
          <div class="jokbo-title-text">${item.subject}</div>
          <div class="jokbo-meta">유형: ${item.type} · 가격: <strong style="color:var(--primary-color);">${item.price} P</strong></div>
          <div class="jokbo-registrant">${registrantText}</div>
        </div>
        <div class="jokbo-card-actions">
          <button class="jokbo-buy-btn ${isOwned ? 'owned' : ''}" data-id="${item.id}" ${isOwned ? 'disabled' : ''}>
            ${isOwned ? '보유 완료' : '족보 구매'}
          </button>
          ${
            canDelete
              ? `<button class="jokbo-delete-btn" data-del="${item.id}"><span class="material-icons-outlined">delete</span> 삭제</button>`
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');
}

document.body.addEventListener('click', (e) => {
  if (
    e.target.classList.contains('jokbo-buy-btn') &&
    !e.target.classList.contains('owned')
  ) {
    if (!isLoggedIn) {
      alert('족보 구매는 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }

    const jokboId = Number(e.target.getAttribute('data-id'));
    const item = jokboStoreData.find((j) => j.id === jokboId);

    if (item) {
      if (userPoints < item.price) {
        alert(
          `포인트가 부족합니다! (현재 보유: ${userPoints}P / 필요: ${item.price}P)\n리뷰 작성이나 태그 기여로 포인트를 획득하세요.`,
        );
        return;
      }

      userPoints -= item.price;
      purchasedJokbo.push(item);
      addPointHistory(`${item.subject} 구매 차감`, -item.price);
      alert(
        `🎁 [${item.subject}]를 성공적으로 구매했습니다. 10포인트가 차감되었습니다.`,
      );

      updateAuthUI();
      renderJokboStore();
    }
  }

  // 족보 삭제 (내가 등록한 족보만)
  const delBtn = e.target.closest('.jokbo-delete-btn');
  if (delBtn) {
    const jokboId = Number(delBtn.getAttribute('data-del'));
    const item = jokboStoreData.find((j) => j.id === jokboId);
    if (!item) return;
    if (item.registeredBy !== userNickname) {
      alert('본인이 등록한 족보만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm(`'${item.subject}' 족보를 삭제할까요?`)) return;
    jokboStoreData = jokboStoreData.filter((j) => j.id !== jokboId);
    purchasedJokbo = purchasedJokbo.filter((j) => j.id !== jokboId);
    saveJokboData();
    syncCurrentUserToStorage();
    renderJokboStore();
    renderPurchasedJokboList();
    alert('족보가 삭제되었습니다.');
  }
});

// ============================================================
// 포인트 내역
// ============================================================
function renderPointHistory() {
  const renderItems = (list) =>
    list.length
      ? list
          .map(
            (h) => `
      <li>
        <span>${h.label}</span>
        <strong class="${h.delta >= 0 ? 'plus-p' : 'minus-p'}">${h.delta >= 0 ? '+' : ''}${h.delta}P</strong>
      </li>`,
          )
          .join('')
      : `<li class="empty-msg">아직 활동 내역이 없습니다.</li>`;

  const miniEl = document.getElementById('mini-history-list');
  if (miniEl) miniEl.innerHTML = renderItems(pointHistoryLog.slice(0, 5));

  const fullEl = document.getElementById('full-history-list');
  if (fullEl) fullEl.innerHTML = renderItems(pointHistoryLog);
}

// ============================================================
// 마이페이지 좌측 소메뉴 탭 전환
// ============================================================
function switchMypageTab(tab) {
  document.querySelectorAll('.mp-nav-item[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.mp-tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `mp-panel-${tab}`);
  });

  if (tab === 'point' || tab === 'history') renderPointHistory();
  if (tab === 'point' || tab === 'jokbo') renderPurchasedJokboList();
  if (tab === 'bookmark') renderBookmarkListInMypage();
  if (tab === 'edit') fillEditProfileForm();
}

function renderBookmarkListInMypage() {
  const listEl = document.getElementById('mypage-bookmark-list');
  if (!listEl) return;

  const bookmarked = professorsData.filter((p) => bookmarkedIds.includes(p.id));
  if (bookmarked.length === 0) {
    listEl.innerHTML = `<li class="empty-msg">아직 찜한 교수님이 없습니다. 교수 검색에서 찜해 보세요!</li>`;
    return;
  }
  listEl.innerHTML = bookmarked
    .map(
      (p) => `
    <li>
      <span class="material-icons-outlined" style="color:var(--primary-color); font-size:16px;">bookmark</span>
      <strong>${p.name}</strong> - ${p.college} ${p.dept} (★ ${p.rating.toFixed(1)})
      <button class="detail-view-btn" style="padding:4px 8px; font-size:11px; margin-left:auto;" data-id="${p.id}">교수 보러가기</button>
    </li>
  `,
    )
    .join('');

  listEl.querySelectorAll('.detail-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderDetailPage(btn.getAttribute('data-id'));
      switchView(document.getElementById('view-detail'), null);
    });
  });
}

function fillEditProfileForm() {
  const nameInput = document.getElementById('edit-user-name');
  const nicknameInput = document.getElementById('edit-user-nickname');
  if (nameInput) nameInput.value = userName;
  if (nicknameInput) nicknameInput.value = userNickname;
}

document.getElementById('btn-save-profile').addEventListener('click', () => {
  const newName = document.getElementById('edit-user-name').value.trim();
  const newNickname = document
    .getElementById('edit-user-nickname')
    .value.trim();

  if (!newName || !newNickname) {
    alert('이름, 닉네임을 모두 입력해 주세요.');
    return;
  }

  userName = newName;
  userNickname = newNickname;
  syncCurrentUserToStorage();
  updateAuthUI();
  alert('✅ 내 정보가 수정되었습니다.');
});

document.querySelector('.mypage-aside-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.mp-nav-item[data-tab]');
  if (btn) switchMypageTab(btn.getAttribute('data-tab'));
});

// ============================================================
// 내가 가진 족보 + 족보 내용 보기
// ============================================================
function renderPurchasedJokboList() {
  // '내가 가진 족보' 탭과 포인트 화면 하단, 두 곳에 동일하게 렌더링
  const targets = [
    document.getElementById('purchased-jokbo-list'),
    document.getElementById('point-jokbo-list'),
  ].filter(Boolean);
  if (targets.length === 0) return;

  const html =
    purchasedJokbo.length === 0
      ? `<li class="empty-msg">아직 구매하거나 등록한 족보가 없습니다. 상점에서 교환해 보세요!</li>`
      : purchasedJokbo
          .map(
            (item) => `
    <li>
      <span class="material-icons-outlined" style="color:var(--primary-color); font-size:16px;">description</span>
      <strong>[보유] ${item.subject}</strong> - ${item.profName} (${item.type})
      <button class="detail-view-btn" style="padding:4px 8px; font-size:11px; margin-left:auto;" data-id="${item.id}">족보 보러가기</button>
    </li>
  `,
          )
          .join('');

  targets.forEach((listEl) => {
    listEl.innerHTML = html;
    listEl.querySelectorAll('.detail-view-btn').forEach((btn) => {
      btn.addEventListener('click', () =>
        viewJokboContentById(Number(btn.getAttribute('data-id'))),
      );
    });
  });
}

function viewJokboContentById(jokboId) {
  const item =
    jokboStoreData.find((j) => j.id === jokboId) ||
    purchasedJokbo.find((j) => j.id === jokboId);
  if (!item) return;

  document.getElementById('jokbo-view-title').innerText = item.subject;
  document.getElementById('jokbo-view-meta').innerText =
    `${item.profName} · ${item.type} · 등록자: ${item.registeredBy || '강의라운지 기본 제공'}`;
  document.getElementById('jokbo-view-content').innerText =
    item.content || '등록된 텍스트 내용이 없습니다. (기본 제공 족보)';

  document.getElementById('jokbo-view-modal').classList.remove('hidden');

  // 서버에서 실제 족보 내용을 가져와 갱신 (실패 시 로컬 내용 유지)
  fetchExamArchiveContent(jokboId);
}

// ============================================================
// [API 연동] 족보 열람  (GET /api/exam-archives/{archiveId}/content)
// 응답 data: { examArchiveId, title, content, writerSemester, createdAt }
// ============================================================
// ============================================================
// [API 연동] 교수별 족보 목록 조회 (GET /api/professors/{professorId}/exam-archives)
//  응답 data: [ { examArchiveId, title, writerSemester, createdAt } ]
//  받아온 족보를 전역 상점(jokboStoreData)에 채워 넣는다(중복 제외).
// ============================================================
async function fetchExamArchivesForProfessor(professorId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/professors/${professorId}/exam-archives`,
    );
    if (!res.ok) return;
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : [];
    const prof = professorsData.find((p) => p.id === Number(professorId));
    const profName = prof ? prof.name : '';

    let added = false;
    list.forEach((a) => {
      if (!jokboStoreData.some((j) => j.id === a.examArchiveId)) {
        jokboStoreData.push({
          id: a.examArchiveId,
          profName,
          subject: a.title,
          type: a.writerSemester || '족보',
          price: 10,
          fromServer: true,
        });
        added = true;
      }
    });
    if (added) renderJokboStore();
  } catch (e) {
    console.warn('족보 목록 서버 연결 실패:', e);
  }
}

async function fetchExamArchiveContent(archiveId) {
  try {
    const res = await authFetch(
      `${API_BASE}/api/exam-archives/${archiveId}/content`,
    );
    if (!res.ok) return; // 로컬 내용 유지
    const d = (await res.json()).data;
    if (!d) return;

    document.getElementById('jokbo-view-title').innerText = d.title || '';
    document.getElementById('jokbo-view-content').innerText = d.content || '';
    const created = (d.createdAt || '').slice(0, 10).replace(/-/g, '.');
    document.getElementById('jokbo-view-meta').innerText =
      `${d.writerSemester || ''} 수강${created ? ' · ' + created : ''}`;
  } catch (e) {
    console.warn('족보 열람 서버 연결 실패, 로컬 내용 사용:', e);
  }
}

document
  .getElementById('btn-close-jokbo-view')
  .addEventListener('click', () =>
    document.getElementById('jokbo-view-modal').classList.add('hidden'),
  );

// 족보 신규 등록 (PDF 대신 텍스트 내용으로 등록, 저작권 문제 회피)
document
  .getElementById('btn-submit-new-jokbo')
  .addEventListener('click', () => {
    const profId = document.getElementById('jk-prof').value;
    const profObj = professorsData.find((p) => p.id === Number(profId));
    const prof = profObj ? profObj.name : '';
    const sub = document.getElementById('jk-subject').value.trim();
    const type = document.getElementById('jk-type').value.trim();
    const content = document.getElementById('jk-content').value.trim();

    if (!prof) {
      alert('담당 교수님을 목록에서 선택해 주세요.');
      return;
    }
    if (!sub) {
      alert('과목을 목록에서 선택해 주세요.');
      return;
    }
    if (!type || !content) {
      alert('시험 유형과 족보 내용을 모두 기입해 주세요.');
      return;
    }
    if (content.length < 10) {
      alert('족보 내용을 10자 이상 구체적으로 작성해 주세요.');
      return;
    }

    const newId = Date.now();
    const newJokbo = {
      id: newId,
      profName: prof,
      subject: sub + ' 기출족보',
      type: type,
      price: 10,
      content: content,
      registeredBy: userNickname,
    };

    jokboStoreData.unshift(newJokbo);
    saveJokboData();

    document.getElementById('jk-prof').value = '';
    document.getElementById('jk-subject').value = '';
    document.getElementById('jk-type').value = '';
    document.getElementById('jk-content').value = '';
    document.getElementById('jokbo-write-modal').classList.add('hidden');
    alert(
      `✨ [${userNickname}]님의 기출 족보가 상점에 등록되었습니다! (모든 족보 가격은 10P로 균일 책정됩니다)`,
    );
    renderJokboStore();
  });

// 수강확인서 파일 제출
document
  .getElementById('verification-file-input')
  .addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      isCertified = true;
      document.getElementById('file-name-display').innerText =
        `✅ 수강인증 완료 (${file.name})`;
      document.getElementById('file-name-display').style.color = '#2b8a3e';
      syncCurrentUserToStorage();
      alert(
        '🎉 학생 수강인증이 확인되었습니다. 이제 클린리뷰 등록 권한이 활성화됩니다.',
      );
      updateAuthUI();
    }
  });

// 프로필 사진 변경
document
  .getElementById('profile-photo-input')
  .addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      userProfileImage = ev.target.result;
      syncCurrentUserToStorage();
      renderAvatar();
    };
    reader.readAsDataURL(file);
  });

function triggerPhotoUpload(e) {
  if (!isLoggedIn) return;
  e.stopPropagation();
  document.getElementById('profile-photo-input').click();
}
document
  .getElementById('sidebar-avatar-name')
  .addEventListener('click', triggerPhotoUpload);
document
  .getElementById('mypage-avatar')
  .addEventListener('click', triggerPhotoUpload);

// 사이드바 프로필 카드 클릭 시 마이페이지로 이동 (아바타 클릭은 사진 변경이라 위에서 stopPropagation 처리됨)
document.getElementById('profile-logged-in').addEventListener('click', () => {
  switchView(
    document.getElementById('view-mypage'),
    document.getElementById('menu-mypage'),
  );
  updateAuthUI();
  switchMypageTab('point');
  closeMobileSidebar();
});

// ============================================================
// 리뷰 작성 (다이어그램 4대 지표 포함, 실시간 반영)
// ============================================================
document.getElementById('btn-submit-review').addEventListener('click', () => {
  const textInput = document.getElementById('input-review-text');
  const prof = professorsData.find((p) => p.id === currentProfId);

  if (textInput.value.trim().length < 10) {
    alert('성의있는 후기 평가를 10자 이상 작성해 주세요.');
    return;
  }

  const metricScores = {
    examDifficulty: Number(
      document.getElementById('input-exam-difficulty').value,
    ),
    gradeDifficulty: Number(
      document.getElementById('input-grade-difficulty').value,
    ),
    attendanceDifficulty: Number(
      document.getElementById('input-attendance-difficulty').value,
    ),
    workload: Number(document.getElementById('input-workload').value),
  };

  const now = new Date();
  const timeString = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  prof.reviews.unshift({
    id: Date.now(),
    writer: '익명 수강생',
    rating: selectedRating,
    semester: document.getElementById('input-semester').value,
    text: textInput.value,
    date: timeString,
    timestamp: now.getTime(),
    ...metricScores,
  });

  // 서버에도 리뷰 작성 시도 (request: { subjectId, content })
  const subjectSel = document.getElementById('input-review-subject');
  const subjectId = subjectSel && subjectSel.value ? Number(subjectSel.value) : null;
  createReviewOnServer(prof.id, subjectId, textInput.value);

  prof.reviewCount += 1;
  applyReviewToDiagramMetrics(prof, metricScores);
  renderDiagram(prof); // 다이어그램 탭이 실시간(부드러운 애니메이션)으로 최신 점수를 반영
  saveProfessors();

  userPoints += 3;
  addPointHistory('리뷰 작성 보상', 3);
  textInput.value = '';
  alert(
    '📝 클린 익명 리뷰가 게시되었습니다. 3포인트가 적립되고 다이어그램 점수에도 실시간 반영되었습니다.',
  );
  updateAuthUI();
  sortAndRenderReviews();
});

// ============================================================
// 검색 및 필터
// ============================================================
function renderProfessorList() {
  const homeProfList = document.getElementById('home-prof-list');
  if (!homeProfList) return;
  const query = document
    .getElementById('home-search-input')
    .value.toLowerCase();

  const filterDept = document.getElementById('filter-dept').value;
  const filterGrade = document.getElementById('filter-grade').value;

  homeProfList.innerHTML = '';
  let data =
    currentMode === 'bookmark'
      ? professorsData.filter((p) => bookmarkedIds.includes(p.id))
      : professorsData;

  data = data.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(query) ||
      p.dept.toLowerCase().includes(query);
    const matchDept = filterDept === 'all' || p.dept === filterDept;
    const matchGrade = filterGrade === 'all' || p.grade === filterGrade;
    return matchQuery && matchDept && matchGrade;
  });

  if (data.length === 0) {
    homeProfList.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:13px;">조건에 부합하는 교수님 정보가 존재하지 않습니다.</div>`;
    return;
  }

  data.forEach((prof) => {
    const isBookmarked = bookmarkedIds.includes(prof.id);
    const card = document.createElement('div');
    card.className = 'prof-card';
    card.innerHTML = `
      <div class="prof-card-left">
        <div class="prof-avatar-large"><span class="material-icons-outlined">account_circle</span></div>
        <div class="prof-info-block">
          <h3>${prof.name}</h3>
          <div class="dept-text">${prof.college} ${prof.dept} · [${prof.grade}학년 대상]</div>
          <div class="card-tags">${prof.tags.map((t) => `<span class="tag-badge">${t}</span>`).join('')}</div>
          <div class="card-rating"><span class="material-icons-outlined">star</span> ${prof.rating.toFixed(1)} (${prof.reviews.length}개 리뷰)</div>
        </div>
      </div>
      <div class="prof-card-right">
        <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${prof.id}">
          <span class="material-icons-outlined">${isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
        </button>
        <button class="detail-view-btn" data-id="${prof.id}">자세히 보기</button>
      </div>
    `;
    homeProfList.appendChild(card);
  });
}

function sortAndRenderReviews() {
  const prof = professorsData.find((p) => p.id === currentProfId);
  const container = document.getElementById('review-list-container');
  if (!container || !prof) return;

  const sortValue = document.getElementById('review-sort').value;
  let sorted = [...prof.reviews];
  if (sortValue === 'latest') sorted.sort((a, b) => b.timestamp - a.timestamp);
  else if (sortValue === 'rating') sorted.sort((a, b) => b.rating - a.rating);

  if (sorted.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px;">등록된 후기가 없습니다. 첫 후기를 남겨보세요!</p>`;
    return;
  }

  container.innerHTML = sorted
    .map(
      (rev) => `
    <div class="review-clean-node">
      <div class="node-top">
        <div class="node-user-info">
          <span class="material-icons-outlined" style="font-size:16px;">lock_person</span>
          <span>${rev.writer}</span>
          <div class="node-stars">${`★`.repeat(rev.rating)}${`☆`.repeat(5 - rev.rating)}</div>
        </div>
        <div class="node-meta">
          <span>${rev.semester} 수강</span>
          <span>${rev.date}</span>
          <button class="review-report-btn" onclick="reportReview(${rev.id})" title="신고">🚩 신고</button>
        </div>
      </div>
      <p class="node-text">${rev.text}</p>
    </div>
  `,
    )
    .join('');
}

// ============================================================
// [API 연동] 리뷰 신고  (POST /api/reviews/{reviewId}/reports)
//  request: { reason }, 인증 필요(Authorization: Bearer)
//  신고 버튼 클릭 → 사유 입력 → 서버로 전송
// ============================================================
function reportReview(reviewId) {
  if (!isLoggedIn) {
    alert('리뷰 신고는 로그인이 필요합니다.');
    return;
  }
  const reason = prompt('신고 사유를 입력해 주세요.\n(예: 부적절한 내용입니다)');
  if (reason === null) return; // 취소
  const trimmed = reason.trim();
  if (!trimmed) {
    alert('신고 사유를 입력해 주세요.');
    return;
  }
  reportReviewOnServer(reviewId, trimmed);
}

async function reportReviewOnServer(reviewId, reason) {
  try {
    const res = await authFetch(`${API_BASE}/api/reviews/${reviewId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      alert('신고가 접수되었습니다. 감사합니다.');
    } else {
      alert(`신고 처리에 실패했습니다. (${res.status})`);
    }
  } catch (e) {
    console.warn('리뷰 신고 연결 실패:', e);
    alert('서버에 연결하지 못해 신고를 보내지 못했습니다.');
  }
}

// ============================================================
// 회원가입 / 로그인 (계정별 영속 저장)
// ============================================================
document
  .getElementById('btn-execute-register')
  .addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-pwd').value;
    const name = document.getElementById('reg-name').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();

    if (!email || !password || !name || !nickname || !phone) {
      alert('모든 회원가입 필수정보 란을 기입해 주세요.');
      return;
    }
    if (password.length < 8) {
      alert('비밀번호는 8자리 이상으로 설정해 주세요.');
      return;
    }

    // ── 서버로 회원가입 요청 ──────────────────────────────
    // 명세서 request 형식: { username, password, name, nickname, phone }
    // (username 자리에 학교 이메일을 그대로 보냄)
    const btn = document.getElementById('btn-execute-register');
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          password,
          name,
          nickname,
          phone,
        }),
      });

      if (!res.ok) {
        // 서버가 에러를 돌려준 경우 (예: 이미 가입된 이메일 등)
        let msg = '회원가입에 실패했습니다. 입력값을 확인해 주세요.';
        try {
          const err = await res.json();
          if (err && err.message) msg = err.message;
        } catch (_) {}
        alert(`회원가입 실패 (${res.status})\n${msg}`);
        return;
      }

      // 서버가 돌려준 response 데이터
      const data = await res.json().catch(() => ({}));
      setToken(pickToken(data)); // 가입과 동시에 토큰을 준다면 저장

      // 서버 가입 성공 → 앱이 쓰는 로컬 세션 계정도 생성(다른 기능 유지용)
      const users = getUsers();
      users[email] = {
        email,
        password,
        name,
        nickname,
        phone,
        points: 20,
        isCertified: false,
        bookmarkedIds: [],
        purchasedJokboIds: [],
        taggedProfessorIds: [],
        pointHistoryLog: [{ label: '회원가입 기본 지급', delta: 20 }],
        profileImage: null,
      };
      saveUsers(users);

      loadUserIntoSession(email);
      setCurrentUserEmail(email);

      document.getElementById('auth-modal').classList.add('hidden');
      alert(
        `🎁 회원가입 축하드립니다, ${userNickname}님! 기본 지급 20포인트가 충전되었습니다.`,
      );
      updateAuthUI();
    } catch (e) {
      // 네트워크 오류 / 서버 꺼짐 / 주소 틀림 / CORS 등
      console.error('회원가입 요청 오류:', e);
      alert(
        '서버에 연결하지 못했습니다.\n' +
          '· 백엔드 서버가 켜져 있는지\n' +
          `· API_BASE 주소가 맞는지 (현재: ${API_BASE})\n` +
          '확인해 주세요.',
      );
    } finally {
      btn.disabled = false;
    }
  });

document.getElementById('btn-execute-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pwd').value;

  if (!email || !password) {
    alert('이메일과 비밀번호를 입력해 주세요.');
    return;
  }

  // ── 서버로 로그인 요청 ────────────────────────────────
  // 명세서 request 형식: { username, password }
  const btn = document.getElementById('btn-execute-login');
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });

    if (!res.ok) {
      let msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      try {
        const err = await res.json();
        if (err && err.message) msg = err.message;
      } catch (_) {}
      alert(`로그인 실패 (${res.status})\n${msg}`);
      return;
    }

    // 서버가 돌려준 response 데이터
    const data = await res.json().catch(() => ({}));
    setToken(pickToken(data)); // 토큰이 있으면 저장(이후 인증 요청에 자동 사용)

    // 서버 인증 성공 → 앱이 쓰는 로컬 세션으로 이어줌(다른 기능 유지용)
    const users = getUsers();
    if (!users[email]) {
      // 이 브라우저에 로컬 계정 기록이 없으면 최소 정보로 생성
      users[email] = {
        email,
        password,
        name: data.name || email,
        nickname: data.nickname || email.split('@')[0],
        phone: data.phone || '',
        points: 20,
        isCertified: false,
        bookmarkedIds: [],
        purchasedJokboIds: [],
        taggedProfessorIds: [],
        pointHistoryLog: [],
        profileImage: null,
      };
      saveUsers(users);
    }

    loadUserIntoSession(email);
    setCurrentUserEmail(email);
    document.getElementById('auth-modal').classList.add('hidden');
    alert(`🔑 ${userNickname}님, 환영합니다!`);
    updateAuthUI();
  } catch (e) {
    console.error('로그인 요청 오류:', e);
    alert(
      '서버에 연결하지 못했습니다.\n' +
        '· 백엔드 서버가 켜져 있는지\n' +
        `· API_BASE 주소가 맞는지 (현재: ${API_BASE})\n` +
        '확인해 주세요.',
    );
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// 태그 기여 - 입력창을 실제로 펼쳐서 태그명을 직접 작성하게 처리
// ============================================================
document
  .getElementById('btn-tag-input-trigger')
  .addEventListener('click', () => {
    if (!isLoggedIn) {
      alert('태그 기여는 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    if (taggedProfessorIds.includes(currentProfId)) {
      alert('이미 이 교수님에게 태그 기여를 완료하셨습니다. (교수당 1회)');
      return;
    }
    const row = document.getElementById('tag-input-row');
    row.classList.toggle('hidden');
    if (!row.classList.contains('hidden')) {
      document.getElementById('tag-input-field').focus();
    }
  });

// ============================================================
// [API 연동] 태그 등록 (POST /api/admin/tags, 관리자/인증 필요)
//  request:  { name }
//  response: { status, code, message, data: { tagId, name } }
//  성공하면 서버가 만든 tagId를 돌려준다. 권한이 없으면 403이 날 수 있으며,
//  그 경우에도 로컬 태그 기여는 정상 동작하도록 실패를 조용히 넘긴다.
// ============================================================
// 서버에 등록된 전역 태그 이름 → tagId 매핑 (태그 클릭 시 tagId 조회에 사용)
let serverTagMap = {};

// ============================================================
// [API 연동] 태그 목록 조회 (GET /api/tags)
//  응답 data: [ { tagId, name } ]  (request 본문 없음)
//  전역 태그 목록을 받아 이름→tagId 매핑을 만들어 둔다.
// ============================================================
async function fetchTagsFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/tags`);
    if (!res.ok) return;
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : [];
    serverTagMap = {};
    list.forEach((t) => {
      if (t && t.name) serverTagMap[t.name.replace(/\s/g, '')] = t.tagId;
    });
  } catch (e) {
    console.warn('태그 목록 서버 연결 실패:', e);
  }
}

// 이름으로 서버 tagId 찾기 (공백 무시)
function findServerTagId(name) {
  return serverTagMap[name.replace(/\s/g, '')] || null;
}

async function createTagOnServer(name) {
  try {
    const res = await authFetch(`${API_BASE}/api/admin/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      console.warn('태그 서버 등록 실패:', res.status);
      return null;
    }
    const body = await res.json().catch(() => ({}));
    const data = body.data || null; // { tagId, name }
    if (data && data.name) serverTagMap[data.name.replace(/\s/g, '')] = data.tagId;
    return data;
  } catch (e) {
    console.warn('태그 서버 등록 연결 실패, 로컬만 반영:', e);
    return null;
  }
}

// ============================================================
// [API 연동] 태그 클릭(카운트 +1)  (POST /api/professors/{professorId}/tags/{tagId}/clicks)
//  - 인증 필요(Authorization: Bearer). 응답 data 는 null.
//  - 서버에 등록된 태그(tagId 가 있는 태그)에만 호출 가능하다.
// ============================================================
async function clickTagOnServer(professorId, tagId) {
  if (!professorId || !tagId) return;
  try {
    const res = await authFetch(
      `${API_BASE}/api/professors/${professorId}/tags/${tagId}/clicks`,
      { method: 'POST' },
    );
    if (!res.ok) console.warn('태그 클릭 서버 반영 실패:', res.status);
  } catch (e) {
    console.warn('태그 클릭 연결 실패, 로컬만 반영:', e);
  }
}

function submitTagInput() {
  if (!isLoggedIn) return;
  if (taggedProfessorIds.includes(currentProfId)) return;

  const field = document.getElementById('tag-input-field');
  const tagName = field.value.trim();
  if (!tagName) {
    alert('등록할 태그 내용을 입력해 주세요. (예: 시험 범위 명확)');
    return;
  }

  const prof = professorsData.find((p) => p.id === currentProfId);
  if (!prof) return;

  const existing = prof.allTags.find(
    (t) => t.name.replace(/\s/g, '') === tagName.replace(/\s/g, ''),
  );
  if (existing) {
    existing.count += 1;
    if (existing.count > existing.max) existing.max = existing.count;
    // 서버 tagId를 로컬 보관값 또는 전역 태그목록에서 찾아 클릭 반영
    const tagId = existing.tagId || findServerTagId(tagName);
    clickTagOnServer(prof.id, tagId);
  } else {
    const baselineMax = Math.max(
      10,
      ...prof.allTags.map((t) => t.max || 10),
    );
    prof.allTags.push({ name: tagName, count: 1, max: baselineMax });
    // 새로 생긴 태그는 서버에도 등록 시도(실패해도 로컬은 그대로 유지)
    createTagOnServer(tagName).then((created) => {
      if (created && created.tagId) {
        const t = prof.allTags.find((x) => x.name === tagName);
        if (t) t.tagId = created.tagId; // 서버가 준 tagId를 로컬에도 보관
        saveProfessors();
      }
    });
  }

  taggedProfessorIds.push(currentProfId);
  userPoints += 2;
  addPointHistory(`태그 기여: ${tagName}`, 2);
  saveProfessors();

  field.value = '';
  document.getElementById('tag-input-row').classList.add('hidden');
  renderTagProgressGrid(prof);
  updateTagButtonState();
  alert(`🏷️ [${tagName}] 태그를 등록했어요! 2포인트가 적립되었습니다.`);
}

document
  .getElementById('btn-tag-submit-confirm')
  .addEventListener('click', submitTagInput);
document
  .getElementById('tag-input-field')
  .addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTagInput();
  });

function updateTagButtonState() {
  const btn = document.getElementById('btn-tag-input-trigger');
  const notice = document.getElementById('tag-notice-msg');
  const row = document.getElementById('tag-input-row');
  if (!btn) return;

  const alreadyTagged = taggedProfessorIds.includes(currentProfId);
  btn.disabled = alreadyTagged;
  btn.style.opacity = alreadyTagged ? '0.5' : '1';
  btn.style.cursor = alreadyTagged ? 'default' : 'pointer';
  if (alreadyTagged && row) row.classList.add('hidden');

  if (!isLoggedIn) return;
  if (notice) {
    notice.innerText = alreadyTagged
      ? '이미 이 교수님에게 태그 기여를 완료했어요. (교수당 1회)'
      : '태그 입력하기를 눌러 원하는 태그를 직접 작성해 보세요. (+2P)';
  }
}

function openAuthModal(mode = 'login') {
  const authModal = document.getElementById('auth-modal');
  authModal.classList.remove('hidden');
  if (mode === 'login') {
    document.getElementById('modal-sub-login').classList.remove('hidden');
    document.getElementById('modal-sub-register').classList.add('hidden');
  } else {
    document.getElementById('modal-sub-login').classList.add('hidden');
    document.getElementById('modal-sub-register').classList.remove('hidden');
  }
}

// ============================================================
// 다이어그램 - 4대 지표 가중평균 갱신 + 렌더(부드러운 실시간 애니메이션)
// ============================================================
function applyReviewToDiagramMetrics(prof, scores) {
  const m = prof.diagramMetrics;
  const prevCount = m.sampleCount || 0;
  const newCount = prevCount + 1;

  const recalc = (prevAvg, newScore) =>
    (prevAvg * prevCount + newScore) / newCount;

  m.examDifficulty = recalc(m.examDifficulty, scores.examDifficulty);
  m.gradeDifficulty = recalc(m.gradeDifficulty, scores.gradeDifficulty);
  m.attendanceDifficulty = recalc(
    m.attendanceDifficulty,
    scores.attendanceDifficulty,
  );
  m.workload = recalc(m.workload, scores.workload);
  m.sampleCount = newCount;
}

function renderDiagram(prof) {
  const m = prof.diagramMetrics;
  if (!m) return;

  const setBar = (fillId, numId, value) => {
    document.getElementById(fillId).style.width = `${(value / 5) * 100}%`;
    document.getElementById(numId).innerText = value.toFixed(1);
  };
  setBar('bar-fill-exam', 'num-exam', m.examDifficulty);
  setBar('bar-fill-grade', 'num-grade', m.gradeDifficulty);
  setBar('bar-fill-attendance', 'num-attendance', m.attendanceDifficulty);
  setBar('bar-fill-workload', 'num-workload', m.workload);

  const total =
    (m.examDifficulty + m.gradeDifficulty + m.attendanceDifficulty + m.workload) / 4;
  document.getElementById('diagram-total-num').innerText =
    `${total.toFixed(1)} / 5.0`;

  // 4축 레이더 차트 (시계방향: 시험난이도 → 과제량 → 출결 난이도 → 학점난이도)
  const legendEl = document.getElementById('radar-legend-name');
  if (legendEl) legendEl.innerText = `${prof.name} 평균`;
  renderRadarChart([
    { label: '시험난이도', value: m.examDifficulty },
    { label: '과제량', value: m.workload },
    { label: '출결 난이도', value: m.attendanceDifficulty },
    { label: '학점난이도', value: m.gradeDifficulty },
  ]);
}

// 4개 지표를 정오각형 스타일의 SVG 레이더 차트로 그린다 (1~5 척도)
function renderRadarChart(axes) {
  const svg = document.getElementById('radar-svg');
  if (!svg) return;

  const NS = 'http://www.w3.org/2000/svg';
  const cx = 150,
    cy = 140,
    maxR = 92,
    levels = 5;

  const pointFor = (i, r) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / axes.length);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };
  const toStr = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const make = (tag, attrs, cls) => {
    const el = document.createElementNS(NS, tag);
    if (cls) el.setAttribute('class', cls);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  svg.innerHTML = '';

  // 배경 격자(동심 다각형) + 눈금
  for (let lvl = 1; lvl <= levels; lvl++) {
    const r = (maxR / levels) * lvl;
    svg.appendChild(
      make('polygon', { points: toStr(axes.map((_, i) => pointFor(i, r))) }, 'radar-grid'),
    );
    const tick = make('text', { x: cx + 6, y: cy - r + 3 }, 'radar-tick');
    tick.textContent = lvl;
    svg.appendChild(tick);
  }

  // 중심에서 각 축으로 뻗는 선
  axes.forEach((_, i) => {
    const p = pointFor(i, maxR);
    svg.appendChild(make('line', { x1: cx, y1: cy, x2: p.x, y2: p.y }, 'radar-spoke'));
  });

  // 데이터 영역
  const dataPts = axes.map((a, i) => pointFor(i, (maxR / levels) * Math.max(0, Math.min(5, a.value))));
  svg.appendChild(make('polygon', { points: toStr(dataPts) }, 'radar-area'));
  dataPts.forEach((p) => svg.appendChild(make('circle', { cx: p.x, cy: p.y, r: 4 }, 'radar-dot')));

  // 축 라벨
  axes.forEach((a, i) => {
    const p = pointFor(i, maxR + 22);
    const label = make('text', { x: p.x, y: p.y }, 'radar-axis-label');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute(
      'text-anchor',
      Math.abs(p.x - cx) < 12 ? 'middle' : p.x > cx ? 'start' : 'end',
    );
    label.textContent = a.label;
    svg.appendChild(label);
  });
}

// ============================================================
// 태그 요약 그리드 + TOP3 렌더 (교수 상세 페이지 공통)
// ============================================================
function renderTagProgressGrid(prof) {
  const maxCount = Math.max(...prof.allTags.map((t) => t.count), 1);
  document.getElementById('tag-progress-container').innerHTML = prof.allTags
    .map(
      (t) => `
    <div class="progress-card">
      <div class="progress-header">
        <span class="tag-name">${t.name}</span>
        <span class="count-badge">${t.count}</span>
      </div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${(t.count / maxCount) * 100}%"></div></div>
    </div>
  `,
    )
    .join('');

  const top3 = [...prof.allTags].sort((a, b) => b.count - a.count).slice(0, 3);
  document.getElementById('detail-top-tags').innerHTML = top3
    .map(
      (t, i) =>
        `<div class="top-tag-item"><span class="num-badge">${i + 1}</span> ${t.name}</div>`,
    )
    .join('');
}

function renderDetailPage(profId) {
  const prof = professorsData.find((p) => p.id === Number(profId));
  if (!prof) return;
  currentProfId = prof.id;

  document.querySelector('.current-dept').innerText = prof.dept;
  document.getElementById('detail-prof-name').innerText = prof.name;
  document.getElementById('detail-prof-dept').innerText =
    `${prof.college} ${prof.dept}`;
  document.getElementById('detail-subjects').innerText =
    prof.subjects.join(', ');
  document.getElementById('detail-score').innerText = prof.rating.toFixed(1);
  document.getElementById('detail-review-count').innerText =
    `${prof.reviews.length}개 리뷰 기준`;

  renderTagProgressGrid(prof);
  document.getElementById('tag-input-row').classList.add('hidden');
  document.getElementById('tag-input-field').value = '';

  sortAndRenderReviews();
  renderDiagram(prof);
  updateTagButtonState();
  populateReviewSubjects(prof); // 리뷰 작성용 과목 드롭다운 채우기

  // 서버에서 이 교수의 최신 상세 정보를 가져와 갱신 (실패해도 로컬 데이터 유지)
  fetchProfessorDetail(prof.id);
  fetchReviewsFromServer(prof.id); // 서버 리뷰 목록 불러오기
  fetchExamArchivesForProfessor(prof.id); // 서버 족보 목록을 상점에 채우기
}

// ============================================================
// [API 연동] 교수 리뷰 목록 조회  (GET /api/professors/{professorId}/reviews)
// 서버 응답 data 항목: { reviewId, professorId, subjectId, subjectName, content, writerSemester, createdAt }
// 서버 리뷰엔 평점/작성자 이름이 없어서, 있는 필드만 매핑하고 나머지는 기본값을 채운다.
// ============================================================
async function fetchReviewsFromServer(professorId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/professors/${professorId}/reviews`,
    );
    if (!res.ok) return; // 로컬 리뷰 유지
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : [];

    const prof = professorsData.find((p) => p.id === Number(professorId));
    if (!prof) return;

    prof.reviews = list.map((r) => ({
      id: r.reviewId,
      // 서버엔 작성자 이름이 없음 → 과목명을 함께 보여줌
      writer: r.subjectName ? `익명 · ${r.subjectName}` : '익명 수강생',
      rating: 0, // 서버 리뷰엔 평점이 없음(별점 비표시)
      semester: r.writerSemester || '',
      text: r.content || '',
      date: (r.createdAt || '').slice(0, 10).replace(/-/g, '.'),
      timestamp: r.createdAt ? new Date(r.createdAt).getTime() : 0,
      subjectId: r.subjectId,
    }));
    prof.reviewCount = prof.reviews.length;

    // 지금 이 교수 화면을 보고 있다면 다시 그림
    if (currentProfId === prof.id) {
      sortAndRenderReviews();
      const cntEl = document.getElementById('detail-review-count');
      if (cntEl) cntEl.innerText = `${prof.reviewCount}개 리뷰 기준`;
    }
  } catch (e) {
    console.warn('리뷰 목록 서버 연결 실패, 로컬 데이터 사용:', e);
  }
}

// ============================================================
// [API 연동] 리뷰 작성  (POST /api/professors/{professorId}/reviews)
//  request: { subjectId, content }, 인증 필요(Authorization: Bearer)
//  subjectId 는 과목 선택 드롭다운 값. (과목 목록 API가 오면 드롭다운을 채운다)
// ============================================================
async function createReviewOnServer(professorId, subjectId, content) {
  if (!subjectId) {
    // 과목이 선택되지 않으면 서버 전송은 생략(로컬 리뷰는 이미 반영됨)
    console.warn('과목(subjectId) 미선택 → 서버 리뷰 전송 생략');
    return null;
  }
  try {
    const res = await authFetch(
      `${API_BASE}/api/professors/${professorId}/reviews`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, content }),
      },
    );
    if (!res.ok) {
      console.warn('리뷰 서버 작성 실패:', res.status);
      return null;
    }
    const body = await res.json().catch(() => ({}));
    return body.data || null;
  } catch (e) {
    console.warn('리뷰 작성 연결 실패, 로컬만 반영:', e);
    return null;
  }
}

// 과목 선택 드롭다운 채우기 — prof.subjectOptions([{ subjectId, name }])가 있으면 사용
// (과목 목록 API를 연결하면 prof.subjectOptions를 채우게 된다)
function populateReviewSubjects(prof) {
  const sel = document.getElementById('input-review-subject');
  if (!sel) return;
  const opts = Array.isArray(prof.subjectOptions) ? prof.subjectOptions : [];
  sel.innerHTML =
    '<option value="">과목 선택</option>' +
    opts
      .map((s) => `<option value="${s.subjectId}">${s.name}</option>`)
      .join('');
}

// ============================================================
// [API 연동] 교수 상세 조회  (GET /api/professors/{professorId})
// 서버 응답 형식: { status, code, message, data: { professorId, name, departmentId, departmentName } }
// 서버는 기본 정보만 주므로 이름/학과만 갱신하고, 리뷰·태그·평점 등 나머지는 그대로 둔다.
// ============================================================
async function fetchProfessorDetail(professorId) {
  try {
    const res = await fetch(`${API_BASE}/api/professors/${professorId}`);
    if (!res.ok) return; // 로컬 데이터 유지
    const body = await res.json();
    const d = body.data;
    if (!d) return;

    const prof = professorsData.find((p) => p.id === Number(professorId));
    if (!prof) return;

    // 서버가 준 최신 기본 정보로 갱신
    prof.name = d.name;
    prof.dept = d.departmentName || prof.dept;
    prof.departmentId = d.departmentId;

    // 지금 이 교수 상세 화면을 보고 있다면 헤더 텍스트만 새로 그림
    if (currentProfId === prof.id) {
      document.querySelector('.current-dept').innerText = prof.dept;
      document.getElementById('detail-prof-name').innerText = prof.name;
      document.getElementById('detail-prof-dept').innerText =
        `${prof.college} ${prof.dept}`.trim();
    }
  } catch (e) {
    console.warn('교수 상세 서버 연결 실패, 로컬 데이터 사용:', e);
  }
}

// ============================================================
// 마이페이지 포인트 등급 진행바 갱신
// ============================================================
function updatePointTier() {
  const tiers = [
    { name: '새내기 리뷰어', min: 0 },
    { name: '성실 리뷰어', min: 50 },
    { name: '우수 리뷰어', min: 100 },
    { name: '베테랑 리뷰어', min: 200 },
  ];
  let idx = 0;
  for (let i = 0; i < tiers.length; i++)
    if (userPoints >= tiers[i].min) idx = i;
  const cur = tiers[idx];
  const next = tiers[idx + 1] || null;

  const nameEl = document.getElementById('tier-name');
  const nextEl = document.getElementById('tier-next-text');
  const fillEl = document.getElementById('tier-fill');
  if (nameEl) nameEl.innerText = cur.name;
  if (next) {
    const span = next.min - cur.min;
    const prog = Math.max(
      0,
      Math.min(100, ((userPoints - cur.min) / span) * 100),
    );
    if (fillEl) fillEl.style.width = `${prog}%`;
    if (nextEl) nextEl.innerText = `다음 등급까지 ${next.min - userPoints}P`;
  } else {
    if (fillEl) fillEl.style.width = '100%';
    if (nextEl) nextEl.innerText = '최고 등급 달성 🎉';
  }
}

// ============================================================
// 🏠 대시보드 홈 렌더링
// ============================================================
function renderDashboard() {
  const pts = document.getElementById('dash-stat-points');
  if (pts) pts.innerText = `${userPoints}P`;
  const bm = document.getElementById('dash-stat-bookmarks');
  if (bm) bm.innerText = bookmarkedIds.length;
  const jk = document.getElementById('dash-stat-jokbo');
  if (jk) jk.innerText = purchasedJokbo.length;

  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) {
    greetEl.innerText = isLoggedIn
      ? `${userNickname}님, 반가워요 👋`
      : '강의라운지에 오신 걸 환영해요 👋';
  }

  const listEl = document.getElementById('dash-popular-list');
  if (listEl) {
    const top = [...professorsData]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    listEl.innerHTML =
      top.length === 0
        ? `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">아직 등록된 교수님이 없어요.</div>`
        : top
            .map(
              (p) => `
      <div class="dash-prof-card" data-id="${p.id}">
        <span class="material-icons-outlined dash-prof-avatar">account_circle</span>
        <div class="dash-prof-body">
          <div class="dash-prof-name">${p.name}</div>
          <div class="dash-prof-dept">${p.college} ${p.dept}</div>
        </div>
        <div class="dash-prof-rating"><span class="material-icons-outlined">star</span> ${p.rating.toFixed(1)}</div>
      </div>`,
            )
            .join('');
    listEl.querySelectorAll('.dash-prof-card').forEach((card) => {
      card.addEventListener('click', () => {
        renderDetailPage(card.getAttribute('data-id'));
        switchView(document.getElementById('view-detail'), null);
      });
    });
  }
}

// 대시보드 빠른 이동 목적지 처리
function dashNavigate(dest) {
  if (dest === 'search') {
    currentMode = 'search';
    switchView(
      document.getElementById('view-home'),
      document.getElementById('menu-home'),
    );
    renderProfessorList();
  } else if (dest === 'jokbo') {
    switchView(
      document.getElementById('view-jokbo'),
      document.getElementById('menu-jokbo'),
    );
    renderJokboStore();
  } else if (dest === 'mypage') {
    switchView(
      document.getElementById('view-mypage'),
      document.getElementById('menu-mypage'),
    );
    updateAuthUI();
    switchMypageTab('point');
  }
}

function switchView(targetSection, menuBtn) {
  document
    .querySelectorAll('.page-view')
    .forEach((v) => v.classList.add('hidden'));
  document
    .querySelectorAll('.menu-item')
    .forEach((m) => m.classList.remove('active'));
  targetSection.classList.remove('hidden');
  if (menuBtn) menuBtn.classList.add('active');
}

// ============================================================
// 모달 및 네비게이션 이벤트 바인딩
// ============================================================
document
  .getElementById('btn-open-jokbo-modal')
  .addEventListener('click', () => {
    if (!isLoggedIn) {
      alert('족보 공유 및 업로드는 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    populateJokboProfSelect(); // 등록된 교수 목록으로 드롭다운 채우기
    document.getElementById('jokbo-write-modal').classList.remove('hidden');
  });

// 족보 등록 폼: 교수 드롭다운을 등록된 교수 목록으로 채움
function populateJokboProfSelect() {
  const profSel = document.getElementById('jk-prof');
  const subSel = document.getElementById('jk-subject');
  if (!profSel) return;
  profSel.innerHTML =
    `<option value="">교수님을 선택하세요</option>` +
    professorsData
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('');
  if (subSel)
    subSel.innerHTML = `<option value="">먼저 교수님을 선택하세요</option>`;
}

// 선택한 교수의 담당 과목으로 과목 드롭다운을 채움
function populateJokboSubjectSelect(profId) {
  const subSel = document.getElementById('jk-subject');
  if (!subSel) return;
  const prof = professorsData.find((p) => p.id === Number(profId));
  const subjects = (prof && prof.subjects) || [];
  subSel.innerHTML =
    subjects.length === 0
      ? `<option value="">등록된 과목이 없습니다</option>`
      : `<option value="">과목을 선택하세요</option>` +
        subjects.map((s) => `<option value="${s}">${s}</option>`).join('');
}

document.getElementById('jk-prof').addEventListener('change', (e) => {
  populateJokboSubjectSelect(e.target.value);
});
document
  .getElementById('btn-close-jokbo-modal')
  .addEventListener('click', () =>
    document.getElementById('jokbo-write-modal').classList.add('hidden'),
  );

document.getElementById('logo-home-trigger').addEventListener('click', () => {
  switchView(
    document.getElementById('view-dashboard'),
    document.getElementById('menu-dashboard'),
  );
  renderDashboard();
});
document.getElementById('menu-dashboard').addEventListener('click', () => {
  switchView(
    document.getElementById('view-dashboard'),
    document.getElementById('menu-dashboard'),
  );
  renderDashboard();
});
document.getElementById('dash-go-search').addEventListener('click', () =>
  dashNavigate('search'),
);
document.getElementById('dash-more-prof').addEventListener('click', () =>
  dashNavigate('search'),
);
document.querySelectorAll('.dash-quick-card').forEach((card) => {
  card.addEventListener('click', () =>
    dashNavigate(card.getAttribute('data-go')),
  );
});
document.getElementById('menu-home').addEventListener('click', () => {
  currentMode = 'search';
  switchView(
    document.getElementById('view-home'),
    document.getElementById('menu-home'),
  );
  renderProfessorList();
});
document.getElementById('menu-bookmark').addEventListener('click', () => {
  currentMode = 'bookmark';
  switchView(
    document.getElementById('view-home'),
    document.getElementById('menu-bookmark'),
  );
  renderProfessorList();
});
document.getElementById('menu-jokbo').addEventListener('click', () => {
  switchView(
    document.getElementById('view-jokbo'),
    document.getElementById('menu-jokbo'),
  );
  renderJokboStore();
});
document.getElementById('menu-mypage').addEventListener('click', () => {
  switchView(
    document.getElementById('view-mypage'),
    document.getElementById('menu-mypage'),
  );
  updateAuthUI();
  switchMypageTab('point');
});

document
  .getElementById('btn-review-action-trigger')
  .addEventListener('click', () => {
    if (!isLoggedIn) openAuthModal('login');
    else {
      switchView(
        document.getElementById('view-mypage'),
        document.getElementById('menu-mypage'),
      );
      // 수강확인서 인증 UI가 있는 '내 정보 수정' 탭으로 바로 이동
      switchMypageTab('edit');
    }
  });

document
  .getElementById('home-search-input')
  .addEventListener('input', renderProfessorList);
document
  .getElementById('filter-dept')
  .addEventListener('change', renderProfessorList);
document
  .getElementById('filter-grade')
  .addEventListener('change', renderProfessorList);
document
  .getElementById('review-sort')
  .addEventListener('change', sortAndRenderReviews);

document.getElementById('home-prof-list').addEventListener('click', (e) => {
  const target = e.target;
  if (target.classList.contains('detail-view-btn')) {
    renderDetailPage(target.getAttribute('data-id'));
    switchView(document.getElementById('view-detail'), null);
  }
  const bBtn = target.closest('.bookmark-btn');
  if (bBtn) {
    const id = Number(bBtn.getAttribute('data-id'));
    if (bookmarkedIds.includes(id))
      bookmarkedIds = bookmarkedIds.filter((b) => b !== id);
    else bookmarkedIds.push(id);
    syncCurrentUserToStorage();
    renderProfessorList();
  }
});

document.getElementById('btn-back-to-home').addEventListener('click', () => {
  switchView(
    document.getElementById('view-home'),
    document.getElementById('menu-home'),
  );
  renderProfessorList();
});

document.querySelectorAll('.tab-menu .tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.tab-menu .tab-btn')
      .forEach((b) => b.classList.remove('active'));
    document
      .querySelectorAll('.tab-content')
      .forEach((c) => c.classList.remove('active-content'));
    btn.classList.add('active');
    document
      .getElementById(btn.getAttribute('data-tab'))
      .classList.add('active-content');
  });
});

document.body.addEventListener('click', (e) => {
  if (
    e.target.id === 'btn-top-login-trigger' ||
    e.target.id === 'btn-sidebar-login' ||
    e.target.id === 'btn-diagram-login-trigger' ||
    e.target.id === 'btn-mypage-login-trigger'
  )
    openAuthModal('login');

  if (e.target.closest('#btn-logout')) performLogout();
});

// 로그아웃 처리 (헤더 버튼 / 마이페이지 네비 버튼 공용)
function performLogout() {
  isLoggedIn = false;
  isCertified = false;
  currentUserEmail = null;
  setCurrentUserEmail(null);
  clearToken(); // 저장된 로그인 토큰 제거
  userPoints = 20;
  userName = '을지유저';
  userNickname = '을지대생';
  userStudentId = '20261234';
  userProfileImage = null;
  purchasedJokbo = [];
  taggedProfessorIds = [];
  pointHistoryLog = [];
  bookmarkedIds = [];
  alert('로그아웃 되었습니다.');
  updateAuthUI();
  switchView(
    document.getElementById('view-dashboard'),
    document.getElementById('menu-dashboard'),
  );
  renderDashboard();
}

document
  .getElementById('btn-mypage-logout')
  .addEventListener('click', performLogout);
document.getElementById('btn-mypage-back').addEventListener('click', () => {
  switchView(
    document.getElementById('view-dashboard'),
    document.getElementById('menu-dashboard'),
  );
  renderDashboard();
});

document
  .getElementById('btn-close-auth-modal')
  .addEventListener('click', () =>
    document.getElementById('auth-modal').classList.add('hidden'),
  );
document
  .getElementById('go-to-register')
  .addEventListener('click', () => openAuthModal('register'));
document
  .getElementById('go-to-login')
  .addEventListener('click', () => openAuthModal('login'));

document.getElementById('star-input-group').addEventListener('click', (e) => {
  if (e.target.classList.contains('star-seed')) {
    selectedRating = Number(e.target.getAttribute('data-value'));
    document.querySelectorAll('.star-seed').forEach((s, i) => {
      if (i < selectedRating) s.classList.add('active');
      else s.classList.remove('active');
    });
  }
});

document.getElementById('mp-history-more-link').addEventListener('click', () => {
  switchMypageTab('history');
});

// ============================================================
// 📱 모바일 사이드바 슬라이드 메뉴 (햄버거 버튼)
// ============================================================
function openMobileSidebar() {
  document.getElementById('app-sidebar').classList.add('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
}
function closeMobileSidebar() {
  document.getElementById('app-sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}
document
  .getElementById('mobile-menu-toggle')
  .addEventListener('click', openMobileSidebar);
document
  .getElementById('sidebar-overlay')
  .addEventListener('click', closeMobileSidebar);
document.querySelectorAll('.menu-item, .logo-area').forEach((el) => {
  el.addEventListener('click', closeMobileSidebar);
});

// ============================================================
// 📦 PWA - 서비스워커 등록
// ============================================================
// PWA 서비스워커는 service-worker.js 파일이 없어 비활성화(404 방지).
// 필요해지면 service-worker.js를 추가하고 아래 등록 코드를 되살리면 된다.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('service-worker.js');
//   });
// }

// ============================================================
// 초기 구동 - 이전에 로그인해 둔 세션이 있으면 자동 복원
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const savedEmail = getCurrentUserEmail();
  if (savedEmail && loadUserIntoSession(savedEmail)) {
    // 저장된 세션 복원 완료
  }
  updateAuthUI();
  renderProfessorList();       // 먼저 로컬/시드 데이터로 즉시 표시
  renderDashboard();           // 대시보드 홈(기본 진입 화면) 채우기
  loadProfessorsFromServer();  // 서버 연결되면 실제 교수 목록으로 교체
  fetchTagsFromServer();       // 전역 태그 목록(이름→tagId) 미리 로드
});
