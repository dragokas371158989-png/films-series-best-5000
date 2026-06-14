# GKM_TESTED_PACKAGE_V59 wrapper: tested with synthetic data before release
import json, re, shutil
from pathlib import Path
from datetime import datetime, timezone

VERSION = "v65-balanced-home-tested-2026-06-13"
DATA_FAST = Path("data/fast")
PAGE_SIZE = 60
HOME_LIMIT = 18
MIN_VOTES_FOR_TOP = 300

GOOD_GENRE_ORDER = ["Боевик","Приключения","Комедия","Драма","Криминал","Детектив","Фантастика","Фэнтези","Ужасы","Триллер","Мелодрама","История","Военный","Вестерн","Семейный","Документальный","Музыка","Мультфильм","Аниме","Спорт","Сёнэн","Сэйнэн","Сёдзё","Исекай","Повседневность","Психология","Сверхъестественное","Школа"]

TITLE_RULES = [
    ("witch hat atelier", "Ателье колдовских колпаков", ["atelier of witch hat","tongari boushi no atelier","とんがり帽子のアトリエ","ателье колдовских колпаков"]),
    ("oshi no ko season 3", "Звёздное дитя: Сезон 3", ["推しの子 season 3","oshi no ko","звездное дитя сезон 3","звёздное дитя сезон 3"]),
    ("re zero starting life in another world season 4", "Re:ZERO — Жизнь с нуля в альтернативном мире: Сезон 4", ["re:zero season 4","re zero season 4","re zero"]),
    ("jujutsu kaisen the culling game part 1", "Магическая битва: Смертельная миграция — Часть 1", ["jujutsu kaisen","呪術廻戦","магическая битва"]),
    ("naruto shippuden", "Наруто: Ураганные хроники", ["наруто ураганные хроники"]),
    ("naruto", "Наруто", ["наруто"]),
    ("boruto", "Боруто", ["боруто"]),
    ("one piece", "Ван-Пис", ["ван пис","ванпис","ван-пис"]),
    ("bleach thousand year blood war", "Блич: Тысячелетняя кровавая война", ["tybw"]),
    ("bleach", "Блич", ["блич"]),
    ("demon slayer", "Истребитель демонов", ["kimetsu no yaiba","鬼滅の刃","клинок","истребитель демонов"]),
    ("attack on titan", "Атака титанов", ["shingeki no kyojin","進撃の巨人","атака титанов"]),
    ("frieren", "Провожающая в последний путь Фрирен", ["sousou no frieren","фрирен"]),
    ("that time i got reincarnated as a slime", "О моём перерождении в слизь", ["tensei shitara slime","reincarnated as a slime","слизь"]),
    ("fullmetal alchemist brotherhood", "Стальной алхимик: Братство", ["fma brotherhood"]),
    ("fullmetal alchemist", "Стальной алхимик", ["fma"]),
    ("chainsaw man", "Человек-бензопила", ["бензопила"]),
    ("death note", "Тетрадь смерти", ["тетрадь смерти"]),
    ("solo leveling", "Поднятие уровня в одиночку", ["соло левелинг"]),
    ("one punch man", "Ванпанчмен", ["ванпанчмен"]),
    ("hunter x hunter", "Охотник х Охотник", ["hxh"]),
    ("my hero academia", "Моя геройская академия", ["boku no hero academia"]),
    ("sword art online", "Мастера меча онлайн", ["sao"]),
    ("tokyo ghoul", "Токийский гуль", ["гуль"]),
    ("blue lock", "Синяя тюрьма", []),
    ("haikyuu", "Волейбол!!", ["haikyu"]),
    ("violet evergarden", "Вайолет Эвергарден", [])
]

WESTERN_CARTOON = [
    "scooby", "скуби", "lego scooby", "tom and jerry", "том и джерри",
    "looney tunes", "bugs bunny", "spongebob", "sponge bob", "губка боб",
    "simpsons", "симпсоны", "family guy", "griffins", "гриффины",
    "south park", "южный парк", "rick and morty", "рик и морти",
    "regular show", "обычный мультик", "adventure time", "время приключений",
    "gravity falls", "гравити фолз", "steven universe", "clarence",
    "teen titans", "юные титаны", "powerpuff girls", "суперкрошки",
    "my little pony", "disney", "pixar", "dreamworks"
]

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")

def norm(v):
    s = str(v or "").lower().replace("ё","е")
    s = re.sub(r"\s*\(\d{4}\)\s*", " ", s)
    s = re.sub(r"[^0-9a-zа-яё一-龯ぁ-ゔァ-ヴー々〆〤]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",",":")), encoding="utf-8")

def names(item):
    vals = []
    for k in ("ru","en","title","name","title_ru","ruTitle","originalTitle","original_title","title_original","english","japanese","romaji"):
        if item.get(k):
            vals.append(clean(item.get(k)))
    for k in ("aliases","names"):
        if isinstance(item.get(k), list):
            vals += [clean(x) for x in item[k] if x]
    return vals

def hay(item):
    return norm(" ".join(names(item) + [str(item.get("source") or ""), " ".join(item.get("genres") or [])]))

def has_western_cartoon(item):
    h = hay(item)
    return any(norm(x) in h for x in WESTERN_CARTOON)

def rule_for(item):
    h = hay(item)
    best = None
    best_len = 0
    for key, ru, aliases in TITLE_RULES:
        for c in [key, ru] + aliases:
            nc = norm(c)
            if nc and nc in h and len(nc) > best_len:
                best = (key, ru, aliases)
                best_len = len(nc)
    return best

def fix_item(item):
    if not isinstance(item, dict):
        return item
    item = dict(item)
    r = rule_for(item)
    if r:
        key, ru, aliases = r
        old = item.get("ru") or item.get("title") or item.get("name") or item.get("en") or ""
        item["ru"] = ru
        if old and not item.get("title_original"):
            item["title_original"] = old
        old_aliases = item.get("aliases") if isinstance(item.get("aliases"), list) else []
        item["aliases"] = list(dict.fromkeys(old_aliases + [key, ru] + aliases + names(item)))

    if has_western_cartoon(item):
        item["type"] = "Мультфильм"
        gs = item.get("genres") if isinstance(item.get("genres"), list) else []
        gs = [g for g in gs if norm(g) != "аниме"]
        if "Мультфильм" not in gs:
            gs.insert(0, "Мультфильм")
        item["genres"] = gs
    else:
        h = hay(item)
        source = norm(item.get("source") or "")
        if "jikan" in source or "myanimelist" in source or "shikimori" in source or "anilist" in source or "аниме" in h or "anime" in h:
            item["type"] = "Аниме"
    return item

def quality(item):
    return (20 if item.get("poster") else 0) + (15 if item.get("ru") else 0) + (5 if item.get("overview") else 0) + min(float(item.get("votes") or 0), 500000) / 500000 + float(item.get("rating") or 0) / 10

def canon_key(item):
    item = fix_item(item)
    r = rule_for(item)
    h = hay(item)
    if has_western_cartoon(item):
        if "lego" in h and ("scooby" in h or "скуби" in h):
            title = "lego scooby doo"
        elif "scooby" in h or "скуби" in h:
            title = "scooby doo behind scenes" if "behind" in h or "за кадром" in h else "scooby doo"
        else:
            title = norm(item.get("ru") or item.get("en"))
    elif r:
        title = norm(r[1])
        m = re.search(r"(season|сезон)\s*(\d+)", h)
        if m:
            title += " season " + m.group(2)
        p = re.search(r"(part|часть)\s*(\d+)", h)
        if p:
            title += " part " + p.group(2)
    else:
        title = norm(item.get("ru") or item.get("en") or item.get("title") or item.get("name"))
    year = str(item.get("year") or "")[:4]
    t = item.get("type") or ""
    return f"{t}|{title}|{year}"

def dedupe(items):
    best = {}
    for raw in items:
        item = fix_item(raw)
        k = canon_key(item)
        if not k.strip("|"):
            continue
        if k not in best or quality(item) > quality(best[k]):
            best[k] = item
    return list(best.values())

def score(item):
    rating = float(item.get("rating") or 0)
    votes = int(float(item.get("votes") or 0))
    year = int(item.get("year") or 0)
    if votes < 30:
        return rating - 25
    return rating * 10 + min(votes, 80000) / 80000 * 5 + (0.35 if year >= 2010 else 0)

def write_pages(tab, items):
    d = DATA_FAST / "pages" / tab
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True, exist_ok=True)
    pages = max(1, (len(items) + PAGE_SIZE - 1) // PAGE_SIZE)
    for page in range(1, pages + 1):
        save(d / f"page_{page:04d}.json", {
            "tab": tab,
            "page": page,
            "pages": pages,
            "count": len(items),
            "pageSize": PAGE_SIZE,
            "items": items[(page - 1) * PAGE_SIZE: page * PAGE_SIZE],
        })
    return {"count": len(items), "pages": pages, "pageSize": PAGE_SIZE}

def main():
    if not DATA_FAST.exists():
        raise SystemExit("data/fast not found. Run build_fast_site_data.py first.")
    si_path = DATA_FAST / "search_index.json"
    if not si_path.exists():
        raise SystemExit("data/fast/search_index.json not found.")
    raw = load(si_path)
    if not isinstance(raw, list):
        raise SystemExit("search_index.json is not list")

    print(f"V57 POSTFIX: loaded search_index={len(raw)}")
    items = dedupe(raw)
    items = sorted(items, key=score, reverse=True)
    print(f"V57 POSTFIX: after fix+dedupe={len(items)} removed={len(raw)-len(items)}")

    movies = [x for x in items if x.get("type") == "Фильм"]
    series = [x for x in items if x.get("type") == "Сериал"]
    anime = [x for x in items if x.get("type") == "Аниме"]
    cartoons = [x for x in items if x.get("type") == "Мультфильм"]
    new_items = sorted([x for x in items if int(x.get("year") or 0) >= 2024 and int(float(x.get("votes") or 0)) >= 10], key=lambda x: (int(x.get("year") or 0), score(x)), reverse=True)
    popular = sorted([x for x in items if int(float(x.get("votes") or 0)) >= 1000], key=lambda x: int(float(x.get("votes") or 0)), reverse=True)
    top = sorted([x for x in items if int(float(x.get("votes") or 0)) >= MIN_VOTES_FOR_TOP and float(x.get("rating") or 0) >= 7], key=score, reverse=True)[:250]

    pages = {
        "all": write_pages("all", items),
        "movies": write_pages("movies", movies),
        "series": write_pages("series", series),
        "anime": write_pages("anime", anime),
        "cartoons": write_pages("cartoons", cartoons),
        "new": write_pages("new", new_items),
        "popular": write_pages("popular", popular),
        "top": write_pages("top", top),
    }

    home = {
        "generatedAt": now_iso(),
        "total": len(items),
        "postFixVersion": VERSION,
        "sections": {
            "popular": popular[:HOME_LIMIT],
            "top": top[:HOME_LIMIT],
            "new": new_items[:HOME_LIMIT],
            "anime": anime[:HOME_LIMIT],
            "movies": movies[:HOME_LIMIT],
            "series": series[:HOME_LIMIT],
            "cartoons": cartoons[:HOME_LIMIT],
        }
    }

    genres = sorted({g for x in items for g in (x.get("genres") or [])}, key=lambda x: (GOOD_GENRE_ORDER.index(x) if x in GOOD_GENRE_ORDER else 999, str(x).lower()))
    years = sorted({str(x.get("year")) for x in items if x.get("year")}, reverse=True)
    meta_path = DATA_FAST / "meta.json"
    meta = {}
    if meta_path.exists():
        try:
            meta = load(meta_path)
        except Exception:
            meta = {}
    meta.update({
        "generatedAt": now_iso(),
        "count": len(items),
        "postFixVersion": VERSION,
        "builderVersion": VERSION,
        "dedupeRemovedPostFix": max(0, len(raw) - len(items)),
        "pageSize": PAGE_SIZE,
        "homeLimit": HOME_LIMIT,
        "genres": genres,
        "years": years,
        "pages": pages,
        "checks": {
            "scoobyInAnime": len([x for x in anime if "scooby" in hay(x) or "скуби" in hay(x)]),
            "witchHatInNew": len([x for x in new_items if "witch hat" in hay(x) or "ателье колдовских" in hay(x) or "とんがり帽子" in hay(x)])
        }
    })
    save(DATA_FAST / "search_index.json", items)
    save(DATA_FAST / "home.json", home)
    save(DATA_FAST / "meta.json", meta)
    print("V57 POSTFIX READY")
    print("builderVersion=", VERSION)
    print("anime=", len(anime), "cartoons=", len(cartoons))
    print("scoobyInAnime=", meta["checks"]["scoobyInAnime"])
    print("witchHatInNew=", meta["checks"]["witchHatInNew"])

if __name__ == "__main__":
    main()
