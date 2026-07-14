const form = document.querySelector("#assignmentForm");
const list = document.querySelector("#assignmentList");
const classList = document.querySelector("#classList");
const countBadge = document.querySelector("#assignmentCount");
const classCountBadge = document.querySelector("#classCount");
const refreshButton = document.querySelector("#refreshButton");
const template = document.querySelector("#assignmentTemplate");
const classOptions = document.querySelector("#classOptions");
const defaultClasses = [];
const fixedClassOrder = ["고1 1티어D3", "고1 제니트Z2", "고1 SKYA3"];
let latestAssignments = [];

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
  const title = `${assignment.dateLabel} ${assignment.title}`.replaceAll(/\s+/g, " ").trim();
  return title;
}

function parentMissingNotice(assignment, student) {
  const title = noticeTitle(assignment);
  return [
    `${student} 어머님, 안녕하세요. 황종선T입니다.`,
    `${title} 과제 제출 확인 중인데, 아직 과제 사진 제출이 확인되지 않아 안내드립니다.`,
    `혹시 완료했는데 제출을 못 한 경우에는 오늘 중으로 사진 첨부만 부탁드립니다.`,
    `감사합니다.`,
  ].join("\n");
}

function studentMissingNotice(assignment, student) {
  const title = noticeTitle(assignment);
  return [
    `${student} 학생, ${title} 과제 사진 제출이 아직 확인되지 않았어요.`,
    `했으면 사진만 올려주고, 아직이면 오늘 안에 제출해 주세요.`,
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
    <div class="problem-grid">${problemGridHtml(assignment)}</div>
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
        <div class="actions">
          ${options.past ? "" : `<button class="copy-summary" type="button" data-id="${escapeHtml(assignment.id)}">수업 전 요약 복사</button>`}
          <button class="copy-class-link" type="button" data-url="${escapeHtml(fixedClassLink)}">반 링크 복사</button>
          <button class="copy-link" type="button" data-url="${escapeHtml(assignmentLink)}">이 과제 링크 복사</button>
          <a class="student-link" href="${escapeHtml(assignmentLink)}" target="_blank" rel="noreferrer">열기</a>
        </div>
      </div>
      <div class="stats">${assignmentStatsHtml(assignment)}</div>
      <details class="assignment-detail">
        <summary>자세히 보기</summary>
        ${assignmentDetailHtml(assignment)}
      </details>
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

function renderAssignments(assignments) {
  const orderedAssignments = assignments.slice().sort((a, b) => compareByClassOrder(a, b) || b.createdAt.localeCompare(a.createdAt));
  latestAssignments = orderedAssignments;
  countBadge.textContent = `${orderedAssignments.length}개`;
  list.innerHTML = "";
  renderClasses(orderedAssignments);

  if (orderedAssignments.length === 0) {
    list.innerHTML = `<p class="muted">아직 만든 과제가 없습니다.</p>`;
    return;
  }

  list.innerHTML = groupedByClass(orderedAssignments)
    .map((group) => {
      const [latest, ...past] = group.assignments;
      return `
        <section class="class-assignment-group">
          ${assignmentCardHtml(latest)}
          ${
            past.length
              ? `
                <details class="past-assignment-list">
                  <summary>지난 과제 보기 ${past.length}개</summary>
                  <div class="past-assignment-items">
                    ${past.map((assignment) => assignmentCardHtml(assignment, { past: true })).join("")}
                  </div>
                </details>
              `
              : `<p class="muted no-past">지난 과제 없음</p>`
          }
        </section>
      `;
    })
    .join("");

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
loadAssignments();
