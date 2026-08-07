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

let assignmentId = routeType === "student" ? routeValue : "";
let availableAssignments = [];
let currentPhotoFiles = [];
let pastPhotoFiles = [];
let activeSubmissionMode = "current";
let passwordRequiredStudents = new Set();
const MAX_PHOTOS = 20;

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

function updatePasswordVisibility() {
  const passwordRequired = passwordRequiredStudents.has(nameInput.value.trim());
  passwordWrap.hidden = !passwordRequired;
  passwordInput.required = passwordRequired;
  if (!passwordRequired) {
    passwordInput.value = "";
  }
}

function revealPasswordForError(error) {
  if (!String(error && error.message).includes("비밀번호")) {
    return;
  }
  passwordWrap.hidden = false;
  passwordInput.required = true;
  passwordInput.focus();
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
    if (selectedFiles.length >= MAX_PHOTOS) {
      break;
    }
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
  const selectedFiles = files.filter(isImageFile).slice(0, MAX_PHOTOS);
  return selectedFiles.map((file) => ({
    name: file.name,
    mimeType: file.type.startsWith("image/") ? file.type : "image/jpeg",
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
    return;
  }

  pastAssignmentWrap.hidden = true;
  submissionTabs.hidden = true;
  const assignment = await api(`/api/assignments/${assignmentId}`);
  passwordRequiredStudents = new Set(assignment.passwordRequiredStudents || []);
  updatePasswordVisibility();
  showAssignment(assignment);
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
    await loadStudentMissingStatus();
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

loadAssignment().catch((error) => {
  classNameEl.textContent = "확인 필요";
  title.textContent = "과제를 불러오지 못했습니다.";
  rangeText.textContent = "";
  detail.textContent = error.message;
});
