const pathParts = location.pathname.split("/").filter(Boolean);
const routeType = pathParts[0];
const routeValue = decodeURIComponent(pathParts.slice(1).join("/"));
const title = document.querySelector("#title");
const detail = document.querySelector("#detail");
const classNameEl = document.querySelector("#className");
const rangeText = document.querySelector("#rangeText");
const grid = document.querySelector("#problemGrid");
const form = document.querySelector("#responseForm");
const nameInput = document.querySelector("#studentName");
const checkedCount = document.querySelector("#checkedCount");
const message = document.querySelector("#message");
const photoInput = document.querySelector("#photoFiles");
const photoList = document.querySelector("#photoList");
const pastAssignmentWrap = document.querySelector("#pastAssignmentWrap");
const pastAssignmentSelect = document.querySelector("#pastAssignmentSelect");
const pastPhotoInput = document.querySelector("#pastPhotoFiles");
const pastPhotoList = document.querySelector("#pastPhotoList");
const pastSubmitBtn = document.querySelector("#pastSubmitBtn");
const pastMessage = document.querySelector("#pastMessage");

let assignmentId = routeType === "student" ? routeValue : "";
let availableAssignments = [];

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
  checkedCount.textContent = `${count}개 선택`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function renderProblems(assignment) {
  const items = Array.isArray(assignment.items) ? assignment.items : assignment.problems || [];
  const books = Array.isArray(assignment.books) && assignment.books.length > 0 ? assignment.books : null;

  if (!books || books.length === 1) {
    grid.innerHTML = renderProblemCells(items);
    return;
  }

  grid.innerHTML = books
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

function displayDateLabel(dateLabel) {
  return String(dateLabel || "").trim() || "오늘";
}

function assignmentOptionLabel(assignment, index) {
  const status = index === 0 ? "현재 과제" : "지난 과제";
  return `${status} · ${displayDateLabel(assignment.dateLabel)} · ${assignment.rangeLabel || assignment.title}`;
}

function renderSelectedPhotos(input, list) {
  const files = [...input.files];
  list.innerHTML = files.length
    ? files.map((file) => `<span>${file.name}</span>`).join("")
    : "";
}

async function selectedPhotosPayload(input) {
  const files = [...input.files].filter((file) => file.type.startsWith("image/")).slice(0, 8);
  return files.map((file) => ({
    name: file.name,
    mimeType: file.type || "image/jpeg",
  }));
}

function showAssignment(assignment) {
  assignmentId = assignment.id;
  document.title = assignment.title;
  document.body.dataset.theme = assignment.theme || "focus";
  classNameEl.textContent = assignment.className || "공통";
  title.textContent = `${displayDateLabel(assignment.dateLabel)} 과제 클리어`;
  rangeText.textContent = assignment.rangeLabel || `${assignment.book} ${assignment.problems[0]}번부터 ${assignment.problems.at(-1)}번까지`;
  detail.textContent = "질문하고 싶은 문제들을 체크하고, 과제 사진은 첨부해 주세요.";
  renderProblems(assignment);
  updateCount();
}

function renderPastAssignmentSelector(assignments) {
  availableAssignments = assignments;
  if (routeType !== "class") {
    pastAssignmentWrap.hidden = true;
    return;
  }

  pastAssignmentWrap.hidden = false;
  const pastAssignments = assignments.slice(1);
  if (!pastAssignments.length) {
    pastAssignmentSelect.disabled = true;
    pastSubmitBtn.disabled = true;
    pastAssignmentSelect.innerHTML = '<option value="">지난 과제가 쌓이면 여기서 선택할 수 있어요.</option>';
    return;
  }

  pastAssignmentSelect.disabled = false;
  pastSubmitBtn.disabled = false;
  pastAssignmentSelect.innerHTML = pastAssignments
    .map((assignment, index) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignmentOptionLabel(assignment, index + 1))}</option>`)
    .join("");
}

async function loadAssignment() {
  if (routeType === "class") {
    const payload = await api(`/api/classes/${encodeURIComponent(routeValue)}/assignments`);
    if (!payload.assignments.length) {
      throw new Error("이 반에 등록된 과제가 아직 없습니다.");
    }
    renderPastAssignmentSelector(payload.assignments);
    showAssignment(payload.assignments[0]);
    return;
  }

  pastAssignmentWrap.hidden = true;
  const assignment = await api(`/api/assignments/${assignmentId}`);
  showAssignment(assignment);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "message";
  message.textContent = "제출 중입니다.";
  const problems = [...grid.querySelectorAll("input:checked")].map((input) => input.value);
  const files = await selectedPhotosPayload(photoInput);
  await api(`/api/assignments/${assignmentId}/responses`, {
    method: "POST",
    body: JSON.stringify({
      studentName: nameInput.value,
      problems,
      files,
    }),
  });
  photoInput.value = "";
  renderSelectedPhotos(photoInput, photoList);
  message.className = "message success";
  message.innerHTML = "<strong>제출 완료되었습니다.</strong><span>같은 이름으로 다시 제출하면 체크 내용과 사진 첨부 여부가 수정됩니다.</span>";
});

async function submitPastAssignment() {
  pastMessage.className = "message";
  pastMessage.textContent = "";

  const studentName = nameInput.value.trim();
  const selectedAssignmentId = pastAssignmentSelect.value;
  const files = await selectedPhotosPayload(pastPhotoInput);

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

  if (!files.length) {
    pastMessage.className = "message error";
    pastMessage.textContent = "지난과제 사진을 첨부해 주세요.";
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
        files,
        keepProblems: true,
      }),
    });
    pastPhotoInput.value = "";
    renderSelectedPhotos(pastPhotoInput, pastPhotoList);
    pastMessage.className = "message success";
    pastMessage.innerHTML = `<strong>지난과제 제출 완료되었습니다.</strong><span>${escapeHtml(selected?.dateLabel || "선택한 날짜")} 과제 제출로 기록되었습니다.</span>`;
  } finally {
    pastSubmitBtn.disabled = !pastAssignmentSelect.value;
  }
}

photoInput.addEventListener("change", () => renderSelectedPhotos(photoInput, photoList));
pastPhotoInput.addEventListener("change", () => renderSelectedPhotos(pastPhotoInput, pastPhotoList));
grid.addEventListener("change", updateCount);
pastAssignmentSelect.addEventListener("change", () => {
  pastMessage.textContent = "";
  pastMessage.className = "message";
});
pastSubmitBtn.addEventListener("click", () => {
  submitPastAssignment().catch((error) => {
    pastSubmitBtn.disabled = !pastAssignmentSelect.value;
    pastMessage.className = "message error";
    pastMessage.textContent = error.message;
  });
});

loadAssignment().catch((error) => {
  classNameEl.textContent = "확인 필요";
  title.textContent = "과제를 불러오지 못했습니다.";
  rangeText.textContent = "";
  detail.textContent = error.message;
});
