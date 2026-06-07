
import json, re
from html import escape
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "movies_updates.json"
OUT_DIR = ROOT / "film"
SITEMAP = ROOT / "sitemap.xml"
BASE_URL = "https://dragokas371158989-png.github.io/films-series-best-5000"

def text(v, fallback=""):
    return fallback if v is None else str(v)

def title_of(item):
    return text(item.get("ru") or item.get("en") or "Без названия")

def rating_of(item):
    try:
        return float(item.get("rating") or 0)
    except Exception:
        return 0.0

def votes_of(item):
    for key in ("votes", "vote_count", "rating_votes"):
        try:
            return int(item.get(key) or 0)
        except Exception:
            pass
    return 0

def genres_of(item):
    g = item.get("genres") or []
    return [str(x) for x in g if x] if isinstance(g, list) else []

def make_page(item):
    item_id = text(item.get("id"), "0")
    title = title_of(item)
    en = text(item.get("en"), "")
    year = text(item.get("year"), "")
    kind = text(item.get("type"), "Фильм или сериал")
    poster = text(item.get("poster"), "")
    overview = text(item.get("overview") or item.get("description") or "Описание пока не добавлено.")
    genres = genres_of(item)
    rating = rating_of(item)
    votes = votes_of(item)
    url = f"{BASE_URL}/film/{item_id}.html"
    q = re.sub(r"\\s+", "+", title)
    desc = f"{title} — {kind} {year}, рейтинг {rating:.1f}. Жанры: {', '.join(genres[:4])}."[:250]
    schema_type = "TVSeries" if kind == "Сериал" else "Movie"
    ld = {"@context":"https://schema.org","@type":schema_type,"name":title,"description":overview,"url":url,"genre":genres}
    if en and en != title:
        ld["alternateName"] = en
    if year:
        ld["datePublished"] = str(year)
    if poster:
        ld["image"] = poster
    if rating:
        ld["aggregateRating"] = {"@type":"AggregateRating","ratingValue":rating,"bestRating":10,"ratingCount":max(votes,1)}
    json_ld = json.dumps(ld, ensure_ascii=False)
    return f'''<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(title)} — {escape(kind)} {escape(str(year))}, рейтинг {rating:.1f}</title>
  <meta name="description" content="{escape(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{escape(url)}">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{escape(url)}">
  {f'<meta property="og:image" content="{escape(poster)}">' if poster else ''}
  <script type="application/ld+json">{escape(json_ld)}</script>
  <style>
    body{{margin:0;font-family:Arial,system-ui,sans-serif;background:#07101c;color:#eef6ff}}
    a{{color:#79b7ff}}.wrap{{max-width:1100px;margin:0 auto;padding:28px 18px}}
    .hero{{display:grid;grid-template-columns:260px 1fr;gap:28px;align-items:start}}
    img{{width:260px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);background:#0d1d33}}
    h1{{margin:0 0 10px;font-size:36px}}.meta,.genres{{color:#aac0d7;line-height:1.5}}
    .rating{{display:inline-block;background:#00d4a7;color:#031012;font-weight:900;padding:8px 12px;border-radius:12px;margin:12px 0}}
    .overview{{line-height:1.65;font-size:18px}}.buttons{{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}}
    .buttons a{{background:#176dd8;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px}}.back{{display:inline-block;margin-bottom:20px;text-decoration:none}}
    @media(max-width:720px){{.hero{{grid-template-columns:1fr}}img{{width:220px}}h1{{font-size:28px}}}}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="back" href="../">← Назад в каталог</a>
    <section class="hero">
      <div>{f'<img src="{escape(poster)}" alt="{escape(title)}">' if poster else ''}</div>
      <div>
        <h1>{escape(title)}</h1>
        <p class="meta">{escape(kind)} · {escape(str(year))} · голосов: {votes}</p>
        <p class="genres">{escape(" · ".join(genres))}</p>
        <div class="rating">{rating:.1f}</div>
        <p class="overview">{escape(overview)}</p>
        <div class="buttons">
          <a href="https://www.kinopoisk.ru/index.php?kp_query={escape(q)}" target="_blank" rel="noreferrer">Кинопоиск</a>
          <a href="https://www.youtube.com/results?search_query={escape(q)}+трейлер" target="_blank" rel="noreferrer">Трейлер YouTube</a>
          <a href="https://vk.com/video?q={escape(q)}" target="_blank" rel="noreferrer">VK Видео</a>
          <a href="https://rutube.ru/search/?query={escape(q)}" target="_blank" rel="noreferrer">Rutube</a>
        </div>
      </div>
    </section>
  </main>
</body>
</html>'''

def main():
    if not DATA.exists():
        raise SystemExit("movies_updates.json not found")
    raw = json.loads(DATA.read_text(encoding="utf-8"))
    items = raw.get("movies") or raw.get("items") or raw.get("anime") or []
    OUT_DIR.mkdir(exist_ok=True)
    urls = [f"{BASE_URL}/"]
    count = 0
    for item in items:
        item_id = text(item.get("id"), "")
        if not item_id:
            continue
        (OUT_DIR / f"{item_id}.html").write_text(make_page(item), encoding="utf-8")
        urls.append(f"{BASE_URL}/film/{item_id}.html")
        count += 1
    today = date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        priority = "1.0" if url.endswith("/") else "0.7"
        lines.append(f"  <url><loc>{escape(url)}</loc><lastmod>{today}</lastmod><priority>{priority}</priority></url>")
    lines.append("</urlset>")
    SITEMAP.write_text("\\n".join(lines), encoding="utf-8")
    print(f"Generated {count} SEO pages")
    print("Generated sitemap.xml")

if __name__ == "__main__":
    main()
