const form = document.querySelector("#assignmentForm");
const list = document.querySelector("#assignmentList");
const classList = document.querySelector("#classList");
const countBadge = document.querySelector("#assignmentCount");
const classCountBadge = document.querySelector("#classCount");
const refreshButton = document.querySelector("#refreshButton");
const template = document.querySelector("#assignmentTemplate");
const classOptions = document.querySelector("#classOptions");
const defaultClasses = ["고1 제니트", "고1 1티어", "고1 SKY"];

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

async function copyToClipboard(text, button, label) {
  await navigator.clipboard.writeText(text);
  button.textContent = "복사됨";
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

function renderClasses(assignments) {
  const classes = [...new Set([...defaultClasses, "고1 제니트Z2", ...assignments.map((assignment) => assignment.className || "공통")])].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
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
  countBadge.textContent = `${assignments.length}개`;
  list.innerHTML = "";
  renderClasses(assignments);

  if (assignments.length === 0) {
    list.innerHTML = `<p class="muted">아직 만든 과제가 없습니다.</p>`;
    return;
  }

  for (const assignment of assignments) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".class-name").textContent = assignment.className || "공통";
    node.querySelector("h3").textContent = assignment.title;
    node.querySelector(".muted").textContent = `${assignment.dateLabel} · ${assignment.book} · ${assignment.problems[0]}번부터 ${assignment.problems.at(-1)}번까지`;

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
      <span class="stat">제출 ${assignment.responseCount}명</span>
      <span class="stat">질문 체크 ${totalQuestions}개</span>
      <span class="stat">문항 ${assignment.problems.length}개</span>
    `;

    const grid = node.querySelector(".problem-grid");
    grid.innerHTML = assignment.problems
      .map((problem) => {
        const questionCount = assignment.counts[problem] || 0;
        const names = assignment.studentsByProblem[problem] || [];
        const title = names.length ? `${names.join(", ")} 질문` : "질문 없음";
        return `<div class="problem-cell ${questionCount > 0 ? "hot" : ""}" title="${title}">${problem}번 · ${questionCount}명</div>`;
      })
      .join("");

    const responses = node.querySelector(".responses");
    responses.innerHTML =
      assignment.responses.length === 0
        ? `<p class="muted">아직 제출한 학생이 없습니다.</p>`
        : assignment.responses
            .map((response) => {
              const problems = response.problems.length ? response.problems.map((number) => `${number}번`).join(", ") : "질문 없음";
              const files = (response.files || []).length
                ? ` · 사진 ${(response.files || []).map((file, index) => `<a href="${file.url}" target="_blank" rel="noreferrer">${index + 1}</a>`).join(", ")}`
                : "";
              return `<div class="response-row"><strong>${response.studentName}</strong><span>${problems}${files}</span></div>`;
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
