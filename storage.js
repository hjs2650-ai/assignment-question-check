const fs = require("fs");

function emptyData() {
  return { assignments: [], classes: [], attendance: [], tests: [], monthlyLearningAnalyses: [], materials: [] };
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
  const materialUploads = new Map();

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
    async uploadMaterial(className, file) {
      const uploadDir = `${localFile}.materials`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeName = `${Date.now()}-${String(file.name || "material.pdf").replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      fs.writeFileSync(`${uploadDir}/${safeName}`, Buffer.from(file.base64, "base64"));
      return {
        driveFileId: `local:${safeName}`,
        previewUrl: `/api/material-content/${encodeURIComponent(safeName)}`,
        viewUrl: `/api/material-content/${encodeURIComponent(safeName)}`,
        downloadRestricted: true,
      };
    },
    async startMaterialUpload(className, file) {
      const uploadDir = `${localFile}.materials`;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const safeName = `${Date.now()}-${String(file.name || "material.pdf").replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const uploadId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const target = `${uploadDir}/${safeName}`;
      fs.writeFileSync(target, Buffer.alloc(0));
      materialUploads.set(uploadId, { target, safeName });
      return { uploadId };
    },
    async uploadMaterialChunk(upload, chunk, start, end, total) {
      const session = materialUploads.get(upload.uploadId);
      if (!session) {
        throw new Error("업로드 시간이 만료되었습니다. 다시 시도해 주세요.");
      }
      const handle = fs.openSync(session.target, "r+");
      try {
        fs.writeSync(handle, chunk, 0, chunk.length, start);
      } finally {
        fs.closeSync(handle);
      }
      return { done: end + 1 >= total, nextOffset: end + 1 };
    },
    async finishMaterialUpload(upload) {
      const session = materialUploads.get(upload.uploadId);
      if (!session) {
        throw new Error("업로드 시간이 만료되었습니다. 다시 시도해 주세요.");
      }
      materialUploads.delete(upload.uploadId);
      return {
        driveFileId: `local:${session.safeName}`,
        previewUrl: `/api/material-content/${encodeURIComponent(session.safeName)}`,
        viewUrl: `/api/material-content/${encodeURIComponent(session.safeName)}`,
        downloadRestricted: true,
      };
    },
    async deleteMaterial(fileId) {
      const prefix = "local:";
      if (!String(fileId || "").startsWith(prefix)) {
        return;
      }
      const safeName = String(fileId).slice(prefix.length).replace(/[\\/]/g, "");
      const target = `${localFile}.materials/${safeName}`;
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
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
    async uploadMaterial(className, file) {
      const payload = await request("uploadMaterial", {
        className,
        file,
      });
      return payload.file;
    },
    async startMaterialUpload(className, file) {
      const payload = await request("startMaterialUpload", { className, file });
      return payload.upload;
    },
    async uploadMaterialChunk(upload, chunk, start, end, total) {
      const response = await fetch(upload.sessionUrl, {
        method: "PUT",
        redirect: "manual",
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
        },
        body: chunk,
      });
      if (response.status === 308) {
        const range = response.headers.get("range") || "";
        const match = range.match(/bytes=0-(\d+)/i);
        return { done: false, nextOffset: match ? Number(match[1]) + 1 : end + 1 };
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.id) {
        throw new Error(payload.error?.message || "Google Drive에 파일 조각을 저장하지 못했습니다.");
      }
      return { done: true, nextOffset: total, fileId: payload.id };
    },
    async finishMaterialUpload(upload, fileId) {
      const payload = await request("finishMaterialUpload", { fileId });
      return payload.file;
    },
    async deleteMaterial(fileId) {
      await request("deleteMaterial", { fileId });
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
