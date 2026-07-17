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
      const { problems, responses, ...savedAssignment } = assignment;
      return {
        ...savedAssignment,
        responses: (responses || []).map((response) => {
          const { files, ...savedResponse } = response;
          return savedResponse;
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

  return {
    kind: "google-sheets",
    async read() {
      const payload = await request("read");
      return payload.data || emptyData();
    },
    async write(data) {
      const compact = compactData(data);
      await request("write", compact);
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
