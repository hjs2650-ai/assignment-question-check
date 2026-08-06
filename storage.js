const fs = require("fs");

function emptyData() {
  return { assignments: [] };
}

function compactData(data) {
  if (!data || !Array.isArray(data.assignments)) {
    return emptyData();
  }

  return {
    ...data,
    assignments: data.assignments.map((assignment) => {
      const { problems, responses, detail, theme, ...savedAssignment } = assignment;
      return {
        ...savedAssignment,
        ...(theme && theme !== "focus" ? { theme } : {}),
        books: Array.isArray(savedAssignment.books)
          ? savedAssignment.books.map(({ problems: bookProblems, ...book }) => book)
          : savedAssignment.books,
        responses: (responses || []).map((response) => {
          const { files, createdAt, noQuestionsConfirmed, ...savedResponse } = response;
          return {
            ...savedResponse,
            ...(noQuestionsConfirmed === true ? { noQuestionsConfirmed: true } : {}),
          };
        }),
      };
    }),
  };
}

function createLocalStore(localFile) {
  return {
    kind: "local-json",
    async read() {
      if (!fs.existsSync(localFile)) {
        return emptyData();
      }
      try {
        return JSON.parse(fs.readFileSync(localFile, "utf8").replace(/^\uFEFF/, ""));
      } catch {
        return emptyData();
      }
    },
    async write(data) {
      fs.writeFileSync(localFile, JSON.stringify(data, null, 2), "utf8");
    },
    async uploadFiles(assignment, studentName, files) {
      const uploadDir = `${localFile}.uploads`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      return files.map((file, index) => {
        const ext = file.mimeType === "image/png" ? "png" : "jpg";
        const safeName = `${assignment.id}-${Date.now()}-${index + 1}.${ext}`;
        const target = `${uploadDir}/${safeName}`;
        fs.writeFileSync(target, Buffer.from(file.base64, "base64"));
        return {
          name: file.name || safeName,
          url: target,
          mimeType: file.mimeType,
          createdAt: new Date().toISOString(),
        };
      });
    },
  };
}

function createSheetsStore(sheetsUrl, sheetsSecret, fallbackStore) {
  const CACHE_TTL_MS = 15_000;
  let cachedData = null;
  let cachedAt = 0;
  let readInFlight = null;

  async function request(action, data) {
    const response = await fetch(sheetsUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: sheetsSecret, action, data }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Google Sheets storage request failed.");
    }
    return payload;
  }

  async function readSheets() {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedData;
    }
    if (readInFlight) {
      return readInFlight;
    }

    readInFlight = request("read")
      .then((payload) => {
        cachedData = payload.data || emptyData();
        cachedAt = Date.now();
        return cachedData;
      })
      .finally(() => {
        readInFlight = null;
      });
    return readInFlight;
  }

  return {
    kind: "google-sheets",
    async read() {
      return readSheets();
    },
    async write(data) {
      const compact = compactData(data);
      try {
        await request("write", compact);
      } catch (writeError) {
        // Apps Script may save DATA successfully and then fail while refreshing
        // the human-readable sheets. Confirm the primary data before failing.
        const verification = await request("read");
        if (JSON.stringify(verification.data || emptyData()) !== JSON.stringify(compact)) {
          throw writeError;
        }
      }
      cachedData = compact;
      cachedAt = Date.now();
      await fallbackStore.write(compact);
    },
    async uploadFiles(assignment, studentName, files) {
      const payload = await request("uploadFiles", {
        assignment: {
          id: assignment.id,
          className: assignment.className,
          title: assignment.title,
          dateLabel: assignment.dateLabel,
          book: assignment.book,
        },
        studentName,
        files,
      });
      return payload.files || [];
    },
  };
}

function createStore(options) {
  const localStore = createLocalStore(options.localFile);
  if (options.sheetsUrl && options.sheetsSecret) {
    return createSheetsStore(options.sheetsUrl, options.sheetsSecret, localStore);
  }
  return localStore;
}

module.exports = { compactData, createStore };
