// ============================================================
// 강의라운지 - 상태 관리 + 영속 저장(localStorage 데모 DB)
// ============================================================
// 실제 서비스에서는 이 저장소 레이어(getUsers/saveUsers 등)를
// 백엔드 REST API 호출로 교체하면 된다. 비밀번호를 평문으로 저장하는 것도
// 데모 전용이며, 실제로는 서버에서 해싱해야 한다.

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
    reviewCount: 128,
    grade: '1',
    tags: ['시험 핵심위주', '학점 깔끔', '출결 엄격'],
    subjects: ['온열치방학', '재활운동학'],
    // 다이어그램 탭 4대 핵심 지표 (1~5 척도) - 리뷰가 새로 등록될 때마다 가중평균으로 갱신됨
    diagramMetrics: {
      examDifficulty: 4.2,
      gradeDifficulty: 3.8,
      attendanceDifficulty: 4.5,
      workload: 3.1,
      sampleCount: 128,
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
        semester: '2026-1',
        text: '교수님께서 출제 범위를 시험난이도에 맞게 정확히 짚어주셔서 공부 방향 잡기가 정말 최고였습니다.',
        date: '2026.06.14',
        timestamp: new Date('2026-06-14').getTime(),
      },
    ],
  },
  {
    id: 2,
    name: '박라운지 교수님',
    college: '보건과학대학',
    dept: '임상병리학과',
    rating: 4.2,
    reviewCount: 12,
    grade: '2',
    tags: ['과제 없음', '출결 프리'],
    subjects: ['기초임상학', '실습'],
    diagramMetrics: {
      examDifficulty: 2.5,
      gradeDifficulty: 4.6,
      attendanceDifficulty: 1.8,
      workload: 1.5,
      sampleCount: 12,
    },
    allTags: [{ name: '학점 혜자', count: 30, max: 50 }],
    reviews: [],
  },
];

const DEFAULT_JOKBO = [
  {
    id: 501,
    profName: '김을지 교수님',
    subject: '운동처방학 기출족보',
    type: 'PDF · 18p',
    price: 10,
  },
  {
    id: 502,
    profName: '김을지 교수님',
    subject: '재활운동학 기출족보',
    type: 'PDF · 14p',
    price: 10,
  },
];

// localStorage에 저장된 값이 있으면 그걸 쓰고, 없으면 기본 시드 데이터를 사용
let professorsData = loadJSON(STORAGE_KEYS.PROFESSORS, DEFAULT_PROFESSORS);
let jokboStoreData = loadJSON(STORAGE_KEYS.JOKBO, DEFAULT_JOKBO);

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
      `${userName} · 학번: ${userStudentId}`;

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
      return `
      <div class="jokbo-card">
        <div>
          <span class="jokbo-badge">${item.profName}</span>
          <div class="jokbo-title-text">${item.subject}</div>
          <div class="jokbo-meta">유형: ${item.type} · 가격: <strong style="color:var(--primary-color);">${item.price} P</strong></div>
          <div class="jokbo-registrant">${registrantText}</div>
        </div>
        <button class="jokbo-buy-btn ${isOwned ? 'owned' : ''}" data-id="${item.id}" ${isOwned ? 'disabled' : ''}>
          ${isOwned ? '보유 완료' : '족보 구매'}
        </button>
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
  if (tab === 'jokbo') renderPurchasedJokboList();
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
  const idInput = document.getElementById('edit-user-student-id');
  if (nameInput) nameInput.value = userName;
  if (nicknameInput) nicknameInput.value = userNickname;
  if (idInput) idInput.value = userStudentId;
}

document.getElementById('btn-save-profile').addEventListener('click', () => {
  const newName = document.getElementById('edit-user-name').value.trim();
  const newNickname = document
    .getElementById('edit-user-nickname')
    .value.trim();
  const newStudentId = document
    .getElementById('edit-user-student-id')
    .value.trim();

  if (!newName || !newNickname || !newStudentId) {
    alert('이름, 닉네임, 학번을 모두 입력해 주세요.');
    return;
  }

  userName = newName;
  userNickname = newNickname;
  userStudentId = newStudentId;
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
  const listEl = document.getElementById('purchased-jokbo-list');
  if (!listEl) return;

  if (purchasedJokbo.length === 0) {
    listEl.innerHTML = `<li class="empty-msg">아직 구매하거나 등록한 족보가 없습니다. 상점에서 교환해 보세요!</li>`;
    return;
  }
  listEl.innerHTML = purchasedJokbo
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

  listEl.querySelectorAll('.detail-view-btn').forEach((btn) => {
    btn.addEventListener('click', () =>
      viewJokboContentById(Number(btn.getAttribute('data-id'))),
    );
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
    const prof = document.getElementById('jk-prof').value.trim();
    const sub = document.getElementById('jk-subject').value.trim();
    const type = document.getElementById('jk-type').value.trim();
    const content = document.getElementById('jk-content').value.trim();

    if (!prof || !sub || !type || !content) {
      alert('모든 항목을 올바르게 기입해 주세요. (족보 내용 포함)');
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
          <div class="card-rating"><span class="material-icons-outlined">star</span> ${prof.rating.toFixed(1)} (${prof.reviewCount}개 리뷰)</div>
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
        </div>
      </div>
      <p class="node-text">${rev.text}</p>
    </div>
  `,
    )
    .join('');
}

// ============================================================
// 회원가입 / 로그인 (계정별 영속 저장)
// ============================================================
document
  .getElementById('btn-execute-register')
  .addEventListener('click', () => {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-pwd').value;
    const name = document.getElementById('reg-name').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const studentId = document.getElementById('reg-student-id').value.trim();

    if (!email || !password || !name || !nickname || !studentId) {
      alert('모든 회원가입 필수정보 란을 기입해 주세요.');
      return;
    }
    if (password.length < 6) {
      alert('비밀번호는 6자리 이상으로 설정해 주세요.');
      return;
    }

    const users = getUsers();
    if (users[email]) {
      alert('이미 가입된 이메일입니다. 로그인해 주세요.');
      openAuthModal('login');
      return;
    }

    users[email] = {
      email,
      password,
      name,
      nickname,
      studentId,
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
  });

document.getElementById('btn-execute-login').addEventListener('click', () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pwd').value;
  const users = getUsers();
  const record = users[email];

  if (!record || record.password !== password) {
    alert(
      '이메일 또는 비밀번호가 올바르지 않습니다.\n(계정이 없다면 먼저 회원가입을 진행해 주세요)',
    );
    return;
  }

  loadUserIntoSession(email);
  setCurrentUserEmail(email);
  document.getElementById('auth-modal').classList.add('hidden');
  alert(`🔑 ${userNickname}님, 환영합니다!`);
  updateAuthUI();
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
  } else {
    const baselineMax = Math.max(
      10,
      ...prof.allTags.map((t) => t.max || 10),
    );
    prof.allTags.push({ name: tagName, count: 1, max: baselineMax });
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

  // 4축 레이더: N=시험난이도, E=과제량, S=출결 난이도, W=학점난이도
  const nRatio = m.examDifficulty / 5;
  const eRatio = m.workload / 5;
  const sRatio = m.attendanceDifficulty / 5;
  const wRatio = m.gradeDifficulty / 5;

  const nY = 50 - nRatio * 50;
  const eX = 50 + eRatio * 50;
  const sY = 50 + sRatio * 50;
  const wX = 50 - wRatio * 50;

  // CSS에 transition이 걸려 있어 값이 바뀔 때마다 부드럽게 움직인다 (실시간 애니메이션)
  document.getElementById('radar-polygon').style.clipPath =
    `polygon(50% ${nY}%, ${eX}% 50%, 50% ${sY}%, ${wX}% 50%)`;
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
    `${prof.reviewCount}개 리뷰 기준`;

  renderTagProgressGrid(prof);
  document.getElementById('tag-input-row').classList.add('hidden');
  document.getElementById('tag-input-field').value = '';

  sortAndRenderReviews();
  renderDiagram(prof);
  updateTagButtonState();
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
    document.getElementById('jokbo-write-modal').classList.remove('hidden');
  });
document
  .getElementById('btn-close-jokbo-modal')
  .addEventListener('click', () =>
    document.getElementById('jokbo-write-modal').classList.add('hidden'),
  );

document.getElementById('logo-home-trigger').addEventListener('click', () => {
  switchView(
    document.getElementById('view-home'),
    document.getElementById('menu-home'),
  );
  renderProfessorList();
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
    else
      switchView(
        document.getElementById('view-mypage'),
        document.getElementById('menu-mypage'),
      );
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

  if (e.target.id === 'btn-logout') {
    isLoggedIn = false;
    isCertified = false;
    currentUserEmail = null;
    setCurrentUserEmail(null);
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
      document.getElementById('view-home'),
      document.getElementById('menu-home'),
    );
    renderProfessorList();
  }
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch((err) => console.log('서비스워커 등록 실패:', err));
  });
}

// ============================================================
// 초기 구동 - 이전에 로그인해 둔 세션이 있으면 자동 복원
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const savedEmail = getCurrentUserEmail();
  if (savedEmail && loadUserIntoSession(savedEmail)) {
    // 저장된 세션 복원 완료
  }
  updateAuthUI();
  renderProfessorList();
});
