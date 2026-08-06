const VERSION = "v375-general-catalog-router-2026-08-06";
const SITE_ORIGIN = "https://dragokas371158989-png.github.io";
const MODEL_FALLBACKS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
];
const buckets = new Map();

function clean(value, limit = 4000) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, limit);
}

function corsHeaders(request) {
  const origin = clean(request.headers.get("origin"), 300);
  const allowedOrigin = !origin || origin === SITE_ORIGIN || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)
    ? (origin || "*")
    : SITE_ORIGIN;
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-gkm-worker-version": VERSION,
    "vary": "Origin"
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders(request)
  });
}

function rateAllowed(request) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const ip = clean(request.headers.get("cf-connecting-ip") || "unknown", 80);
  const key = `${ip}:${minute}`;
  const used = Number(buckets.get(key) || 0) + 1;
  buckets.set(key, used);
  if (buckets.size > 2000) {
    for (const oldKey of buckets.keys()) {
      if (!oldKey.endsWith(`:${minute}`)) buckets.delete(oldKey);
    }
  }
  return used <= 30;
}

function normalizeMode(value) {
  const mode = clean(value, 40).toLowerCase();
  return ["general", "catalog", "weather"].includes(mode) ? mode : "general";
}

function resultRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 14).map((item, index) => ({
    n: Number(item?.n || index + 1),
    title: clean(item?.title, 220),
    type: clean(item?.type, 80),
    year: clean(item?.year, 20),
    rating: clean(item?.rating, 20),
    votes: clean(item?.votes, 30),
    genres: Array.isArray(item?.genres)
      ? item.genres.slice(0, 8).map(value => clean(value, 80)).filter(Boolean)
      : []
  })).filter(item => item.title);
}

function historyRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).map(item => ({
    role: item?.role === "assistant" || item?.role === "bot" ? "assistant" : "user",
    content: clean(item?.text || item?.content, 1500)
  })).filter(item => item.content);
}

function catalogContext(rows) {
  return rows.map(item => {
    const details = [item.type, item.year, item.rating ? `рейтинг ${item.rating}` : "", item.genres.join(", ")]
      .filter(Boolean).join(" · ");
    return `${item.n}. ${item.title}${details ? ` — ${details}` : ""}`;
  }).join("\n");
}

function systemPrompt(mode, rows) {
  if (mode === "catalog") {
    return [
      "Ты ГОЛУБЬ AI — помощник каталога фильмов, сериалов, аниме и мультфильмов.",
      "Отвечай по-русски, конкретно и без спойлеров.",
      "Используй только переданные результаты каталога, не придумывай отсутствующие карточки.",
      "Сохраняй номера результатов, чтобы пользователь мог написать «открой 1».",
      "Кратко объясняй, почему каждый вариант подходит запросу.",
      rows.length ? `Результаты каталога:\n${catalogContext(rows)}` : "Результаты каталога не переданы."
    ].join("\n\n");
  }
  if (mode === "weather") {
    return [
      "Ты ГОЛУБЬ AI.",
      "Не выдумывай текущую погоду и температуру без полученных метеоданных.",
      "Если данных нет, попроси пользователя указать город или разрешить геолокацию.",
      "Отвечай по-русски и кратко."
    ].join("\n");
  }
  return [
    "Ты ГОЛУБЬ AI — дружелюбный универсальный русскоязычный помощник.",
    "Отвечай на общие вопросы естественно, точно и по делу.",
    "Не своди разговор к фильмам и не упоминай карточки каталога, если пользователь сам не просит подборку.",
    "Если факт может быть неоднозначным, коротко объясни контекст. Не выдумывай источники."
  ].join("\n");
}

function uniqueModels(requested) {
  const first = clean(requested, 100);
  return [...new Set([first, ...MODEL_FALLBACKS].filter(Boolean))];
}

async function askGroq(env, payload) {
  const key = clean(env.GROQ_API_KEY || env.GROQ_KEY, 300);
  if (!key) {
    const error = new Error("В Worker не задан секрет GROQ_API_KEY");
    error.code = "GROQ_KEY_MISSING";
    throw error;
  }

  const mode = normalizeMode(payload.mode);
  const rows = resultRows(payload.last_results);
  const localAnswer = clean(payload.local_answer, 7000);
  const query = clean(payload.query, 1000);
  if (!query) {
    const error = new Error("Пустой вопрос");
    error.code = "EMPTY_QUERY";
    throw error;
  }

  if (mode === "weather" && localAnswer) {
    return {answer: localAnswer, model: "local-weather", fallback: true};
  }
  if (mode === "catalog" && !rows.length && localAnswer) {
    return {answer: localAnswer, model: "local-catalog", fallback: true};
  }

  const messages = [
    {role: "system", content: systemPrompt(mode, rows)},
    ...historyRows(payload.conversation),
    {role: "user", content: query}
  ];
  let lastError = "Groq не ответил";

  for (const model of uniqueModels(payload.requested_model)) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${key}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: mode === "catalog" ? 0.35 : 0.5,
          max_tokens: 900,
          stream: false
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = clean(data?.error?.message || `Groq HTTP ${response.status}`, 500);
        continue;
      }
      const answer = clean(data?.choices?.[0]?.message?.content, 8000);
      if (!answer) {
        lastError = "Groq вернул пустой ответ";
        continue;
      }
      return {answer, model, fallback: false};
    } catch (error) {
      lastError = clean(error?.message || error, 500);
    }
  }

  if (localAnswer) return {answer: localAnswer, model: "local-fallback", fallback: true};
  const error = new Error(lastError);
  error.code = "GROQ_UNAVAILABLE";
  throw error;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {status: 204, headers: corsHeaders(request)});
    }

    const url = new URL(request.url);
    if (request.method === "GET") {
      return json(request, {
        ok: true,
        service: "GKM Groq AI",
        version: VERSION,
        hasGroqKey: Boolean(env.GROQ_API_KEY || env.GROQ_KEY),
        modes: ["general", "catalog", "weather"],
        endpoint: url.origin
      });
    }

    if (request.method !== "POST") {
      return json(request, {ok: false, error: "Method not allowed"}, 405);
    }
    if (!rateAllowed(request)) {
      return json(request, {ok: false, error: "Слишком много запросов. Повтори через минуту.", code: "RATE_LIMIT"}, 429);
    }
    if (Number(request.headers.get("content-length") || 0) > 65536) {
      return json(request, {ok: false, error: "Слишком большой запрос", code: "PAYLOAD_TOO_LARGE"}, 413);
    }

    try {
      const payload = await request.json();
      const result = await askGroq(env, payload || {});
      return json(request, {
        ok: true,
        answer: result.answer,
        model: result.model,
        fallback: result.fallback,
        mode: normalizeMode(payload?.mode),
        workerVersion: VERSION
      });
    } catch (error) {
      return json(request, {
        ok: false,
        error: clean(error?.message || "Ошибка AI Worker", 700),
        code: clean(error?.code || "AI_WORKER_ERROR", 80),
        workerVersion: VERSION
      }, error?.code === "EMPTY_QUERY" ? 400 : 502);
    }
  }
};
