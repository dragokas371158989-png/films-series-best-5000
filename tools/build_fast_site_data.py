import json, os, re, shutil
from pathlib import Path
from datetime import datetime, timezone

DATA_DIR = Path("data")
FAST_DIR = DATA_DIR / "fast"
FAST_TMP_DIR = DATA_DIR / "fast_tmp_build"
INDEX_PATH = DATA_DIR / "index.json"
PAGE_SIZE = int(os.environ.get("GKM_FAST_PAGE_SIZE", "60"))
HOME_LIMIT = int(os.environ.get("GKM_FAST_HOME_LIMIT", "18"))

GENRE_MAP = {
    "10749":"Мелодрама","36":"История",
    "action":"Боевик","adventure":"Приключения","animation":"Мультфильм","anime":"Аниме",
    "comedy":"Комедия","crime":"Криминал","detective":"Детектив","documentary":"Документальный",
    "drama":"Драма","family":"Семейный","fantasy":"Фэнтези","history":"История","historical":"Историческое",
    "horror":"Ужасы","music":"Музыка","mystery":"Детектив","romance":"Мелодрама",
    "sci fi":"Фантастика","sci-fi":"Фантастика","science fiction":"Фантастика","supernatural":"Сверхъестественное",
    "suspense":"Саспенс","thriller":"Триллер","war":"Военный","western":"Вестерн",
    "award winning":"Призовые","gore":"Жесть","gourmet":"Еда","harem":"Гарем","isekai":"Исекай",
    "josei":"Дзёсэй","kids":"Для детей","martial arts":"Боевые искусства","mecha":"Меха",
    "military":"Военное","parody":"Пародия","psychological":"Психология","racing":"Гонки",
    "reincarnation":"Перерождение","samurai":"Самураи","school":"Школа","seinen":"Сэйнэн",
    "shoujo":"Сёдзё","shounen":"Сёнэн","slice of life":"Повседневность","sports":"Спорт",
    "survival":"Выживание","time travel":"Путешествия во времени","vampire":"Вампиры","workplace":"Работа",
    "боевик":"Боевик","боевик и приключения":"Боевик","приключения":"Приключения","аниме":"Аниме",
    "мультфильм":"Мультфильм","комедия":"Комедия","криминал":"Криминал","детектив":"Детектив",
    "документальный":"Документальный","драма":"Драма","семейный":"Семейный","фэнтези":"Фэнтези",
    "нф и фэнтези":"Фантастика","фантастика":"Фантастика","история":"История","ужасы":"Ужасы",
    "музыка":"Музыка","мелодрама":"Мелодрама","триллер":"Триллер","военный":"Военный",
    "вестерн":"Вестерн","реалити шоу":"Реалити-шоу","ток шоу":"Ток-шоу","мыльная опера":"Мыльная опера",
    "новости":"Новости","телевизионный фильм":"Телевизионный фильм","война и политика":"Война и политика",
}
GOOD_GENRE_ORDER = ["Боевик","Приключения","Комедия","Драма","Криминал","Детектив","Фантастика","Фэнтези","Ужасы","Триллер","Мелодрама","История","Военный","Вестерн","Семейный","Документальный","Музыка","Мультфильм","Аниме","Спорт","Сёнэн","Сэйнэн","Сёдзё","Исекай","Повседневность","Психология","Сверхъестественное","Школа"]

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
def load_json(path):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"SKIP unreadable {path}: {e}"); return None
def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
def clean_text(v): return re.sub(r"\s+"," ",str(v or "")).strip()
def norm(v): return re.sub(r"[^\wа-яА-ЯёЁ]+"," ",str(v or "").lower().replace("ё","е")).strip()

def extract_items(data):
    if isinstance(data, list): return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("movies","items","data","results","records","list"):
            if isinstance(data.get(k), list): return [x for x in data[k] if isinstance(x, dict)]
    return []

def chunk_candidates(entry):
    raw = entry if isinstance(entry, str) else (entry.get("file") or entry.get("path") or entry.get("url") or entry.get("src") or entry.get("name") or "" if isinstance(entry, dict) else "")
    raw = str(raw or "").strip().replace("\\","/").lstrip("/")
    if not raw: return []
    name = Path(raw).name
    c = []
    def add(p):
        if p not in c: c.append(p)
    add(Path(raw) if raw.startswith("data/") else DATA_DIR / raw)
    if raw.startswith("chunks/"): add(DATA_DIR / raw)
    if re.match(r"chunk_\d+\.json$", name, re.I):
        add(DATA_DIR / name)
        add(DATA_DIR / "chunks" / name)
    return c

def find_chunk_files():
    index = load_json(INDEX_PATH)
    result = []
    if isinstance(index, dict) and isinstance(index.get("chunks"), list):
        for entry in index["chunks"]:
            for p in chunk_candidates(entry):
                if p.exists():
                    result.append(p); break
    if not result:
        for pattern in ("chunk_*.json","chunks/chunk_*.json"):
            result.extend([p for p in DATA_DIR.glob(pattern) if p.is_file()])
    seen, unique = set(), []
    for p in result:
        if str(p) not in seen:
            seen.add(str(p)); unique.append(p)
    def sk(p):
        m = re.search(r"chunk_(\d+)\.json$", p.name, re.I)
        return int(m.group(1)) if m else 999999
    return sorted(unique, key=sk)

def normalize_genre(g):
    raw = clean_text(g)
    if not raw: return ""
    key = norm(raw)
    if key.isdigit() and key not in GENRE_MAP: return ""
    return GENRE_MAP.get(key, raw[:1].upper()+raw[1:])

def genres_of(item):
    genres = item.get("genres") or item.get("genre") or item.get("genresRu") or []
    if isinstance(genres, list):
        genres = [(g.get("genre") or g.get("name") or g.get("title") or "") if isinstance(g, dict) else g for g in genres]
    elif isinstance(genres, str):
        genres = re.split(r"[,;/|·]+", genres)
    else:
        genres = []
    out, seen = [], set()
    for g in genres:
        ng = normalize_genre(g)
        if not ng: continue
        k = norm(ng)
        if k not in seen:
            seen.add(k); out.append(ng)
    return out[:8]

def title_of(item): return clean_text(item.get("ru") or item.get("title") or item.get("name") or item.get("nameRu") or item.get("nameEn") or item.get("en") or item.get("originalTitle") or item.get("titleOriginal") or item.get("nameOriginal") or "")
def en_of(item): return clean_text(item.get("en") or item.get("nameEn") or item.get("originalTitle") or item.get("titleOriginal") or item.get("nameOriginal") or "")
def year_of(item):
    m = re.search(r"(19\d{2}|20\d{2})", clean_text(item.get("year") or item.get("release_date") or item.get("first_air_date") or item.get("premiereRu") or item.get("premiereWorld") or ""))
    return m.group(1) if m else ""
def rating_of(item):
    for k in ("rating","vote_average","ratingKinopoisk","ratingImdb","score"):
        try:
            if item.get(k) not in (None,""): return round(float(item.get(k)),2)
        except Exception: pass
    return 0.0
def votes_of(item):
    for k in ("votes","vote_count","ratingVoteCount","kinopoiskVotes","imdbVotes"):
        try:
            if item.get(k) not in (None,""): return int(float(item.get(k)))
        except Exception: pass
    return 0
def type_of(item):
    low = norm(item.get("type") or item.get("kind") or item.get("category") or "")
    source = norm(item.get("source") or item.get("provider") or "")
    text = " ".join([low, source, " ".join(norm(g) for g in genres_of(item)), norm(title_of(item)), norm(en_of(item))])
    if "аниме" in text or "anime" in text or "jikan" in source or "myanimelist" in source: return "Аниме"
    if "мульт" in text or low in {"animation","cartoon"}: return "Мультфильм"
    if "сериал" in text or low in {"tv","series","tv series"}: return "Сериал"
    return "Фильм"
def poster_of(item): return clean_text(item.get("poster") or item.get("posterUrl") or item.get("poster_url") or item.get("image") or item.get("imageUrl") or item.get("poster_path") or item.get("cover") or "")
def overview_of(item):
    for k in ("overview_ru","ruOverview","description_ru","descriptionRu","description","overview","synopsis","shortDescription"):
        v=clean_text(item.get(k))
        if v: return v
    return ""
def stable_id(item, i):
    for k in ("id","uid","tmdbId","tmdb_id","kinopoiskId","filmId","mal_id","malId","shikimori_id"):
        if item.get(k) not in (None,""): return str(item.get(k))
    return "gkm_"+str(i)
def pick_extra(item):
    extra={}
    for k in ("player","playerUrl","video","videoUrl","url","src","iframe","rutube","watchUrl","watch","trailer","trailerUrl","players","videoLinks","links","sources","episodes","episodeCount","status","studio","studios","country","countries","ageRating","age","source","tmdbId","tmdb_id","kinopoiskId","filmId","mal_id","malId","shikimori_id","shikimoriId"):
        if k in item and item[k] not in (None,"",[],{}): extra[k]=item[k]
    return extra

def infer_ai_tags(item, title, en, genres, overview, item_type):
    text = norm(" ".join([title, en, item_type, " ".join(genres), overview, str(item.get("source") or "")]))
    tags = set()
    moods = set()
    rec = set()

    def has_any(words):
        return any(norm(w) in text for w in words)

    # TYPE
    if item_type == "Аниме":
        tags.add("anime")
    elif item_type == "Сериал":
        tags.add("series")
    elif item_type == "Мультфильм":
        tags.add("cartoons")
    else:
        tags.add("movies")

    # THEMES / RECOMMENDER TAGS
    if has_any(["исекай", "isekai", "другой мир", "another world", "parallel world", "перерождение", "реинкарнация", "reincarnation", "summoned", "призван"]):
        tags.add("isekai")
        rec.add("попаданцы")

    # title aliases for isekai/popadantsy
    isekai_titles = [
        "re zero", "rezero", "starting life in another world", "mushoku", "jobless reincarnation",
        "slime", "tensei shitara", "reincarnated as a slime", "overlord", "konosuba",
        "sword art online", "shield hero", "tate no yuusha", "tsukimichi", "no game no life",
        "log horizon", "eminence in shadow", "kage no jitsuryokusha", "arifureta", "cautious hero",
        "youjo senki", "moonlit fantasy", "farming life in another world", "death march",
        "parallel world", "world's finest assassin", "ascendance of a bookworm", "grimgar",
        "problem children", "black summoner", "skeleton knight", "campfire cooking"
    ]
    if any(norm(x) in text for x in isekai_titles):
        tags.add("isekai")
        rec.add("попаданцы")

    if has_any(["сильный герой", "overpowered", "op", "прокачка", "leveling", "уровни", "непобедимый", "one punch", "solo leveling"]):
        tags.add("opmc")
        rec.add("сильный герой")

    if has_any(["магия", "magic", "волшеб", "академия", "заклинание"]):
        tags.add("magic")

    if has_any(["сёнэн", "сенэн", "shounen", "боевик", "экшен", "action", "martial arts", "боевые искусства"]):
        tags.add("action")
        rec.add("экшен")

    if has_any(["психология", "psychological", "детектив", "detective", "mystery", "mind game", "тайна", "расследование"]):
        tags.add("smart")
        rec.add("умный сюжет")

    if has_any(["ужасы", "horror", "триллер", "thriller", "саспенс", "suspense", "кровь", "gore"]):
        tags.add("dark")
        moods.add("мрачное")

    if has_any(["комедия", "comedy", "пародия", "parody", "повседневность", "slice of life"]):
        tags.add("funny")
        moods.add("лёгкое")

    if has_any(["романс", "романтика", "romance", "мелодрама", "любовь"]):
        tags.add("romance")
        moods.add("романтика")

    if has_any(["космос", "space", "галактика", "interstellar", "sci fi", "science fiction", "фантастика"]):
        tags.add("space")

    if has_any(["выживание", "survival", "зомби", "апокалипсис", "игра на смерть", "death game"]):
        tags.add("survival")

    if has_any(["спорт", "sports", "football", "basketball", "volleyball", "boxing"]):
        tags.add("sport")

    if has_any(["меха", "mecha", "робот", "robot", "gundam"]):
        tags.add("mecha")

    if has_any(["гарем", "harem"]):
        tags.add("harem")

    if has_any(["школа", "school", "академия", "student"]):
        tags.add("school")

    if has_any(["семейный", "family", "детям", "kids", "для детей"]):
        tags.add("family")

    # MOOD BY GENRE
    if has_any(["фэнтези", "fantasy", "приключения", "adventure"]):
        moods.add("приключения")
    if has_any(["драма", "drama"]):
        moods.add("драма")


    if has_any(["детектив", "detective", "расследование", "mystery"]):
        tags.add("detective")
        tags.add("smart")

    if has_any(["киберпанк", "cyberpunk", "роботы", "android", "андроид"]):
        tags.add("cyberpunk")
        tags.add("dystopia")

    if has_any(["музыка", "music", "группа", "band", "idol"]):
        tags.add("music")

    if has_any(["еда", "кулинария", "cooking", "gourmet"]):
        tags.add("food")
        moods.add("лёгкое")


    return sorted(tags), sorted(moods), sorted(rec)


def infer_ai_words(title, en, genres, overview, ai_tags, mood_tags, rec_tags):
    text = norm(" ".join([title, en, " ".join(genres), overview, " ".join(ai_tags), " ".join(mood_tags), " ".join(rec_tags)]))
    words = []
    seen = set()

    for w in text.split():
        w = w.strip()
        if len(w) < 3:
            continue
        if w.isdigit():
            continue
        if w in seen:
            continue
        seen.add(w)
        words.append(w)
        if len(words) >= 60:
            break

    return words


def make_rec_text(title, en, genres, overview, ai_tags, mood_tags, rec_tags, ai_words):
    parts = [title, en, " ".join(genres), " ".join(ai_tags), " ".join(mood_tags), " ".join(rec_tags), " ".join(ai_words), overview[:260]]
    return clean_text(" ".join(str(x or "") for x in parts))[:900]


def quality_tier(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    if rating >= 8.7 and votes >= 10000:
        return "legend"
    if rating >= 8.2 and votes >= 1000:
        return "top"
    if rating >= 7.5 and votes >= 300:
        return "good"
    if votes < 30 and rating >= 9:
        return "risky"
    return "normal"

def recommender_score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    year = int(item.get("year") or 0)
    score = rating * 10 + min(votes, 500000) / 500000 * 20
    if item.get("poster"):
        score += 4
    if year >= 2015:
        score += 2
    if year >= 2020:
        score += 2
    if votes < 30 and rating >= 9:
        score -= 30
    return round(score, 3)


def popularity_tier(item):
    votes = int(item.get("votes") or 0)
    if votes >= 100000:
        return "mega"
    if votes >= 10000:
        return "popular"
    if votes >= 1000:
        return "known"
    if votes >= 100:
        return "small"
    return "unknown"


def content_quality_flags(item):
    flags = []
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    if rating >= 8.5 and votes >= 10000:
        flags.append("must_watch")
    if rating >= 8.0 and votes >= 1000:
        flags.append("safe_pick")
    if votes < 50:
        flags.append("low_votes")
    if item.get("poster"):
        flags.append("has_poster")
    return flags


def neuro_vector(item):
    vec = []
    for key in ["type", "qualityTier", "popularityTier"]:
        v = item.get(key)
        if v:
            vec.append(str(v))
    vec += item.get("aiTags", [])[:10]
    vec += item.get("moodTags", [])[:8]
    vec += item.get("recTags", [])[:8]
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    year = int(item.get("year") or 0)
    if rating >= 8.5:
        vec.append("high_rating")
    if votes >= 10000:
        vec.append("many_votes")
    if year >= 2020:
        vec.append("modern")
    elif year and year < 2005:
        vec.append("classic")
    return sorted(set(vec))


def decade_of(item):
    y = int(item.get("year") or 0)
    if not y:
        return ""
    return str((y // 10) * 10) + "s"

def omega_text(item):
    parts = [
        item.get("ru", ""),
        item.get("en", ""),
        item.get("type", ""),
        decade_of(item),
        item.get("qualityTier", ""),
        item.get("popularityTier", ""),
        " ".join(item.get("qualityFlags", [])),
        " ".join(item.get("neuroVector", [])),
        " ".join(item.get("aiTags", [])),
        " ".join(item.get("moodTags", [])),
        " ".join(item.get("recTags", [])),
        " ".join(item.get("genres", [])),
    ]
    return clean_text(" ".join(str(x or "") for x in parts))[:700]


def apex_text(item):
    parts = [
        item.get("omegaText", ""),
        item.get("decade", ""),
        item.get("qualityTier", ""),
        item.get("popularityTier", ""),
        " ".join(item.get("qualityFlags", [])),
        " ".join(item.get("neuroVector", [])),
    ]
    # Короткие подсказки для помощника
    if item.get("qualityTier") in ("legend", "top"):
        parts.append("годное без шлака recommended")
    if item.get("popularityTier") in ("mega", "popular"):
        parts.append("популярное известное")
    return clean_text(" ".join(str(x or "") for x in parts))[:800]


def supreme_text(item):
    parts = [
        item.get("apexText", ""),
        item.get("omegaText", ""),
        item.get("qualityTier", ""),
        item.get("popularityTier", ""),
        " ".join(item.get("qualityFlags", [])),
        " ".join(item.get("neuroVector", [])),
        item.get("decade", "")
    ]
    if item.get("qualityTier") in ("legend", "top") and item.get("popularityTier") in ("mega", "popular"):
        parts.append("supreme_best_choice")
    if "low_votes" not in item.get("qualityFlags", []):
        parts.append("reliable")
    return clean_text(" ".join(str(x or "") for x in parts))[:900]


def risk_level(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    if votes < 30:
        return "high_risk"
    if votes < 300:
        return "medium_risk"
    if rating >= 8 and votes >= 1000:
        return "low_risk"
    return "normal_risk"

def ultra_text(item):
    parts = [
        item.get("supremeText", ""),
        item.get("apexText", ""),
        item.get("omegaText", ""),
        item.get("riskLevel", ""),
        item.get("qualityTier", ""),
        item.get("popularityTier", ""),
        " ".join(item.get("qualityFlags", [])),
        " ".join(item.get("neuroVector", [])),
    ]
    if item.get("riskLevel") == "low_risk":
        parts.append("без риска надежный выбор")
    if item.get("qualityTier") == "legend":
        parts.append("легенда must watch")
    if item.get("popularityTier") == "small" and item.get("qualityTier") in ("good", "top"):
        parts.append("скрытая жемчужина underrated")
    return clean_text(" ".join(str(x or "") for x in parts))[:1000]


def final_score_band(item):
    s = float(item.get("recScore") or 0)
    if s >= 105:
        return "s_plus"
    if s >= 92:
        return "s"
    if s >= 80:
        return "a"
    if s >= 65:
        return "b"
    return "c"

def infinity_text(item):
    parts = [
        item.get("ultraText", ""),
        item.get("supremeText", ""),
        item.get("apexText", ""),
        item.get("riskLevel", ""),
        item.get("scoreBand", ""),
        item.get("qualityTier", ""),
        item.get("popularityTier", ""),
    ]
    if item.get("scoreBand") in ("s_plus", "s"):
        parts.append("infinity_best top choice")
    if item.get("riskLevel") == "low_risk":
        parts.append("safe reliable")
    return clean_text(" ".join(str(x or "") for x in parts))[:1100]


def absolute_rank(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    rec = float(item.get("recScore") or 0)
    risk = item.get("riskLevel") or ""
    band = item.get("scoreBand") or ""
    score = rec
    if risk == "low_risk":
        score += 8
    if band in ("s_plus", "s"):
        score += 10
    if rating >= 8.5 and votes >= 10000:
        score += 12
    if votes < 50:
        score -= 25
    return round(score, 3)

def absolute_text(item):
    parts = [
        item.get("infinityText", ""),
        item.get("ultraText", ""),
        item.get("supremeText", ""),
        item.get("scoreBand", ""),
        item.get("riskLevel", ""),
        str(item.get("absoluteRank", "")),
    ]
    rank = float(item.get("absoluteRank") or 0)
    if rank >= 120:
        parts.append("absolute_god_pick")
    elif rank >= 100:
        parts.append("absolute_strong_pick")
    if item.get("riskLevel") == "high_risk":
        parts.append("warning risky")
    return clean_text(" ".join(str(x or "") for x in parts))[:1200]


def card_item(raw, i):
    x={"id":stable_id(raw,i),"ru":title_of(raw),"en":en_of(raw),"year":year_of(raw),"type":type_of(raw),"rating":rating_of(raw),"votes":votes_of(raw),"poster":poster_of(raw),"backdrop":clean_text(raw.get("backdrop") or ""),"genres":genres_of(raw),"overview":overview_of(raw)}
    x.update(pick_extra(raw))
    x["source"]=clean_text(x.get("source") or raw.get("provider") or "")
    x["episodes"]=x.get("episodes") or x.get("episodeCount") or ""
    x["studio"]=x.get("studio") or x.get("studios") or ""
    x["country"]=x.get("country") or x.get("countries") or ""
    x["ageRating"]=x.get("ageRating") or x.get("age") or ""
    ai_tags, mood_tags, rec_tags = infer_ai_tags(raw, x["ru"], x["en"], x["genres"], x["overview"], x["type"])
    x["aiTags"] = ai_tags
    x["moodTags"] = mood_tags
    x["recTags"] = rec_tags
    x["aiWords"] = infer_ai_words(x["ru"], x["en"], x["genres"], x["overview"], ai_tags, mood_tags, rec_tags)
    x["recText"] = make_rec_text(x["ru"], x["en"], x["genres"], x["overview"], ai_tags, mood_tags, rec_tags, x["aiWords"])
    x["qualityTier"] = quality_tier(x)
    x["popularityTier"] = popularity_tier(x)
    x["recScore"] = recommender_score(x)
    x["qualityFlags"] = content_quality_flags(x)
    x["neuroVector"] = neuro_vector(x)
    x["decade"] = decade_of(x)
    x["omegaText"] = omega_text(x)
    x["apexText"] = apex_text(x)
    x["supremeText"] = supreme_text(x)
    x["riskLevel"] = risk_level(x)
    x["scoreBand"] = final_score_band(x)
    x["ultraText"] = ultra_text(x)
    x["infinityText"] = infinity_text(x)
    x["absoluteRank"] = absolute_rank(x)
    x["absoluteText"] = absolute_text(x)
    return x

def smart_score(x):
    r, v, y = float(x.get("rating") or 0), int(x.get("votes") or 0), int(x.get("year") or 0)
    if v < 30: return r - 25
    return r*10 + min(v,80000)/80000*5 + (0.35 if y>=2010 else 0)
def quality(x): return int(x.get("votes") or 0)*100 + float(x.get("rating") or 0)*1000 + (10000 if x.get("poster") else 0) + len(x.get("overview") or "")

def collect_items():
    chunks=find_chunk_files()
    print(f"Resolved chunks: {len(chunks)}")
    raw=[]
    for p in chunks:
        data=load_json(p)
        items=extract_items(data)
        print(f"{p}: {len(items)}")
        raw.extend(items)
    return raw

def dedupe(raw_items):
    best, skipped = {}, 0
    for i, raw in enumerate(raw_items):
        item=card_item(raw,i)
        tk=norm(item.get("ru") or item.get("en"))
        if not tk:
            skipped += 1; continue
        key=item["type"]+"|"+tk
        if key not in best or quality(item)>quality(best[key]): best[key]=item
    print(f"Skipped without title: {skipped}")
    return list(best.values())

def write_pages(base, tab, items):
    d=base/"pages"/tab
    d.mkdir(parents=True, exist_ok=True)
    pages=max(1,(len(items)+PAGE_SIZE-1)//PAGE_SIZE)
    for page in range(1,pages+1):
        save_json(d/f"page_{page:04d}.json", {"tab":tab,"page":page,"pages":pages,"count":len(items),"pageSize":PAGE_SIZE,"items":items[(page-1)*PAGE_SIZE:page*PAGE_SIZE]})
    return {"count":len(items),"pages":pages,"pageSize":PAGE_SIZE}

def main():
    raw=collect_items()
    print(f"Raw items: {len(raw)}")
    items=dedupe(raw)
    print(f"After dedupe: {len(items)}")
    if len(items)<=0: raise SystemExit("ERROR: 0 items. Refusing to overwrite existing data/fast.")
    if FAST_TMP_DIR.exists(): shutil.rmtree(FAST_TMP_DIR)
    FAST_TMP_DIR.mkdir(parents=True, exist_ok=True)
    genres_all=sorted({g for x in items for g in x.get("genres",[])}, key=lambda x:(GOOD_GENRE_ORDER.index(x) if x in GOOD_GENRE_ORDER else 999, x.lower()))
    years=sorted({x.get("year") for x in items if x.get("year")}, reverse=True)
    by=lambda seq: sorted(seq, key=smart_score, reverse=True)
    all_sorted=by(items)
    movies=by([x for x in items if x["type"]=="Фильм"])
    series=by([x for x in items if x["type"]=="Сериал"])
    anime=by([x for x in items if x["type"]=="Аниме"])
    cartoons=by([x for x in items if x["type"]=="Мультфильм"])
    new_items=sorted([x for x in items if int(x.get("year") or 0)>=2024 and int(x.get("votes") or 0)>=10], key=lambda x:(int(x.get("year") or 0), smart_score(x)), reverse=True)
    popular=sorted([x for x in items if int(x.get("votes") or 0)>=1000], key=lambda x:int(x.get("votes") or 0), reverse=True)
    top=by([x for x in items if int(x.get("votes") or 0)>=300 and float(x.get("rating") or 0)>=7])
    pages={"all":write_pages(FAST_TMP_DIR,"all",all_sorted),"movies":write_pages(FAST_TMP_DIR,"movies",movies),"series":write_pages(FAST_TMP_DIR,"series",series),"anime":write_pages(FAST_TMP_DIR,"anime",anime),"cartoons":write_pages(FAST_TMP_DIR,"cartoons",cartoons),"new":write_pages(FAST_TMP_DIR,"new",new_items),"popular":write_pages(FAST_TMP_DIR,"popular",popular),"top":write_pages(FAST_TMP_DIR,"top",top[:250])}
    home={"generatedAt":now_iso(),"total":len(items),"sections":{"popular":popular[:HOME_LIMIT],"top":top[:HOME_LIMIT],"new":new_items[:HOME_LIMIT],"anime":anime[:HOME_LIMIT],"movies":movies[:HOME_LIMIT],"series":series[:HOME_LIMIT],"cartoons":cartoons[:HOME_LIMIT]}}
    search_index=[{"id":x.get("id"),"ru":x.get("ru"),"en":x.get("en"),"year":x.get("year"),"type":x.get("type"),"rating":x.get("rating"),"votes":x.get("votes"),"poster":x.get("poster"),"genres":x.get("genres",[])[:6],"overview":(x.get("overview") or "")[:180],"source":x.get("source"),"aiTags":x.get("aiTags",[])[:8],"moodTags":x.get("moodTags",[])[:6],"recTags":x.get("recTags",[])[:6],"aiWords":x.get("aiWords",[])[:40],"recText":(x.get("recText") or "")[:420],"qualityTier":x.get("qualityTier"),"popularityTier":x.get("popularityTier"),"recScore":x.get("recScore"),"qualityFlags":x.get("qualityFlags",[]),"neuroVector":x.get("neuroVector",[])[:25],"decade":x.get("decade"),"omegaText":(x.get("omegaText") or "")[:350],"apexText":(x.get("apexText") or "")[:350],"supremeText":(x.get("supremeText") or "")[:350],"riskLevel":x.get("riskLevel"),"ultraText":(x.get("ultraText") or "")[:350],"scoreBand":x.get("scoreBand"),"infinityText":(x.get("infinityText") or "")[:350],"absoluteRank":x.get("absoluteRank"),"absoluteText":(x.get("absoluteText") or "")[:350]} for x in all_sorted]
    meta={"generatedAt":now_iso(),"rawCount":len(raw),"count":len(items),"pageSize":PAGE_SIZE,"homeLimit":HOME_LIMIT,"genres":genres_all,"years":years,"pages":pages}
    save_json(FAST_TMP_DIR/"home.json", home)
    save_json(FAST_TMP_DIR/"search_index.json", search_index)
    save_json(FAST_TMP_DIR/"meta.json", meta)
    if FAST_DIR.exists(): shutil.rmtree(FAST_DIR)
    FAST_TMP_DIR.rename(FAST_DIR)
    print("FAST DATA READY")
    print(f"rawCount={len(raw)}")
    print(f"count={len(items)}")
    print(f"pages_all={pages['all']['pages']}")
if __name__=="__main__": main()
