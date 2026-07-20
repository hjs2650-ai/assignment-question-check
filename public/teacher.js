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
const selectedClassTitle = document.querySelector("#selectedClassTitle");
const selectedClassContext = document.querySelector("#selectedClassContext");
const selectedClassSummary = document.querySelector("#selectedClassSummary");
const todayClassLabel = document.querySelector("#todayClassLabel");
const defaultClasses = [];
const fixedClassOrder = ["고1 1티어D3", "고1 제니트Z2", "고1 SKYA3"];
let latestAssignments = [];
let selectedClassName = "";
let assignmentViewMode = "current";
let selectedPastAssignmentId = "";

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

function responseSummary(assignment) {
  const rows = (assignment.responses || []).map((response) => {
    const problems = response.problems.length
      ? response.problems.map((problem) => problemLabel(assignment, problem)).join(", ")
      : "질문 없음";
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
          const problems = response.problems.length
            ? response.problems.map((problem) => problemLabel(assignment, problem)).join(", ")
            : "질문 없음";
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
}

function renderTeacherClassTabs(classes) {
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
      renderFocusedDashboard();
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

  renderTeacherClassTabs(groups.map((item) => item.className));
  selectedClassTitle.textContent = selectedClassName || "과제 없음";
  selectedClassContext.textContent = contextLabel;
  currentAssignmentTab.classList.toggle("is-active", assignmentViewMode === "current");
  pastAssignmentsTab.classList.toggle("is-active", assignmentViewMode === "past");
  currentAssignmentTab.setAttribute("aria-selected", String(assignmentViewMode === "current"));
  pastAssignmentsTab.setAttribute("aria-selected", String(assignmentViewMode === "past"));

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

function renderAssignments(assignments) {
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

  const classes = groupedByClass(orderedAssignments).map((group) => group.className);
  const scheduledClass = classForDay();
  if (!classes.includes(selectedClassName)) {
    selectedClassName = classes.includes(scheduledClass) ? scheduledClass : classes[0];
  }
  todayClassLabel.textContent = `${todayLabel()} · ${new Date().getDay() === 0 ? "다음 수업" : "오늘 수업"} ${shortClassName(scheduledClass)}`;
  renderFocusedDashboard();
}

async function loadAssignments() {
  const payload = await api("/api/assignments");
  renderAssignments(payload.assignments);
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

refreshButton.addEventListener("click", loadAssignments);
currentAssignmentTab.addEventListener("click", () => {
  assignmentViewMode = "current";
  renderFocusedDashboard();
});
pastAssignmentsTab.addEventListener("click", () => {
  assignmentViewMode = "past";
  renderFocusedDashboard();
});
loadAssignments();
