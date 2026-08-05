/* GKM V374.4 — public community chat backend for Cloudflare Workers + D1. */

const VERSION = "v3744-direct-public-community-chat-2026-08-05";
const DEFAULT_ORIGIN = "https://dragokas371158989-png.github.io";
const MAX_NAME = 40;
const MAX_BODY = 1500;
const MAX_ROOT_MESSAGES = 30;

let schemaPromise;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function cleanText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const configured = String(env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
  if (!origin) return configured;
  if (origin === configured) return origin;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) return origin;
  return "";
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    "access-control-allow-origin": origin || "null",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

async function ensureSchema(env) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_messages (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_community_created ON community_messages(created_at DESC)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_community_parent ON community_messages(parent_id, created_at)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_community_rate ON community_messages(ip_hash, created_at DESC)").run();
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function clientHash(request, env, clientId) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return sha256(`${ip}|${cleanText(clientId, 80)}|${env.HASH_SALT || "gkm-community-v3744"}`);
}

function publicRow(row) {
  return {
    id: String(row.id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    name: cleanText(row.name, MAX_NAME) || "Гость",
    body: cleanText(row.body, MAX_BODY),
    created_at: String(row.created_at),
  };
}

async function listMessages(env) {
  const rootsResult = await env.DB.prepare(`SELECT id,parent_id,name,body,created_at
    FROM community_messages
    WHERE hidden=0 AND parent_id IS NULL
    ORDER BY created_at DESC
    LIMIT ?`).bind(MAX_ROOT_MESSAGES).all();
  const roots = (rootsResult.results || []).map(publicRow);
  if (!roots.length) return [];

  const placeholders = roots.map(() => "?").join(",");
  const repliesResult = await env.DB.prepare(`SELECT id,parent_id,name,body,created_at
    FROM community_messages
    WHERE hidden=0 AND parent_id IN (${placeholders})
    ORDER BY created_at ASC
    LIMIT 240`).bind(...roots.map(row => row.id)).all();
  const replies = new Map(roots.map(row => [row.id, []]));
  for (const raw of repliesResult.results || []) {
    const row = publicRow(raw);
    replies.get(row.parent_id)?.push(row);
  }
  return roots.map(row => ({...row, replies: replies.get(row.id) || []}));
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) throw new Error("PAYLOAD_TOO_LARGE");
  try {
    return await request.json();
  } catch {
    throw new Error("BAD_JSON");
  }
}

function messageError(body) {
  if (body.length < 2) return "Сообщение слишком короткое.";
  const links = body.match(/https?:\/\//gi) || [];
  if (links.length > 2) return "В одном сообщении можно оставить не больше двух ссылок.";
  if (/(.)\1{24,}/u.test(body)) return "Убери повторяющиеся символы из сообщения.";
  return "";
}

async function postMessage(request, env) {
  const payload = await readJson(request);
  if (cleanText(payload.website, 120)) return {ignored: true};
  const name = cleanText(payload.name, MAX_NAME) || "Гость";
  const body = cleanText(payload.message, MAX_BODY);
  const parentId = cleanText(payload.parent_id, 80) || null;
  const validation = messageError(body);
  if (validation) throw new Error(`VALIDATION:${validation}`);

  if (parentId) {
    const parent = await env.DB.prepare("SELECT id FROM community_messages WHERE id=? AND parent_id IS NULL AND hidden=0")
      .bind(parentId).first();
    if (!parent) throw new Error("PARENT_NOT_FOUND");
  }

  const hash = await clientHash(request, env, payload.client_id);
  const latest = await env.DB.prepare("SELECT created_at FROM community_messages WHERE ip_hash=? ORDER BY created_at DESC LIMIT 1")
    .bind(hash).first();
  if (latest && Date.now() - Date.parse(latest.created_at) < 12000) throw new Error("RATE_FAST");
  const hour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM community_messages WHERE ip_hash=? AND created_at>=?")
    .bind(hash, hour).first();
  if (Number(count?.count || 0) >= 12) throw new Error("RATE_HOUR");

  const row = {
    id: crypto.randomUUID(),
    parent_id: parentId,
    name,
    body,
    created_at: new Date().toISOString(),
  };
  await env.DB.prepare(`INSERT INTO community_messages
    (id,parent_id,name,body,created_at,ip_hash,hidden)
    VALUES (?,?,?,?,?,?,0)`).bind(row.id, row.parent_id, row.name, row.body, row.created_at, hash).run();
  return publicRow(row);
}

async function deleteMessage(request, env, id) {
  const token = String(env.ADMIN_TOKEN || "");
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || supplied !== token) throw new Error("UNAUTHORIZED");
  await env.DB.prepare("UPDATE community_messages SET hidden=1 WHERE id=? OR parent_id=?").bind(id, id).run();
  return {deleted: true, id};
}

function errorResponse(error, headers) {
  const code = String(error?.message || "UNKNOWN");
  if (code.startsWith("VALIDATION:")) return json({ok:false,error:code.slice(11)}, 400, headers);
  const known = {
    BAD_JSON: [400, "Неверный формат запроса."],
    PAYLOAD_TOO_LARGE: [413, "Сообщение слишком большое."],
    PARENT_NOT_FOUND: [404, "Сообщение для ответа не найдено."],
    RATE_FAST: [429, "Подожди несколько секунд перед следующим сообщением."],
    RATE_HOUR: [429, "Слишком много сообщений. Попробуй позднее."],
    UNAUTHORIZED: [401, "Нет доступа."],
  };
  const [status, message] = known[code] || [500, "Чат временно недоступен."];
  console.error("GKM community worker", error);
  return json({ok:false,error:message}, status, headers);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers});
    if (!allowedOrigin(request, env)) return json({ok:false,error:"Origin is not allowed"}, 403, headers);

    const url = new URL(request.url);
    try {
      await ensureSchema(env);
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return json({ok:true,service:"gkm-community-chat",version:VERSION}, 200, headers);
      }
      if (request.method === "GET" && url.pathname === "/api/messages") {
        return json({ok:true,messages:await listMessages(env),version:VERSION}, 200, headers);
      }
      if (request.method === "POST" && url.pathname === "/api/messages") {
        return json({ok:true,message:await postMessage(request, env)}, 201, headers);
      }
      const match = url.pathname.match(/^\/api\/messages\/([a-zA-Z0-9-]+)$/);
      if (request.method === "DELETE" && match) {
        return json({ok:true,...await deleteMessage(request, env, match[1])}, 200, headers);
      }
      return json({ok:false,error:"Not found"}, 404, headers);
    } catch (error) {
      return errorResponse(error, headers);
    }
  },
};
