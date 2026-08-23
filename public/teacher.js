const form = document.querySelector("#assignmentForm");
const list = document.querySelector("#assignmentList");
const classList = document.querySelector("#classList");
const countBadge = document.querySelector("#assignmentCount");
const classCountBadge = document.querySelector("#classCount");
const refreshButton = document.querySelector("#refreshButton");
const template = document.querySelector("#assignmentTemplate");
const classOptions = document.querySelector("#classOptions");
const teacherClassTabs = document.querySelector("#teacherClassTabs");
const currentAssignmentTab = document.querySelector("#currentAssignmentTab");
const pastAssignmentsTab = document.querySelector("#pastAssignmentsTab");
const cumulativeMissingTab = document.querySelector("#cumulativeMissingTab");
const selectedClassTitle = document.querySelector("#selectedClassTitle");
const selectedClassContext = document.querySelector("#selectedClassContext");
const selectedClassSummary = document.querySelector("#selectedClassSummary");
const todayClassLabel = document.querySelector("#todayClassLabel");
const studentPasswordSettings = document.querySelector("#studentPasswordSettings");
const passwordClassLabel = document.querySelector("#passwordClassLabel");
const studentPasswordList = document.querySelector("#studentPasswordList");
const studentPasswordMessage = document.querySelector("#studentPasswordMessage");
const teacherMainTabs = [...document.querySelectorAll(".teacher-main-tab")];
const assignmentManagementModule = document.querySelector("#assignmentManagementModule");
const attendanceManagementModule = document.querySelector("#attendanceManagementModule");
const testManagementModule = document.querySelector("#testManagementModule");
const monthlyManagementModule = document.querySelector("#monthlyManagementModule");
const attendanceMonth = document.querySelector("#attendanceMonth");
const attendanceSummary = document.querySelector("#attendanceSummary");
const attendanceDateTabs = document.querySelector("#attendanceDateTabs");
const attendanceEditor = document.querySelector("#attendanceEditor");
const attendanceDateLabel = document.querySelector("#attendanceDateLabel");
const attendanceNoClass = document.querySelector("#attendanceNoClass");
const attendanceStudentList = document.querySelector("#attendanceStudentList");
const attendanceNote = document.querySelector("#attendanceNote");
const saveAttendanceButton = document.querySelector("#saveAttendanceButton");
const attendanceMessage = document.querySelector("#attendanceMessage");
const createTestForm = document.querySelector("#createTestForm");
const teacherTestList = document.querySelector("#teacherTestList");
const testScoreEditor = document.querySelector("#testScoreEditor");
const selectedTestDate = document.querySelector("#selectedTestDate");
const selectedTestTitle = document.querySelector("#selectedTestTitle");
const selectedTestKind = document.querySelector("#selectedTestKind");
const selectedTestTopics = document.querySelector("#selectedTestTopics");
const testScoreRows = document.querySelector("#testScoreRows");
const saveTestScoresButton = document.querySelector("#saveTestScoresButton");
const deleteTestButton = document.querySelector("#deleteTestButton");
const testMessage = document.querySelector("#testMessage");
const testCumulativeTable = document.querySelector("#testCumulativeTable");
const monthlyReportMonth = document.querySelector("#monthlyReportMonth");
const monthlyStudentList = document.querySelector("#monthlyStudentList");
const monthlyReportPreview = document.querySelector("#monthlyReportPreview");
const monthlyReportMessage = document.querySelector("#monthlyReportMessage");
const defaultClasses = [];
const fixedClassOrder = ["고1 1티어D3", "고1 제니트Z2", "고1 SKYA3"];
let latestAssignments = [];
let selectedClassName = "";
let assignmentViewMode = "current";
let selectedPastAssignmentId = "";
let teacherModule = "assignments";
let teacherClasses = [];
let attendanceData = null;
let selectedAttendanceDate = "";
let teacherTests = [];
let testStudents = [];
let selectedTestId = "";
let monthlyData = null;

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

function studentUrl(id) {
  return `${location.origin}/student/${id}`;
}

function classUrl(className) {
  return `${location.origin}/class/${encodeURIComponent(className)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function saveStudentPassword(studentName, password, enabled) {
  return api(`/api/classes/${encodeURIComponent(selectedClassName)}/passwords`, {
    method: "POST",
    body: JSON.stringify({ studentName, password, enabled }),
  });
}

function bindStudentPasswordActions() {
  studentPasswordList.querySelectorAll(".set-student-password").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest(".student-password-row");
      const input = row.querySelector('input[type="password"]');
      const password = input.value.trim();
      studentPasswordMessage.className = "message";
      studentPasswordMessage.textContent = "";
      if (!/^\d{4}$/.test(password)) {
        studentPasswordMessage.className = "message error";
        studentPasswordMessage.textContent = "비밀번호는 숫자 4자리로 입력해 주세요.";
        input.focus();
        return;
      }

      button.disabled = true;
      try {
        await saveStudentPassword(button.dataset.student, password, true);
        studentPasswordMessage.className = "message success";
        studentPasswordMessage.textContent = `${button.dataset.student} 학생 비밀번호를 설정했습니다.`;
        await loadStudentPasswordSettings();
      } catch (error) {
        studentPasswordMessage.className = "message error";
        studentPasswordMessage.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });

  studentPasswordList.querySelectorAll(".remove-student-password").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await saveStudentPassword(button.dataset.student, "", false);
        studentPasswordMessage.className = "message success";
        studentPasswordMessage.textContent = `${button.dataset.student} 학생 비밀번호를 해제했습니다.`;
        await loadStudentPasswordSettings();
      } catch (error) {
        studentPasswordMessage.className = "message error";
        studentPasswordMessage.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadStudentPasswordSettings() {
  if (!selectedClassName) {
    return;
  }
  const requestedClass = selectedClassName;
  passwordClassLabel.textContent = shortClassName(requestedClass);
  studentPasswordList.innerHTML = `<p class="muted">학생 명단을 불러오는 중입니다.</p>`;

  try {
    const payload = await api(`/api/classes/${encodeURIComponent(requestedClass)}/passwords`);
    if (requestedClass !== selectedClassName) {
      return;
    }
    studentPasswordList.innerHTML = payload.students.length
      ? payload.students
          .map(
            (student) => `
              <div class="student-password-row">
                <div class="student-password-name">
                  <strong>${escapeHtml(student.name)}</strong>
                  <span class="badge ${student.passwordEnabled ? "is-enabled" : ""}">
                    ${student.passwordEnabled ? "설정됨" : "미설정"}
                  </span>
                </div>
                <input
                  type="password"
                  inputmode="numeric"
                  pattern="[0-9]{4}"
                  maxlength="4"
                  autocomplete="new-password"
                  aria-label="${escapeHtml(student.name)} 새 비밀번호"
                  placeholder="새 4자리"
                />
                <button class="set-student-password" type="button" data-student="${escapeHtml(student.name)}">
                  ${student.passwordEnabled ? "재설정" : "설정"}
                </button>
                <button
                  class="remove-student-password ghost"
                  type="button"
                  data-student="${escapeHtml(student.name)}"
                  ${student.passwordEnabled ? "" : "disabled"}
                >해제</button>
              </div>
            `,
          )
          .join("")
      : `<p class="muted">이 반에 등록된 학생이 없습니다.</p>`;
    bindStudentPasswordActions();
  } catch (error) {
    studentPasswordList.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`;
  }
}

function rangeLabel(assignment) {
  if (assignment.rangeLabel) {
    return assignment.rangeLabel;
  }
  return `${assignment.book} · ${assignment.problems[0]}번부터 ${assignment.problems.at(-1)}번까지`;
}

function itemMap(assignment) {
  return Object.fromEntries((assignment.items || []).map((item) => [String(item.id), item]));
}

function problemLabel(assignment, problem) {
  const item = itemMap(assignment)[String(problem)];
  return item ? item.label : `${problem}번`;
}

function formatDateTime(value) {
  if (!value) {
    return "시간 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "시간 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function classOrderIndex(className) {
  const index = fixedClassOrder.indexOf(className || "공통");
  return index === -1 ? fixedClassOrder.length : index;
}

function compareByClassOrder(a, b) {
  const classA = typeof a === "string" ? a : a.className || "공통";
  const classB = typeof b === "string" ? b : b.className || "공통";
  const orderDiff = classOrderIndex(classA) - classOrderIndex(classB);
  if (orderDiff !== 0) {
    return orderDiff;
  }
  return classA.localeCompare(classB, "ko");
}

function classForDay(day = new Date().getDay()) {
  if (day === 2 || day === 4) {
    return "고1 제니트Z2";
  }
  if (day === 3 || day === 6) {
    return "고1 SKYA3";
  }
  return "고1 1티어D3";
}

function shortClassName(className) {
  return String(className || "공통").replace(/^고1\s*/, "");
}

function todayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function localIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMonth() {
  return localIsoDate().slice(0, 7);
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
  return value === null || value === undefined ? "-" : `${value}%`;
}

async function loadActiveTeacherModule() {
  if (!selectedClassName) {
    return;
  }
  if (teacherModule === "attendance") {
    await loadAttendance();
  } else if (teacherModule === "tests") {
    await loadTests();
  } else if (teacherModule === "monthly") {
    await loadMonthlyReport();
  }
}

function setTeacherModule(module) {
  teacherModule = module;
  assignmentManagementModule.hidden = module !== "assignments";
  attendanceManagementModule.hidden = module !== "attendance";
  testManagementModule.hidden = module !== "tests";
  monthlyManagementModule.hidden = module !== "monthly";
  teacherMainTabs.forEach((button) => {
    const active = button.dataset.module === module;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (module === "assignments") {
    renderFocusedDashboard();
    return;
  }
  loadActiveTeacherModule().catch((error) => {
    const target = module === "attendance" ? attendanceMessage : module === "tests" ? testMessage : monthlyReportMessage;
    target.className = "message error";
    target.textContent = error.message;
  });
}

function attendanceDateSummary(row) {
  if (row.noClass) {
    return "휴강";
  }
  if (row.future) {
    return "예정";
  }
  const statuses = Object.values(row.statuses || {});
  const exceptions = statuses.filter((status) => status !== "present").length;
  return exceptions ? `특이 ${exceptions}명` : "전원 출석";
}

function renderAttendanceEditor() {
  const row = attendanceData?.dates.find((item) => item.date === selectedAttendanceDate);
  if (!row) {
    attendanceEditor.hidden = true;
    return;
  }
  attendanceEditor.hidden = false;
  attendanceDateLabel.textContent = `${displayIsoDate(row.date)} 수업`;
  attendanceNoClass.checked = row.noClass;
  attendanceNote.value = row.note || "";
  attendanceStudentList.innerHTML = Object.entries(row.statuses || {})
    .map(
      ([student, status]) => `
        <div class="attendance-student-row">
          <strong>${escapeHtml(student)}</strong>
          <select data-student="${escapeHtml(student)}" ${row.noClass ? "disabled" : ""} aria-label="${escapeHtml(student)} 출결">
            ${["present", "late", "absent", "early", "makeup"]
              .map((value) => `<option value="${value}" ${value === status ? "selected" : ""}>${attendanceStatusLabel(value)}</option>`)
              .join("")}
          </select>
        </div>
      `,
    )
    .join("");
}

function renderAttendance() {
  const pastRows = (attendanceData?.dates || []).filter((row) => !row.future && !row.noClass);
  const allStatuses = pastRows.flatMap((row) => Object.values(row.statuses || {}));
  attendanceSummary.innerHTML = `
    <div><span>수업</span><strong>${pastRows.length}회</strong></div>
    <div><span>결석</span><strong>${allStatuses.filter((status) => status === "absent").length}건</strong></div>
    <div><span>지각</span><strong>${allStatuses.filter((status) => status === "late").length}건</strong></div>
    <div><span>조퇴</span><strong>${allStatuses.filter((status) => status === "early").length}건</strong></div>
  `;
  attendanceDateTabs.innerHTML = attendanceData?.dates?.length
    ? attendanceData.dates
        .map(
          (row) => `
            <button type="button" class="attendance-date-tab ${row.date === selectedAttendanceDate ? "is-active" : ""} ${row.future ? "is-future" : ""}" data-date="${row.date}">
              <strong>${escapeHtml(displayIsoDate(row.date))}</strong>
              <span>${escapeHtml(attendanceDateSummary(row))}</span>
            </button>
          `,
        )
        .join("")
    : `<p class="muted">이 반의 수업 요일이 아직 설정되지 않았습니다.</p>`;
  attendanceDateTabs.querySelectorAll(".attendance-date-tab").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAttendanceDate = button.dataset.date;
      renderAttendance();
      renderAttendanceEditor();
    });
  });
  renderAttendanceEditor();
}

async function loadAttendance() {
  const month = attendanceMonth.value || localMonth();
  attendanceMonth.value = month;
  attendanceMessage.textContent = "";
  attendanceData = await api(`/api/classes/${encodeURIComponent(selectedClassName)}/attendance?month=${encodeURIComponent(month)}`);
  const preferredDate = attendanceData.dates.find((row) => row.date === localIsoDate())?.date;
  if (!attendanceData.dates.some((row) => row.date === selectedAttendanceDate)) {
    selectedAttendanceDate = preferredDate || attendanceData.dates.filter((row) => !row.future).at(-1)?.date || attendanceData.dates[0]?.date || "";
  }
  renderAttendance();
}

async function saveAttendance() {
  if (!selectedAttendanceDate) {
    return;
  }
  const statuses = Object.fromEntries(
    [...attendanceStudentList.querySelectorAll("select[data-student]")].map((select) => [select.dataset.student, select.value]),
  );
  saveAttendanceButton.disabled = true;
  attendanceMessage.className = "message";
  attendanceMessage.textContent = "저장 중입니다.";
  try {
    await api(`/api/classes/${encodeURIComponent(selectedClassName)}/attendance`, {
      method: "POST",
      body: JSON.stringify({
        date: selectedAttendanceDate,
        noClass: attendanceNoClass.checked,
        note: attendanceNote.value,
        statuses,
      }),
    });
    attendanceMessage.className = "message success";
    attendanceMessage.textContent = "출결을 저장했습니다.";
    await loadAttendance();
  } finally {
    saveAttendanceButton.disabled = false;
  }
}

function selectedTest() {
  return teacherTests.find((test) => test.id === selectedTestId);
}

function renderTestCumulative() {
  testCumulativeTable.innerHTML = testStudents.length
    ? `
      <div class="test-cumulative-row is-head"><span>학생</span><span>테스트</span><span>평균</span><span>최근</span><span>보완학습</span></div>
      ${testStudents
        .map((student) => {
          const results = teacherTests
            .filter((test) => test.kind !== "relearning")
            .map((test) => ({ test, result: test.scores?.[student] }))
            .filter(({ result }) => result && result.score !== null && result.score !== undefined);
          const relearning = teacherTests
            .filter((test) => test.kind === "relearning")
            .map((test) => ({ test, result: test.scores?.[student] }))
            .filter(({ result }) => result && (result.score !== null && result.score !== undefined || result.absent));
          const relearningCompleted = relearning.filter(
            ({ result }) => result.score !== null && result.score !== undefined,
          ).length;
          const percentages = results.map(({ test, result }) => (Number(result.score) / test.maxScore) * 100);
          const average = percentages.length
            ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10
            : null;
          const latest = results[0];
          return `
            <div class="test-cumulative-row">
              <strong>${escapeHtml(student)}</strong>
              <span>${results.length}회</span>
              <span>${percentText(average)}</span>
              <span>${latest ? `${escapeHtml(latest.result.score)}/${escapeHtml(latest.test.maxScore)}` : "-"}</span>
              <span>${relearningCompleted}/${relearning.length}회</span>
            </div>
          `;
        })
        .join("")}
    `
    : `<p class="muted">학생 명단이 없습니다.</p>`;
}

function renderTestEditor() {
  const test = selectedTest();
  if (!test) {
    testScoreEditor.hidden = true;
    return;
  }
  testScoreEditor.hidden = false;
  selectedTestDate.textContent = `${displayIsoDate(test.date)} · ${test.maxScore}점 만점`;
  selectedTestTitle.textContent = test.name;
  selectedTestKind.value = test.kind === "relearning" ? "relearning" : "test";
  selectedTestTopics.value = (test.topics || []).join(", ");
  testScoreRows.innerHTML = testStudents
    .map((student) => {
      const result = test.scores?.[student] || { score: null, absent: false, note: "" };
      return `
        <div class="test-score-row">
          <strong>${escapeHtml(student)}</strong>
          <label>
            점수
            <input class="student-test-score" data-student="${escapeHtml(student)}" type="number" min="0" max="${escapeHtml(test.maxScore)}" value="${result.score ?? ""}" ${result.absent ? "disabled" : ""} />
          </label>
          <label class="test-absent-check">
            <input class="student-test-absent" data-student="${escapeHtml(student)}" type="checkbox" ${result.absent ? "checked" : ""} />
            미응시
          </label>
          <label>
            메모
            <input class="student-test-note" data-student="${escapeHtml(student)}" value="${escapeHtml(result.note || "")}" placeholder="선택" />
          </label>
        </div>
      `;
    })
    .join("");
  testScoreRows.querySelectorAll(".student-test-absent").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const scoreInput = testScoreRows.querySelector(`.student-test-score[data-student="${CSS.escape(checkbox.dataset.student)}"]`);
      scoreInput.disabled = checkbox.checked;
      if (checkbox.checked) {
        scoreInput.value = "";
      }
    });
  });
}

function renderTests() {
  teacherTestList.innerHTML = teacherTests.length
    ? teacherTests
        .map(
          (test) => `
            <button class="teacher-test-item ${test.id === selectedTestId ? "is-active" : ""}" type="button" data-id="${test.id}">
              <strong>${escapeHtml(test.name)}</strong>
              <span>${test.kind === "relearning" ? "보완학습" : "일반 테스트"} · ${escapeHtml(displayIsoDate(test.date))} · ${escapeHtml(test.maxScore)}점</span>
              ${(test.topics || []).length ? `<small>${test.topics.map(escapeHtml).join(" · ")}</small>` : ""}
            </button>
          `,
        )
        .join("")
    : `<p class="muted">아직 만든 테스트가 없습니다.</p>`;
  teacherTestList.querySelectorAll(".teacher-test-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTestId = button.dataset.id;
      renderTests();
      renderTestEditor();
    });
  });
  renderTestEditor();
  renderTestCumulative();
}

async function loadTests() {
  testMessage.textContent = "";
  const payload = await api(`/api/classes/${encodeURIComponent(selectedClassName)}/tests`);
  teacherTests = payload.tests || [];
  testStudents = payload.students || [];
  if (!teacherTests.some((test) => test.id === selectedTestId)) {
    selectedTestId = teacherTests[0]?.id || "";
  }
  renderTests();
}

async function saveTestScores() {
  const test = selectedTest();
  if (!test) {
    return;
  }
  const scores = Object.fromEntries(
    testStudents.map((student) => {
      const scoreInput = testScoreRows.querySelector(`.student-test-score[data-student="${CSS.escape(student)}"]`);
      const absentInput = testScoreRows.querySelector(`.student-test-absent[data-student="${CSS.escape(student)}"]`);
      const noteInput = testScoreRows.querySelector(`.student-test-note[data-student="${CSS.escape(student)}"]`);
      return [
        student,
        {
          score: scoreInput.value === "" ? null : Number(scoreInput.value),
          absent: absentInput.checked,
          note: noteInput.value,
        },
      ];
    }),
  );
  saveTestScoresButton.disabled = true;
  testMessage.className = "message";
  testMessage.textContent = "점수를 저장하는 중입니다.";
  try {
    await api(`/api/tests/${encodeURIComponent(test.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ scores, topics: selectedTestTopics.value, kind: selectedTestKind.value }),
    });
    testMessage.className = "message success";
    testMessage.textContent = "점수를 저장했습니다.";
    await loadTests();
  } finally {
    saveTestScoresButton.disabled = false;
  }
}

function monthlyNarrative(row) {
  const parts = [];
  if (row.homework.total) {
    parts.push(`과제는 ${row.homework.total}회 중 ${row.homework.submitted}회 제출했습니다.`);
  }
  if (row.attendance.total) {
    parts.push(`출결은 ${row.attendance.attended}/${row.attendance.total}회 출석으로 확인됩니다.`);
  }
  if (row.tests.count) {
    parts.push(`이번 달 테스트 평균은 ${row.tests.averagePercent}%입니다.`);
  }
  if (row.relearning?.completed) {
    parts.push(`보완학습은 ${row.relearning.count}회 중 ${row.relearning.completed}회 완료했습니다.`);
  }
  if (row.learning?.strong?.length) {
    parts.push(`${row.learning.strong.map((item) => item.topic).join(", ")} 단원은 비교적 잘 이해하고 있습니다.`);
  }
  if (row.learning?.weak?.length) {
    parts.push(`${row.learning.weak.map((item) => item.topic).join(", ")} 단원은 다시 확인하며 보완하겠습니다.`);
  }
  return parts.length ? parts.join(" ") : "이번 달 기록이 쌓이면 학습 흐름을 자세히 안내할 수 있습니다.";
}

function monthlyLearningHtml(learning = {}) {
  const strong = learning.strong || [];
  const weak = learning.weak || [];
  const weakTypes = learning.weakTypes || [];
  if (!strong.length && !weak.length && !weakTypes.length) {
    return "";
  }
  const rows = [];
  if (strong.length) {
    rows.push(`
      <div>
        <span>잘한 단원</span>
        <p>${strong.map((item) => `<strong>${escapeHtml(item.topic)}</strong><small>${escapeHtml(item.percent)}%</small>`).join("")}</p>
      </div>
    `);
  }
  if (weak.length) {
    rows.push(`
      <div>
        <span>더 연습할 단원</span>
        <p>${weak.map((item) => `<strong>${escapeHtml(item.topic)}</strong><small>${escapeHtml(item.percent)}%</small>`).join("")}</p>
      </div>
    `);
  }
  if (weakTypes.length) {
    rows.push(`
      <div>
        <span>취약 유형</span>
        <p>${weakTypes.map((item) => `<strong>${escapeHtml(item)}</strong>`).join("")}</p>
      </div>
    `);
  }
  return `<div class="monthly-learning-analysis">${rows.join("")}</div>`;
}

function showMonthlyPreview(studentName) {
  const row = monthlyData?.students.find((student) => student.studentName === studentName);
  if (!row) {
    return;
  }
  monthlyReportPreview.hidden = false;
  monthlyReportPreview.innerHTML = `
    <div class="monthly-report-sheet">
      <div class="monthly-report-title">
        <p>${escapeHtml(monthlyData.month.replace("-", "년 "))}월 학습 리포트</p>
        <h2>${escapeHtml(row.studentName)} 학생</h2>
        <span>${escapeHtml(monthlyData.className)} · 황종선T</span>
      </div>
      <div class="monthly-report-metrics">
        <div><span>과제 제출률</span><strong>${percentText(row.homework.rate)}</strong><small>${row.homework.submitted}/${row.homework.total}회</small></div>
        <div><span>출석률</span><strong>${percentText(row.attendance.rate)}</strong><small>결석 ${row.attendance.counts.absent}회 · 지각 ${row.attendance.counts.late}회</small></div>
        <div><span>테스트 평균</span><strong>${percentText(row.tests.averagePercent)}</strong><small>${row.tests.count}회 응시</small></div>
        <div><span>보완학습</span><strong>${row.relearning.completed}/${row.relearning.count}회</strong><small>정답 ${row.relearning.score}/${row.relearning.maxScore}문항</small></div>
        <div><span>질문 문항</span><strong>${row.homework.questionCount}개</strong><small>이번 달 체크</small></div>
      </div>
      ${monthlyLearningHtml(row.learning)}
      <div class="monthly-report-comment">
        <h3>이번 달 학습 이야기</h3>
        <p contenteditable="true">${escapeHtml(monthlyNarrative(row))}</p>
      </div>
      <div class="monthly-report-sign">황종선T</div>
    </div>
    <div class="monthly-report-actions">
      <span class="muted">학습 이야기 문장은 눌러서 수정할 수 있습니다.</span>
      <button id="printMonthlyReport" class="primary" type="button">인쇄·PDF 저장</button>
    </div>
  `;
  document.querySelector("#printMonthlyReport").addEventListener("click", () => window.print());
  monthlyReportPreview.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMonthlyReport() {
  monthlyStudentList.innerHTML = monthlyData?.students?.length
    ? `
      <div class="monthly-student-row is-head"><span>학생</span><span>과제</span><span>출석</span><span>테스트</span><span></span></div>
      ${monthlyData.students
        .map(
          (row) => `
            <div class="monthly-student-row">
              <strong>${escapeHtml(row.studentName)}</strong>
              <span>${percentText(row.homework.rate)}</span>
              <span>${percentText(row.attendance.rate)}</span>
              <span>${percentText(row.tests.averagePercent)}</span>
              <button class="ghost preview-monthly-student" type="button" data-student="${escapeHtml(row.studentName)}">미리보기</button>
            </div>
          `,
        )
        .join("")}
    `
    : `<p class="muted">학생 명단이 없습니다.</p>`;
  monthlyStudentList.querySelectorAll(".preview-monthly-student").forEach((button) => {
    button.addEventListener("click", () => showMonthlyPreview(button.dataset.student));
  });
}

async function loadMonthlyReport() {
  const month = monthlyReportMonth.value || localMonth();
  monthlyReportMonth.value = month;
  monthlyReportMessage.textContent = "";
  monthlyReportPreview.hidden = true;
  monthlyData = await api(`/api/classes/${encodeURIComponent(selectedClassName)}/monthly?month=${encodeURIComponent(month)}`);
  renderMonthlyReport();
}

async function copyToClipboard(text, button, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  button.textContent = "복사됨";
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

function submittedNames(assignment) {
  return new Set((assignment.responses || []).map((response) => response.studentName));
}

function missingStudents(assignment) {
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  const submitted = submittedNames(assignment);
  return students.filter((student) => !submitted.has(student));
}

function submissionRateText(assignment) {
  const total = Array.isArray(assignment.students) ? assignment.students.length : 0;
  if (!total) {
    return `제출 ${assignment.responseCount}명`;
  }
  const submitted = [...submittedNames(assignment)].filter((name) => assignment.students.includes(name)).length;
  const percent = Math.round((submitted / total) * 100);
  return `제출 ${submitted}/${total}명 (${percent}%)`;
}

function topHelpProblems(assignment) {
  return (assignment.items || [])
    .map((item) => ({
      label: item.label,
      count: assignment.counts[item.id] || 0,
      names: assignment.studentsByProblem[item.id] || [],
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"))
    .slice(0, 5);
}

function totalQuestionCount(assignment) {
  return Object.values(assignment.counts || {}).reduce((sum, value) => sum + value, 0);
}

function groupedByClass(assignments) {
  const groups = new Map();
  assignments.forEach((assignment) => {
    const className = assignment.className || "공통";
    if (!groups.has(className)) {
      groups.set(className, []);
    }
    groups.get(className).push(assignment);
  });
  return [...groups.entries()]
    .map(([className, items]) => ({
      className,
      assignments: items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
    .sort((a, b) => compareByClassOrder(a.className, b.className));
}

function responseQuestionText(assignment, response) {
  if (response.problems.length) {
    return response.problems.map((problem) => problemLabel(assignment, problem)).join(", ");
  }
  return response.noQuestionsConfirmed ? "질문 없음 확인" : "질문 선택 확인 기록 없음";
}

function responseSummary(assignment) {
  const rows = (assignment.responses || []).map((response) => {
    const problems = responseQuestionText(assignment, response);
    const files = (response.files || []).length ? " · 사진 첨부" : "";
    return `${response.studentName}: ${problems}${files}`;
  });
  return rows.length ? rows.join("\n") : "아직 제출한 학생 없음";
}

function lessonSummaryText(assignment) {
  const missing = missingStudents(assignment);
  const topItems = topHelpProblems(assignment);
  return [
    `[${assignment.className || "공통"} ${assignment.title}]`,
    `${assignment.dateLabel} · ${rangeLabel(assignment)}`,
    "",
    `제출: ${submissionRateText(assignment)}`,
    `미제출: ${missing.length ? missing.join(", ") : "없음"}`,
    `도와줘요 쌤 TOP 5: ${topItems.length ? topItems.map((item) => `${item.label} ${item.count}명`).join(", ") : "아직 없음"}`,
    "",
    "[학생별 제출]",
    responseSummary(assignment),
  ].join("\n");
}

function noticeTitle(assignment) {
  const dateLabel = String(assignment.dateLabel || "").trim();
  const rawTitle = String(assignment.title || "").replaceAll(/\s+/g, " ").trim();
  const title = dateLabel && rawTitle.startsWith(dateLabel) ? rawTitle : `${dateLabel} ${rawTitle}`.trim();
  return title;
}

function givenName(name) {
  const text = String(name || "").trim();
  return text.length > 1 ? text.slice(1) : text;
}

function hasFinalConsonant(text) {
  const last = String(text || "").trim().at(-1);
  if (!last) {
    return false;
  }
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }
  return (code - 0xac00) % 28 !== 0;
}

function parentName(student) {
  const name = givenName(student);
  return hasFinalConsonant(name) ? `${name}이 어머님` : `${name} 어머님`;
}

function friendlyStudentName(student) {
  const name = givenName(student);
  return hasFinalConsonant(name) ? `${name}아` : `${name}야`;
}

function parentMissingNotice(assignment, student) {
  const title = noticeTitle(assignment);
  return [
    `${parentName(student)}, 안녕하세요. 황종선T입니다.`,
    `${title} 제출 확인 중인데, 아직 과제 사진 제출이 확인되지 않아 안내드립니다.`,
    `혹시 완료했는데 제출을 못 한 경우에는 오늘 중으로 사진 첨부만 부탁드립니다.`,
    `감사합니다.`,
  ].join("\n");
}

function studentMissingNotice(assignment, student) {
  const title = noticeTitle(assignment);
  return [
    `${friendlyStudentName(student)}, ${title} 사진 제출이 아직 확인이 안 됐어.`,
    `했으면 사진만 올려주고, 아직이면 오늘 안에 제출해줘.`,
  ].join("\n");
}

function assignmentStartDate(assignment) {
  const value = assignment.dateLabel;
  const match = String(value || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) {
    return null;
  }
  const createdAt = new Date(assignment.createdAt);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();
  return new Date(year, Number(match[1]) - 1, Number(match[2]));
}

function isDueAssignment(assignment) {
  const startDate = assignmentStartDate(assignment);
  if (!startDate) {
    return false;
  }
  const visibleFrom = new Date(startDate);
  visibleFrom.setDate(visibleFrom.getDate() + 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return visibleFrom <= today;
}

function cumulativeMissingRows(assignments) {
  const rows = new Map();
  assignments
    .filter(isDueAssignment)
    .forEach((assignment) => {
      missingStudents(assignment).forEach((student) => {
        if (!rows.has(student)) {
          rows.set(student, []);
        }
        rows.get(student).push(assignment);
      });
    });

  return [...rows.entries()]
    .map(([student, missingAssignments]) => ({
      student,
      assignments: missingAssignments.sort((a, b) => assignmentStartDate(a) - assignmentStartDate(b)),
    }))
    .sort((a, b) => a.student.localeCompare(b.student, "ko"));
}

function cumulativeAssignmentLine(assignment) {
  return `${noticeTitle(assignment)} · ${rangeLabel(assignment)}`;
}

function cumulativeParentNotice(student, assignments) {
  return [
    `${parentName(student)}, 안녕하세요. 황종선T입니다.`,
    `지금까지 과제 제출 현황을 확인하는 중 미제출 과제가 있어 안내드립니다.`,
    "",
    "[미제출 과제]",
    ...assignments.map((assignment) => `- ${cumulativeAssignmentLine(assignment)}`),
    "",
    `완료한 과제가 있다면 과제 체크 링크의 '지난 과제 제출'에서 사진 첨부 부탁드립니다.`,
    `감사합니다.`,
  ].join("\n");
}

function cumulativeStudentNotice(student, assignments) {
  const count = assignments.length;
  let message;

  if (count === 1) {
    message = [
      `${friendlyStudentName(student)}, 아직 제출하지 않은 과제가 하나 있어.`,
      `깜빡했을 수 있으니까 확인하고 사진 올려줘!`,
    ];
  } else if (count === 2) {
    message = [
      `${friendlyStudentName(student)}, 지금 밀린 과제가 ${count}개 있어.`,
      `더 쌓이기 전에 오늘 하나라도 꼭 끝내서 제출하자!`,
    ];
  } else {
    message = [
      `${friendlyStudentName(student)}, 현재 제출하지 않은 과제가 ${count}개나 쌓여 있어.`,
      `더 미루면 따라잡기 힘들어져. 오늘 가장 오래된 과제부터 시작해서 끝낸 건 바로 사진 올려줘.`,
      `아무런 제출이나 연락이 없으면 과제 진행 상황을 부모님께도 안내할게.`,
    ];
  }

  return [
    ...message,
    "",
    "[미제출 과제]",
    ...assignments.map((assignment) => `- ${cumulativeAssignmentLine(assignment)}`),
    "",
    `끝낸 과제는 과제 체크 링크의 '지난 과제 제출'에 바로 올려주면 돼!`,
  ].join("\n");
}

function cumulativeMissingHtml(assignments) {
  const rows = cumulativeMissingRows(assignments);
  if (!rows.length) {
    return `<p class="muted empty-focused-view">누적 미제출 과제가 없습니다.</p>`;
  }

  return `
    <div class="cumulative-missing-list">
      ${rows
        .map(
          ({ student, assignments: missingAssignments }) => `
            <article class="cumulative-missing-row">
              <div class="cumulative-missing-head">
                <div>
                  <strong>${escapeHtml(student)}</strong>
                  <span>${missingAssignments.length}건 미제출</span>
                </div>
                <div class="actions mini-actions">
                  <button class="copy-cumulative-parent" type="button" data-student="${escapeHtml(student)}">어머님용 복사</button>
                  <button class="copy-cumulative-student" type="button" data-student="${escapeHtml(student)}">학생용 복사</button>
                </div>
              </div>
              <ul>
                ${missingAssignments.map((assignment) => `<li>${escapeHtml(cumulativeAssignmentLine(assignment))}</li>`).join("")}
              </ul>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function missingNoticeHtml(assignment) {
  const missing = missingStudents(assignment);
  if (!missing.length) {
    return `<p class="muted no-missing">미제출 안내를 보낼 학생이 없습니다.</p>`;
  }

  return `
    <div class="missing-notice-list">
      ${missing
        .map(
          (student) => `
            <div class="missing-notice-row">
              <strong>${escapeHtml(student)}</strong>
              <div class="actions mini-actions">
                <button class="copy-parent-notice" type="button" data-id="${escapeHtml(assignment.id)}" data-student="${escapeHtml(student)}">어머님용 복사</button>
                <button class="copy-student-notice" type="button" data-id="${escapeHtml(assignment.id)}" data-student="${escapeHtml(student)}">학생용 복사</button>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function assignmentStatsHtml(assignment) {
  return `
    <span class="stat">${submissionRateText(assignment)}</span>
    <span class="stat">도와줘요 쌤 ${totalQuestionCount(assignment)}개</span>
    <span class="stat">문항 ${assignment.problems.length}개</span>
  `;
}

function assignmentInsightsHtml(assignment) {
  const missing = missingStudents(assignment);
  const topItems = topHelpProblems(assignment);
  return `
    <div class="teacher-insights">
      <section>
        <h4>미제출 학생</h4>
        <p>${missing.length ? escapeHtml(missing.join(", ")) : "없음"}</p>
      </section>
      <section>
        <h4>도와줘요 쌤 TOP 5</h4>
        <p>${
          topItems.length
            ? topItems.map((item) => `${escapeHtml(item.label)} ${item.count}명`).join(" · ")
            : "아직 없음"
        }</p>
      </section>
    </div>
  `;
}

function problemGridHtml(assignment) {
  const items = assignment.items || assignment.problems.map((problem) => ({ id: String(problem), label: `${problem}번` }));
  return items
    .map((item) => {
      const questionCount = assignment.counts[item.id] || 0;
      const names = assignment.studentsByProblem[item.id] || [];
      const title = names.length ? `${names.join(", ")} 질문` : "질문 없음";
      return `<div class="problem-cell ${questionCount > 0 ? "hot" : ""}" title="${escapeHtml(title)}">${escapeHtml(item.label)} · ${questionCount}명</div>`;
    })
    .join("");
}

function responsesHtml(assignment) {
  return assignment.responses.length === 0
    ? `<p class="muted">아직 제출한 학생이 없습니다.</p>`
    : assignment.responses
        .map((response) => {
          const problems = responseQuestionText(assignment, response);
          const files = (response.files || []).length ? ` · 사진 첨부함` : "";
          return `<div class="response-row"><strong>${escapeHtml(response.studentName)}</strong><span>${escapeHtml(problems)}${files}</span><em>${escapeHtml(formatDateTime(response.updatedAt))}</em></div>`;
        })
        .join("");
}

function assignmentDetailHtml(assignment) {
  return `
    ${assignmentInsightsHtml(assignment)}
    <details>
      <summary>전체 문제별 질문 보기</summary>
      <div class="problem-grid">${problemGridHtml(assignment)}</div>
    </details>
    <details>
      <summary>학생별 제출 보기</summary>
      <div class="responses">${responsesHtml(assignment)}</div>
    </details>
    <details>
      <summary>미제출 안내 복사</summary>
      ${missingNoticeHtml(assignment)}
    </details>
  `;
}

function assignmentCardHtml(assignment, options = {}) {
  const assignmentLink = studentUrl(assignment.id);
  const fixedClassLink = classUrl(assignment.className || "공통");
  const modeClass = options.past ? "assignment past-assignment-card" : "assignment latest-assignment-card";
  return `
    <article class="${modeClass}" data-assignment-id="${escapeHtml(assignment.id)}">
      <div class="assignment-head">
        <div>
          <p class="eyebrow class-name">${escapeHtml(assignment.className || "공통")}</p>
          <h3>${escapeHtml(assignment.title)}</h3>
          <p class="muted">${escapeHtml(assignment.dateLabel)} · ${escapeHtml(rangeLabel(assignment))}</p>
        </div>
      </div>
      <details class="assignment-actions-menu">
        <summary>필요한 작업</summary>
        <div class="actions">
          ${options.past ? "" : `<button class="copy-summary" type="button" data-id="${escapeHtml(assignment.id)}">수업 전 요약 복사</button>`}
          <button class="copy-class-link" type="button" data-url="${escapeHtml(fixedClassLink)}">반 링크 복사</button>
          <button class="copy-link" type="button" data-url="${escapeHtml(assignmentLink)}">이 과제 링크 복사</button>
          <a class="student-link" href="${escapeHtml(assignmentLink)}" target="_blank" rel="noreferrer">학생 화면 열기</a>
        </div>
      </details>
      <div class="assignment-detail">${assignmentDetailHtml(assignment)}</div>
    </article>
  `;
}

function renderClasses(assignments) {
  const classes = [...new Set([...defaultClasses, ...assignments.map((assignment) => assignment.className || "공통")])].sort(compareByClassOrder);
  classCountBadge.textContent = `${classes.length}개`;
  classOptions.innerHTML = classes.map((name) => `<option value="${name}"></option>`).join("");

  if (classes.length === 0) {
    classList.innerHTML = `<p class="muted">아직 반별 링크가 없습니다. 과제를 만들 때 반 이름을 입력하면 생깁니다.</p>`;
    return;
  }

  classList.innerHTML = classes
    .map((className) => {
      const latest = assignments.find((assignment) => assignment.className === className);
      return `
        <div class="class-row">
          <div>
            <strong>${className}</strong>
            <span class="muted">${latest ? latest.title : "과제 없음"}</span>
          </div>
          <div class="actions">
            <button type="button" class="copy-fixed-class" data-class="${className}">반 링크 복사</button>
            <a class="student-link" href="${classUrl(className)}" target="_blank" rel="noreferrer">열기</a>
          </div>
        </div>
      `;
    })
    .join("");

  classList.querySelectorAll(".copy-fixed-class").forEach((button) => {
    button.addEventListener("click", () => {
      copyToClipboard(classUrl(button.dataset.class), button, "반 링크 복사");
    });
  });
}

function bindRenderedAssignmentActions() {
  list.querySelectorAll(".copy-class-link").forEach((button) => {
    button.addEventListener("click", (event) => {
      copyToClipboard(event.currentTarget.dataset.url, event.currentTarget, "반 링크 복사");
    });
  });

  list.querySelectorAll(".copy-link").forEach((button) => {
    button.addEventListener("click", (event) => {
      copyToClipboard(event.currentTarget.dataset.url, event.currentTarget, "이 과제 링크 복사");
    });
  });

  list.querySelectorAll(".copy-summary").forEach((button) => {
    button.addEventListener("click", (event) => {
      const assignment = latestAssignments.find((item) => item.id === event.currentTarget.dataset.id);
      if (assignment) {
        copyToClipboard(lessonSummaryText(assignment), event.currentTarget, "수업 전 요약 복사");
      }
    });
  });

  list.querySelectorAll(".copy-parent-notice").forEach((button) => {
    button.addEventListener("click", (event) => {
      const assignment = latestAssignments.find((item) => item.id === event.currentTarget.dataset.id);
      if (assignment) {
        copyToClipboard(parentMissingNotice(assignment, event.currentTarget.dataset.student), event.currentTarget, "어머님용 복사");
      }
    });
  });

  list.querySelectorAll(".copy-student-notice").forEach((button) => {
    button.addEventListener("click", (event) => {
      const assignment = latestAssignments.find((item) => item.id === event.currentTarget.dataset.id);
      if (assignment) {
        copyToClipboard(studentMissingNotice(assignment, event.currentTarget.dataset.student), event.currentTarget, "학생용 복사");
      }
    });
  });

  list.querySelectorAll(".copy-cumulative-parent").forEach((button) => {
    button.addEventListener("click", (event) => {
      const group = groupedByClass(latestAssignments).find((item) => item.className === selectedClassName);
      const row = cumulativeMissingRows(group?.assignments || []).find((item) => item.student === event.currentTarget.dataset.student);
      if (row) {
        copyToClipboard(cumulativeParentNotice(row.student, row.assignments), event.currentTarget, "어머님용 복사");
      }
    });
  });

  list.querySelectorAll(".copy-cumulative-student").forEach((button) => {
    button.addEventListener("click", (event) => {
      const group = groupedByClass(latestAssignments).find((item) => item.className === selectedClassName);
      const row = cumulativeMissingRows(group?.assignments || []).find((item) => item.student === event.currentTarget.dataset.student);
      if (row) {
        copyToClipboard(cumulativeStudentNotice(row.student, row.assignments), event.currentTarget, "학생용 복사");
      }
    });
  });
}

function renderTeacherClassTabs(classes) {
  teacherClasses = classes;
  const scheduledClass = classForDay();
  teacherClassTabs.innerHTML = classes
    .map(
      (className) => `
        <button class="teacher-class-tab ${className === selectedClassName ? "is-active" : ""}" type="button" role="tab" aria-selected="${className === selectedClassName}" data-class="${escapeHtml(className)}">
          <span>${escapeHtml(shortClassName(className))}</span>
          ${className === scheduledClass ? `<em>${new Date().getDay() === 0 ? "다음 수업" : "오늘"}</em>` : ""}
        </button>
      `,
    )
    .join("");

  teacherClassTabs.querySelectorAll(".teacher-class-tab").forEach((button) => {
    button.addEventListener("click", () => {
      selectedClassName = button.dataset.class;
      assignmentViewMode = "current";
      selectedPastAssignmentId = "";
      selectedAttendanceDate = "";
      selectedTestId = "";
      monthlyReportPreview.hidden = true;
      if (teacherModule === "assignments") {
        renderFocusedDashboard();
      } else {
        renderTeacherClassTabs(teacherClasses);
        loadActiveTeacherModule().catch((error) => {
          const target = teacherModule === "attendance" ? attendanceMessage : teacherModule === "tests" ? testMessage : monthlyReportMessage;
          target.className = "message error";
          target.textContent = error.message;
        });
      }
      if (studentPasswordSettings.open) {
        loadStudentPasswordSettings();
      }
    });
  });
}

function teacherSummaryHtml(assignment) {
  if (!assignment) {
    return `<p class="muted">이 반에 등록된 과제가 없습니다.</p>`;
  }
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  const submitted = [...submittedNames(assignment)].filter((name) => students.includes(name)).length;
  const missing = missingStudents(assignment).length;
  return `
    <div><span>제출</span><strong>${submitted}/${students.length}명</strong></div>
    <div class="summary-missing"><span>미제출</span><strong>${missing}명</strong></div>
    <div class="summary-questions"><span>질문</span><strong>${totalQuestionCount(assignment)}개</strong></div>
  `;
}

function renderFocusedDashboard() {
  const scheduledClass = classForDay();
  const day = new Date().getDay();
  const groups = groupedByClass(latestAssignments);
  const group = groups.find((item) => item.className === selectedClassName);
  const assignments = group ? group.assignments : [];
  const [currentAssignment, ...pastAssignments] = assignments;
  const contextLabel = selectedClassName === scheduledClass ? (day === 0 ? "다음 수업" : "오늘 수업") : "선택한 반";

  renderTeacherClassTabs(teacherClasses.length ? teacherClasses : groups.map((item) => item.className));
  selectedClassTitle.textContent = selectedClassName || "과제 없음";
  selectedClassContext.textContent = contextLabel;
  passwordClassLabel.textContent = shortClassName(selectedClassName);
  currentAssignmentTab.classList.toggle("is-active", assignmentViewMode === "current");
  pastAssignmentsTab.classList.toggle("is-active", assignmentViewMode === "past");
  cumulativeMissingTab.classList.toggle("is-active", assignmentViewMode === "missing");
  currentAssignmentTab.setAttribute("aria-selected", String(assignmentViewMode === "current"));
  pastAssignmentsTab.setAttribute("aria-selected", String(assignmentViewMode === "past"));
  cumulativeMissingTab.setAttribute("aria-selected", String(assignmentViewMode === "missing"));

  if (assignmentViewMode === "missing") {
    const rows = cumulativeMissingRows(assignments);
    const totalMissing = rows.reduce((sum, row) => sum + row.assignments.length, 0);
    selectedClassSummary.innerHTML = `
      <div><span>대상 학생</span><strong>${rows.length}명</strong></div>
      <div class="summary-missing"><span>누적 미제출</span><strong>${totalMissing}건</strong></div>
      <div><span>확인 기준</span><strong>과제 시작 +6일</strong></div>
    `;
    list.innerHTML = cumulativeMissingHtml(assignments);
    bindRenderedAssignmentActions();
    return;
  }

  let displayedAssignment = currentAssignment;
  if (assignmentViewMode === "past") {
    if (!pastAssignments.some((assignment) => assignment.id === selectedPastAssignmentId)) {
      selectedPastAssignmentId = pastAssignments[0]?.id || "";
    }
    displayedAssignment = pastAssignments.find((assignment) => assignment.id === selectedPastAssignmentId);
  }

  selectedClassSummary.innerHTML = teacherSummaryHtml(displayedAssignment);

  if (!displayedAssignment) {
    list.innerHTML = `<p class="muted empty-focused-view">${assignmentViewMode === "past" ? "지난 과제가 없습니다." : "등록된 과제가 없습니다."}</p>`;
    return;
  }

  const picker = assignmentViewMode === "past"
    ? `
      <label class="teacher-past-picker">
        지난 과제 선택
        <select id="teacherPastAssignmentSelect">
          ${pastAssignments
            .map((assignment) => `<option value="${escapeHtml(assignment.id)}" ${assignment.id === displayedAssignment.id ? "selected" : ""}>${escapeHtml(`${assignment.dateLabel} ${rangeLabel(assignment)}`)}</option>`)
            .join("")}
        </select>
      </label>
    `
    : "";

  list.innerHTML = `${picker}${assignmentCardHtml(displayedAssignment, { past: assignmentViewMode === "past" })}`;
  const pastSelect = document.querySelector("#teacherPastAssignmentSelect");
  if (pastSelect) {
    pastSelect.addEventListener("change", () => {
      selectedPastAssignmentId = pastSelect.value;
      renderFocusedDashboard();
    });
  }
  bindRenderedAssignmentActions();
}

function renderAssignments(assignments, knownClasses = []) {
  const orderedAssignments = assignments.slice().sort((a, b) => compareByClassOrder(a, b) || b.createdAt.localeCompare(a.createdAt));
  latestAssignments = orderedAssignments;
  countBadge.textContent = `${orderedAssignments.length}개`;
  renderClasses(orderedAssignments);

  if (orderedAssignments.length === 0) {
    teacherClassTabs.innerHTML = "";
    selectedClassSummary.innerHTML = "";
    list.innerHTML = `<p class="muted">아직 만든 과제가 없습니다.</p>`;
    return;
  }

  const classes = [...new Set([...knownClasses, ...groupedByClass(orderedAssignments).map((group) => group.className)])].sort(compareByClassOrder);
  teacherClasses = classes;
  const scheduledClass = classForDay();
  if (!classes.includes(selectedClassName)) {
    selectedClassName = classes.includes(scheduledClass) ? scheduledClass : classes[0];
  }
  todayClassLabel.textContent = `${todayLabel()} · ${new Date().getDay() === 0 ? "다음 수업" : "오늘 수업"} ${shortClassName(scheduledClass)}`;
  renderFocusedDashboard();
  if (studentPasswordSettings.open) {
    loadStudentPasswordSettings();
  }
}

async function loadAssignments() {
  const [payload, classPayload] = await Promise.all([api("/api/assignments"), api("/api/classes")]);
  renderAssignments(payload.assignments, (classPayload.classes || []).map((item) => item.name));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  await api("/api/assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
  await loadAssignments();
});

refreshButton.addEventListener("click", async () => {
  await loadAssignments();
  await loadActiveTeacherModule();
});
currentAssignmentTab.addEventListener("click", () => {
  assignmentViewMode = "current";
  renderFocusedDashboard();
});
pastAssignmentsTab.addEventListener("click", () => {
  assignmentViewMode = "past";
  renderFocusedDashboard();
});
cumulativeMissingTab.addEventListener("click", () => {
  assignmentViewMode = "missing";
  renderFocusedDashboard();
});
studentPasswordSettings.addEventListener("toggle", () => {
  if (studentPasswordSettings.open) {
    studentPasswordMessage.textContent = "";
    loadStudentPasswordSettings();
  }
});

teacherMainTabs.forEach((button) => {
  button.addEventListener("click", () => setTeacherModule(button.dataset.module));
});

attendanceMonth.addEventListener("change", () => {
  selectedAttendanceDate = "";
  loadAttendance().catch((error) => {
    attendanceMessage.className = "message error";
    attendanceMessage.textContent = error.message;
  });
});

attendanceNoClass.addEventListener("change", () => {
  attendanceStudentList.querySelectorAll("select").forEach((select) => {
    select.disabled = attendanceNoClass.checked;
  });
});

saveAttendanceButton.addEventListener("click", () => {
  saveAttendance().catch((error) => {
    attendanceMessage.className = "message error";
    attendanceMessage.textContent = error.message;
    saveAttendanceButton.disabled = false;
  });
});

createTestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = createTestForm.querySelector('button[type="submit"]');
  button.disabled = true;
  testMessage.className = "message";
  testMessage.textContent = "테스트를 만드는 중입니다.";
  try {
    const body = Object.fromEntries(new FormData(createTestForm));
    const created = await api(`/api/classes/${encodeURIComponent(selectedClassName)}/tests`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    selectedTestId = created.id;
    createTestForm.reset();
    createTestForm.elements.date.value = localIsoDate();
    createTestForm.elements.maxScore.value = "100";
    testMessage.className = "message success";
    testMessage.textContent = "테스트를 만들었습니다. 학생별 점수를 입력해 주세요.";
    await loadTests();
  } catch (error) {
    testMessage.className = "message error";
    testMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

saveTestScoresButton.addEventListener("click", () => {
  saveTestScores().catch((error) => {
    testMessage.className = "message error";
    testMessage.textContent = error.message;
    saveTestScoresButton.disabled = false;
  });
});

deleteTestButton.addEventListener("click", async () => {
  const test = selectedTest();
  if (!test || !window.confirm(`${test.name} 테스트를 삭제하시겠습니까?`)) {
    return;
  }
  deleteTestButton.disabled = true;
  try {
    await api(`/api/tests/${encodeURIComponent(test.id)}`, { method: "DELETE" });
    selectedTestId = "";
    await loadTests();
  } catch (error) {
    testMessage.className = "message error";
    testMessage.textContent = error.message;
  } finally {
    deleteTestButton.disabled = false;
  }
});

monthlyReportMonth.addEventListener("change", () => {
  loadMonthlyReport().catch((error) => {
    monthlyReportMessage.className = "message error";
    monthlyReportMessage.textContent = error.message;
  });
});

attendanceMonth.value = localMonth();
monthlyReportMonth.value = localMonth();
createTestForm.elements.date.value = localIsoDate();
loadAssignments();
