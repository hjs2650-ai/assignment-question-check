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
  await navigator.clipboard.writeText(text);
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
  countBadge.textContent = `${orderedAssignments.length}개`;
  list.innerHTML = "";
  renderClasses(orderedAssignments);

  if (orderedAssignments.length === 0) {
    list.innerHTML = `<p class="muted">아직 만든 과제가 없습니다.</p>`;
    return;
  }

  for (const assignment of orderedAssignments) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".class-name").textContent = assignment.className || "공통";
    node.querySelector("h3").textContent = assignment.title;
    node.querySelector(".muted").textContent = `${assignment.dateLabel} · ${rangeLabel(assignment)}`;

    const assignmentLink = studentUrl(assignment.id);
    const fixedClassLink = classUrl(assignment.className || "공통");
    const linkButton = node.querySelector(".student-link");
    linkButton.href = assignmentLink;
    linkButton.textContent = "과제 열기";

    node.querySelector(".copy-class-link").addEventListener("click", (event) => {
      copyToClipboard(fixedClassLink, event.currentTarget, "반 링크 복사");
    });

    node.querySelector(".copy-link").addEventListener("click", (event) => {
      copyToClipboard(assignmentLink, event.currentTarget, "이 과제 링크 복사");
    });

    const stats = node.querySelector(".stats");
    const totalQuestions = Object.values(assignment.counts).reduce((sum, value) => sum + value, 0);
    stats.innerHTML = `
      <span class="stat">${submissionRateText(assignment)}</span>
      <span class="stat">도와줘요 쌤 ${totalQuestions}개</span>
      <span class="stat">문항 ${assignment.problems.length}개</span>
    `;

    const missing = missingStudents(assignment);
    const topItems = topHelpProblems(assignment);
    stats.insertAdjacentHTML(
      "afterend",
      `
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
      `,
    );

    const grid = node.querySelector(".problem-grid");
    const items = assignment.items || assignment.problems.map((problem) => ({ id: String(problem), label: `${problem}번` }));
    grid.innerHTML = items
      .map((item) => {
        const questionCount = assignment.counts[item.id] || 0;
        const names = assignment.studentsByProblem[item.id] || [];
        const title = names.length ? `${names.join(", ")} 질문` : "질문 없음";
        return `<div class="problem-cell ${questionCount > 0 ? "hot" : ""}" title="${escapeHtml(title)}">${escapeHtml(item.label)} · ${questionCount}명</div>`;
      })
      .join("");

    const responses = node.querySelector(".responses");
    responses.innerHTML =
      assignment.responses.length === 0
        ? `<p class="muted">아직 제출한 학생이 없습니다.</p>`
        : assignment.responses
            .map((response) => {
              const problems = response.problems.length ? response.problems.map((problem) => problemLabel(assignment, problem)).join(", ") : "질문 없음";
              const files = (response.files || []).length
                ? ` · 사진 첨부함`
                : "";
              return `<div class="response-row"><strong>${escapeHtml(response.studentName)}</strong><span>${escapeHtml(problems)}${files}</span><em>${escapeHtml(formatDateTime(response.updatedAt))}</em></div>`;
            })
            .join("");

    list.appendChild(node);
  }
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
