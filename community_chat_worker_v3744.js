/* GKM V382 — community chat plus profile sync, reports and watch rooms. */

const VERSION = "v382-community-sync-reports-rooms-2026-08-15";
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
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS profile_sync (
        code TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ip_hash TEXT NOT NULL
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_profile_sync_expiry ON profile_sync(expires_at)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_profile_sync_rate ON profile_sync(ip_hash, created_at DESC)").run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feature_reports (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        details TEXT NOT NULL,
        item_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new'
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_feature_reports_rate ON feature_reports(ip_hash, created_at DESC)").run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS watch_rooms (
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        candidates_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        creator_hash TEXT NOT NULL
      )`).run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS watch_votes (
        room_code TEXT NOT NULL,
        voter_hash TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(room_code, voter_hash)
      )`).run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_watch_rooms_expiry ON watch_rooms(expires_at)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_watch_votes_room ON watch_votes(room_code, candidate_id)").run();
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

async function readJson(request, maxLength = 12000) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxLength) throw new Error("PAYLOAD_TOO_LARGE");
  try {
    return await request.json();
  } catch {
    throw new Error("BAD_JSON");
  }
}

function randomCode(byteLength = 9) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function rateCount(env, table, hash, since) {
  const allowed = new Set(["profile_sync", "feature_reports", "watch_rooms"]);
  if (!allowed.has(table)) throw new Error("BAD_RATE_TABLE");
  const column = table === "watch_rooms" ? "creator_hash" : "ip_hash";
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column}=? AND created_at>=?`)
    .bind(hash, since).first();
  return Number(row?.count || 0);
}

async function saveProfileSync(request, env) {
  const body = await readJson(request, 230000);
  const payload = body && body.payload;
  if (!payload || typeof payload !== "object" || payload.schema !== "gkm-sync-v382") throw new Error("BAD_SYNC");
  const serialized = JSON.stringify(payload);
  if (serialized.length > 190000) throw new Error("PAYLOAD_TOO_LARGE");
  const hash = await clientHash(request, env, body.client_id);
  const hour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (await rateCount(env, "profile_sync", hash, hour) >= 6) throw new Error("RATE_HOUR");
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const code = randomCode(10);
  await env.DB.prepare("DELETE FROM profile_sync WHERE expires_at<?").bind(now.toISOString()).run();
  await env.DB.prepare(`INSERT INTO profile_sync (code,payload,created_at,expires_at,ip_hash)
    VALUES (?,?,?,?,?)`).bind(code, serialized, now.toISOString(), expires.toISOString(), hash).run();
  return {code, expires_at: expires.toISOString()};
}

async function loadProfileSync(env, code) {
  const safeCode = cleanText(code, 40);
  const row = await env.DB.prepare("SELECT payload,expires_at FROM profile_sync WHERE code=?").bind(safeCode).first();
  if (!row) throw new Error("SYNC_NOT_FOUND");
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare("DELETE FROM profile_sync WHERE code=?").bind(safeCode).run();
    throw new Error("SYNC_EXPIRED");
  }
  try {
    return {payload: JSON.parse(row.payload), expires_at: String(row.expires_at)};
  } catch {
    throw new Error("BAD_SYNC");
  }
}

async function saveFeatureReport(request, env) {
  const body = await readJson(request, 18000);
  const title = cleanText(body.title, 180);
  const kind = cleanText(body.kind, 80);
  const details = cleanText(body.details, 2500);
  if (!title || details.length < 3) throw new Error("BAD_REPORT");
  const itemJson = JSON.stringify(body.item && typeof body.item === "object" ? body.item : {}).slice(0, 12000);
  const hash = await clientHash(request, env, body.client_id);
  const hour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (await rateCount(env, "feature_reports", hash, hour) >= 8) throw new Error("RATE_HOUR");
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO feature_reports
    (id,kind,title,details,item_json,created_at,ip_hash,status)
    VALUES (?,?,?,?,?,?,?,'new')`).bind(id, kind || "Другое", title, details, itemJson, new Date().toISOString(), hash).run();
  return {id, accepted: true};
}

function cleanCandidate(raw) {
  const id = cleanText(raw && (raw.key || raw.id), 220);
  const title = cleanText(raw && (raw.ru || raw.title || raw.name), 180);
  if (!id || !title) return null;
  return {
    key: id,
    id: cleanText(raw.id, 100),
    ru: title,
    en: cleanText(raw.en, 180),
    type: cleanText(raw.type, 60),
    year: cleanText(raw.year, 12),
    rating: Math.max(0, Math.min(10, Number(raw.rating || 0))),
    votes: Math.max(0, Math.floor(Number(raw.votes || 0))),
    genres: Array.isArray(raw.genres) ? raw.genres.slice(0, 8).map(value => cleanText(value, 60)).filter(Boolean) : [],
    poster: cleanText(raw.poster, 900),
    source: cleanText(raw.source, 80),
  };
}

async function publicRoom(env, row) {
  if (!row) throw new Error("ROOM_NOT_FOUND");
  if (Date.parse(row.expires_at) <= Date.now()) throw new Error("ROOM_EXPIRED");
  let candidates;
  try { candidates = JSON.parse(row.candidates_json); } catch { throw new Error("ROOM_NOT_FOUND"); }
  const votes = await env.DB.prepare(`SELECT candidate_id,COUNT(*) AS count
    FROM watch_votes WHERE room_code=? GROUP BY candidate_id`).bind(row.code).all();
  const counts = new Map((votes.results || []).map(item => [String(item.candidate_id), Number(item.count || 0)]));
  return {
    code: String(row.code),
    title: cleanText(row.title, 80),
    created_at: String(row.created_at),
    expires_at: String(row.expires_at),
    candidates: candidates.map(item => ({...item, votes: counts.get(String(item.key)) || 0})),
  };
}

async function createRoom(request, env) {
  const body = await readJson(request, 32000);
  const title = cleanText(body.title, 80) || "Что смотрим?";
  const candidates = Array.isArray(body.candidates) ? body.candidates.map(cleanCandidate).filter(Boolean).slice(0, 8) : [];
  if (candidates.length < 2) throw new Error("ROOM_CANDIDATES");
  const unique = new Map(candidates.map(item => [item.key, item]));
  if (unique.size < 2) throw new Error("ROOM_CANDIDATES");
  const hash = await clientHash(request, env, body.client_id);
  const hour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (await rateCount(env, "watch_rooms", hash, hour) >= 8) throw new Error("RATE_HOUR");
  const now = new Date();
  const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const code = randomCode(6).slice(0, 8).toUpperCase();
  await env.DB.prepare("DELETE FROM watch_rooms WHERE expires_at<?").bind(now.toISOString()).run();
  await env.DB.prepare(`INSERT INTO watch_rooms
    (code,title,candidates_json,created_at,expires_at,creator_hash)
    VALUES (?,?,?,?,?,?)`).bind(code, title, JSON.stringify([...unique.values()]), now.toISOString(), expires.toISOString(), hash).run();
  const row = await env.DB.prepare("SELECT * FROM watch_rooms WHERE code=?").bind(code).first();
  return publicRoom(env, row);
}

async function loadRoom(env, code) {
  const safeCode = cleanText(code, 20).toUpperCase();
  const row = await env.DB.prepare("SELECT * FROM watch_rooms WHERE code=?").bind(safeCode).first();
  return publicRoom(env, row);
}

async function voteRoom(request, env, code) {
  const body = await readJson(request, 6000);
  const room = await loadRoom(env, code);
  const candidate = cleanText(body.candidate_id, 220);
  if (!room.candidates.some(item => item.key === candidate)) throw new Error("ROOM_CANDIDATE_NOT_FOUND");
  const hash = await clientHash(request, env, body.client_id);
  await env.DB.prepare(`INSERT INTO watch_votes (room_code,voter_hash,candidate_id,created_at)
    VALUES (?,?,?,?) ON CONFLICT(room_code,voter_hash) DO UPDATE SET
    candidate_id=excluded.candidate_id,created_at=excluded.created_at`)
    .bind(room.code, hash, candidate, new Date().toISOString()).run();
  return loadRoom(env, room.code);
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
    PAYLOAD_TOO_LARGE: [413, "Данные слишком большие."],
    PARENT_NOT_FOUND: [404, "Сообщение для ответа не найдено."],
    RATE_FAST: [429, "Подожди несколько секунд перед следующим сообщением."],
    RATE_HOUR: [429, "Слишком много сообщений. Попробуй позднее."],
    BAD_SYNC: [400, "Неверный формат профиля."],
    SYNC_NOT_FOUND: [404, "Код синхронизации не найден."],
    SYNC_EXPIRED: [410, "Срок действия кода синхронизации истёк."],
    BAD_REPORT: [400, "Заполни название и описание ошибки."],
    ROOM_NOT_FOUND: [404, "Комната не найдена."],
    ROOM_EXPIRED: [410, "Комната уже закрыта."],
    ROOM_CANDIDATES: [400, "Для комнаты нужны минимум две разные карточки."],
    ROOM_CANDIDATE_NOT_FOUND: [400, "Такой карточки нет в комнате."],
    UNAUTHORIZED: [401, "Нет доступа."],
  };
  const [status, message] = known[code] || [500, "Сервис временно недоступен."];
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
      const messageMatch = url.pathname.match(/^\/api\/messages\/([a-zA-Z0-9-]+)$/);
      if (request.method === "DELETE" && messageMatch) {
        return json({ok:true,...await deleteMessage(request, env, messageMatch[1])}, 200, headers);
      }
      if (request.method === "POST" && url.pathname === "/api/sync") {
        return json({ok:true,...await saveProfileSync(request, env),version:VERSION}, 201, headers);
      }
      const syncMatch = url.pathname.match(/^\/api\/sync\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && syncMatch) {
        return json({ok:true,...await loadProfileSync(env, syncMatch[1]),version:VERSION}, 200, headers);
      }
      if (request.method === "POST" && url.pathname === "/api/reports") {
        return json({ok:true,report:await saveFeatureReport(request, env),version:VERSION}, 201, headers);
      }
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        return json({ok:true,room:await createRoom(request, env),version:VERSION}, 201, headers);
      }
      const roomVoteMatch = url.pathname.match(/^\/api\/rooms\/([a-zA-Z0-9_-]+)\/vote$/);
      if (request.method === "POST" && roomVoteMatch) {
        return json({ok:true,room:await voteRoom(request, env, roomVoteMatch[1]),version:VERSION}, 200, headers);
      }
      const roomMatch = url.pathname.match(/^\/api\/rooms\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && roomMatch) {
        return json({ok:true,room:await loadRoom(env, roomMatch[1]),version:VERSION}, 200, headers);
      }
      return json({ok:false,error:"Not found"}, 404, headers);
    } catch (error) {
      return errorResponse(error, headers);
    }
  },
};
