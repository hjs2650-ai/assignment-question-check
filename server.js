const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createStore } = require("./storage");

const PORT = Number(process.env.PORT || 3010);
const ROOT = __dirname;
const DEFAULT_CLASS = "공통";
const store = createStore({
  localFile: path.join(ROOT, "data.json"),
  sheetsUrl: process.env.SHEETS_WEB_APP_URL,
  sheetsSecret: process.env.SHEETS_SECRET,
});

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeClassName(value) {
  return normalizeText(value) || DEFAULT_CLASS;
}

function makeProblemList(start, end) {
  const first = Number(start);
  const last = Number(end);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last - first > 500) {
    return null;
  }
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function problemId(book, number) {
  return `${book}__${number}`;
}

function parseBookRanges(text) {
  return normalizeText(text)
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+(\d+)\s*번?\s*(?:~|-|부터)\s*(\d+)\s*번?\s*(?:까지)?$/);
      if (!match) {
        return null;
      }
      return {
        book: normalizeText(match[1]),
        startNumber: Number(match[2]),
        endNumber: Number(match[3]),
      };
    });
}

function normalizeBookRanges(body) {
  const rawBooks = Array.isArray(body.books) ? body.books : parseBookRanges(body.bookRanges);
  const ranges = rawBooks
    .map((item) => ({
      book: normalizeText(item && item.book),
      startNumber: Number(item && item.startNumber),
      endNumber: Number(item && item.endNumber),
    }))
    .filter((item) => item.book && makeProblemList(item.startNumber, item.endNumber));

  if (ranges.length > 0) {
    return ranges.map((item) => {
      const numbers = makeProblemList(item.startNumber, item.endNumber);
      return {
        book: item.book,
        startNumber: item.startNumber,
        endNumber: item.endNumber,
        problems: numbers.map((number) => problemId(item.book, number)),
      };
    });
  }

  const book = normalizeText(body.book);
  const numbers = makeProblemList(body.startNumber, body.endNumber);
  if (!book || !numbers) {
    return null;
  }
  return [
    {
      book,
      startNumber: Number(body.startNumber),
      endNumber: Number(body.endNumber),
      problems: numbers.map(String),
    },
  ];
}

function booksForAssignment(assignment) {
  if (Array.isArray(assignment.books) && assignment.books.length > 0) {
    return assignment.books.map((range) => ({
      book: normalizeText(range.book || assignment.book),
      startNumber: Number(range.startNumber),
      endNumber: Number(range.endNumber),
      problems: Array.isArray(range.problems) ? range.problems.map(String) : makeProblemList(range.startNumber, range.endNumber).map((number) => problemId(range.book, number)),
    }));
  }

  const problems = Array.isArray(assignment.problems) ? assignment.problems.map(String) : [];
  return [
    {
      book: normalizeText(assignment.book),
      startNumber: problems[0],
      endNumber: problems[problems.length - 1],
      problems,
    },
  ];
}

function itemsForAssignment(assignment) {
  return booksForAssignment(assignment).flatMap((range) =>
    range.problems.map((id) => {
      const text = String(id);
      const suffix = text.startsWith(`${range.book}__`) ? text.slice(`${range.book}__`.length) : text;
      const number = Number(suffix);
      const labelNumber = Number.isFinite(number) ? number : suffix;
      return {
        id: text,
        book: range.book,
        number: labelNumber,
        label: `${range.book} ${labelNumber}번`,
      };
    }),
  );
}

function assignmentBookLabel(assignment) {
  return booksForAssignment(assignment)
    .map((range) => `${range.book} ${range.startNumber}번부터 ${range.endNumber}번까지`)
    .join(", ");
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.assignments)) {
    return { assignments: [], classes: [] };
  }
  data.classes = Array.isArray(data.classes) ? data.classes : [];
  data.classes.forEach((classInfo) => {
    classInfo.name = normalizeClassName(classInfo.name);
    classInfo.students = Array.isArray(classInfo.students) ? classInfo.students.map(normalizeText).filter(Boolean) : [];
  });
  data.assignments.forEach((assignment) => {
    assignment.className = normalizeClassName(assignment.className);
    assignment.books = booksForAssignment(assignment);
    assignment.problems = assignment.books.flatMap((range) => range.problems).map(String);
    assignment.book = assignment.books.map((range) => range.book).join(", ");
    assignment.responses = Array.isArray(assignment.responses) ? assignment.responses : [];
    assignment.responses.forEach((response) => {
      if (!Array.isArray(response.problems)) {
        response.problems = String(response.problems || "")
          .split(/[\s,]+/)
          .filter(Boolean);
      }
      response.problems = response.problems.map(String);
      response.files = Array.isArray(response.files) ? response.files : [];
    });
  });
  return data;
}

function publicAssignment(assignment) {
  return {
    id: assignment.id,
    className: normalizeClassName(assignment.className),
    theme: assignment.theme || "focus",
    dateLabel: assignment.dateLabel,
    book: assignment.book,
    books: booksForAssignment(assignment),
    title: assignment.title,
    detail: assignment.detail,
    problems: assignment.problems,
    items: itemsForAssignment(assignment),
    rangeLabel: assignmentBookLabel(assignment),
    createdAt: assignment.createdAt,
  };
}

function studentsForClass(data, className) {
  const targetClass = normalizeClassName(className);
  const classInfo = data.classes.find((item) => normalizeClassName(item.name) === targetClass);
  return classInfo ? classInfo.students : [];
}

function summaryFor(assignment) {
  const validProblems = assignment.problems.map(String);
  const counts = Object.fromEntries(validProblems.map((problem) => [problem, 0]));
  const studentsByProblem = Object.fromEntries(validProblems.map((problem) => [problem, []]));

  for (const response of assignment.responses || []) {
    for (const problem of response.problems || []) {
      if (counts[problem] !== undefined) {
        counts[problem] += 1;
        studentsByProblem[problem].push(response.studentName);
      }
    }
  }

  return {
    ...publicAssignment(assignment),
    responseCount: (assignment.responses || []).length,
    counts,
    studentsByProblem,
    responses: (assignment.responses || []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

function findAssignment(data, id) {
  return data.assignments.find((assignment) => assignment.id === id);
}

function classNames(data) {
  return [
    ...new Set([
      ...data.classes.map((classInfo) => normalizeClassName(classInfo.name)),
      ...data.assignments.map((assignment) => normalizeClassName(assignment.className)),
    ]),
  ].sort((a, b) => a.localeCompare(b, "ko"));
}

function latestAssignmentForClass(data, className) {
  const targetClass = normalizeClassName(className);
  return data.assignments
    .filter((assignment) => normalizeClassName(assignment.className) === targetClass)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

async function handleApi(req, res, pathname) {
  const data = normalizeData(await store.read());

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      storage: store.kind,
      assignmentCount: data.assignments.length,
      classCount: classNames(data).length,
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/classes") {
    sendJson(res, 200, {
      classes: classNames(data).map((name) => ({
        name,
        students: studentsForClass(data, name),
      })),
    });
    return;
  }

  const classCurrentMatch = pathname.match(/^\/api\/classes\/([^/]+)\/current$/);
  if (req.method === "GET" && classCurrentMatch) {
    const className = decodeURIComponent(classCurrentMatch[1]);
    const assignment = latestAssignmentForClass(data, className);
    if (!assignment) {
      sendJson(res, 404, { error: "이 반에 등록된 과제가 아직 없습니다." });
      return;
    }
    sendJson(res, 200, {
      ...publicAssignment(assignment),
      students: studentsForClass(data, className),
    });
    return;
  }

  const classAssignmentsMatch = pathname.match(/^\/api\/classes\/([^/]+)\/assignments$/);
  if (req.method === "GET" && classAssignmentsMatch) {
    const className = decodeURIComponent(classAssignmentsMatch[1]);
    const targetClass = normalizeClassName(className);
    const assignments = data.assignments
      .filter((assignment) => normalizeClassName(assignment.className) === targetClass)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicAssignment);
    sendJson(res, 200, {
      assignments,
      students: studentsForClass(data, className),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/assignments") {
    sendJson(res, 200, {
      assignments: data.assignments
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((assignment) => ({
          ...summaryFor(assignment),
          students: studentsForClass(data, assignment.className),
        })),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/assignments") {
    const body = await readBody(req);
    const className = normalizeClassName(body.className);
    const theme = normalizeText(body.theme) || "focus";
    const dateLabel = normalizeText(body.dateLabel);
    const books = normalizeBookRanges(body);
    const book = books ? books.map((range) => range.book).join(", ") : "";
    const title = normalizeText(body.title) || `${dateLabel} 과제 ${book}`.trim();
    const detail = normalizeText(body.detail);
    const problems = books ? books.flatMap((range) => range.problems).map(String) : null;

    if (!dateLabel || !book || !problems) {
      sendJson(res, 400, { error: "날짜, 교재명, 문제 범위를 확인해 주세요." });
      return;
    }

    const assignment = {
      id: crypto.randomBytes(4).toString("hex"),
      className,
      theme,
      dateLabel,
      book,
      books,
      title,
      detail,
      problems,
      createdAt: new Date().toISOString(),
      responses: [],
    };

    data.assignments.push(assignment);
    await store.write(data);
    sendJson(res, 201, summaryFor(assignment));
    return;
  }

  const assignmentMatch = pathname.match(/^\/api\/assignments\/([^/]+)$/);
  if (req.method === "GET" && assignmentMatch) {
    const assignment = findAssignment(data, assignmentMatch[1]);
    if (!assignment) {
      sendJson(res, 404, { error: "과제를 찾을 수 없습니다." });
      return;
    }
    sendJson(res, 200, {
      ...publicAssignment(assignment),
      students: studentsForClass(data, assignment.className),
    });
    return;
  }

  const responseMatch = pathname.match(/^\/api\/assignments\/([^/]+)\/responses$/);
  if (req.method === "POST" && responseMatch) {
    const assignment = findAssignment(data, responseMatch[1]);
    if (!assignment) {
      sendJson(res, 404, { error: "과제를 찾을 수 없습니다." });
      return;
    }

    const body = await readBody(req);
    const studentName = normalizeText(body.studentName);
    const hasProblemPayload = Array.isArray(body.problems);
    const checked = hasProblemPayload ? body.problems.map(String) : [];
    const submittedFiles = Array.isArray(body.files) ? body.files : [];
    const validSet = new Set(assignment.problems);
    const problems = [...new Set(checked)].filter((problem) => validSet.has(problem));

    if (!studentName) {
      sendJson(res, 400, { error: "이름을 입력해 주세요." });
      return;
    }

    const uploadedFiles = submittedFiles
      .filter((file) => file && /^image\/(jpeg|png|webp)$/.test(file.mimeType))
      .slice(0, 8)
      .map((file) => ({
        name: normalizeText(file.name) || "photo",
        stored: false,
        createdAt: new Date().toISOString(),
      }));

    const existing = assignment.responses.find((response) => response.studentName === studentName);
    if (existing) {
      if (hasProblemPayload && !body.keepProblems) {
        existing.problems = problems;
      }
      existing.files = [...(existing.files || []), ...uploadedFiles];
      existing.updatedAt = new Date().toISOString();
    } else {
      assignment.responses.push({
        id: crypto.randomBytes(4).toString("hex"),
        studentName,
        problems,
        files: uploadedFiles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await store.write(data);
    sendJson(res, 200, summaryFor(assignment));
    return;
  }

  sendJson(res, 404, { error: "없는 API입니다." });
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(ROOT, "public", pathname === "/" ? "index.html" : pathname);
  if (pathname.startsWith("/student/") || pathname.startsWith("/class/")) {
    filePath = path.join(ROOT, "public", "student.html");
  }

  if (!filePath.startsWith(path.join(ROOT, "public"))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(res, 500, { error: "처리 중 오류가 났습니다.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Assignment question checker running at http://localhost:${PORT}`);
  console.log(`Storage: ${store.kind}`);
});
