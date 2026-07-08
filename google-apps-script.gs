const SECRET = "CHANGE_THIS_TO_A_LONG_RANDOM_TEXT";
const DATA_SHEET = "DATA";
const ASSIGNMENTS_SHEET = "ASSIGNMENTS";
const RESPONSES_SHEET = "RESPONSES";
const SUMMARY_SHEET = "SUMMARY";
const STUDENTS_SHEET = "STUDENTS";
const ROOT_FOLDER_NAME = "과제 질문 체크 제출";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.secret !== SECRET) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (payload.action === "read") {
      return json({ ok: true, data: readData() });
    }

    if (payload.action === "write") {
      writeData(payload.data || { assignments: [] });
      return json({ ok: true });
    }

    if (payload.action === "uploadFiles") {
      return json({ ok: true, files: noteAttachedPhotos(payload.data || {}) });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function readData() {
  const sheet = getOrCreateSheet(DATA_SHEET);
  const raw = sheet.getRange("A1").getValue();
  if (!raw) {
    return { assignments: [] };
  }
  return JSON.parse(raw);
}

function writeData(data) {
  const safeData = data && Array.isArray(data.assignments) ? data : { assignments: [] };
  const dataSheet = getOrCreateSheet(DATA_SHEET);
  dataSheet.clear();
  dataSheet.getRange("A1").setValue(JSON.stringify(safeData));
  dataSheet.hideSheet();

  writeAssignmentsView(safeData);
  writeResponsesView(safeData);
  writeSummaryView(safeData);
  writeStudentsView(safeData);
}

function writeAssignmentsView(data) {
  const rows = [["assignmentId", "className", "theme", "title", "dateLabel", "books", "range", "problemCount", "createdAt"]];
  data.assignments.forEach((assignment) => {
    const items = itemsForAssignment(assignment);
    rows.push([
      assignment.id,
      assignment.className || "공통",
      assignment.theme || "focus",
      assignment.title,
      assignment.dateLabel,
      booksForAssignment(assignment).map((range) => range.book).join(", "),
      rangeLabel(assignment),
      items.length,
      assignment.createdAt,
    ]);
  });
  replaceSheetRows(ASSIGNMENTS_SHEET, rows);
}

function writeResponsesView(data) {
  const rows = [["assignmentId", "className", "assignmentTitle", "studentName", "doHelpProblems", "questionCount", "photoStatus", "updatedAt"]];
  data.assignments.forEach((assignment) => {
    const labels = problemLabelsForAssignment(assignment);
    (assignment.responses || []).forEach((response) => {
      rows.push([
        assignment.id,
        assignment.className || "공통",
        assignment.title,
        response.studentName,
        (response.problems || []).map((problem) => labels[problem] || `${problem}번`).join(", "),
        (response.problems || []).length,
        (response.files || []).length ? "사진 첨부함" : "",
        response.updatedAt,
      ]);
    });
  });
  replaceSheetRows(RESPONSES_SHEET, rows);
}

function writeSummaryView(data) {
  const rows = [["assignmentId", "className", "assignmentTitle", "doHelpProblem", "questionCount", "students"]];
  data.assignments.forEach((assignment) => {
    const items = itemsForAssignment(assignment);
    const counts = {};
    const students = {};
    items.forEach((item) => {
      counts[item.id] = 0;
      students[item.id] = [];
    });

    (assignment.responses || []).forEach((response) => {
      (response.problems || []).forEach((problem) => {
        if (counts[problem] !== undefined) {
          counts[problem] += 1;
          students[problem].push(response.studentName);
        }
      });
    });

    items.forEach((item) => {
      rows.push([assignment.id, assignment.className || "공통", assignment.title, item.label, counts[item.id], students[item.id].join(", ")]);
    });
  });
  replaceSheetRows(SUMMARY_SHEET, rows);
}

function writeStudentsView(data) {
  const rows = [["className", "studentName"]];
  (data.classes || []).forEach((classInfo) => {
    (classInfo.students || []).forEach((studentName) => {
      rows.push([classInfo.name || "공통", studentName]);
    });
  });
  replaceSheetRows(STUDENTS_SHEET, rows);
}

function replaceSheetRows(name, rows) {
  const sheet = getOrCreateSheet(name);
  sheet.clear();
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
    sheet.autoResizeColumns(1, rows[0].length);
  }
}

function noteAttachedPhotos(data) {
  const files = Array.isArray(data.files) ? data.files : [];
  return files.map((file, index) => {
    return {
      name: safeName(file.name || `photo-${index + 1}`),
      stored: false,
      createdAt: new Date().toISOString(),
    };
  });
}

function safeName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "untitled";
}

function booksForAssignment(assignment) {
  if (Array.isArray(assignment.books) && assignment.books.length > 0) {
    return assignment.books.map((range) => ({
      book: String(range.book || assignment.book || "").trim(),
      startNumber: range.startNumber,
      endNumber: range.endNumber,
      problems: Array.isArray(range.problems) ? range.problems.map(String) : [],
    }));
  }

  const problems = Array.isArray(assignment.problems) ? assignment.problems.map(String) : [];
  return [
    {
      book: String(assignment.book || "").trim(),
      startNumber: problems[0],
      endNumber: problems[problems.length - 1],
      problems,
    },
  ];
}

function itemsForAssignment(assignment) {
  const items = [];
  booksForAssignment(assignment).forEach((range) => {
    (range.problems || []).forEach((id) => {
      const text = String(id);
      const prefix = `${range.book}__`;
      const suffix = text.indexOf(prefix) === 0 ? text.slice(prefix.length) : text;
      items.push({
        id: text,
        book: range.book,
        number: suffix,
        label: `${range.book} ${suffix}번`,
      });
    });
  });
  return items;
}

function problemLabelsForAssignment(assignment) {
  const labels = {};
  itemsForAssignment(assignment).forEach((item) => {
    labels[item.id] = item.label;
  });
  return labels;
}

function rangeLabel(assignment) {
  return booksForAssignment(assignment)
    .map((range) => `${range.book} ${range.startNumber}번부터 ${range.endNumber}번까지`)
    .join(", ");
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
