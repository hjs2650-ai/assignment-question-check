const pathParts = location.pathname.split("/").filter(Boolean);
const routeType = pathParts[0];
const routeValue = decodeURIComponent(pathParts.slice(1).join("/"));
const title = document.querySelector("#title");
const detail = document.querySelector("#detail");
const classNameEl = document.querySelector("#className");
const rangeText = document.querySelector("#rangeText");
const grid = document.querySelector("#problemGrid");
const form = document.querySelector("#responseForm");
const submitButton = form.querySelector('button[type="submit"]');
const nameInput = document.querySelector("#studentName");
const passwordWrap = document.querySelector("#studentPasswordWrap");
const passwordInput = document.querySelector("#studentPassword");
const checkedCount = document.querySelector("#checkedCount");
const noQuestionInput = document.querySelector("#noQuestion");
const message = document.querySelector("#message");
const photoInput = document.querySelector("#photoFiles");
const photoCameraInput = document.querySelector("#photoCamera");
const photoList = document.querySelector("#photoList");
const submissionTabs = document.querySelector("#submissionTabs");
const currentSubmissionTab = document.querySelector("#currentSubmissionTab");
const pastSubmissionTab = document.querySelector("#pastSubmissionTab");
const currentSubmissionPanel = document.querySelector("#currentSubmissionPanel");
const pastAssignmentWrap = document.querySelector("#pastAssignmentWrap");
const pastAssignmentSelect = document.querySelector("#pastAssignmentSelect");
const pastProblemWrap = document.querySelector("#pastProblemWrap");
const pastProblemGrid = document.querySelector("#pastProblemGrid");
const pastCheckedCount = document.querySelector("#pastCheckedCount");
const pastNoQuestionInput = document.querySelector("#pastNoQuestion");
const pastPhotoInput = document.querySelector("#pastPhotoFiles");
const pastPhotoCameraInput = document.querySelector("#pastPhotoCamera");
const pastPhotoList = document.querySelector("#pastPhotoList");
const pastSubmitBtn = document.querySelector("#pastSubmitBtn");
const pastMessage = document.querySelector("#pastMessage");
const studentMissingCheck = document.querySelector("#studentMissingCheck");
const checkMissingBtn = document.querySelector("#checkMissingBtn");
const studentMissingResult = document.querySelector("#studentMissingResult");
const classVideos = document.querySelector("#classVideos");
const classVideoList = document.querySelector("#classVideoList");
const classVideosMonthButton = document.querySelector("#classVideosMonthButton");
const classVideosToggle = document.querySelector("#classVideosToggle");
const videoEmptyState = document.querySelector("#videoEmptyState");
const studentAuthLoading = document.querySelector("#studentAuthLoading");
const studentLoginGate = document.querySelector("#studentLoginGate");
const studentLoginForm = document.querySelector("#studentLoginForm");
const loginClassName = document.querySelector("#loginClassName");
const loginStudentName = document.querySelector("#loginStudentName");
const loginSchoolName = document.querySelector("#loginSchoolName");
const loginStudentPassword = document.querySelector("#loginStudentPassword");
const studentLoginMessage = document.querySelector("#studentLoginMessage");
const studentApp = document.querySelector("#studentApp");
const loggedInStudentName = document.querySelector("#loggedInStudentName");
const loggedInSchoolName = document.querySelector("#loggedInSchoolName");
const loggedInClassName = document.querySelector("#loggedInClassName");
const studentLogoutButton = document.querySelector("#studentLogoutButton");
const studentMainTabs = [...document.querySelectorAll(".student-main-tab")];
const studentHomeView = document.querySelector("#studentHomeView");
const studentAssignmentView = document.querySelector("#studentAssignmentView");
const studentRecordsView = document.querySelector("#studentRecordsView");
const studentVideoView = document.querySelector("#studentVideoView");
const studentGreetingName = document.querySelector("#studentGreetingName");
const studentDashboardMonth = document.querySelector("#studentDashboardMonth");
const studentGraphMonthButton = document.querySelector("#studentGraphMonthButton");
const homeHomeworkValue = document.querySelector("#homeHomeworkValue");
const homeAttendanceValue = document.querySelector("#homeAttendanceValue");
const homeTestValue = document.querySelector("#homeTestValue");
const homeVideoValue = document.querySelector("#homeVideoValue");
const homeProgressBar = document.querySelector("#homeProgressBar");
const homeProgressValue = document.querySelector("#homeProgressValue");
const homeAssignmentStatus = document.querySelector("#homeAssignmentStatus");
const homeMissingAlert = document.querySelector("#homeMissingAlert");
const homeVideoAlert = document.querySelector("#homeVideoAlert");
const homeStartAssignmentButton = document.querySelector("#homeStartAssignmentButton");
const homeQuestionButton = document.querySelector("#homeQuestionButton");
const homePastAssignmentButton = document.querySelector("#homePastAssignmentButton");
const homeViewButtons = [...document.querySelectorAll("[data-home-view]")];
const assignmentViewTitle = document.querySelector("#assignmentViewTitle");
const assignmentViewRange = document.querySelector("#assignmentViewRange");
const studentRecordMonth = document.querySelector("#studentRecordMonth");
const studentRecordTabs = [...document.querySelectorAll(".student-record-tab")];
const studentRecordOverview = document.querySelector("#studentRecordOverview");
const studentRecordTests = document.querySelector("#studentRecordTests");
const studentRecordAttendance = document.querySelector("#studentRecordAttendance");
const studentRecordSummary = document.querySelector("#studentRecordSummary");
const studentScoreTrend = document.querySelector("#studentScoreTrend");
const studentScoreTrendChart = document.querySelector("#studentScoreTrendChart");
const studentLearningAnalysis = document.querySelector("#studentLearningAnalysis");
const studentAttendanceHistory = document.querySelector("#studentAttendanceHistory");
const studentTestHistory = document.querySelector("#studentTestHistory");
const studentPastExamHistory = document.querySelector("#studentPastExamHistory");
const studentRelearningHistory = document.querySelector("#studentRelearningHistory");
const studentRecordsMessage = document.querySelector("#studentRecordsMessage");

let assignmentId = routeType === "student" ? routeValue : "";
let availableAssignments = [];
let currentPhotoFiles = [];
let pastPhotoFiles = [];
let activeSubmissionMode = "current";
let passwordRequiredStudents = new Set();
let activeStudentSession = null;
let targetClassName = routeType === "class" ? routeValue : "";
let recordsLoadedForMonth = "";
let schoolLookupTimer = 0;
let loadedClassVideos = [];
let classVideoScope = "month";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  }
  return payload;
}

function updateCount() {
  const count = grid.querySelectorAll("input:checked").length;
  checkedCount.textContent = noQuestionInput.checked ? "질문 없음" : `${count}개 선택`;
}

function updatePastCount() {
  const count = pastProblemGrid.querySelectorAll("input:checked").length;
  pastCheckedCount.textContent = pastNoQuestionInput.checked ? "질문 없음" : `${count}개 선택`;
}

function clearProblemChecks(targetGrid) {
  targetGrid.querySelectorAll('input[type="checkbox"]:checked').forEach((input) => {
    input.checked = false;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function videosForSelectedMonth() {
  const month = studentRecordMonth.value || localMonthValue();
  return loadedClassVideos.filter((video) => String(video.publishedAt || "").slice(0, 7) === month);
}

function updateVideoHomeSummary() {
  if (!loadedClassVideos.length) {
    return;
  }
  const monthVideos = videosForSelectedMonth();
  const monthNumber = Number((studentRecordMonth.value || localMonthValue()).slice(5, 7));
  homeVideoValue.textContent = monthVideos.length ? `${monthVideos.length}개` : "영상 없음";
  if (monthVideos.length) {
    homeVideoAlert.querySelector("strong").textContent = "최근 수업 영상";
    homeVideoAlert.querySelector("span").textContent = monthVideos[0].title;
    return;
  }
  homeVideoAlert.querySelector("strong").textContent = `${monthNumber}월 수업 영상이 아직 없어요`;
  homeVideoAlert.querySelector("span").textContent = "전체 영상에서 이전 수업을 확인할 수 있어요.";
}

function renderClassVideos() {
  const month = studentRecordMonth.value || localMonthValue();
  const monthNumber = Number(month.slice(5, 7));
  const videos = classVideoScope === "all" ? loadedClassVideos : videosForSelectedMonth();
  classVideoList.classList.toggle("is-expanded", classVideoScope === "all");
  classVideosMonthButton.textContent = `${monthNumber}월 영상`;
  classVideosMonthButton.classList.toggle("is-active", classVideoScope === "month");
  classVideosToggle.classList.toggle("is-active", classVideoScope === "all");
  classVideoList.innerHTML = videos
    .map(
      (video) => `
        <a class="class-video-item" href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer">
          <span class="class-video-thumbnail">
            <img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />
            <span class="class-video-play" aria-hidden="true"></span>
          </span>
          <strong>${escapeHtml(video.title)}</strong>
        </a>
      `,
    )
    .join("") || `<p class="muted class-video-month-empty">${monthNumber}월에 등록된 수업 영상이 아직 없어요.</p>`;
  updateVideoHomeSummary();
}

async function loadClassVideos(className) {
  if (!className) {
    return;
  }
  try {
    const payload = await api(`/api/classes/${encodeURIComponent(className)}/videos`);
    if (!payload.configured || !payload.videos?.length) {
      loadedClassVideos = [];
      classVideoScope = "month";
      classVideos.hidden = true;
      videoEmptyState.hidden = false;
      homeVideoValue.textContent = "등록 영상 없음";
      homeVideoAlert.querySelector("strong").textContent = "새 수업 영상이 아직 없어요";
      homeVideoAlert.querySelector("span").textContent = "영상이 등록되면 이곳에서 바로 확인할 수 있어요.";
      return;
    }

    loadedClassVideos = payload.videos;
    classVideoScope = "month";
    renderClassVideos();
    classVideos.hidden = false;
    videoEmptyState.hidden = true;
  } catch (error) {
    loadedClassVideos = [];
    classVideoScope = "month";
    classVideos.hidden = true;
    videoEmptyState.hidden = false;
    homeVideoValue.textContent = "확인 필요";
    homeVideoAlert.querySelector("strong").textContent = "수업 영상을 불러오지 못했어요";
    homeVideoAlert.querySelector("span").textContent = "수업영상 메뉴에서 다시 확인해 주세요.";
  }
}

function updatePasswordVisibility() {
  if (activeStudentSession) {
    passwordWrap.hidden = true;
    passwordInput.required = false;
    passwordInput.value = "";
    return;
  }
  const passwordRequired = passwordRequiredStudents.has(nameInput.value.trim());
  passwordWrap.hidden = !passwordRequired;
  passwordInput.required = passwordRequired;
  if (!passwordRequired) {
    passwordInput.value = "";
  }
}

function revealPasswordForError(error) {
  if (activeStudentSession) {
    return;
  }
  if (!String(error && error.message).includes("비밀번호")) {
    return;
  }
  passwordWrap.hidden = false;
  passwordInput.required = true;
  passwordInput.focus();
}

function localMonthValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function displayIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

function attendanceStatusLabel(status) {
  return {
    present: "출석",
    late: "지각",
    absent: "결석",
    early: "조퇴",
    makeup: "보강",
  }[status] || "출석";
}

function percentText(value) {
  return value === null || value === undefined ? "기록 없음" : `${value}%`;
}

function monthRecordLabel(month) {
  const monthNumber = Number(String(month || localMonthValue()).slice(5, 7));
  return `${monthNumber}월 기록`;
}

function updateMonthTriggers(month = studentRecordMonth.value || localMonthValue()) {
  const label = monthRecordLabel(month);
  studentDashboardMonth.textContent = label;
  studentGraphMonthButton.textContent = label;
  if (loadedClassVideos.length) {
    renderClassVideos();
  }
}

function openStudentMonthPicker() {
  try {
    if (typeof studentRecordMonth.showPicker === "function") {
      studentRecordMonth.showPicker();
      return;
    }
  } catch {
    // Fall back to the native input click when showPicker is unavailable.
  }
  studentRecordMonth.focus();
  studentRecordMonth.click();
}

function setStudentRecordSection(section = "overview") {
  studentRecordOverview.hidden = section !== "overview";
  studentRecordTests.hidden = section !== "tests";
  studentRecordAttendance.hidden = section !== "attendance";
  studentRecordTabs.forEach((button) => {
    const active = button.dataset.recordSection === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (section === "overview") {
    requestAnimationFrame(() => {
      studentScoreTrendChart.scrollLeft = 0;
    });
  }
}

function setStudentMainView(view) {
  studentHomeView.hidden = view !== "home";
  studentAssignmentView.hidden = view !== "assignment";
  studentRecordsView.hidden = view !== "records";
  studentVideoView.hidden = view !== "videos";
  studentMainTabs.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (view === "records") {
    setStudentRecordSection("overview");
    loadStudentRecords().catch((error) => {
      studentRecordsMessage.className = "message error";
      studentRecordsMessage.textContent = error.message;
    });
  }
}

function renderStudentHomeSummary(payload) {
  const homework = payload.homework || {};
  const attendance = payload.attendance || {};
  const monthlyTests = payload.tests || {};
  const homeworkRate = Number.isFinite(Number(homework.rate)) ? Number(homework.rate) : 0;

  updateMonthTriggers(payload.month);
  homeHomeworkValue.textContent = `${homework.submitted || 0} / ${homework.total || 0}`;
  homeAttendanceValue.textContent = `${attendance.attended || 0} / ${attendance.total || 0}`;
  homeTestValue.textContent = monthlyTests.averagePercent === null || monthlyTests.averagePercent === undefined
    ? "기록 없음"
    : `${monthlyTests.averagePercent}%`;
  homeProgressValue.textContent = homework.rate === null || homework.rate === undefined ? "-" : `${homework.rate}%`;
  homeProgressBar.style.width = `${Math.max(0, Math.min(100, homeworkRate))}%`;
}

async function loadStudentHomeStatus() {
  if (!targetClassName || !activeStudentSession) {
    return;
  }
  try {
    const payload = await api(`/api/classes/${encodeURIComponent(targetClassName)}/status`);
    const assignments = payload.assignments || [];
    const current = assignments.find((assignment) => assignment.id === assignmentId);
    const missing = assignments.filter((assignment) => !assignment.submitted);

    homeAssignmentStatus.textContent = current?.submitted ? "제출 완료" : "제출 전";
    homeAssignmentStatus.classList.toggle("is-complete", Boolean(current?.submitted));
    homeMissingAlert.querySelector("strong").textContent = missing.length
      ? `미제출 과제 ${missing.length}개가 있어`
      : "미제출 과제가 없어요";
    homeMissingAlert.querySelector("span").textContent = missing.length
      ? `${displayDateLabel(missing[0].dateLabel)} 과제부터 확인해 주세요.`
      : "지금까지 등록된 과제를 모두 제출했어요.";
    homeMissingAlert.classList.toggle("is-clear", missing.length === 0);
  } catch (error) {
    homeAssignmentStatus.textContent = "확인 필요";
    homeMissingAlert.querySelector("strong").textContent = "미제출 과제를 불러오지 못했어요";
    homeMissingAlert.querySelector("span").textContent = "과제 메뉴에서 다시 확인해 주세요.";
  }
}

function renderScoreTrend(tests = []) {
  const rows = tests
    .filter((test) => test.percent !== null && test.percent !== undefined)
    .slice()
    .reverse();
  studentScoreTrend.hidden = rows.length === 0;
  if (!rows.length) {
    studentScoreTrendChart.innerHTML = "";
    return;
  }

  const width = Math.max(620, rows.length * 88);
  const height = 230;
  const left = 42;
  const right = 32;
  const top = 26;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xAt = (index) => left + (rows.length === 1 ? plotWidth / 2 : (plotWidth * index) / (rows.length - 1));
  const yAt = (percent) => top + ((100 - Math.max(0, Math.min(100, percent))) / 100) * plotHeight;
  const points = rows.map((test, index) => `${xAt(index)},${yAt(test.percent)}`).join(" ");
  const classPoints = rows
    .map((test, index) => (
      test.classPercent === null || test.classPercent === undefined
        ? ""
        : `${xAt(index)},${yAt(test.classPercent)}`
    ))
    .filter(Boolean)
    .join(" ");
  const grid = [100, 80, 60, 40].map((value) => {
    const y = yAt(value);
    return `
      <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" />
      <text x="${left - 9}" y="${y + 4}" text-anchor="end">${value}</text>
    `;
  });
  const dots = rows.map((test, index) => {
    const x = xAt(index);
    const y = yAt(test.percent);
    return `
      <g>
        <circle cx="${x}" cy="${y}" r="5" />
        <text class="score-value" x="${x}" y="${Math.max(14, y - 11)}" text-anchor="middle">${escapeHtml(test.percent)}%</text>
        <text class="score-date" x="${x}" y="${height - 17}" text-anchor="middle">${escapeHtml(displayIsoDate(test.date))}</text>
      </g>
    `;
  });
  const classDots = rows.map((test, index) => {
    if (test.classPercent === null || test.classPercent === undefined) {
      return "";
    }
    return `<circle cx="${xAt(index)}" cy="${yAt(test.classPercent)}" r="4" />`;
  });

  studentScoreTrendChart.innerHTML = `
    <div class="score-chart-legend" aria-label="성적 그래프 범례">
      <span class="student"><i></i>내 점수</span>
      <span class="class-average"><i></i>반 평균</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" style="width:${width}px" role="img" aria-label="테스트 성적 변화 그래프">
      <g class="score-grid">${grid.join("")}</g>
      ${classPoints ? `<polyline class="score-class-line" points="${classPoints}" />` : ""}
      <polyline class="score-line" points="${points}" />
      <g class="score-class-dots">${classDots.join("")}</g>
      <g class="score-dots">${dots.join("")}</g>
    </svg>
  `;
  studentScoreTrendChart.scrollLeft = 0;
}

function renderStudentRecords(payload) {
  const homework = payload.homework || {};
  const attendance = payload.attendance || { counts: {}, rows: [] };
  const monthlyTests = payload.tests || { tests: [] };
  const cumulativeTests = payload.cumulativeTests || { tests: [] };
  const cumulativePastExams = payload.cumulativePastExams || { tests: [] };
  const cumulativeRelearning = payload.cumulativeRelearning || { rows: [] };
  const classComparison = payload.classComparison || { level: "unavailable", label: "비교할 기록이 아직 없어요" };
  studentRecordSummary.innerHTML = `
    <div class="comparison-summary comparison-${escapeHtml(classComparison.level)}">
      <span>반 평균과 비교</span>
      <strong class="comparison-label">${escapeHtml(classComparison.label)}</strong>
      <small>이번 달 테스트 결과</small>
    </div>
  `;

  renderScoreTrend(monthlyTests.tests || []);

  const learning = payload.learning || {};
  const topicRows = learning.topics || [];
  const weakTypes = learning.weakTypes || [];
  studentLearningAnalysis.hidden = topicRows.length === 0 && weakTypes.length === 0;
  studentLearningAnalysis.innerHTML = topicRows.length || weakTypes.length
    ? `
      <div class="student-analysis-heading">
        <div>
          <p class="eyebrow">이번 달 테스트 결과</p>
          <h3>단원별 성취도</h3>
        </div>
      </div>
      ${topicRows.length ? `
        <div class="topic-achievement-list">
          ${topicRows
            .map(
              (row) => `
              <div class="topic-achievement-row ${row.percent >= 80 ? "is-strong" : row.percent >= 60 ? "is-steady" : "is-focus"}">
                <div><strong>${escapeHtml(row.topic)}</strong><span>${escapeHtml(row.percent)}%</span></div>
                <div class="topic-achievement-track"><i style="width:${Math.max(0, Math.min(100, row.percent))}%"></i></div>
              </div>
            `,
            )
            .join("")}
        </div>
      ` : ""}
      ${weakTypes.length ? `
        <div class="weak-type-summary">
          <span>조금 더 연습할 유형</span>
          <p>${weakTypes.map((topic) => `<strong>${escapeHtml(topic)}</strong>`).join("")}</p>
        </div>
      ` : ""}
    `
    : "";

  studentAttendanceHistory.innerHTML = attendance.rows?.length
    ? attendance.rows
        .slice()
        .reverse()
        .map(
          (row) => `
            <div class="student-history-row">
              <strong>${escapeHtml(displayIsoDate(row.date))}</strong>
              <span class="record-status status-${escapeHtml(row.status)}">${escapeHtml(attendanceStatusLabel(row.status))}</span>
              <small>${escapeHtml(row.note || "")}</small>
            </div>
          `,
        )
        .join("")
    : `<p class="muted">이 달의 출결 기록이 아직 없습니다.</p>`;

  studentTestHistory.innerHTML = cumulativeTests.tests?.length
    ? cumulativeTests.tests
        .map(
          (test) => `
            <div class="student-history-row test-history-row">
              <div>
                <strong>${escapeHtml(test.name)}</strong>
                <small>${escapeHtml(displayIsoDate(test.date))}</small>
                ${(test.topics || []).length ? `<small class="test-topic-list">${test.topics.map(escapeHtml).join(" · ")}</small>` : ""}
              </div>
              <span>${test.absent ? "미응시" : `${escapeHtml(test.score)} / ${escapeHtml(test.maxScore)}`}</span>
              <em>${test.percent === null ? "-" : `${escapeHtml(test.percent)}%`}</em>
            </div>
          `,
        )
        .join("")
    : `<p class="muted">등록된 테스트 결과가 아직 없습니다.</p>`;

  studentPastExamHistory.innerHTML = cumulativePastExams.tests?.length
    ? cumulativePastExams.tests
        .map(
          (test) => `
            <div class="student-history-row test-history-row past-exam-history-row">
              <div>
                <strong>${escapeHtml(test.name)}</strong>
                <small>${escapeHtml(displayIsoDate(test.date))}</small>
                ${(test.topics || []).length ? `<small class="test-topic-list">${test.topics.map(escapeHtml).join(" · ")}</small>` : ""}
              </div>
              <span>${test.absent ? "미응시" : `${escapeHtml(test.score)} / ${escapeHtml(test.maxScore)}`}</span>
              <em>${test.percent === null ? "-" : `${escapeHtml(test.percent)}%`}</em>
            </div>
          `,
        )
        .join("")
    : `<p class="muted">등록된 기출 테스트 결과가 아직 없습니다.</p>`;

  studentRelearningHistory.innerHTML = cumulativeRelearning.rows?.length
    ? cumulativeRelearning.rows
        .map(
          (row) => `
            <div class="student-history-row test-history-row relearning-history-row">
              <div>
                <strong>${escapeHtml(row.name)}</strong>
                <small>${escapeHtml(displayIsoDate(row.date))}</small>
                ${(row.topics || []).length ? `<small class="test-topic-list">${row.topics.map(escapeHtml).join(" · ")}</small>` : ""}
              </div>
              <span>${row.completed ? `${escapeHtml(row.score)} / ${escapeHtml(row.maxScore)}` : "미완료"}</span>
              <em>${row.completed ? "완료" : "-"}</em>
            </div>
          `,
        )
        .join("")
    : `<p class="muted">등록된 보완학습 기록이 아직 없습니다.</p>`;

  renderStudentHomeSummary(payload);
}

async function loadStudentRecords(force = false) {
  const month = studentRecordMonth.value || localMonthValue();
  studentRecordMonth.value = month;
  updateMonthTriggers(month);
  if (!force && recordsLoadedForMonth === month) {
    return;
  }
  studentRecordsMessage.className = "message";
  studentRecordsMessage.textContent = "기록을 불러오는 중입니다.";
  const payload = await api(`/api/student/records?month=${encodeURIComponent(month)}`);
  renderStudentRecords(payload);
  recordsLoadedForMonth = month;
  studentRecordsMessage.textContent = "";
}

async function sessionOrNull() {
  const response = await fetch("/api/student/session", { headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function resolveTargetClassName() {
  if (targetClassName) {
    return targetClassName;
  }
  if (routeType === "student" && assignmentId) {
    const assignment = await api(`/api/assignments/${assignmentId}`);
    targetClassName = assignment.className;
  }
  return targetClassName;
}

function showStudentLogin() {
  studentAuthLoading.hidden = true;
  studentApp.hidden = true;
  studentLoginGate.hidden = false;
  loginClassName.textContent = targetClassName;
  loginStudentName.focus();
}

async function updateLoginSchoolName() {
  const studentName = loginStudentName.value.trim();
  loginSchoolName.hidden = true;
  loginSchoolName.textContent = "";
  if (!studentName || !targetClassName) {
    return;
  }
  try {
    const payload = await api("/api/student/school", {
      method: "POST",
      body: JSON.stringify({ className: targetClassName, studentName }),
    });
    if (studentName !== loginStudentName.value.trim() || !payload.schoolName) {
      return;
    }
    loginSchoolName.textContent = payload.schoolName;
    loginSchoolName.hidden = false;
  } catch {
    loginSchoolName.hidden = true;
  }
}

async function openStudentApp(session) {
  activeStudentSession = session;
  nameInput.value = session.studentName;
  nameInput.readOnly = true;
  nameInput.setAttribute("aria-readonly", "true");
  updatePasswordVisibility();
  loggedInStudentName.textContent = session.studentName;
  loggedInSchoolName.textContent = session.schoolName || "";
  loggedInSchoolName.hidden = !session.schoolName;
  loggedInClassName.textContent = session.className;
  studentGreetingName.textContent = session.studentName.length === 3
    ? session.studentName.slice(1)
    : session.studentName;
  studentAuthLoading.hidden = true;
  studentLoginGate.hidden = true;
  studentApp.hidden = false;
  setStudentMainView("home");
  await loadAssignment();
  await Promise.allSettled([loadStudentRecords(true), loadStudentHomeStatus()]);
}

loginStudentName.addEventListener("input", () => {
  window.clearTimeout(schoolLookupTimer);
  loginSchoolName.hidden = true;
  schoolLookupTimer = window.setTimeout(updateLoginSchoolName, 250);
});

loginStudentName.addEventListener("blur", updateLoginSchoolName);

async function bootstrapStudentApp() {
  studentRecordMonth.value = localMonthValue();
  updateMonthTriggers();
  await resolveTargetClassName();
  if (!targetClassName) {
    throw new Error("반 정보를 확인하지 못했습니다.");
  }
  const session = await sessionOrNull();
  if (!session || session.className !== targetClassName) {
    showStudentLogin();
    return;
  }
  await openStudentApp(session);
}

function itemLabel(item) {
  return item && item.label ? item.label : `${item}번`;
}

function renderProblemCells(items) {
  return items
    .map((item) => {
      const id = typeof item === "object" ? item.id : String(item);
      const number = typeof item === "object" ? item.number : item;
      return `
        <label class="check-cell">
          <input type="checkbox" value="${escapeHtml(id)}" />
          <span>${escapeHtml(number)}번</span>
        </label>
      `;
    })
    .join("");
}

function renderProblemsInto(assignment, targetGrid) {
  const items = Array.isArray(assignment.items) ? assignment.items : assignment.problems || [];
  const books = Array.isArray(assignment.books) && assignment.books.length > 0 ? assignment.books : null;

  if (!books || books.length === 1) {
    targetGrid.innerHTML = renderProblemCells(items);
    return;
  }

  targetGrid.innerHTML = books
    .map((bookRange) => {
      const rangeItems = items.filter((item) => item.book === bookRange.book && (bookRange.problems || []).includes(item.id));
      return `
        <section class="book-section">
          <h3>${escapeHtml(bookRange.book)} ${escapeHtml(bookRange.startNumber)}번부터 ${escapeHtml(bookRange.endNumber)}번까지</h3>
          <div class="check-grid">${renderProblemCells(rangeItems)}</div>
        </section>
      `;
    })
    .join("");
}

function renderProblems(assignment) {
  renderProblemsInto(assignment, grid);
}

function displayDateLabel(dateLabel) {
  return String(dateLabel || "").trim() || "오늘";
}

function assignmentOptionLabel(assignment, index) {
  const status = index === 0 ? "현재 과제" : "지난 과제";
  return `${status} · ${displayDateLabel(assignment.dateLabel)} · ${assignment.rangeLabel || assignment.title}`;
}

function pastAssignmentOptionLabel(assignment) {
  return `${displayDateLabel(assignment.dateLabel)} ${assignment.rangeLabel || assignment.title}`;
}

function submittedQuestionText(assignment) {
  const selected = Array.isArray(assignment.checkedProblems) ? assignment.checkedProblems : [];
  if (selected.length) {
    const labels = new Map((assignment.items || []).map((item) => [String(item.id), item.label]));
    return selected.map((problem) => labels.get(String(problem)) || `${problem}번`).join(", ");
  }
  return assignment.noQuestionsConfirmed ? "질문할 문제 없음으로 제출" : "질문 선택 확인 기록 없음";
}

function renderStudentMissingAssignments(assignments) {
  const missing = assignments.filter((assignment) => !assignment.submitted && assignment.id !== assignmentId);
  const submitted = assignments.filter((assignment) => assignment.submitted);
  studentMissingResult.hidden = false;

  studentMissingResult.innerHTML = `
    ${
      missing.length
        ? `
          <div class="student-missing-title">
            <strong>미제출 지난 과제 ${missing.length}건</strong>
            <span>완료한 과제는 사진을 첨부해 제출해 주세요.</span>
          </div>
          <div class="student-missing-items">
            ${missing
              .map(
                (assignment) => `
                  <div class="student-missing-item">
                    <div>
                      <strong>${escapeHtml(displayDateLabel(assignment.dateLabel))} 과제</strong>
                      <span>${escapeHtml(assignment.rangeLabel || assignment.title)}</span>
                    </div>
                    <button class="open-missing-assignment" type="button" data-id="${escapeHtml(assignment.id)}">지금 제출하기</button>
                  </div>
                `,
              )
              .join("")}
          </div>
        `
        : `
          <div class="student-missing-clear">
            <strong>미제출 과제 확인 완료</strong>
            <span>미제출로 남아 있는 지난 과제가 없어요.</span>
          </div>
        `
    }
    <section class="student-question-history">
      <div class="student-missing-title">
        <strong>내가 체크한 질문</strong>
        <span>제출한 과제별 질문 번호를 확인할 수 있어요.</span>
      </div>
      ${
        submitted.length
          ? `
            <div class="student-question-items">
              ${submitted
                .map(
                  (assignment) => `
                    <div class="student-question-item">
                      <strong>${escapeHtml(displayDateLabel(assignment.dateLabel))} 과제</strong>
                      <span>${escapeHtml(submittedQuestionText(assignment))}</span>
                    </div>
                  `,
                )
                .join("")}
              </div>
          `
          : `<p class="muted">아직 제출한 과제가 없어요.</p>`
      }
    </section>
  `;

  studentMissingResult.querySelectorAll(".open-missing-assignment").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = availableAssignments.find((assignment) => assignment.id === button.dataset.id);
      if (!selected) {
        return;
      }
      setSubmissionMode("past");
      pastAssignmentSelect.value = selected.id;
      renderPastProblems(selected);
      pastMessage.textContent = "";
      pastMessage.className = "message";
      pastAssignmentWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadStudentMissingStatus() {
  const studentName = nameInput.value.trim();
  if (!studentName) {
    studentMissingResult.hidden = false;
    studentMissingResult.innerHTML = `<p class="message error">이름을 먼저 입력해 주세요.</p>`;
    nameInput.focus();
    return;
  }

  checkMissingBtn.disabled = true;
  checkMissingBtn.textContent = "확인 중";
  try {
    const payload = await api(`/api/classes/${encodeURIComponent(routeValue)}/status`, {
      method: "POST",
      body: JSON.stringify({
        studentName,
        studentPassword: passwordInput.value,
      }),
    });
    renderStudentMissingAssignments(payload.assignments || []);
  } catch (error) {
    revealPasswordForError(error);
    studentMissingResult.hidden = false;
    studentMissingResult.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`;
  } finally {
    checkMissingBtn.disabled = false;
    checkMissingBtn.textContent = "확인하기";
  }
}

function setSubmissionMode(mode) {
  if (mode === "past" && routeType !== "class") {
    return;
  }

  activeSubmissionMode = mode;
  const showCurrent = mode === "current";
  currentSubmissionPanel.hidden = !showCurrent;
  pastAssignmentWrap.hidden = showCurrent;
  currentSubmissionTab.classList.toggle("is-active", showCurrent);
  pastSubmissionTab.classList.toggle("is-active", !showCurrent);
  currentSubmissionTab.setAttribute("aria-selected", String(showCurrent));
  pastSubmissionTab.setAttribute("aria-selected", String(!showCurrent));
}

function fileKey(file) {
  return [file.name, file.size, file.lastModified].join(":");
}

function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

function renderSelectedPhotos(files, list) {
  list.innerHTML = files.length
    ? files.map((file) => `<span>${file.name}</span>`).join("")
    : "";
}

function addSelectedPhotos(input, selectedFiles, list) {
  const existingKeys = new Set(selectedFiles.map(fileKey));
  const incomingFiles = [...input.files].filter(isImageFile);

  for (const file of incomingFiles) {
    const key = fileKey(file);
    if (!existingKeys.has(key)) {
      selectedFiles.push(file);
      existingKeys.add(key);
    }
  }

  input.value = "";
  renderSelectedPhotos(selectedFiles, list);
}

async function selectedPhotosPayload(files) {
  const selectedFiles = files.filter(isImageFile);
  return selectedFiles.map((file) => ({
    name: file.name,
    mimeType: file.type.startsWith("image/") ? file.type : "image/jpeg",
  }));
}

function showAssignment(assignment) {
  const assignmentTitle = `${displayDateLabel(assignment.dateLabel)} 과제 클리어`;
  const assignmentRange = assignment.rangeLabel || `${assignment.book} ${assignment.problems[0]}번부터 ${assignment.problems.at(-1)}번까지`;
  assignmentId = assignment.id;
  document.title = assignment.title;
  document.body.dataset.theme = assignment.theme || "focus";
  classNameEl.textContent = `${displayDateLabel(assignment.dateLabel)} 과제`;
  title.textContent = assignmentTitle;
  rangeText.textContent = assignmentRange;
  detail.textContent = "질문하고 싶은 문제들을 체크하고, 과제 사진은 첨부해 주세요.";
  assignmentViewTitle.textContent = assignmentTitle;
  assignmentViewRange.textContent = assignmentRange;
  renderProblems(assignment);
  noQuestionInput.checked = false;
  updateCount();
}

function renderPastAssignmentSelector(assignments) {
  availableAssignments = assignments;
  if (routeType !== "class") {
    submissionTabs.hidden = true;
    pastAssignmentWrap.hidden = true;
    studentMissingCheck.hidden = true;
    studentMissingResult.hidden = true;
    return;
  }

  submissionTabs.hidden = false;
  const pastAssignments = assignments.slice(1);
  if (!pastAssignments.length) {
    pastAssignmentSelect.disabled = true;
    pastSubmitBtn.disabled = true;
    pastAssignmentSelect.innerHTML = '<option value="">지난 과제가 쌓이면 여기서 선택할 수 있어요.</option>';
    pastProblemWrap.hidden = true;
    pastProblemGrid.innerHTML = "";
    updatePastCount();
    setSubmissionMode(activeSubmissionMode);
    return;
  }

  pastAssignmentSelect.disabled = false;
  pastSubmitBtn.disabled = false;
  pastAssignmentSelect.innerHTML = pastAssignments
    .map((assignment) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(pastAssignmentOptionLabel(assignment))}</option>`)
    .join("");
  renderPastProblems(pastAssignments[0]);
  setSubmissionMode(activeSubmissionMode);
}

function renderPastProblems(assignment) {
  if (!assignment) {
    pastProblemWrap.hidden = true;
    pastProblemGrid.innerHTML = "";
    pastNoQuestionInput.checked = false;
    updatePastCount();
    return;
  }

  pastProblemWrap.hidden = false;
  renderProblemsInto(assignment, pastProblemGrid);
  pastNoQuestionInput.checked = false;
  updatePastCount();
}

async function loadAssignment() {
  if (routeType === "class") {
    const payload = await api(`/api/classes/${encodeURIComponent(routeValue)}/assignments`);
    if (!payload.assignments.length) {
      throw new Error("이 반에 등록된 과제가 아직 없습니다.");
    }
    passwordRequiredStudents = new Set(payload.passwordRequiredStudents || []);
    updatePasswordVisibility();
    renderPastAssignmentSelector(payload.assignments);
    showAssignment(payload.assignments[0]);
    loadClassVideos(payload.assignments[0].className);
    return;
  }

  pastAssignmentWrap.hidden = true;
  submissionTabs.hidden = true;
  const assignment = await api(`/api/assignments/${assignmentId}`);
  passwordRequiredStudents = new Set(assignment.passwordRequiredStudents || []);
  updatePasswordVisibility();
  showAssignment(assignment);
  loadClassVideos(assignment.className);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "message";
  const studentName = nameInput.value.trim();
  const problems = [...grid.querySelectorAll("input:checked")].map((input) => input.value);
  const noQuestionsConfirmed = noQuestionInput.checked;

  if (!studentName) {
    message.className = "message error";
    message.textContent = "이름을 먼저 입력해 주세요.";
    nameInput.focus();
    return;
  }

  const files = await selectedPhotosPayload(currentPhotoFiles);
  if (!files.length) {
    message.className = "message error";
    message.textContent = "과제 사진을 한 장 이상 첨부해 주세요.";
    return;
  }

  if (
    noQuestionsConfirmed &&
    !window.confirm("정말로 질문 없이 제출하시겠습니까?\n질문할 문제가 있다면 취소하고 문제 번호를 선택해 주세요.")
  ) {
    message.className = "message";
    message.textContent = "문제 번호를 다시 확인해 주세요.";
    return;
  }

  if (
    !problems.length &&
    !noQuestionsConfirmed &&
    !window.confirm("질문할 문제를 아직 체크하지 않았습니다.\n이대로 과제를 제출하시겠습니까?")
  ) {
    message.className = "message error";
    message.textContent = "질문할 문제를 체크하거나, 질문이 없다면 '질문할 문제 없음'을 체크해 주세요.";
    return;
  }

  message.textContent = "제출 중입니다.";
  submitButton.disabled = true;

  try {
    await api(`/api/assignments/${assignmentId}/responses`, {
      method: "POST",
      body: JSON.stringify({
        studentName,
        studentPassword: passwordInput.value,
        problems,
        noQuestionsConfirmed,
        files,
      }),
    });
    currentPhotoFiles = [];
    photoInput.value = "";
    photoCameraInput.value = "";
    renderSelectedPhotos(currentPhotoFiles, photoList);
    message.className = "message success";
    message.innerHTML = "<strong>제출 완료되었습니다.</strong><span>같은 이름으로 다시 제출하면 체크 내용과 사진 첨부 여부가 수정됩니다.</span>";
    recordsLoadedForMonth = "";
    await Promise.allSettled([loadStudentRecords(true), loadStudentHomeStatus()]);
  } catch (error) {
    revealPasswordForError(error);
    message.className = "message error";
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

async function submitPastAssignment() {
  pastMessage.className = "message";
  pastMessage.textContent = "";

  const studentName = nameInput.value.trim();
  const selectedAssignmentId = pastAssignmentSelect.value;
  const files = await selectedPhotosPayload(pastPhotoFiles);
  const problems = [...pastProblemGrid.querySelectorAll("input:checked")].map((input) => input.value);
  const noQuestionsConfirmed = pastNoQuestionInput.checked;

  if (!studentName) {
    pastMessage.className = "message error";
    pastMessage.textContent = "이름을 먼저 입력해 주세요.";
    nameInput.focus();
    return;
  }

  if (!selectedAssignmentId) {
    pastMessage.className = "message error";
    pastMessage.textContent = "제출할 지난 과제를 선택해 주세요.";
    return;
  }

  if (!files.length && !problems.length) {
    pastMessage.className = "message error";
    pastMessage.textContent = "질문할 문제를 선택하거나 지난과제 사진을 첨부해 주세요.";
    return;
  }

  if (
    !problems.length &&
    !noQuestionsConfirmed &&
    !window.confirm("질문할 문제를 아직 체크하지 않았습니다.\n이대로 지난과제를 제출하시겠습니까?")
  ) {
    pastMessage.className = "message error";
    pastMessage.textContent = "질문할 문제를 체크하거나, 질문이 없다면 '질문할 문제 없음'을 체크해 주세요.";
    return;
  }

  if (
    noQuestionsConfirmed &&
    !window.confirm("정말로 질문 없이 제출하시겠습니까?\n질문할 문제가 있다면 취소하고 문제 번호를 선택해 주세요.")
  ) {
    pastMessage.className = "message";
    pastMessage.textContent = "문제 번호를 다시 확인해 주세요.";
    return;
  }

  const selected = availableAssignments.find((assignment) => assignment.id === selectedAssignmentId);
  pastSubmitBtn.disabled = true;
  pastMessage.textContent = "지난과제 제출 중입니다.";

  try {
    await api(`/api/assignments/${selectedAssignmentId}/responses`, {
      method: "POST",
      body: JSON.stringify({
        studentName,
        studentPassword: passwordInput.value,
        files,
        problems,
        noQuestionsConfirmed,
      }),
    });
    pastPhotoFiles = [];
    pastPhotoInput.value = "";
    pastPhotoCameraInput.value = "";
    renderSelectedPhotos(pastPhotoFiles, pastPhotoList);
    pastMessage.className = "message success";
    pastMessage.innerHTML = `<strong>지난과제 제출 완료되었습니다.</strong><span>${escapeHtml(selected?.dateLabel || "선택한 날짜")} 과제 제출로 기록되었습니다.</span>`;
    recordsLoadedForMonth = "";
    await Promise.allSettled([loadStudentMissingStatus(), loadStudentRecords(true), loadStudentHomeStatus()]);
  } finally {
    pastSubmitBtn.disabled = !pastAssignmentSelect.value;
  }
}

photoInput.addEventListener("change", () => addSelectedPhotos(photoInput, currentPhotoFiles, photoList));
photoCameraInput.addEventListener("change", () => addSelectedPhotos(photoCameraInput, currentPhotoFiles, photoList));
pastPhotoInput.addEventListener("change", () => addSelectedPhotos(pastPhotoInput, pastPhotoFiles, pastPhotoList));
pastPhotoCameraInput.addEventListener("change", () => addSelectedPhotos(pastPhotoCameraInput, pastPhotoFiles, pastPhotoList));
currentSubmissionTab.addEventListener("click", () => setSubmissionMode("current"));
pastSubmissionTab.addEventListener("click", () => setSubmissionMode("past"));
grid.addEventListener("change", (event) => {
  if (event.target.matches('input[type="checkbox"]') && event.target.checked) {
    noQuestionInput.checked = false;
  }
  updateCount();
});
pastProblemGrid.addEventListener("change", (event) => {
  if (event.target.matches('input[type="checkbox"]') && event.target.checked) {
    pastNoQuestionInput.checked = false;
  }
  updatePastCount();
});
noQuestionInput.addEventListener("change", () => {
  if (noQuestionInput.checked) {
    clearProblemChecks(grid);
  }
  updateCount();
});
pastNoQuestionInput.addEventListener("change", () => {
  if (pastNoQuestionInput.checked) {
    clearProblemChecks(pastProblemGrid);
  }
  updatePastCount();
});
pastAssignmentSelect.addEventListener("change", () => {
  pastMessage.textContent = "";
  pastMessage.className = "message";
  const selected = availableAssignments.find((assignment) => assignment.id === pastAssignmentSelect.value);
  renderPastProblems(selected);
});
pastSubmitBtn.addEventListener("click", () => {
  submitPastAssignment().catch((error) => {
    revealPasswordForError(error);
    pastSubmitBtn.disabled = !pastAssignmentSelect.value;
    pastMessage.className = "message error";
    pastMessage.textContent = error.message;
  });
});
checkMissingBtn.addEventListener("click", loadStudentMissingStatus);
nameInput.addEventListener("input", () => {
  updatePasswordVisibility();
  studentMissingResult.hidden = true;
  studentMissingResult.innerHTML = "";
});

function openAssignmentView(mode = "current") {
  setStudentMainView("assignment");
  setSubmissionMode(mode);
  document.querySelector("#studentAssignmentView").scrollIntoView({ behavior: "smooth", block: "start" });
}

homeStartAssignmentButton.addEventListener("click", () => openAssignmentView("current"));
homeQuestionButton.addEventListener("click", () => openAssignmentView("current"));
homePastAssignmentButton.addEventListener("click", () => openAssignmentView("past"));
homeMissingAlert.addEventListener("click", () => {
  if (homeMissingAlert.classList.contains("is-clear")) {
    setStudentMainView("records");
    return;
  }
  openAssignmentView("past");
  loadStudentMissingStatus();
});
homeVideoAlert.addEventListener("click", () => setStudentMainView("videos"));
classVideosMonthButton.addEventListener("click", () => {
  classVideoScope = "month";
  renderClassVideos();
});
classVideosToggle.addEventListener("click", () => {
  classVideoScope = "all";
  renderClassVideos();
});
homeViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.homeView;
    if (view === "assignment") {
      openAssignmentView("current");
      return;
    }
    setStudentMainView(view);
    if (view === "records" && button.dataset.recordSection) {
      setStudentRecordSection(button.dataset.recordSection);
    }
  });
});

studentMainTabs.forEach((button) => {
  button.addEventListener("click", () => setStudentMainView(button.dataset.view));
});

studentRecordTabs.forEach((button) => {
  button.addEventListener("click", () => setStudentRecordSection(button.dataset.recordSection));
});

studentDashboardMonth.addEventListener("click", openStudentMonthPicker);
studentGraphMonthButton.addEventListener("click", openStudentMonthPicker);

studentRecordMonth.addEventListener("change", () => {
  updateMonthTriggers();
  recordsLoadedForMonth = "";
  loadStudentRecords(true).catch((error) => {
    studentRecordsMessage.className = "message error";
    studentRecordsMessage.textContent = error.message;
  });
});

studentLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = studentLoginForm.querySelector('button[type="submit"]');
  studentLoginMessage.className = "message";
  studentLoginMessage.textContent = "로그인 중입니다.";
  button.disabled = true;
  try {
    const session = await api("/api/student/login", {
      method: "POST",
      body: JSON.stringify({
        className: targetClassName,
        studentName: loginStudentName.value.trim(),
        password: loginStudentPassword.value,
      }),
    });
    loginStudentPassword.value = "";
    await openStudentApp(session);
  } catch (error) {
    studentLoginMessage.className = "message error";
    studentLoginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

studentLogoutButton.addEventListener("click", async () => {
  studentLogoutButton.disabled = true;
  try {
    await api("/api/student/logout", { method: "POST", body: "{}" });
  } finally {
    location.reload();
  }
});

bootstrapStudentApp().catch((error) => {
  studentAuthLoading.hidden = false;
  studentLoginGate.hidden = true;
  studentApp.hidden = true;
  studentAuthLoading.querySelector("strong").textContent = error.message;
  classNameEl.textContent = "확인 필요";
  title.textContent = "과제를 불러오지 못했습니다.";
  rangeText.textContent = "";
  detail.textContent = error.message;
});
