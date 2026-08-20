const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createStore } = require("./storage");

const PORT = Number(process.env.PORT || 3010);
const ROOT = __dirname;
const DEFAULT_CLASS = "공통";
const YOUTUBE_PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID || "PLAljtV9lQmNQ";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_CACHE_MS = 15 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SHEETS_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_COOKIE = "hwangt_student_session";
const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;
const CLASS_WEEKDAYS = {
  "고1 1티어D3": [1, 5],
  "고1 제니트Z2": [2, 4],
  "고1 SKYA3": [3, 6],
};
const ATTENDANCE_STATUSES = new Set(["present", "late", "absent", "early", "makeup"]);
let youtubeCache = { expiresAt: 0, videos: [] };
const store = createStore({
  localFile: path.join(ROOT, "data.json"),
  sheetsUrl: process.env.SHEETS_WEB_APP_URL,
  sheetsSecret: process.env.SHEETS_SECRET,
});

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
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

function encodeSessionPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sessionToken(className, studentName) {
  const payload = encodeSessionPart({
    className: normalizeClassName(className),
    studentName: normalizeText(studentName),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  const [payload, signature] = normalizeText(token).split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!value.expiresAt || value.expiresAt <= Date.now()) {
      return null;
    }
    return {
      className: normalizeClassName(value.className),
      studentName: normalizeText(value.studentName),
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(parts.join("="));
    }
  }
  return "";
}

function studentSession(req, data) {
  const session = verifySessionToken(cookieValue(req, SESSION_COOKIE));
  if (!session) {
    return null;
  }
  return studentsForClass(data, session.className).includes(session.studentName) ? session : null;
}

function sessionCookie(req, token, maxAge = SESSION_TTL_SECONDS) {
  const secure = String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function videoMatchesClass(title, className) {
  const normalizedTitle = normalizeText(title).toLowerCase().replace(/\s+/g, "");
  const normalizedClass = normalizeClassName(className).toLowerCase().replace(/\s+/g, "");

  if (normalizedClass.includes("1티어")) {
    return normalizedTitle.includes("1티어");
  }
  if (normalizedClass.includes("제니트")) {
    return normalizedTitle.includes("제니트");
  }
  if (normalizedClass.includes("sky")) {
    return normalizedTitle.includes("sky");
  }
  return false;
}

async function youtubePlaylistVideos() {
  if (!YOUTUBE_API_KEY) {
    return { configured: false, videos: [] };
  }
  if (youtubeCache.expiresAt > Date.now()) {
    return { configured: true, videos: youtubeCache.videos };
  }

  const videos = [];
  let pageToken = "";
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", YOUTUBE_PLAYLIST_ID);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", YOUTUBE_API_KEY);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || "유튜브 재생목록을 불러오지 못했습니다.");
    }

    for (const item of payload.items || []) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const title = normalizeText(item.snippet?.title);
      if (!videoId || !title || title === "Private video" || title === "Deleted video") {
        continue;
      }
      videos.push({
        id: videoId,
        title,
        publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "",
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.high?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken && videos.length < 200);

  videos.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  youtubeCache = { expiresAt: Date.now() + YOUTUBE_CACHE_MS, videos };
  return { configured: true, videos };
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, record) {
  if (!record || !record.salt || !record.hash) {
    return true;
  }
  const expected = Buffer.from(record.hash, "hex");
  const actual = crypto.scryptSync(password, record.salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
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
  data = data && typeof data === "object" ? data : {};
  data.assignments = Array.isArray(data.assignments) ? data.assignments : [];
  data.classes = Array.isArray(data.classes) ? data.classes : [];
  data.classes.forEach((classInfo) => {
    classInfo.name = normalizeClassName(classInfo.name);
    classInfo.students = Array.isArray(classInfo.students) ? classInfo.students.map(normalizeText).filter(Boolean) : [];
    classInfo.studentStartDates = classInfo.studentStartDates && typeof classInfo.studentStartDates === "object" ? classInfo.studentStartDates : {};
    classInfo.studentPasswords =
      classInfo.studentPasswords && typeof classInfo.studentPasswords === "object" ? classInfo.studentPasswords : {};
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
  data.attendance = Array.isArray(data.attendance) ? data.attendance : [];
  data.attendance = data.attendance
    .map((record) => ({
      className: normalizeClassName(record.className),
      date: normalizeText(record.date),
      noClass: record.noClass === true,
      note: normalizeText(record.note),
      statuses: record.statuses && typeof record.statuses === "object" ? record.statuses : {},
      updatedAt: record.updatedAt || "",
    }))
    .filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.date));
  data.tests = Array.isArray(data.tests) ? data.tests : [];
  data.tests = data.tests
    .map((test) => ({
      id: normalizeText(test.id) || crypto.randomBytes(4).toString("hex"),
      className: normalizeClassName(test.className),
      date: normalizeText(test.date),
      name: normalizeText(test.name),
      maxScore: Number(test.maxScore),
      scores: test.scores && typeof test.scores === "object" ? test.scores : {},
      createdAt: test.createdAt || new Date().toISOString(),
      updatedAt: test.updatedAt || test.createdAt || new Date().toISOString(),
    }))
    .filter((test) => test.name && /^\d{4}-\d{2}-\d{2}$/.test(test.date) && test.maxScore > 0);
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

function classInfoFor(data, className) {
  const targetClass = normalizeClassName(className);
  return data.classes.find((item) => normalizeClassName(item.name) === targetClass);
}

function studentPasswordRecord(data, className, studentName) {
  const classInfo = classInfoFor(data, className);
  return classInfo && classInfo.studentPasswords ? classInfo.studentPasswords[studentName] : null;
}

function validateStudentAccess(data, className, studentName, password, eligibleStudents = null) {
  const classStudents = Array.isArray(eligibleStudents) ? eligibleStudents : studentsForClass(data, className);
  if (!studentName || (classStudents.length > 0 && !classStudents.includes(studentName))) {
    return { status: 404, error: "반 명단에서 이름을 확인할 수 없습니다. 이름을 정확히 입력해 주세요." };
  }

  const record = studentPasswordRecord(data, className, studentName);
  if (record && !normalizeText(password)) {
    return { status: 401, error: "이 학생은 비밀번호가 설정되어 있습니다. 4자리 비밀번호를 입력해 주세요." };
  }
  if (record && !passwordMatches(normalizeText(password), record)) {
    return { status: 401, error: "비밀번호가 맞지 않습니다. 다시 확인해 주세요." };
  }
  return null;
}

function dateKey(value) {
  const match = normalizeText(value).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 100 + Number(match[2]);
}

function todayInKorea() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentMonthInKorea() {
  return todayInKorea().slice(0, 7);
}

function normalizeMonth(value) {
  const month = normalizeText(value);
  return /^\d{4}-\d{2}$/.test(month) ? month : currentMonthInKorea();
}

function dateFromMonthDay(value, year) {
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const match = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) {
    return "";
  }
  return `${year}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

function assignmentDate(assignment) {
  const created = new Date(assignment.createdAt);
  const year = Number.isNaN(created.getTime()) ? Number(currentMonthInKorea().slice(0, 4)) : created.getUTCFullYear();
  return dateFromMonthDay(assignment.dateLabel, year);
}

function studentActiveOnDate(data, className, studentName, date) {
  const classInfo = classInfoFor(data, className);
  if (!classInfo || !classInfo.students.includes(studentName)) {
    return false;
  }
  const startValue = classInfo.studentStartDates && classInfo.studentStartDates[studentName];
  if (!startValue) {
    return true;
  }
  const startDate = dateFromMonthDay(startValue, Number(date.slice(0, 4)));
  return !startDate || startDate <= date;
}

function scheduledDates(className, month) {
  const weekdays = CLASS_WEEKDAYS[normalizeClassName(className)] || [];
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    if (weekdays.includes(date.getUTCDay())) {
      dates.push(`${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}

function attendanceRecord(data, className, date) {
  const targetClass = normalizeClassName(className);
  return data.attendance.find((record) => record.className === targetClass && record.date === date);
}

function attendanceForClass(data, className, month) {
  const targetClass = normalizeClassName(className);
  const monthValue = normalizeMonth(month);
  const extraDates = data.attendance
    .filter((record) => record.className === targetClass && record.date.startsWith(`${monthValue}-`))
    .map((record) => record.date);
  const dates = [...new Set([...scheduledDates(targetClass, monthValue), ...extraDates])].sort();
  const students = studentsForClass(data, targetClass);
  const today = todayInKorea();

  return dates.map((date) => {
    const record = attendanceRecord(data, targetClass, date);
    const activeStudents = students.filter((student) => studentActiveOnDate(data, targetClass, student, date));
    const statuses = Object.fromEntries(
      activeStudents.map((student) => {
        const savedStatus = record && ATTENDANCE_STATUSES.has(record.statuses[student]) ? record.statuses[student] : "present";
        return [student, savedStatus];
      }),
    );
    return {
      date,
      future: date > today,
      noClass: Boolean(record && record.noClass),
      note: record ? record.note : "",
      statuses,
    };
  });
}

function attendanceSummaryForStudent(data, className, studentName, month) {
  const rows = attendanceForClass(data, className, month).filter(
    (row) => !row.future && !row.noClass && Object.prototype.hasOwnProperty.call(row.statuses, studentName),
  );
  const counts = { present: 0, late: 0, absent: 0, early: 0, makeup: 0 };
  rows.forEach((row) => {
    counts[row.statuses[studentName]] += 1;
  });
  const attended = counts.present + counts.late + counts.early + counts.makeup;
  return {
    total: rows.length,
    attended,
    rate: rows.length ? Math.round((attended / rows.length) * 100) : null,
    counts,
    rows: rows.map((row) => ({ date: row.date, status: row.statuses[studentName], note: row.note })),
  };
}

function normalizedScore(value) {
  if (value && typeof value === "object") {
    const score = value.score === "" || value.score === null || value.score === undefined ? null : Number(value.score);
    return {
      score: Number.isFinite(score) ? score : null,
      absent: value.absent === true,
      note: normalizeText(value.note),
    };
  }
  const score = value === "" || value === null || value === undefined ? null : Number(value);
  return { score: Number.isFinite(score) ? score : null, absent: false, note: "" };
}

function publicTest(test, students = []) {
  return {
    id: test.id,
    className: test.className,
    date: test.date,
    name: test.name,
    maxScore: test.maxScore,
    scores: Object.fromEntries(students.map((student) => [student, normalizedScore(test.scores[student])])),
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  };
}

function testSummaryForStudent(data, className, studentName, month = "") {
  const targetClass = normalizeClassName(className);
  const tests = data.tests
    .filter((test) => test.className === targetClass && (!month || test.date.startsWith(`${month}-`)))
    .map((test) => ({ test, result: normalizedScore(test.scores[studentName]) }))
    .filter(({ result }) => result.score !== null || result.absent)
    .sort((a, b) => b.test.date.localeCompare(a.test.date));
  const scored = tests.filter(({ result }) => result.score !== null);
  const percentages = scored.map(({ test, result }) => Math.round((result.score / test.maxScore) * 1000) / 10);
  return {
    count: scored.length,
    averagePercent: percentages.length ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10 : null,
    bestPercent: percentages.length ? Math.max(...percentages) : null,
    tests: tests.map(({ test, result }) => ({
      id: test.id,
      date: test.date,
      name: test.name,
      maxScore: test.maxScore,
      ...result,
      percent: result.score === null ? null : Math.round((result.score / test.maxScore) * 1000) / 10,
    })),
  };
}

function homeworkSummaryForStudent(data, className, studentName, month) {
  const assignments = data.assignments
    .filter((assignment) => assignment.className === normalizeClassName(className))
    .filter((assignment) => assignmentDate(assignment).startsWith(`${month}-`))
    .filter((assignment) => studentsForAssignment(data, assignment).includes(studentName));
  const submitted = assignments.filter((assignment) =>
    (assignment.responses || []).some((response) => response.studentName === studentName),
  );
  const questionCount = submitted.reduce((sum, assignment) => {
    const response = assignment.responses.find((item) => item.studentName === studentName);
    return sum + (response && Array.isArray(response.problems) ? response.problems.length : 0);
  }, 0);
  return {
    total: assignments.length,
    submitted: submitted.length,
    rate: assignments.length ? Math.round((submitted.length / assignments.length) * 100) : null,
    questionCount,
  };
}

function monthlySummary(data, className, month) {
  const targetClass = normalizeClassName(className);
  const monthValue = normalizeMonth(month);
  return studentsForClass(data, targetClass).map((studentName) => ({
    studentName,
    homework: homeworkSummaryForStudent(data, targetClass, studentName, monthValue),
    attendance: attendanceSummaryForStudent(data, targetClass, studentName, monthValue),
    tests: testSummaryForStudent(data, targetClass, studentName, monthValue),
  }));
}

function studentsForAssignment(data, assignment) {
  const targetClass = normalizeClassName(assignment.className);
  const classInfo = data.classes.find((item) => normalizeClassName(item.name) === targetClass);
  if (!classInfo) {
    return [];
  }
  const assignmentDate = dateKey(assignment.dateLabel);
  return classInfo.students.filter((student) => {
    const startDate = dateKey(classInfo.studentStartDates && classInfo.studentStartDates[student]);
    return !startDate || !assignmentDate || startDate <= assignmentDate;
  });
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
  if (req.method === "GET" && pathname === "/api/health") {
    const requestUrl = new URL(req.url, "http://localhost");
    if (requestUrl.searchParams.has("wake")) {
      await store.read();
    }
    sendJson(res, 200, {
      ok: true,
      storage: store.kind,
    });
    return;
  }

  const classVideosMatch = pathname.match(/^\/api\/classes\/([^/]+)\/videos$/);
  if (req.method === "GET" && classVideosMatch) {
    const className = decodeURIComponent(classVideosMatch[1]);
    const result = await youtubePlaylistVideos();
    sendJson(res, 200, {
      configured: result.configured,
      videos: result.videos.filter((video) => videoMatchesClass(video.title, className)).slice(0, 12),
    });
    return;
  }

  const data = normalizeData(await store.read());

  if (req.method === "POST" && pathname === "/api/student/login") {
    const body = await readBody(req);
    const className = normalizeClassName(body.className);
    const studentName = normalizeText(body.studentName);
    const password = normalizeText(body.password);
    const classInfo = classInfoFor(data, className);
    if (!classInfo || !classInfo.students.includes(studentName)) {
      sendJson(res, 404, { error: "반과 이름을 정확히 확인해 주세요." });
      return;
    }
    const record = studentPasswordRecord(data, className, studentName);
    if (!record) {
      sendJson(res, 409, { error: "아직 비밀번호가 설정되지 않았습니다. 선생님께 비밀번호를 요청해 주세요." });
      return;
    }
    if (!passwordMatches(password, record)) {
      sendJson(res, 401, { error: "비밀번호가 맞지 않습니다. 다시 확인해 주세요." });
      return;
    }
    const token = sessionToken(className, studentName);
    sendJson(
      res,
      200,
      { className, studentName, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 },
      { "Set-Cookie": sessionCookie(req, token) },
    );
    return;
  }

  if (req.method === "POST" && pathname === "/api/student/logout") {
    sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req, "", 0) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/student/session") {
    const session = studentSession(req, data);
    if (!session) {
      sendJson(res, 401, { error: "로그인이 필요합니다." });
      return;
    }
    sendJson(res, 200, session);
    return;
  }

  if (req.method === "GET" && pathname === "/api/student/records") {
    const session = studentSession(req, data);
    if (!session) {
      sendJson(res, 401, { error: "로그인이 필요합니다." });
      return;
    }
    const url = new URL(req.url, "http://localhost");
    const month = normalizeMonth(url.searchParams.get("month"));
    const monthly = monthlySummary(data, session.className, month).find((row) => row.studentName === session.studentName);
    sendJson(res, 200, {
      month,
      className: session.className,
      studentName: session.studentName,
      ...monthly,
      cumulativeTests: testSummaryForStudent(data, session.className, session.studentName),
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

  const classAttendanceMatch = pathname.match(/^\/api\/classes\/([^/]+)\/attendance$/);
  if (classAttendanceMatch) {
    const className = decodeURIComponent(classAttendanceMatch[1]);
    const classInfo = classInfoFor(data, className);
    if (!classInfo) {
      sendJson(res, 404, { error: "반 명단을 찾을 수 없습니다." });
      return;
    }
    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const month = normalizeMonth(url.searchParams.get("month"));
      sendJson(res, 200, {
        className: classInfo.name,
        month,
        students: classInfo.students,
        dates: attendanceForClass(data, classInfo.name, month),
      });
      return;
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const date = normalizeText(body.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sendJson(res, 400, { error: "출결 날짜를 확인해 주세요." });
        return;
      }
      const statuses = {};
      for (const student of classInfo.students) {
        const status = body.statuses && body.statuses[student];
        if (ATTENDANCE_STATUSES.has(status) && status !== "present") {
          statuses[student] = status;
        }
      }
      const recordIndex = data.attendance.findIndex(
        (record) => record.className === classInfo.name && record.date === date,
      );
      const record = {
        className: classInfo.name,
        date,
        noClass: body.noClass === true,
        note: normalizeText(body.note),
        statuses,
        updatedAt: new Date().toISOString(),
      };
      if (!record.noClass && !record.note && Object.keys(statuses).length === 0) {
        if (recordIndex >= 0) {
          data.attendance.splice(recordIndex, 1);
        }
      } else if (recordIndex >= 0) {
        data.attendance[recordIndex] = record;
      } else {
        data.attendance.push(record);
      }
      await store.write(data);
      sendJson(res, 200, { ok: true, record });
      return;
    }
  }

  const classTestsMatch = pathname.match(/^\/api\/classes\/([^/]+)\/tests$/);
  if (classTestsMatch) {
    const className = decodeURIComponent(classTestsMatch[1]);
    const classInfo = classInfoFor(data, className);
    if (!classInfo) {
      sendJson(res, 404, { error: "반 명단을 찾을 수 없습니다." });
      return;
    }
    if (req.method === "GET") {
      const tests = data.tests
        .filter((test) => test.className === classInfo.name)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((test) => publicTest(test, classInfo.students));
      sendJson(res, 200, { className: classInfo.name, students: classInfo.students, tests });
      return;
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const date = normalizeText(body.date);
      const name = normalizeText(body.name);
      const maxScore = Number(body.maxScore);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name || !Number.isFinite(maxScore) || maxScore <= 0) {
        sendJson(res, 400, { error: "테스트 날짜, 시험명, 만점을 확인해 주세요." });
        return;
      }
      const test = {
        id: crypto.randomBytes(4).toString("hex"),
        className: classInfo.name,
        date,
        name,
        maxScore,
        scores: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.tests.push(test);
      await store.write(data);
      sendJson(res, 201, publicTest(test, classInfo.students));
      return;
    }
  }

  const testMatch = pathname.match(/^\/api\/tests\/([^/]+)$/);
  if (testMatch) {
    const testIndex = data.tests.findIndex((test) => test.id === testMatch[1]);
    if (testIndex < 0) {
      sendJson(res, 404, { error: "테스트를 찾을 수 없습니다." });
      return;
    }
    const test = data.tests[testIndex];
    const students = studentsForClass(data, test.className);
    if (req.method === "PATCH") {
      const body = await readBody(req);
      if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(body.date))) {
        test.date = normalizeText(body.date);
      }
      if (body.name !== undefined && normalizeText(body.name)) {
        test.name = normalizeText(body.name);
      }
      if (body.maxScore !== undefined && Number(body.maxScore) > 0) {
        test.maxScore = Number(body.maxScore);
      }
      if (body.scores && typeof body.scores === "object") {
        test.scores = Object.fromEntries(
          students.map((student) => [student, normalizedScore(body.scores[student])]),
        );
      }
      test.updatedAt = new Date().toISOString();
      await store.write(data);
      sendJson(res, 200, publicTest(test, students));
      return;
    }
    if (req.method === "DELETE") {
      data.tests.splice(testIndex, 1);
      await store.write(data);
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  const classMonthlyMatch = pathname.match(/^\/api\/classes\/([^/]+)\/monthly$/);
  if (req.method === "GET" && classMonthlyMatch) {
    const className = decodeURIComponent(classMonthlyMatch[1]);
    const month = normalizeMonth(new URL(req.url, "http://localhost").searchParams.get("month"));
    sendJson(res, 200, {
      className: normalizeClassName(className),
      month,
      students: monthlySummary(data, className, month),
    });
    return;
  }

  const classPasswordsMatch = pathname.match(/^\/api\/classes\/([^/]+)\/passwords$/);
  if (classPasswordsMatch) {
    const className = decodeURIComponent(classPasswordsMatch[1]);
    const classInfo = classInfoFor(data, className);
    if (!classInfo) {
      sendJson(res, 404, { error: "반 명단을 찾을 수 없습니다." });
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 200, {
        className: classInfo.name,
        students: classInfo.students.map((name) => ({
          name,
          passwordEnabled: Boolean(classInfo.studentPasswords[name]),
        })),
      });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const studentName = normalizeText(body.studentName);
      const password = normalizeText(body.password);
      if (!classInfo.students.includes(studentName)) {
        sendJson(res, 404, { error: "반 명단에서 학생 이름을 찾을 수 없습니다." });
        return;
      }
      if (body.enabled !== false && !/^\d{4}$/.test(password)) {
        sendJson(res, 400, { error: "비밀번호는 숫자 4자리로 입력해 주세요." });
        return;
      }

      if (body.enabled === false) {
        delete classInfo.studentPasswords[studentName];
      } else {
        classInfo.studentPasswords[studentName] = passwordRecord(password);
      }
      await store.write(data);
      sendJson(res, 200, {
        studentName,
        passwordEnabled: Boolean(classInfo.studentPasswords[studentName]),
      });
      return;
    }
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
      students: studentsForAssignment(data, assignment),
      passwordRequiredStudents: studentsForAssignment(data, assignment).filter((student) =>
        Boolean(studentPasswordRecord(data, assignment.className, student)),
      ),
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
      passwordRequiredStudents: studentsForClass(data, className).filter((student) =>
        Boolean(studentPasswordRecord(data, className, student)),
      ),
    });
    return;
  }

  const classStatusMatch = pathname.match(/^\/api\/classes\/([^/]+)\/status$/);
  if ((req.method === "GET" || req.method === "POST") && classStatusMatch) {
    const className = decodeURIComponent(classStatusMatch[1]);
    const body = req.method === "POST" ? await readBody(req) : {};
    const url = new URL(req.url, "http://localhost");
    const session = studentSession(req, data);
    const matchingSession = session && session.className === normalizeClassName(className) ? session : null;
    const studentName = matchingSession
      ? matchingSession.studentName
      : normalizeText(body.studentName || url.searchParams.get("studentName"));
    const studentPassword = normalizeText(body.studentPassword || url.searchParams.get("studentPassword"));
    const classStudents = studentsForClass(data, className);
    const accessError = matchingSession
      ? null
      : validateStudentAccess(data, className, studentName, studentPassword, classStudents);
    if (accessError) {
      sendJson(res, accessError.status, { error: accessError.error });
      return;
    }

    const targetClass = normalizeClassName(className);
    const assignments = data.assignments
      .filter((assignment) => normalizeClassName(assignment.className) === targetClass)
      .filter((assignment) => studentsForAssignment(data, assignment).includes(studentName))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((assignment) => {
        const response = (assignment.responses || []).find((item) => item.studentName === studentName);
        return {
          ...publicAssignment(assignment),
          submitted: Boolean(response),
          checkedProblems: response ? response.problems : [],
          noQuestionsConfirmed: Boolean(response && response.noQuestionsConfirmed),
        };
      });

    sendJson(res, 200, { studentName, assignments });
    return;
  }

  if (req.method === "GET" && pathname === "/api/assignments") {
    sendJson(res, 200, {
      assignments: data.assignments
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((assignment) => ({
          ...summaryFor(assignment),
          students: studentsForAssignment(data, assignment),
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
      students: studentsForAssignment(data, assignment),
      passwordRequiredStudents: studentsForAssignment(data, assignment).filter((student) =>
        Boolean(studentPasswordRecord(data, assignment.className, student)),
      ),
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
    const session = studentSession(req, data);
    const matchingSession = session && session.className === normalizeClassName(assignment.className) ? session : null;
    const studentName = matchingSession ? matchingSession.studentName : normalizeText(body.studentName);
    const studentPassword = normalizeText(body.studentPassword);
    const hasProblemPayload = Array.isArray(body.problems);
    const checked = hasProblemPayload ? body.problems.map(String) : [];
    const noQuestionsConfirmed = body.noQuestionsConfirmed === true;
    const submittedFiles = Array.isArray(body.files) ? body.files : [];
    const validSet = new Set(assignment.problems);
    const problems = [...new Set(checked)].filter((problem) => validSet.has(problem));
    const latestAssignment = latestAssignmentForClass(data, assignment.className);
    const isPastAssignment = Boolean(latestAssignment && latestAssignment.id !== assignment.id);
    const hasSubmittedPhoto = submittedFiles.some((file) => file && /^image\//.test(file.mimeType));

    if (!studentName) {
      sendJson(res, 400, { error: "이름을 입력해 주세요." });
      return;
    }

    const accessError = matchingSession
      ? studentsForAssignment(data, assignment).includes(studentName)
        ? null
        : { status: 403, error: "이 과제를 제출할 수 있는 학생이 아닙니다." }
      : validateStudentAccess(
          data,
          assignment.className,
          studentName,
          studentPassword,
          studentsForAssignment(data, assignment),
        );
    if (accessError) {
      sendJson(res, accessError.status, { error: accessError.error });
      return;
    }

    if (!problems.length && !noQuestionsConfirmed) {
      sendJson(res, 400, { error: "질문할 문제를 선택하거나 '질문할 문제 없음'을 체크해 주세요." });
      return;
    }

    if (!hasSubmittedPhoto && !(isPastAssignment && problems.length > 0)) {
      sendJson(res, 400, { error: "과제 사진을 한 장 이상 첨부해 주세요." });
      return;
    }

    const uploadedFiles = submittedFiles
      .filter((file) => file && /^image\//.test(file.mimeType))
      .slice(0, 20)
      .map((file) => ({
        name: normalizeText(file.name) || "photo",
        stored: false,
        createdAt: new Date().toISOString(),
      }));

    const existing = assignment.responses.find((response) => response.studentName === studentName);
    if (existing) {
      if (hasProblemPayload) {
        existing.problems = problems;
      }
      existing.noQuestionsConfirmed = noQuestionsConfirmed;
      existing.files = [...(existing.files || []), ...uploadedFiles];
      existing.updatedAt = new Date().toISOString();
    } else {
      assignment.responses.push({
        id: crypto.randomBytes(4).toString("hex"),
        studentName,
        problems,
        noQuestionsConfirmed,
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
