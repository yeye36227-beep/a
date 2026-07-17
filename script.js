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
// Live Server(5500)로 열면 CORS 프록시(8082)를 거쳐 백엔드를 호출하고,
// 도커 프론트(8080) 등 그 외 환경에서는 백엔드(8081)를 직접 호출한다.
const API_BASE =
  location.port === '5500'
    ? 'http://localhost:8082'
    : 'http://localhost:8081';

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
  const direct =
    body.token ||
    body.accessToken ||
    body.jwt ||
    d.token ||
    d.accessToken ||
    d.jwt ||
    (d.accessToken && d.accessToken.token) ||
    (d.tokenInfo && d.tokenInfo.accessToken);
  if (typeof direct === 'string' && direct) return direct;

  // 키 이름이 달라도 놓치지 않도록: 'token'이 들어간 키의 문자열, 또는 JWT 형태를 깊이 탐색
  const looksJwt = (s) =>
    typeof s === 'string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(s);
  let found = null;
  const walk = (o) => {
    if (!o || typeof o !== 'object' || found) return;
    for (const [k, v] of Object.entries(o)) {
      if (found) break;
      if (typeof v === 'string') {
        if (/token/i.test(k) && v.length > 20 && !/refresh/i.test(k)) {
          found = v;
          break;
        }
        if (looksJwt(v)) {
          found = v;
          break;
        }
      } else if (v && typeof v === 'object') {
        walk(v);
      }
    }
  };
  walk(body);
  return found;
}

// JWT의 만료(exp)를 클라이언트에서 미리 확인한다. (이 백엔드 토큰은 15분짜리로 짧다)
function isTokenExpired() {
  const t = getToken();
  if (!t) return true;
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() / 1000 >= payload.exp;
  } catch (_) {
    return false; // 못 읽으면 만료로 단정하지 않음
  }
}

// 서버 반영이 가능한 인증 상태인지 확인. 만료면 한 번만 안내하고 로컬 처리로 넘긴다.
let __tokenExpiredNotified = false;
function canSyncToServer() {
  if (!getToken()) return false;
  if (isTokenExpired()) {
    if (!__tokenExpiredNotified) {
      __tokenExpiredNotified = true;
      alert(
        '로그인 세션이 만료됐어요(약 15분). 서버 반영은 다시 로그인 후 가능하며, 지금 활동은 화면(로컬)에만 반영됩니다.',
      );
    }
    return false;
  }
  return true;
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

// 기존 코드의 모든 alert(...) 호출을 디자인 다이얼로그로 대체 (native 팝업 제거)
// showAppDialog 정의는 파일 하단에 있으며 함수 선언이라 호이스팅되어 여기서 사용 가능.
window.alert = (msg) => showAppDialog(msg);

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
  // 저장된 가입일이 있으면 사용, 없던 기존 계정은 오늘 날짜로 보정 후 저장
  if (u.joinDate) {
    userJoinDate = u.joinDate;
  } else {
    userJoinDate = todayDateStr();
    u.joinDate = userJoinDate;
    saveUsers(users);
  }
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
  isAdmin = computeIsAdmin(email, u);
  return true;
}

// ============================================================
// 관리자(admin 롤) 판별
//  - 서버가 준 role 값이 'ADMIN'이거나
//  - 계정 이메일이 지정된 관리자 계정이면 관리자로 본다.
//  (추후 서버 롤 값이 확정되면 이 로직만 교체하면 된다.)
// ============================================================
const ADMIN_EMAILS = ['admin@eulji.ac.kr', 'admin@likelion.com'];
function computeIsAdmin(email, user) {
  const role = (user && (user.role || user.authority)) || '';
  if (String(role).toUpperCase().includes('ADMIN')) return true;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  // 데모 편의: 이메일 아이디가 'admin'으로 시작하면 관리자로 취급
  if (email && email.toLowerCase().startsWith('admin')) return true;
  return false;
}

// ============================================================
// 전역 세션 상태 (비로그인 기본값)
// ============================================================
let isLoggedIn = false;
let isCertified = false;
let isAdmin = false; // 관리자(admin 롤) 여부
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

// 오늘 날짜를 'YYYY.MM.DD' 형식 문자열로 반환 (가입일 등 표시용)
function todayDateStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

function addPointHistory(label, delta) {
  pointHistoryLog.unshift({ label, delta });
  renderPointHistory();
  syncCurrentUserToStorage();
}

// ============================================================
// 기본(시드) 데이터 - localStorage에 아무것도 없을 때만 사용됨
// ============================================================
const DEFAULT_PROFESSORS = []; // 하드코딩 제거 - 교수는 전적으로 서버(GET /api/professors)에서 로드

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

    // 기존(로컬) 교수 데이터를 id로 보관해 두었다가, 서버 정보와 병합한다.
    // 이렇게 하면 로컬에 쌓인 리뷰·평점·태그가 새로고침해도 사라지지 않는다.
    const prevById = {};
    professorsData.forEach((p) => {
      prevById[p.id] = p;
    });

    professorsData = list.map((p) => {
      const prev = prevById[p.professorId];
      return {
        id: p.professorId,
        name: p.name, // 서버가 준 이름/학과가 기준
        departmentId: p.departmentId,
        dept: p.departmentName || '',
        // 서버가 안 주는 하드코딩 전용 필드(대학/학년/카드태그)는 쓰지 않는다 → 모든 교수 통일
        college: '',
        grade: '',
        tags: [],
        // 아래는 서버 리뷰에서 파생/계산되는 값 → 있으면 유지, 없으면 기본값
        rating: prev ? prev.rating : 0,
        reviewCount: prev ? prev.reviewCount : 0,
        subjects: prev ? prev.subjects : [],
        subjectOptions: prev ? prev.subjectOptions : [],
        diagramMetrics: prev
          ? prev.diagramMetrics
          : {
              examDifficulty: 0,
              gradeDifficulty: 0,
              attendanceDifficulty: 0,
              workload: 0,
              sampleCount: 0,
            },
        allTags: prev ? prev.allTags || [] : [],
        reviews: prev ? prev.reviews || [] : [],
      };
    });

    saveProfessors(); // 병합 결과를 로컬에도 반영
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
// 관리자 전용 메뉴(사이드바 '관리자 페이지' 버튼) 노출 여부 갱신
function updateAdminUI() {
  const show = isLoggedIn && isAdmin;
  const btn = document.getElementById('menu-admin');
  const section = document.getElementById('admin-menu-section');
  if (btn) btn.classList.toggle('hidden', !show);
  if (section) section.classList.toggle('hidden', !show);
}

function updateAuthUI() {
  const writeLockOverlay = document.getElementById('review-write-lock-overlay');
  const reviewLockMsg = document.getElementById('review-lock-msg');

  updateAdminUI();

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
        <div class="jokbo-card-head">
          <span class="jokbo-badge">${item.profName}</span>
          ${isOwned ? '<span class="jokbo-owned-pill">열람함</span>' : ''}
          ${
            canDelete
              ? `<button class="jokbo-delete-btn" data-del="${item.id}" title="삭제"><span class="material-icons-outlined">delete</span></button>`
              : ''
          }
        </div>
        <div class="jokbo-title-text">${item.subject}</div>
        <div class="jokbo-meta">${item.type} · ${registrantText}</div>
        <div class="jokbo-card-footer">
          <span class="jokbo-price">열람 <strong>10P</strong></span>
          <button class="jokbo-buy-btn ${isOwned ? 'owned' : ''}" data-id="${item.id}">
            ${isOwned ? '다시 열람' : '열람하기'}
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

document.body.addEventListener('click', (e) => {
  // 족보 '열람' (명세: 최초 열람 시 -10P, 재열람 무료)
  const viewBtn = e.target.closest('.jokbo-buy-btn');
  if (viewBtn) {
    if (!isLoggedIn) {
      alert('족보 열람은 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }

    const jokboId = Number(viewBtn.getAttribute('data-id'));
    const item = jokboStoreData.find((j) => j.id === jokboId);
    if (!item) return;

    const alreadyUnlocked = purchasedJokbo.some((p) => p.id === jokboId);
    if (!alreadyUnlocked) {
      // 최초 열람 → 10P 차감 (서버도 GET content 시 최초 1회 -10P 차감)
      if (userPoints < 10) {
        alert(
          `포인트가 부족해 열람할 수 없어요. (열람 10P 필요 / 현재 ${userPoints}P)\n리뷰 작성이나 태그 기여로 포인트를 모아보세요.`,
        );
        return;
      }
      userPoints -= 10;
      purchasedJokbo.push(item);
      addPointHistory(`${item.subject} 열람 차감`, -10);
      updateAuthUI();
      renderJokboStore();
    }
    // 열람 모달 열기 (+ 서버 content 조회). 재열람은 무료.
    viewJokboContentById(jokboId);
    return;
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
  const pwdEl = document.getElementById('edit-user-password');
  const pwdConfirmEl = document.getElementById('edit-user-password-confirm');
  const newPwd = pwdEl ? pwdEl.value : '';
  const newPwdConfirm = pwdConfirmEl ? pwdConfirmEl.value : '';

  if (!newName || !newNickname) {
    alert('이름, 닉네임을 모두 입력해 주세요.');
    return;
  }

  // 비밀번호는 입력했을 때만 변경 (비워두면 기존 비밀번호 유지)
  if (newPwd || newPwdConfirm) {
    if (newPwd.length < 8) {
      alert('비밀번호는 8자리 이상으로 설정해 주세요.');
      return;
    }
    if (newPwd !== newPwdConfirm) {
      alert('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    const users = getUsers();
    if (currentUserEmail && users[currentUserEmail]) {
      users[currentUserEmail].password = newPwd;
      saveUsers(users);
    }
  }

  userName = newName;
  userNickname = newNickname;
  syncCurrentUserToStorage();
  updateAuthUI();

  // 저장 후 비밀번호 입력칸 비우기
  if (pwdEl) pwdEl.value = '';
  if (pwdConfirmEl) pwdConfirmEl.value = '';

  alert(
    newPwd
      ? '✅ 내 정보와 비밀번호가 수정되었습니다.'
      : '✅ 내 정보가 수정되었습니다.',
  );
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
      ? `<li class="empty-msg">아직 열람하거나 등록한 족보가 없습니다. 상점에서 열람해 보세요!</li>`
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

  // 서버에 등록된 족보(fromServer)일 때만 서버 내용을 조회한다.
  // 로컬에서 만든 족보는 id가 타임스탬프라 서버엔 없으므로 호출하면 404가 난다.
  if (item.fromServer) fetchExamArchiveContent(jokboId);
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

// 족보 상점 진입 시: 모든 교수의 서버 족보를 불러와 상점에 채운다.
// (서버 족보는 교수 상세를 안 들러도 상점에서 바로 보이고, 열람 시 content API가 호출되게)
async function loadAllExamArchivesForStore() {
  if (!Array.isArray(professorsData) || professorsData.length === 0) return;
  await Promise.all(
    professorsData.map((p) => fetchExamArchivesForProfessor(p.id)),
  );
  renderJokboStore();
}

// ============================================================
// [API 연동] 족보(기출자료) 신규 등록  ★엔드포인트는 추정 — 명세서로 확인 필요★
//  추정: POST /api/professors/{professorId}/exam-archives
//  request: { title, content, writerSemester }  (인증 필요)
//  response data: { examArchiveId, title, content, writerSemester, createdAt }
//  실패해도 로컬 등록은 유지된다.
// ============================================================
async function createExamArchiveOnServer(professorId, title, content, writerSemester) {
  if (!professorId) return null;
  if (!canSyncToServer()) {
    console.info('토큰 없음/만료 → 족보 서버 등록 생략(로컬만 반영)');
    return null;
  }
  try {
    const res = await authFetch(
      `${API_BASE}/api/professors/${professorId}/exam-archives`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, writerSemester }),
      },
    );
    if (!res.ok) {
      console.warn('족보 서버 등록 실패:', res.status);
      return null;
    }
    const body = await res.json().catch(() => ({}));
    return body.data || null;
  } catch (e) {
    console.warn('족보 서버 등록 연결 실패, 로컬만 반영:', e);
    return null;
  }
}

// 명세: GET /api/exam-archives/{archiveId}/content (인증 필요)
//  성공 200 EXAM_ARCHIVE_200_2 → 최초 열람 시 서버가 포인트 -10 차감, 재열람은 무차감.
//  실패 401 COMMON_401(인증) / 402 EXAM_ARCHIVE_402(포인트 부족) / 404 EXAM_ARCHIVE_404(없음)
async function fetchExamArchiveContent(archiveId) {
  // 로그인(토큰)이 아예 없으면 서버 열람 불가. 만료 토큰은 그대로 호출해 401 안내를 받는다.
  if (!getToken()) {
    alert('족보 열람은 로그인이 필요해요.');
    return;
  }
  try {
    const res = await authFetch(
      `${API_BASE}/api/exam-archives/${archiveId}/content`,
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = body.code || '';
      if (res.status === 402 || code === 'EXAM_ARCHIVE_402') {
        alert('포인트가 부족해 족보를 열람할 수 없어요. (열람 시 10P 필요)');
      } else if (res.status === 404 || code === 'EXAM_ARCHIVE_404') {
        alert('존재하지 않는 족보예요.');
      } else if (res.status === 401 || code === 'COMMON_401') {
        alert('족보 열람은 로그인이 필요해요. 다시 로그인해 주세요.');
      } else {
        console.warn('족보 열람 실패:', res.status, code);
      }
      return; // 로컬 내용 유지
    }
    const d = body.data;
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
      alert('과목을 선택하거나 직접 입력해 주세요.');
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
    const title = sub + ' 기출족보';
    const newJokbo = {
      id: newId,
      profName: prof,
      subject: title,
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

    // 서버에도 등록 시도. 성공하면 서버 id/내용으로 연결(열람 시 서버 API 사용)
    createExamArchiveOnServer(Number(profId), title, content, type).then(
      (created) => {
        if (created && created.examArchiveId) {
          const j = jokboStoreData.find((x) => x.id === newId);
          if (j) {
            j.id = created.examArchiveId; // 서버 id로 교체
            j.fromServer = true; // 열람 시 서버에서 내용 조회
            saveJokboData();
            renderJokboStore();
          }
        }
      },
    );
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
// 전체 평점(★)을 리뷰들의 별점 평균으로 재계산 (별점 있는 리뷰만 반영)
function recomputeProfRating(prof) {
  const rated = (prof.reviews || []).filter((r) => r.rating > 0);
  prof.rating = rated.length
    ? rated.reduce((s, r) => s + r.rating, 0) / rated.length
    : 0;
}

document.getElementById('btn-submit-review').addEventListener('click', () => {
  // 로그인 + 수강확인서 인증이 되어야만 리뷰 작성 가능
  if (!isLoggedIn) {
    alert('리뷰 작성은 로그인이 필요합니다.');
    openAuthModal('login');
    return;
  }
  if (!isCertified) {
    alert(
      '리뷰 작성은 수강확인서 인증이 필요합니다.\n마이페이지 > 내 정보 수정에서 수강확인서를 등록해 주세요.',
    );
    switchView(
      document.getElementById('view-mypage'),
      document.getElementById('menu-mypage'),
    );
    switchMypageTab('edit');
    return;
  }

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

  prof.reviewCount = prof.reviews.length;
  recomputeProfRating(prof); // 전체 평점(★)을 리뷰 평균으로 재계산
  applyReviewToDiagramMetrics(prof, metricScores);
  renderDiagram(prof); // 다이어그램 탭이 실시간(부드러운 애니메이션)으로 최신 점수를 반영
  // 상단 평점/리뷰수 표시 즉시 갱신
  document.getElementById('detail-score').innerText = prof.rating.toFixed(1);
  document.getElementById('detail-review-count').innerText =
    `${prof.reviews.length}개 리뷰 기준`;
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
    // 교수명 / 학과 / 태그 / 담당과목 을 모두 검색 대상에 포함한다.
    const haystacks = [
      p.name,
      p.dept,
      p.college,
      ...(p.tags || []),
      ...((p.allTags || []).map((t) => t.name)),
      ...(p.subjects || []),
    ];
    const matchQuery =
      !query ||
      haystacks.some((h) => (h || '').toLowerCase().includes(query));
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
    // 서버/시드마다 필드가 빠질 수 있어 항상 기본값으로 보정 (교수마다 화면이 달라지는 문제 방지)
    const safeTags = Array.isArray(prof.tags) ? prof.tags : [];
    const safeSubjects = Array.isArray(prof.subjects) ? prof.subjects : [];
    const safeReviews = Array.isArray(prof.reviews) ? prof.reviews : [];
    const safeRating = typeof prof.rating === 'number' ? prof.rating : 0;
    card.innerHTML = `
      <div class="prof-card-left">
        <div class="prof-avatar-large"><span class="material-icons-outlined">account_circle</span></div>
        <div class="prof-info-block">
          <h3>${prof.name}</h3>
          <div class="dept-text">${[prof.college, prof.dept].filter(Boolean).join(' ')}${prof.grade ? ` · ${prof.grade}학년 대상` : ''}</div>
          ${safeSubjects.length ? `<div class="card-subjects">담당과목: ${safeSubjects.join(', ')}</div>` : ''}
          <div class="card-rating"><span class="material-icons-outlined">star</span> ${safeRating.toFixed(1)} (${safeReviews.length}개 리뷰)</div>
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
// 로컬 신고 접수 내역 저장소 (백엔드 연동 전까지 프론트에서 접수 보관)
function getReportsLog() {
  return loadJSON('gl_reports', []);
}
function addReportLog(entry) {
  const list = getReportsLog();
  list.unshift(entry);
  saveJSON('gl_reports', list);
}

// 신고 사유 프리셋
const REPORT_REASONS = [
  '부적절한 내용',
  '욕설/비방',
  '허위사실',
  '광고/스팸',
  '개인정보 노출',
];
let reportingReviewId = null;

function reportReview(reviewId) {
  if (!isLoggedIn) {
    alert('리뷰 신고는 로그인이 필요합니다.');
    return;
  }
  // 네이티브 prompt() 대신 앱 디자인에 맞는 모달을 띄운다.
  reportingReviewId = reviewId;
  const chips = document.getElementById('report-reason-chips');
  if (chips) {
    chips.innerHTML = REPORT_REASONS.map(
      (r) => `<button type="button" class="report-reason-chip" data-reason="${r}">${r}</button>`,
    ).join('');
  }
  const input = document.getElementById('report-reason-input');
  if (input) input.value = '';
  document.getElementById('report-modal').classList.remove('hidden');
}

function submitReport() {
  const input = document.getElementById('report-reason-input');
  const reason = (input ? input.value : '').trim();
  if (!reason) {
    alert('신고 사유를 입력하거나 선택해 주세요.');
    return;
  }
  document.getElementById('report-modal').classList.add('hidden');
  reportReviewOnServer(reportingReviewId, reason);
  reportingReviewId = null;
}

// 명세: POST /api/reviews/{reviewId}/reports (인증 필요)
//  성공 200 REVIEW_200_2 (data null)
//  실패 400 COMMON_400(사유 누락) / 401 COMMON_401(인증) / 404 REVIEW_404(없는 리뷰) / 409 REVIEW_409_2(이미 신고)
async function reportReviewOnServer(reviewId, reason) {
  // 프론트에서 항상 접수 내역을 남긴다 (백엔드 미연동/실패 시에도 접수 보관)
  addReportLog({
    reviewId,
    reason,
    reporter: currentUserEmail || userNickname || '익명',
    at: new Date().toISOString(),
  });

  // 로컬에서 작성한 리뷰(id가 타임스탬프)는 서버에 없으므로 서버 신고 대상이 아니다.
  const isServerReview = professorsData.some((p) =>
    (p.reviews || []).some((r) => r.id === reviewId && r.fromServer),
  );

  if (!isServerReview) {
    alert('신고가 접수되었습니다. 감사합니다.\n검토 후 조치될 예정입니다.');
    return;
  }
  if (!canSyncToServer()) {
    alert(
      '신고가 접수되었어요. (세션 만료로 서버 반영은 다시 로그인 후 처리됩니다)',
    );
    return;
  }

  try {
    const res = await authFetch(`${API_BASE}/api/reviews/${reviewId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json().catch(() => ({}));
    const code = body.code || '';
    if (res.ok) {
      alert('신고가 접수되었습니다. 감사합니다.\n검토 후 조치될 예정입니다.');
    } else if (res.status === 409 || code === 'REVIEW_409_2') {
      alert('이미 신고한 리뷰예요. (중복 신고는 불가합니다)');
    } else if (res.status === 404 || code === 'REVIEW_404') {
      alert('존재하지 않는 리뷰예요.');
    } else if (res.status === 401 || code === 'COMMON_401') {
      alert('신고는 로그인이 필요해요. 다시 로그인해 주세요.');
    } else if (res.status === 400 || code === 'COMMON_400') {
      alert('신고 사유를 입력해 주세요.');
    } else {
      console.warn('리뷰 신고 실패:', res.status, code);
      alert('신고 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  } catch (e) {
    console.warn('리뷰 신고 서버 연결 실패(로컬 접수됨):', e);
    alert('신고가 접수되었습니다. (서버 연결 실패, 화면에는 접수됨)');
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
        joinDate: todayDateStr(), // 실제 가입일(오늘 날짜)로 저장
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
      alert(`로그인에 실패했어요\n${msg}`);
      return;
    }

    // 서버가 돌려준 response 데이터
    const data = await res.json().catch(() => ({}));
    const loginToken = pickToken(data);
    setToken(loginToken); // 토큰이 있으면 저장(이후 인증 요청에 자동 사용)
    __tokenExpiredNotified = false; // 새로 로그인했으니 만료 안내 플래그 초기화
    if (loginToken)
      console.info('로그인 토큰 저장 완료(인증 요청에 자동 사용).');
    else
      console.warn(
        '로그인 응답에서 토큰(JWT)을 못 찾았습니다. 인증이 필요한 요청(태그/신고 등)이 403이 날 수 있어요. 로그인 응답 형식을 확인하세요:',
        data,
      );

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
        joinDate: todayDateStr(),
        bookmarkedIds: [],
        purchasedJokboIds: [],
        taggedProfessorIds: [],
        pointHistoryLog: [],
        profileImage: null,
      };
      saveUsers(users);
    }

    // 서버가 롤(role/authority)을 내려주면 계정에 저장 → 관리자 판별에 사용
    const serverRole =
      data.role || data.authority || (data.data && (data.data.role || data.data.authority));
    if (serverRole) {
      users[email].role = serverRole;
      saveUsers(users);
    }

    loadUserIntoSession(email);
    setCurrentUserEmail(email);
    document.getElementById('auth-modal').classList.add('hidden');
    updateAuthUI();
    if (isAdmin) {
      // 관리자 계정으로 로그인하면 바로 관리자 페이지(모달)로 이동
      alert(`관리자님, 환영합니다.\n관리자 페이지로 이동합니다.`);
      openAdminModal();
    } else {
      alert(
        `로그인 되었습니다!\n${userNickname}님, 환영합니다.\n전공 교수 리뷰에서 다양한 정보를 확인해보세요.`,
      );
    }
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
// 태그 기여 - 직접 입력 대신, 미리 정의된 태그를 '클릭'해서 기여한다.
//  (추후 서버(DB)에서 등록된 태그 목록을 받아 여기에 합쳐서 노출)
// ============================================================
// 기본 제공(프리셋) 태그. 서버 시드 태그와 이름을 맞춰, 클릭 시 서버 tagId로 반영되게 한다.
// (서버 태그 목록을 못 받는 오프라인 상황의 대비용)
const PRESET_TAGS = [
  '출결 엄격함',
  '출결 널널함',
  '시험 어려움',
  '과제 많음',
  '학점 후함',
  '설명 잘함',
  '팀플 많음',
];

// 관리자가 만든(서버 등록 실패 시) 로컬 태그 목록 - 서버 복구 전 임시 보관
function getLocalCreatedTags() {
  return loadJSON('gl_local_tags', []);
}
function addLocalCreatedTag(name) {
  const list = getLocalCreatedTags();
  if (!list.some((n) => n.replace(/\s/g, '') === name.replace(/\s/g, ''))) {
    list.push(name);
    saveJSON('gl_local_tags', list);
  }
}

// 현재 교수 상세에서 클릭 가능한 태그 목록 렌더.
// 서버 태그가 있으면 서버 태그(유효한 tagId 보유)를 우선 노출한다.
function renderTagChoiceList() {
  const container = document.getElementById('tag-choice-list');
  if (!container) return;
  const prof = professorsData.find((p) => p.id === currentProfId);

  // 중복 제거(공백 무시)하여 후보 목록 구성
  const seen = new Set();
  const candidates = [];
  const add = (name) => {
    if (!name) return;
    const key = name.replace(/\s/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(name);
  };
  // 1순위: 서버 등록 태그 → 관리자가 만든 로컬 태그 → 프리셋 → 교수 기존 태그
  serverTags.forEach((t) => add(t.name));
  getLocalCreatedTags().forEach(add);
  PRESET_TAGS.forEach(add);
  if (prof && Array.isArray(prof.allTags)) prof.allTags.forEach((t) => add(t.name));

  container.innerHTML = candidates
    .map(
      (name) =>
        `<button type="button" class="tag-choice-chip" data-tag="${name}">${name}</button>`,
    )
    .join('');
}

document
  .getElementById('btn-tag-input-trigger')
  .addEventListener('click', () => {
    if (!isLoggedIn) {
      alert('태그 기여는 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    if (!isCertified) {
      alert(
        '태그 기여는 수강확인서 인증 후에 가능합니다.\n마이페이지 > 내 정보 수정에서 인증해 주세요.',
      );
      switchView(
        document.getElementById('view-mypage'),
        document.getElementById('menu-mypage'),
      );
      switchMypageTab('edit');
      return;
    }
    if (taggedProfessorIds.includes(currentProfId)) {
      alert('이미 이 교수님에게 태그 기여를 완료하셨습니다. (교수당 1회)');
      return;
    }
    const row = document.getElementById('tag-input-row');
    renderTagChoiceList();
    row.classList.toggle('hidden');
  });

// 태그 칩 클릭 → 해당 태그로 기여 처리
document.getElementById('tag-choice-list').addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-choice-chip');
  if (!chip) return;
  submitTagByName(chip.getAttribute('data-tag'));
});

// 관리자 전용: 새 태그 등록 (POST /api/tags)
async function handleAdminCreateTag() {
  if (!isAdmin) {
    alert('태그 생성은 관리자만 가능합니다.');
    return;
  }
  const input = document.getElementById('admin-tag-name');
  const name = (input ? input.value : '').trim();
  if (!name) {
    alert('등록할 태그명을 입력해 주세요.');
    return;
  }
  // 이미 존재하는 태그면 서버에 보내지 않는다.
  // (백엔드가 중복 시 409 대신 500으로 터지는 경우가 있어 사전 차단)
  if (findServerTagId(name)) {
    alert('이미 존재하는 태그명입니다. 목록에서 선택해 주세요.');
    return;
  }
  if (!canSyncToServer()) {
    alert('세션이 만료됐어요. 다시 로그인 후 태그를 등록해 주세요.');
    return;
  }
  const result = await createTagOnServer(name);
  if (result.ok) {
    if (input) input.value = '';
    renderTagChoiceList(); // 새 태그를 선택 목록에 즉시 반영
    alert(`🏷️ 태그 "${name}" 를 등록했어요.`);
  } else if (result.code === 'TAG_409_1' || result.status === 409) {
    alert('이미 존재하는 태그명입니다. 다른 이름을 입력해 주세요.');
  } else if (result.code === 'COMMON_400' || result.status === 400) {
    alert('태그명을 확인해 주세요. (필수)');
  } else if (result.status === 401 || result.status === 403) {
    alert('권한이 없거나 세션이 만료됐어요. 관리자로 다시 로그인해 주세요.');
  } else if (result.status === 500) {
    // 백엔드 버그(500)로 서버 등록 실패 → 데모용으로 로컬에라도 추가해 화면엔 뜨게 한다.
    addLocalCreatedTag(name);
    if (input) input.value = '';
    renderTagChoiceList();
    alert(
      `서버 등록은 실패했어요(백엔드 500 오류).\n대신 "${name}" 를 화면 목록에 임시로 추가했습니다.\n(서버 반영은 백엔드 수정 후 가능)`,
    );
  } else {
    // 그 밖의 실패도 로컬 추가로 데모는 이어지게 한다.
    addLocalCreatedTag(name);
    if (input) input.value = '';
    renderTagChoiceList();
    alert(`서버 등록 실패(${result.status}). "${name}" 를 화면에 임시 추가했어요.`);
  }
}

document
  .getElementById('btn-admin-create-tag')
  .addEventListener('click', handleAdminCreateTag);
document.getElementById('admin-tag-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAdminCreateTag();
});

// ============================================================
// [API 연동] 태그 등록 (POST /api/tags, 관리자 전용)
//  request:  { name }
//  response: { status, code, message, data: { tagId, name } }
//  성공하면 서버가 만든 tagId를 돌려준다. 권한이 없으면 403이 날 수 있으며,
//  그 경우에도 로컬 태그 기여는 정상 동작하도록 실패를 조용히 넘긴다.
// ============================================================
// 서버에 등록된 전역 태그 이름 → tagId 매핑 (태그 클릭 시 tagId 조회에 사용)
let serverTagMap = {};
// 서버 태그 원본 목록 [{ tagId, name }] - 클릭 선택 후보로 사용(공백 유지)
let serverTags = [];

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
    serverTags = [];
    list.forEach((t) => {
      if (t && t.name) {
        serverTagMap[t.name.replace(/\s/g, '')] = t.tagId;
        serverTags.push({ tagId: t.tagId, name: t.name });
      }
    });
    // 태그 목록을 새로 받았으면, 지금 열려 있는 선택 목록도 갱신
    const row = document.getElementById('tag-input-row');
    if (row && !row.classList.contains('hidden')) renderTagChoiceList();
  } catch (e) {
    console.warn('태그 목록 서버 연결 실패:', e);
  }
}

// 이름으로 서버 tagId 찾기 (공백 무시)
function findServerTagId(name) {
  return serverTagMap[name.replace(/\s/g, '')] || null;
}

// [API 연동] 태그 등록 (POST /api/tags, 관리자 전용)
//  request: { name }
//  성공 201: { code:"TAG_201_1", data:{ tagId, name } }
//  실패 400 COMMON_400(태그명 누락) / 409 TAG_409_1(이미 존재하는 태그명)
//  { ok, data, status, code } 형태로 반환한다.
async function createTagOnServer(name) {
  try {
    const res = await authFetch(`${API_BASE}/api/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('태그 서버 등록 실패:', res.status, body.code || '');
      return { ok: false, status: res.status, code: body.code || '', data: null };
    }
    const data = body.data || null; // { tagId, name }
    if (data && data.name) {
      serverTagMap[data.name.replace(/\s/g, '')] = data.tagId;
      if (!serverTags.some((t) => t.tagId === data.tagId)) serverTags.push(data);
    }
    return { ok: true, status: res.status, code: body.code || '', data };
  } catch (e) {
    console.warn('태그 서버 등록 연결 실패:', e);
    return { ok: false, status: 0, code: '', data: null };
  }
}

// ============================================================
// [API 연동] 태그 클릭(카운트 +1)  (POST /api/professors/{professorId}/tags/{tagId}/clicks)
//  - 인증 필요(Authorization: Bearer). 응답 data 는 null.
//  - 서버에 등록된 태그(tagId 가 있는 태그)에만 호출 가능하다.
// ============================================================
async function clickTagOnServer(professorId, tagId) {
  if (!professorId || !tagId) return;
  // 토큰이 없거나 만료면 서버가 403을 주므로 아예 호출하지 않는다(로컬만 반영).
  if (!canSyncToServer()) {
    console.info('로그인 토큰 없음/만료 → 태그 클릭은 로컬에만 반영합니다.');
    return;
  }
  // 이 백엔드는 태그 클릭 엔드포인트를 일반 USER 권한엔 허용하지 않아 403을 준다.
  // 관리자가 아니면 서버 호출을 생략하고 로컬로만 반영해 불필요한 403을 없앤다.
  if (!isAdmin) {
    console.info('일반 사용자 태그 클릭은 서버 정책상 로컬에만 반영합니다.');
    return;
  }
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

function submitTagByName(rawName) {
  if (!isLoggedIn) return;
  if (!isCertified) {
    alert('태그 기여는 수강확인서 인증이 필요합니다.');
    return;
  }
  if (taggedProfessorIds.includes(currentProfId)) return;

  const tagName = (rawName || '').trim();
  if (!tagName) {
    alert('기여할 태그를 선택해 주세요.');
    return;
  }

  const prof = professorsData.find((p) => p.id === currentProfId);
  if (!prof) return;

  // 태그 '선택(적용)'은 기존 태그에만 한다. 새 태그 생성은 관리자 전용 별도 기능.
  // 선택한 태그의 서버 tagId를 찾아 클릭 엔드포인트로 반영(권한상 관리자만 서버 반영됨).
  const serverTagId = findServerTagId(tagName);

  const existing = prof.allTags.find(
    (t) => t.name.replace(/\s/g, '') === tagName.replace(/\s/g, ''),
  );
  if (existing) {
    existing.count += 1;
    if (existing.count > existing.max) existing.max = existing.count;
    if (!existing.tagId && serverTagId) existing.tagId = serverTagId;
    clickTagOnServer(prof.id, existing.tagId || serverTagId);
  } else {
    const baselineMax = Math.max(10, ...prof.allTags.map((t) => t.max || 10));
    prof.allTags.push({ name: tagName, count: 1, max: baselineMax, tagId: serverTagId });
    clickTagOnServer(prof.id, serverTagId);
  }

  taggedProfessorIds.push(currentProfId);
  userPoints += 2;
  addPointHistory(`태그 기여: ${tagName}`, 2);
  saveProfessors();

  document.getElementById('tag-input-row').classList.add('hidden');
  renderTagProgressGrid(prof);
  updateTagButtonState();
  alert(`🏷️ [${tagName}] 태그에 기여했어요! 2포인트가 적립되었습니다.`);
}

function updateTagButtonState() {
  const btn = document.getElementById('btn-tag-input-trigger');
  const notice = document.getElementById('tag-notice-msg');
  const row = document.getElementById('tag-input-row');
  if (!btn) return;

  // 새 태그 생성 UI는 관리자(admin)로 로그인했을 때만 노출한다.
  const adminCreate = document.getElementById('admin-tag-create');
  if (adminCreate) adminCreate.classList.toggle('hidden', !(isLoggedIn && isAdmin));

  // 비로그인 상태: '기여 완료' 등 로그인 사용자용 문구가 남지 않도록 초기화한다.
  if (!isLoggedIn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'default';
    if (row) row.classList.add('hidden');
    if (notice) notice.innerText = '태그 입력은 로그인이 필요합니다.';
    return;
  }

  const alreadyTagged = taggedProfessorIds.includes(currentProfId);
  const needsCert = isLoggedIn && !isCertified;
  const disabled = alreadyTagged || needsCert;
  btn.disabled = disabled;
  btn.style.opacity = disabled ? '0.5' : '1';
  btn.style.cursor = disabled ? 'default' : 'pointer';
  if ((alreadyTagged || needsCert) && row) row.classList.add('hidden');

  if (notice) {
    notice.innerText = alreadyTagged
      ? '이미 이 교수님에게 태그 기여를 완료했어요. (교수당 1회)'
      : needsCert
        ? '태그 기여는 수강확인서 인증 후 가능해요. (마이페이지 > 내 정보 수정)'
        : '태그 달기를 눌러 원하는 태그를 클릭해 기여해 보세요. (+2P)';
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
    [prof.college, prof.dept].filter(Boolean).join(' ');
  // 담당 과목이 있으면 표시, 없으면 '· 담당 과목' 문구째로 숨김
  const subjWrap = document.getElementById('detail-subjects-wrap');
  if (prof.subjects && prof.subjects.length > 0) {
    document.getElementById('detail-subjects').innerText =
      prof.subjects.join(', ');
    if (subjWrap) subjWrap.style.display = '';
  } else if (subjWrap) {
    subjWrap.style.display = 'none';
  }
  document.getElementById('detail-score').innerText = prof.rating.toFixed(1);
  document.getElementById('detail-review-count').innerText =
    `${prof.reviews.length}개 리뷰 기준`;

  renderTagProgressGrid(prof);
  document.getElementById('tag-input-row').classList.add('hidden');

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

    const serverReviews = list.map((r) => ({
      id: r.reviewId,
      // 서버엔 작성자 이름이 없음 → 과목명을 함께 보여줌
      writer: r.subjectName ? `익명 · ${r.subjectName}` : '익명 수강생',
      rating: 0, // 서버 리뷰엔 평점이 없음(별점 비표시)
      semester: r.writerSemester || '',
      text: r.content || '',
      date: (r.createdAt || '').slice(0, 10).replace(/-/g, '.'),
      timestamp: r.createdAt ? new Date(r.createdAt).getTime() : 0,
      subjectId: r.subjectId,
      fromServer: true,
    }));
    // 로컬에서 작성해 아직 서버에 저장되지 않은 리뷰는 보존한다(새로고침해도 안 사라지게)
    const localOnly = (prof.reviews || []).filter((r) => !r.fromServer);
    prof.reviews = [...serverReviews, ...localOnly];
    prof.reviewCount = prof.reviews.length;
    recomputeProfRating(prof);
    saveProfessors();

    // 리뷰 응답의 subjectId+subjectName으로 '과목 선택' 드롭다운 옵션을 만든다.
    // (별도 과목 API가 없어도 실제 서버 subjectId를 확보 → 리뷰 작성 시 서버 저장 성공)
    const subjMap = new Map();
    list.forEach((r) => {
      if (r.subjectId && r.subjectName && !subjMap.has(r.subjectId))
        subjMap.set(r.subjectId, r.subjectName);
    });
    prof.subjectOptions = [...subjMap.entries()].map(([subjectId, name]) => ({
      subjectId,
      name,
    }));

    // 담당 과목 표시도 위 과목명으로 유추해 채운다
    const derivedSubjects = prof.subjectOptions.map((s) => s.name);
    if (derivedSubjects.length && (!prof.subjects || prof.subjects.length === 0))
      prof.subjects = derivedSubjects;

    // 지금 이 교수 화면을 보고 있다면 다시 그림
    if (currentProfId === prof.id) {
      sortAndRenderReviews();
      populateReviewSubjects(prof); // 과목 선택 드롭다운 채우기
      const cntEl = document.getElementById('detail-review-count');
      if (cntEl) cntEl.innerText = `${prof.reviews.length}개 리뷰 기준`;
      const scoreEl = document.getElementById('detail-score');
      if (scoreEl) scoreEl.innerText = prof.rating.toFixed(1);
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
    console.info('과목(subjectId) 미선택 → 서버 리뷰 전송 생략');
    return null;
  }
  // 토큰이 없거나 만료면 401이 나므로 서버 전송을 생략(로컬 리뷰는 이미 반영됨)
  if (!canSyncToServer()) {
    console.info('토큰 없음/만료 → 서버 리뷰 전송 생략(로컬만 반영)');
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
      // 서버 에러 코드/메시지를 읽어 사용자에게 이유를 알려준다.
      const err = await res.json().catch(() => ({}));
      const code = err.code || '';
      console.warn('리뷰 서버 작성 실패:', res.status, code, err.message || '');
      if (code === 'SUBJECT_PROFESSOR_MISMATCH') {
        alert(
          '선택한 과목이 이 교수님의 담당 과목이 아니에요.\n과목을 다시 선택해 주세요. (리뷰는 화면에는 반영됩니다)',
        );
      } else if (err.message) {
        console.warn('서버 메시지:', err.message);
      }
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
// 등급제(새내기/성실/우수 리뷰어 등)는 제거됨. 호출부 호환을 위해 no-op으로 남겨둔다.
function updatePointTier() {}

// ============================================================
// 🏠 대시보드 홈 렌더링
// ============================================================
function renderDashboard() {
  // 비로그인 상태에서는 포인트/저장/족보 수치를 0(또는 -)으로 표시한다.
  // (로그인/회원가입 전에는 20P 기본 지급이 화면에 노출되지 않도록)
  const pts = document.getElementById('dash-stat-points');
  if (pts) pts.innerText = isLoggedIn ? `${userPoints}P` : '-';
  const bm = document.getElementById('dash-stat-bookmarks');
  if (bm) bm.innerText = isLoggedIn ? bookmarkedIds.length : 0;
  const jk = document.getElementById('dash-stat-jokbo');
  if (jk) jk.innerText = isLoggedIn ? purchasedJokbo.length : 0;

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
    loadAllExamArchivesForStore();
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
  const subInput = document.getElementById('jk-subject');
  if (!profSel) return;
  profSel.innerHTML =
    `<option value="">교수님을 선택하세요</option>` +
    professorsData
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join('');
  if (subInput) {
    subInput.value = '';
    subInput.placeholder = '먼저 교수님을 선택하세요';
  }
  const dl = document.getElementById('jk-subject-list');
  if (dl) dl.innerHTML = '';
}

// 선택한 교수의 담당 과목을 '추천 목록(datalist)'으로 채움.
// 등록된 과목이 없어도 직접 타이핑할 수 있다(과목 등록 API가 없으므로).
function populateJokboSubjectSelect(profId) {
  const subInput = document.getElementById('jk-subject');
  const dl = document.getElementById('jk-subject-list');
  if (!subInput) return;
  const prof = professorsData.find((p) => p.id === Number(profId));
  const subjects = (prof && prof.subjects) || [];
  subInput.value = '';
  subInput.placeholder =
    subjects.length > 0
      ? '과목 선택 또는 직접 입력'
      : '담당 과목을 직접 입력하세요';
  if (dl)
    dl.innerHTML = subjects.map((s) => `<option value="${s}"></option>`).join('');
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
  loadAllExamArchivesForStore(); // 서버 족보를 상점에 불러오기
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
  isAdmin = false;
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
  alert('로그아웃 되었습니다\n안전하게 로그아웃했어요. 다음에 또 만나요!');
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

// ============================================================
// 관리자 페이지 (모달) - 회원 목록 + 상세보기
// ============================================================
function openAdminModal() {
  if (!isAdmin) {
    alert('관리자만 접근할 수 있는 페이지입니다.');
    return;
  }
  switchAdminTab('members'); // 열 때 회원 목록 탭으로
  renderAdminMemberList();
  renderAdminReportList();
  document.getElementById('admin-modal').classList.remove('hidden');
}

// 관리자 모달 탭 전환 (회원 목록 / 신고된 리뷰)
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-atab') === tab);
  });
  document
    .getElementById('admin-tab-members')
    .classList.toggle('hidden', tab !== 'members');
  document
    .getElementById('admin-tab-reports')
    .classList.toggle('hidden', tab !== 'reports');
  if (tab === 'reports') renderAdminReportList();
}

// 신고된 리뷰 목록 렌더 (로컬 신고 접수 내역 기반)
function renderAdminReportList() {
  const container = document.getElementById('admin-report-list');
  if (!container) return;
  const reports = getReportsLog();

  if (!reports.length) {
    container.innerHTML =
      '<div class="report-empty">접수된 신고가 없습니다.</div>';
    return;
  }

  // reviewId로 실제 리뷰(작성자/내용)를 찾아 함께 보여준다.
  const findReview = (id) => {
    for (const p of professorsData) {
      const r = (p.reviews || []).find((rv) => rv.id === id);
      if (r) return { review: r, prof: p };
    }
    return null;
  };

  container.innerHTML = reports
    .map((rep) => {
      const found = findReview(rep.reviewId);
      const reviewText = found
        ? `${found.prof.name} · ${found.review.writer}: “${found.review.text}”`
        : `리뷰 #${rep.reviewId} (본문 없음/서버 리뷰)`;
      const when = (rep.at || '').slice(0, 10).replace(/-/g, '.');
      return `
      <div class="report-card">
        <div class="rc-reason">🚩 ${rep.reason || '(사유 없음)'}</div>
        <div class="rc-review">${reviewText}</div>
        <div class="rc-meta">신고자: ${rep.reporter || '익명'}${when ? ' · ' + when : ''}</div>
      </div>`;
    })
    .join('');
}

function renderAdminMemberList() {
  const container = document.getElementById('admin-member-list');
  if (!container) return;
  const users = getUsers();
  const emails = Object.keys(users);

  if (emails.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">가입된 회원이 없습니다.</div>';
    return;
  }

  container.innerHTML = emails
    .map((email) => {
      const u = users[email] || {};
      const admin = computeIsAdmin(email, u);
      const roleBadge = admin
        ? '<span class="admin-role-badge is-admin">ADMIN</span>'
        : '<span class="admin-role-badge">USER</span>';
      return `
      <div class="admin-member-row">
        <div class="amr-main">
          <div class="amr-name">${u.nickname || u.name || email}${roleBadge}</div>
          <div class="amr-sub">${email} · ${u.points ?? 0}P</div>
        </div>
        <button class="admin-detail-btn" data-email="${email}">상세보기</button>
      </div>`;
    })
    .join('');
}

function renderMemberDetail(email) {
  const users = getUsers();
  const u = users[email];
  if (!u) return;
  const admin = computeIsAdmin(email, u);
  const rows = [
    ['이름', u.name || '-'],
    ['닉네임', u.nickname || '-'],
    ['이메일', email],
    ['연락처', u.phone || '-'],
    ['가입일', u.joinDate || '-'],
    ['보유 포인트', `${u.points ?? 0}P`],
    ['수강확인서 인증', u.isCertified ? '인증됨' : '미인증'],
    ['보유 족보 수', (u.purchasedJokboIds || []).length],
    ['권한', admin ? '관리자(ADMIN)' : '일반회원(USER)'],
  ];
  document.getElementById('member-detail-body').innerHTML = rows
    .map(
      ([label, value]) =>
        `<div class="mdb-row"><span class="mdb-label">${label}</span><span class="mdb-value">${value}</span></div>`,
    )
    .join('');
  document.getElementById('member-detail-modal').classList.remove('hidden');
}

// 신고 모달 이벤트
document.getElementById('report-reason-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.report-reason-chip');
  if (!chip) return;
  const input = document.getElementById('report-reason-input');
  if (input) input.value = chip.getAttribute('data-reason');
});
document
  .getElementById('btn-submit-report')
  .addEventListener('click', submitReport);
document
  .getElementById('btn-close-report')
  .addEventListener('click', () =>
    document.getElementById('report-modal').classList.add('hidden'),
  );
document.getElementById('report-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('report-modal'))
    document.getElementById('report-modal').classList.add('hidden');
});

document.getElementById('menu-admin').addEventListener('click', openAdminModal);
document
  .getElementById('btn-close-admin')
  .addEventListener('click', () =>
    document.getElementById('admin-modal').classList.add('hidden'),
  );
document
  .getElementById('btn-close-member-detail')
  .addEventListener('click', () =>
    document.getElementById('member-detail-modal').classList.add('hidden'),
  );
document.getElementById('admin-member-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.admin-detail-btn');
  if (btn) renderMemberDetail(btn.getAttribute('data-email'));
});
// 관리자 모달 탭 버튼 (회원 목록 / 신고된 리뷰)
document.querySelectorAll('.admin-tab').forEach((b) => {
  b.addEventListener('click', () => switchAdminTab(b.getAttribute('data-atab')));
});
// 배경(딤) 클릭 시 관리자 모달 닫기
['admin-modal', 'member-detail-modal'].forEach((id) => {
  const el = document.getElementById(id);
  if (el)
    el.addEventListener('click', (e) => {
      if (e.target === el) el.classList.add('hidden');
    });
});
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

// ============================================================
// 💬 디자인 다이얼로그 - 못생긴 브라우저 alert()를 대체
//    메시지 내용에 따라 성공/오류/안내 아이콘을 자동으로 고른다.
// ============================================================
function detectDialogType(msg) {
  const m = String(msg);
  // 성공을 먼저 판정한다. (성공 문구/이모지가 있으면 성공으로 확정)
  // 이모지 정규식엔 반드시 u 플래그를 붙인다. u가 없으면 📝·🎁 등이
  // 🔒과 같은 서로게이트 코드(\uD83D)를 공유해 오류로 잘못 분류된다.
  if (
    /(성공|완료|환영|적립|등록되었|등록했|축하|구매했|되었습니다|저장되었|삭제되었|수정되었)/.test(m) ||
    /[🎉✅🎁📝🏷🔑✨🎊]/u.test(m)
  )
    return 'success';
  if (
    /(실패|오류|올바르지|부족합니다|없습니다|불가|취소되었|에러|권한이 없|만료)/.test(m) ||
    /[❌🔒]/u.test(m)
  )
    return 'error';
  return 'info';
}

function showAppDialog(message, opts = {}) {
  const text = String(message);
  const type = opts.type || detectDialogType(text);
  const icon =
    type === 'error'
      ? 'error_outline'
      : type === 'success'
        ? 'check_circle'
        : 'info';

  // 메시지에 줄바꿈이 있으면 첫 줄을 제목, 나머지를 본문으로
  const lines = text.split('\n');
  let title = '';
  let body = text;
  if (lines.length > 1) {
    title = lines[0];
    body = lines.slice(1).join('\n').trim();
  }

  const dim = document.createElement('div');
  dim.className = 'app-dialog-dim';
  const card = document.createElement('div');
  card.className = `app-dialog-card app-dialog-${type}`;
  card.innerHTML = `
    <div class="app-dialog-icon"><span class="material-icons-outlined">${icon}</span></div>
    ${title ? `<div class="app-dialog-title"></div>` : ''}
    <div class="app-dialog-msg"></div>
    <button class="app-dialog-btn">확인</button>`;
  if (title) card.querySelector('.app-dialog-title').textContent = title;
  card.querySelector('.app-dialog-msg').textContent = body;
  dim.appendChild(card);
  document.body.appendChild(dim);

  const close = () => {
    dim.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') close();
  };
  card.querySelector('.app-dialog-btn').addEventListener('click', close);
  dim.addEventListener('click', (e) => {
    if (e.target === dim) close();
  });
  document.addEventListener('keydown', onKey);
  card.querySelector('.app-dialog-btn').focus();
}

// (alert 오버라이드는 파일 상단에서 window.alert = showAppDialog 로 설정됨)
