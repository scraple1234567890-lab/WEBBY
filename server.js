#!/usr/bin/env node
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "posts.json");
const PUBLIC_DIR = __dirname;
const MAX_POSTS = 500;

function readPosts() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Unable to read posts file:", err);
    }
    return [];
  }
}

function writePosts(posts) {
  const safe = JSON.stringify(posts, null, 2);
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, `${safe}\n`, "utf8");
}

function respondJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function respondText(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(message);
}

function sanitizePostFields({ author, school, text }) {
  const cleanAuthor = String(author || "").trim();
  const cleanSchool = String(school || "").trim();
  const cleanText = String(text || "").trim();

  if (cleanAuthor.length < 2) throw new Error("Author must be at least 2 characters.");
  if (!cleanSchool) throw new Error("School is required.");
  if (cleanText.length < 12) throw new Error("Post must be at least 12 characters.");

  return {
    author: cleanAuthor.slice(0, 120),
    school: cleanSchool.slice(0, 80),
    text: cleanText.slice(0, 1200),
  };
}

function nextId(existing) {
  const now = Date.now();
  const suffix = Math.floor(Math.random() * 100000);
  return `user-${now}-${suffix}`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20000) {
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch (err) {
        reject(new Error("Invalid JSON payload."));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname !== "/api/posts") return false;

  if (req.method === "GET") {
    const posts = readPosts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    respondJson(res, 200, posts);
    return true;
  }

  if (req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const sanitized = sanitizePostFields(body);

      const posts = readPosts();
      const savedPost = {
        ...sanitized,
        id: nextId(posts),
        createdAt: new Date().toISOString(),
      };

      const updated = [savedPost, ...posts].slice(0, MAX_POSTS);
      writePosts(updated);

      respondJson(res, 201, savedPost);
    } catch (err) {
      respondText(res, 400, err.message || "Unable to save post.");
    }
    return true;
  }

  respondText(res, 405, "Method not allowed.");
  return true;
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
};

function serveStatic(req, res, url) {
  const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath.slice(1));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    respondText(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      respondText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    const handled = await handleApi(req, res, url);
    if (!handled) {
      serveStatic(req, res, url);
    }
  } catch (err) {
    console.error("Unhandled server error:", err);
    respondText(res, 500, "Internal server error");
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
