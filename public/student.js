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

let assignmentId = routeType === "student" ? routeValue : "";

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

function renderSelectedPhotos() {
  const files = [...photoInput.files];
  photoList.innerHTML = files.length
    ? files.map((file) => `<span>${file.name}</span>`).join("")
    : "";
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file) {
  const image = await fileToImage(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  return {
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    mimeType: "image/jpeg",
    base64: dataUrl.split(",")[1],
  };
}

async function selectedPhotosPayload() {
  const files = [...photoInput.files].filter((file) => file.type.startsWith("image/")).slice(0, 8);
  const compressed = [];
  for (const file of files) {
    compressed.push(await compressPhoto(file));
  }
  return compressed;
}

async function loadAssignment() {
  const assignment =
    routeType === "class"
      ? await api(`/api/classes/${encodeURIComponent(routeValue)}/current`)
      : await api(`/api/assignments/${assignmentId}`);

  assignmentId = assignment.id;
  document.title = assignment.title;
  document.body.dataset.theme = assignment.theme || "focus";
  classNameEl.textContent = assignment.className || "공통";
  title.textContent = `${displayDateLabel(assignment.dateLabel)} 과제 클리어`;
  rangeText.textContent = assignment.rangeLabel || `${assignment.book} ${assignment.problems[0]}번부터 ${assignment.problems.at(-1)}번까지`;
  detail.textContent = "막힌 문제는 체크하고, 과제 사진은 첨부해 주세요.";
  renderProblems(assignment);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "제출 중입니다. 사진이 있으면 잠시 기다려 주세요.";
  const problems = [...grid.querySelectorAll("input:checked")].map((input) => input.value);
  const files = await selectedPhotosPayload();
  await api(`/api/assignments/${assignmentId}/responses`, {
    method: "POST",
    body: JSON.stringify({
      studentName: nameInput.value,
      problems,
      files,
    }),
  });
  photoInput.value = "";
  renderSelectedPhotos();
  message.textContent = "제출되었습니다. 같은 이름으로 다시 제출하면 문제 체크는 수정되고 사진은 추가 저장됩니다.";
});

photoInput.addEventListener("change", renderSelectedPhotos);
grid.addEventListener("change", updateCount);

loadAssignment().catch((error) => {
  classNameEl.textContent = "확인 필요";
  title.textContent = "과제를 불러오지 못했습니다.";
  rangeText.textContent = "";
  detail.textContent = error.message;
});
