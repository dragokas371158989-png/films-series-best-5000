import json, os, re, shutil, math
from pathlib import Path
from datetime import datetime, timezone

DATA_DIR = Path("data")
FAST_DIR = DATA_DIR / "fast"
FAST_TMP_DIR = DATA_DIR / "fast_tmp_build"
INDEX_PATH = DATA_DIR / "index.json"

PAGE_SIZE = int(os.environ.get("GKM_FAST_PAGE_SIZE", "60"))
HOME_LIMIT = int(os.environ.get("GKM_FAST_HOME_LIMIT", "18"))
MIN_VOTES_FOR_TOP = int(os.environ.get("GKM_MIN_VOTES_FOR_TOP", "300"))
SEARCH_LITE_LIMIT = int(os.environ.get("GKM_SEARCH_LITE_LIMIT", "15000"))
TMDB_ENABLED = False
TMDB_OFF_VERSION = "v101-full-fast-search-kinopoisk-data-2026-06-17"

GENRE_MAP = {
    "10749":"Мелодрама","36":"История","28":"Боевик","12":"Приключения","16":"Мультфильм","35":"Комедия","80":"Криминал",
    "99":"Документальный","18":"Драма","10751":"Семейный","14":"Фэнтези","27":"Ужасы","10402":"Музыка","9648":"Детектив",
    "878":"Фантастика","10770":"Телевизионный фильм","53":"Триллер","10752":"Военный","37":"Вестерн",
    "action":"Боевик","adventure":"Приключения","animation":"Мультфильм","anime":"Аниме","comedy":"Комедия",
    "crime":"Криминал","detective":"Детектив","documentary":"Документальный","drama":"Драма","family":"Семейный",
    "fantasy":"Фэнтези","history":"История","historical":"Историческое","horror":"Ужасы","music":"Музыка","mystery":"Детектив",
    "romance":"Мелодрама","sci fi":"Фантастика","sci-fi":"Фантастика","science fiction":"Фантастика","supernatural":"Сверхъестественное",
    "suspense":"Саспенс","thriller":"Триллер","war":"Военный","western":"Вестерн",
    "award winning":"Призовые","gore":"Жесть","gourmet":"Еда","harem":"Гарем","isekai":"Исекай","josei":"Дзёсэй",
    "kids":"Для детей","martial arts":"Боевые искусства","mecha":"Меха","military":"Военное","parody":"Пародия",
    "psychological":"Психология","racing":"Гонки","reincarnation":"Перерождение","samurai":"Самураи","school":"Школа",
    "seinen":"Сэйнэн","shoujo":"Сёдзё","shounen":"Сёнэн","slice of life":"Повседневность","sports":"Спорт",
    "survival":"Выживание","time travel":"Путешествия во времени","vampire":"Вампиры","workplace":"Работа",
    "боевик":"Боевик","боевик и приключения":"Боевик","приключения":"Приключения","аниме":"Аниме","мультфильм":"Мультфильм",
    "комедия":"Комедия","криминал":"Криминал","детектив":"Детектив","документальный":"Документальный","драма":"Драма",
    "семейный":"Семейный","фэнтези":"Фэнтези","нф и фэнтези":"Фантастика","фантастика":"Фантастика","история":"История",
    "ужасы":"Ужасы","музыка":"Музыка","мелодрама":"Мелодрама","триллер":"Триллер","военный":"Военный","вестерн":"Вестерн",
    "реалити шоу":"Реалити-шоу","ток шоу":"Ток-шоу","мыльная опера":"Мыльная опера","новости":"Новости",
    "телевизионный фильм":"Телевизионный фильм","война и политика":"Война и политика","экшен":"Экшен",
}

GOOD_GENRE_ORDER = [
    "Боевик","Приключения","Комедия","Драма","Криминал","Детектив","Фантастика","Фэнтези","Ужасы","Триллер",
    "Мелодрама","История","Военный","Вестерн","Семейный","Документальный","Музыка","Мультфильм","Аниме",
    "Спорт","Сёнэн","Сэйнэн","Сёдзё","Исекай","Повседневность","Психология","Сверхъестественное","Школа"
]

# Русские названия/алиасы. Это правится в билдере, а не в браузере.
TITLE_RULES = [
    ("witch hat atelier", "Ателье колдовских колпаков", ["atelier of witch hat","tongari boushi no atelier","とんがり帽子のアトリエ","ателье колдовских колпаков"]),
    ("oshi no ko", "Звёздное дитя", ["推しの子","звездное дитя","звёздное дитя"]),
    ("re zero", "Re:Zero. Жизнь с нуля в альтернативном мире", ["re:zero","starting life in another world","ре зеро"]),
    ("jujutsu kaisen", "Магическая битва", ["дзюдзюцу кайсен","呪術廻戦","магическая битва"]),
    ("demon slayer", "Истребитель демонов", ["kimetsu no yaiba","鬼滅の刃","клинок рассекающий демонов","истребитель демонов"]),
    ("attack on titan", "Атака титанов", ["shingeki no kyojin","進撃の巨人","атака титанов"]),
    ("naruto shippuden", "Наруто: Ураганные хроники", ["наруто ураганные хроники"]),
    ("naruto", "Наруто", ["наруто"]),
    ("boruto", "Боруто", ["боруто"]),
    ("one piece", "Ван-Пис", ["ван пис","ванпис","ван-пис"]),
    ("bleach thousand year blood war", "Блич: Тысячелетняя кровавая война", ["tybw"]),
    ("bleach", "Блич", ["блич"]),
    ("that time i got reincarnated as a slime", "О моём перерождении в слизь", ["tensei shitara slime","reincarnated as a slime","слизь"]),
    ("frieren", "Провожающая в последний путь Фрирен", ["sousou no frieren","фрирен"]),
    ("fullmetal alchemist brotherhood", "Стальной алхимик: Братство", ["fma brotherhood"]),
    ("fullmetal alchemist", "Стальной алхимик", ["fma"]),
    ("hunter x hunter", "Охотник х Охотник", ["hxh"]),
    ("chainsaw man", "Человек-бензопила", ["бензопила"]),
    ("death note", "Тетрадь смерти", ["тетрадь смерти"]),
    ("solo leveling", "Поднятие уровня в одиночку", ["соло левелинг"]),
    ("one punch man", "Ванпанчмен", ["ванпанчмен"]),
    ("my hero academia", "Моя геройская академия", ["boku no hero academia"]),
    ("sword art online", "Мастера меча онлайн", ["sao"]),
    ("tokyo ghoul", "Токийский гуль", ["гуль"]),
    ("black clover", "Чёрный клевер", []),
    ("fairy tail", "Хвост Феи", []),
    ("spy x family", "Семья шпиона", []),
    ("blue lock", "Синяя тюрьма", []),
    ("haikyuu", "Волейбол!!", ["haikyu"]),
    ("violet evergarden", "Вайолет Эвергарден", []),
    ("made in abyss", "Созданный в Бездне", []),
    ("goblin slayer", "Убийца гоблинов", []),
    ("the eminence in shadow", "Восхождение в тени", ["kage no jitsuryokusha"]),
    ("the rising of the shield hero", "Восхождение героя щита", ["shield hero","tate no yuusha"]),
    ("no game no life", "Нет игры — нет жизни", []),
    ("overlord", "Повелитель", []),
    ("konosuba", "Этот замечательный мир!", []),
    ("classroom of the elite", "Добро пожаловать в класс превосходства", ["youkoso jitsuryoku"]),
    ("pokemon", "Покемон", []),
    ("digimon", "Дигимон", []),
    ("jojo", "Невероятные приключения ДжоДжо", ["jojo's bizarre adventure","jojos bizarre adventure"]),
    ("cowboy bebop", "Ковбой Бибоп", []),
    ("samurai champloo", "Самурай Чамплу", []),
    ("neon genesis evangelion", "Евангелион", ["evangelion"]),
    ("code geass", "Код Гиас", []),
    ("steins gate", "Врата Штейна", ["steins;gate"]),
    ("parasyte", "Паразит", ["kiseijuu"]),
    ("mob psycho", "Моб Психо 100", []),
    ("vinland saga", "Сага о Винланде", []),
    ("dr stone", "Доктор Стоун", ["dr. stone"]),
    ("hells paradise", "Адский рай", ["hell's paradise","jigokuraku"]),
    ("your name", "Твоё имя", ["kimi no na wa"]),
    ("weathering with you", "Дитя погоды", ["tenki no ko"]),
    ("suzume", "Судзумэ, закрывающая двери", []),
    ("initial d", "Инициал Ди", []),
    ("inuyasha", "Инуяша", []),
]

# Западные мультфильмы. Они никогда не должны попадать в Аниме.
WESTERN_CARTOON_RULES = [
    ("scooby", "Мультфильм"), ("скуби", "Мультфильм"), ("lego scooby", "Мультфильм"),
    ("tom and jerry", "Мультфильм"), ("том и джерри", "Мультфильм"),
    ("looney tunes", "Мультфильм"), ("bugs bunny", "Мультфильм"),
    ("spongebob", "Мультфильм"), ("sponge bob", "Мультфильм"), ("губка боб", "Мультфильм"),
    ("simpsons", "Мультфильм"), ("симпсоны", "Мультфильм"),
    ("family guy", "Мультфильм"), ("griffins", "Мультфильм"), ("гриффины", "Мультфильм"),
    ("south park", "Мультфильм"), ("южный парк", "Мультфильм"),
    ("rick and morty", "Мультфильм"), ("рик и морти", "Мультфильм"),
    ("regular show", "Мультфильм"), ("обычный мультик", "Мультфильм"),
    ("adventure time", "Мультфильм"), ("время приключений", "Мультфильм"),
    ("gravity falls", "Мультфильм"), ("гравити фолз", "Мультфильм"),
    ("steven universe", "Мультфильм"), ("clarence", "Мультфильм"),
    ("teen titans", "Мультфильм"), ("юные титаны", "Мультфильм"),
    ("powerpuff girls", "Мультфильм"), ("суперкрошки", "Мультфильм"),
    ("my little pony", "Мультфильм"), ("pony", "Мультфильм"),
    ("disney", "Мультфильм"), ("pixar", "Мультфильм"), ("dreamworks", "Мультфильм"),
]

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"SKIP unreadable {path}: {e}")
        return None

def save_json(path, data, pretty=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if pretty:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def clean_text(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()

def has_cyr(v):
    return bool(re.search(r"[а-яА-ЯёЁ]", str(v or "")))

def norm(v):
    s = str(v or "").lower().replace("ё", "е")
    s = re.sub(r"\s*\(\d{4}\)\s*", " ", s)
    s = re.sub(r"[^\wа-яА-ЯёЁ一-龯ぁ-ゔァ-ヴー々〆〤]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def norm_latin(v):
    s = str(v or "").lower().replace("ё", "е")
    s = re.sub(r"\b(tv|ona|ova|movie|special|season|part)\b", " ", s)
    s = re.sub(r"[^0-9a-zа-яё一-龯ぁ-ゔァ-ヴー々〆〤]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def extract_items(data):
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for k in ("movies", "items", "data", "results", "records", "list"):
            if isinstance(data.get(k), list):
                return [x for x in data[k] if isinstance(x, dict)]
    return []

def chunk_candidates(entry):
    raw = entry if isinstance(entry, str) else (entry.get("file") or entry.get("path") or entry.get("url") or entry.get("src") or entry.get("name") or "" if isinstance(entry, dict) else "")
    raw = str(raw or "").strip().replace("\\", "/").lstrip("/")
    if not raw:
        return []
    name = Path(raw).name
    c = []
    def add(p):
        if p not in c:
            c.append(p)
    add(Path(raw) if raw.startswith("data/") else DATA_DIR / raw)
    if raw.startswith("chunks/"):
        add(DATA_DIR / raw)
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
                    result.append(p)
                    break
    if not result:
        for pattern in ("chunk_*.json", "chunks/chunk_*.json"):
            result.extend([p for p in DATA_DIR.glob(pattern) if p.is_file()])
    seen, unique = set(), []
    for p in result:
        if str(p) not in seen:
            seen.add(str(p))
            unique.append(p)
    def sk(p):
        m = re.search(r"chunk_(\d+)\.json$", p.name, re.I)
        return int(m.group(1)) if m else 999999
    return sorted(unique, key=sk)

def normalize_genre(g):
    raw = clean_text(g)
    if not raw:
        return ""
    key = norm(raw)
    if key.isdigit() and key not in GENRE_MAP:
        return ""
    return GENRE_MAP.get(key, raw[:1].upper() + raw[1:])

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
        if not ng:
            continue
        k = norm(ng)
        if k not in seen:
            seen.add(k)
            out.append(ng)
    return out[:8]

def all_names(item):
    keys = ("ru","title","name","nameRu","nameEn","en","originalTitle","titleOriginal","nameOriginal","original_title","english","japanese","romaji","title_ru","ruTitle")
    vals = [clean_text(item.get(k)) for k in keys if clean_text(item.get(k))]
    for k in ("aliases", "names", "alt_titles", "alternative_titles"):
        arr = item.get(k)
        if isinstance(arr, list):
            for x in arr:
                if isinstance(x, str):
                    vals.append(clean_text(x))
                elif isinstance(x, dict):
                    vals.append(clean_text(x.get("title") or x.get("name") or x.get("value")))
    return [v for v in vals if v]

def title_rule_for(item):
    hay = norm_latin(" ".join(all_names(item)))
    best = None
    best_len = 0
    for key, ru, aliases in TITLE_RULES:
        candidates = [key] + aliases
        for c in candidates:
            nc = norm_latin(c)
            if nc and nc in hay and len(nc) > best_len:
                best = (key, ru, aliases)
                best_len = len(nc)
    return best

def title_of(item):
    rule = title_rule_for(item)
    if rule:
        return rule[1]
    for k in ("ru", "title_ru", "ruTitle", "nameRu", "titleRu", "russian"):
        v = clean_text(item.get(k))
        if v and has_cyr(v):
            return v
    return clean_text(item.get("title") or item.get("name") or item.get("nameRu") or item.get("nameEn") or item.get("en") or item.get("originalTitle") or item.get("titleOriginal") or item.get("nameOriginal") or item.get("original_title") or "")

def en_of(item):
    for k in ("en", "nameEn", "originalTitle", "titleOriginal", "nameOriginal", "original_title", "english", "romaji"):
        v = clean_text(item.get(k))
        if v:
            return v
    return ""

def aliases_of(item):
    vals = []
    rule = title_rule_for(item)
    if rule:
        vals += [rule[0], rule[1]] + list(rule[2])
    vals += all_names(item)
    out, seen = [], set()
    for v in vals:
        v = clean_text(v)
        if not v:
            continue
        k = norm_latin(v)
        if k and k not in seen:
            seen.add(k)
            out.append(v)
    return out[:20]

def year_of(item):
    m = re.search(r"(19\d{2}|20\d{2})", clean_text(item.get("year") or item.get("release_date") or item.get("first_air_date") or item.get("premiereRu") or item.get("premiereWorld") or ""))
    return m.group(1) if m else ""

def rating_of(item):
    for k in ("rating", "vote_average", "ratingKinopoisk", "ratingImdb", "score"):
        try:
            if item.get(k) not in (None, ""):
                return round(float(item.get(k)), 2)
        except Exception:
            pass
    return 0.0

def votes_of(item):
    for k in ("votes", "vote_count", "ratingVoteCount", "kinopoiskVotes", "imdbVotes", "scored_by", "members"):
        try:
            if item.get(k) not in (None, ""):
                return int(float(item.get(k)))
        except Exception:
            pass
    return 0

def is_western_cartoon(item):
    hay = norm_latin(" ".join(all_names(item) + genres_of(item) + [str(item.get("source") or ""), str(item.get("provider") or "")]))
    return any(norm_latin(x) in hay for x, _ in WESTERN_CARTOON_RULES)

def is_anime_source(item):
    source = norm_latin(item.get("source") or item.get("provider") or "")
    hay = norm_latin(" ".join(all_names(item) + genres_of(item) + [source]))
    return (
        "jikan" in source or "myanimelist" in source or source in ("mal", "anime") or
        "shikimori" in source or "anilist" in source or "anime" in hay or "аниме" in hay
    )

def type_of(item):
    if is_western_cartoon(item):
        return "Мультфильм"
    low = norm_latin(item.get("type") or item.get("kind") or item.get("category") or "")
    source = norm_latin(item.get("source") or item.get("provider") or "")
    genres = genres_of(item)
    text = " ".join([low, source, " ".join(norm_latin(g) for g in genres), norm_latin(title_of(item)), norm_latin(en_of(item))])
    if is_anime_source(item):
        return "Аниме"
    if "мульт" in text or "animation" in text or low in {"animation", "cartoon"}:
        return "Мультфильм"
    if "сериал" in text or low in {"tv", "series", "tv series"}:
        return "Сериал"
    return "Фильм"

def poster_of(item):
    return clean_text(item.get("poster") or item.get("posterUrl") or item.get("poster_url") or item.get("image") or item.get("imageUrl") or item.get("poster_path") or item.get("cover") or "")

def overview_of(item):
    for k in ("overview_ru", "ruOverview", "description_ru", "descriptionRu", "description", "overview", "synopsis", "shortDescription"):
        v = clean_text(item.get(k))
        if v:
            return v
    return ""

def generated_overview(title, item_type, year, genres):
    title = clean_text(title) or "Проект"
    item_type = clean_text(item_type).lower() or "проект"
    year_text = f" {year} года" if year else ""
    genre_text = ", ".join(genres[:3]) if genres else ""
    tail = f" Жанры: {genre_text}." if genre_text else ""
    return f"«{title}» — {item_type}{year_text} из каталога «ГОЛУБЬ Каталог Мира».{tail} Описание будет дополнено после следующего обновления данных."

def stable_id(item, i):
    for k in ("id", "uid", "tmdbId", "tmdb_id", "kinopoiskId", "filmId", "mal_id", "malId", "shikimori_id"):
        if item.get(k) not in (None, ""):
            return str(item.get(k))
    return "gkm_" + str(i)

def pick_extra(item):
    extra = {}
    for k in ("player","playerUrl","video","videoUrl","url","src","iframe","rutube","watchUrl","watch","trailer","trailerUrl","players","videoLinks","links","sources","episodes","episodeCount","status","studio","studios","country","countries","ageRating","age","source","tmdbId","tmdb_id","kinopoiskId","filmId","mal_id","malId","shikimori_id"):
        if k in item and item[k] not in (None, "", [], {}):
            extra[k] = item[k]
    return extra

def infer_ai_tags(item, title, en, genres, overview, item_type):
    text = norm_latin(" ".join([title, en, item_type, " ".join(genres), overview, str(item.get("source") or "")]))
    tags, moods, rec = set(), set(), set()

    def has_any(words):
        return any(norm_latin(w) in text for w in words)

    if item_type == "Аниме":
        tags.add("anime")
    elif item_type == "Сериал":
        tags.add("series")
    elif item_type == "Мультфильм":
        tags.add("cartoons")
    else:
        tags.add("movies")

    if has_any(["исекай","isekai","another world","перерождение","реинкарнация","reincarnation","summoned"]):
        tags.add("isekai"); rec.add("попаданцы")
    if has_any(["overpowered","op","solo leveling","one punch","прокачка","уровни"]):
        tags.add("opmc"); rec.add("сильный герой")
    if has_any(["magic","магия","волшеб","академия"]):
        tags.add("magic")
    if has_any(["shounen","сёнэн","боевик","экшен","action","martial arts"]):
        tags.add("action"); rec.add("экшен")
    if has_any(["psychological","психология","детектив","detective","mystery"]):
        tags.add("smart"); rec.add("умный сюжет")
    if has_any(["horror","ужасы","thriller","триллер","gore","жесть"]):
        tags.add("dark"); moods.add("мрачное")
    if has_any(["comedy","комедия","parody","повседневность","slice of life"]):
        tags.add("funny"); moods.add("лёгкое")
    if has_any(["romance","романтика","мелодрама","любовь"]):
        tags.add("romance"); moods.add("романтика")
    if has_any(["space","космос","sci fi","science fiction","фантастика"]):
        tags.add("space")
    if has_any(["survival","выживание","зомби","апокалипсис","death game"]):
        tags.add("survival")
    if has_any(["sports","спорт","volleyball","football","boxing"]):
        tags.add("sport")
    if has_any(["mecha","меха","robot","робот"]):
        tags.add("mecha")
    if has_any(["school","школа","академия"]):
        tags.add("school")
    if has_any(["family","семейный","kids","для детей"]):
        tags.add("family")
    if has_any(["detective","детектив","расследование","mystery"]):
        tags.add("detective"); tags.add("smart")
    if has_any(["music","музыка","idol","band"]):
        tags.add("music")
    if has_any(["food","еда","cooking","кулинария"]):
        tags.add("food"); moods.add("лёгкое")
    if has_any(["fantasy","фэнтези","adventure","приключения"]):
        moods.add("приключения")
    if has_any(["drama","драма"]):
        moods.add("драма")

    return sorted(tags), sorted(moods), sorted(rec)

def infer_ai_words(title, en, genres, overview, ai_tags, mood_tags, rec_tags):
    text = norm_latin(" ".join([title, en, " ".join(genres), overview, " ".join(ai_tags), " ".join(mood_tags), " ".join(rec_tags)]))
    words, seen = [], set()
    for w in text.split():
        if len(w) < 3 or w.isdigit() or w in seen:
            continue
        seen.add(w)
        words.append(w)
        if len(words) >= 60:
            break
    return words

def make_rec_text(title, en, genres, overview, ai_tags, mood_tags, rec_tags, ai_words):
    return clean_text(" ".join([title, en, " ".join(genres), " ".join(ai_tags), " ".join(mood_tags), " ".join(rec_tags), " ".join(ai_words), overview[:260]]))[:900]

def quality_tier(item):
    rating, votes = float(item.get("rating") or 0), int(item.get("votes") or 0)
    if rating >= 8.7 and votes >= 10000: return "legend"
    if rating >= 8.2 and votes >= 1000: return "top"
    if rating >= 7.5 and votes >= 300: return "good"
    if votes < 30 and rating >= 9: return "risky"
    return "normal"

def popularity_tier(item):
    votes = int(item.get("votes") or 0)
    if votes >= 100000: return "mega"
    if votes >= 10000: return "popular"
    if votes >= 1000: return "known"
    if votes >= 100: return "small"
    return "unknown"

def recommender_score(item):
    rating = float(item.get("rating") or 0)
    votes = int(item.get("votes") or 0)
    year = int(item.get("year") or 0)
    score = rating * 10 + min(votes, 500000) / 500000 * 20
    if item.get("poster"): score += 4
    if year >= 2015: score += 2
    if year >= 2020: score += 2
    if votes < 30 and rating >= 9: score -= 30
    return round(score, 3)

def content_quality_flags(item):
    flags = []
    rating, votes = float(item.get("rating") or 0), int(item.get("votes") or 0)
    if rating >= 8.5 and votes >= 10000: flags.append("must_watch")
    if rating >= 8.0 and votes >= 1000: flags.append("safe_pick")
    if votes < 50: flags.append("low_votes")
    if item.get("poster"): flags.append("has_poster")
    return flags

def decade_of(item):
    y = int(item.get("year") or 0)
    return str((y // 10) * 10) + "s" if y else ""

def neuro_vector(item):
    vec = []
    for key in ["type", "qualityTier", "popularityTier"]:
        if item.get(key): vec.append(str(item[key]))
    vec += item.get("aiTags", [])[:10] + item.get("moodTags", [])[:8] + item.get("recTags", [])[:8]
    rating, votes, year = float(item.get("rating") or 0), int(item.get("votes") or 0), int(item.get("year") or 0)
    if rating >= 8.5: vec.append("high_rating")
    if votes >= 10000: vec.append("many_votes")
    if year >= 2020: vec.append("modern")
    elif year and year < 2005: vec.append("classic")
    return sorted(set(vec))

def risk_level(item):
    votes = int(item.get("votes") or 0)
    rating = float(item.get("rating") or 0)
    if votes < 30: return "high_risk"
    if votes < 300: return "medium_risk"
    if rating >= 8 and votes >= 1000: return "low_risk"
    return "normal_risk"

def final_score_band(item):
    s = float(item.get("recScore") or 0)
    if s >= 105: return "s_plus"
    if s >= 92: return "s"
    if s >= 80: return "a"
    if s >= 65: return "b"
    return "c"

def absolute_rank(item):
    rating, votes, rec = float(item.get("rating") or 0), int(item.get("votes") or 0), float(item.get("recScore") or 0)
    score = rec
    if item.get("riskLevel") == "low_risk": score += 8
    if item.get("scoreBand") in ("s_plus", "s"): score += 10
    if rating >= 8.5 and votes >= 10000: score += 12
    if votes < 50: score -= 25
    return round(score, 3)

def compact_text(*parts, limit=800):
    return clean_text(" ".join(str(x or "") for x in parts))[:limit]

def card_item(raw, i):
    title = title_of(raw)
    en = en_of(raw)
    genres = genres_of(raw)
    item_type = type_of(raw)

    x = {
        "id": stable_id(raw, i),
        "ru": title,
        "en": en,
        "aliases": aliases_of(raw),
        "year": year_of(raw),
        "type": item_type,
        "rating": rating_of(raw),
        "votes": votes_of(raw),
        "poster": poster_of(raw),
        "backdrop": clean_text(raw.get("backdrop") or ""),
        "genres": genres,
        "overview": overview_of(raw),
    }
    if not x["overview"]:
        x["overview"] = generated_overview(x["ru"], x["type"], x["year"], x["genres"])
        x["overviewGenerated"] = True
    else:
        x["overviewGenerated"] = False

    x.update(pick_extra(raw))
    x["source"] = clean_text(x.get("source") or raw.get("provider") or "")
    x["episodes"] = x.get("episodes") or x.get("episodeCount") or ""
    x["studio"] = x.get("studio") or x.get("studios") or ""
    x["country"] = x.get("country") or x.get("countries") or ""
    x["ageRating"] = x.get("ageRating") or x.get("age") or ""

    # Западным мультам не оставляем жанр Аниме
    if x["type"] == "Мультфильм":
        x["genres"] = [g for g in x["genres"] if norm(g) != "аниме"]
        if "Мультфильм" not in x["genres"]:
            x["genres"].insert(0, "Мультфильм")

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
    x["omegaText"] = compact_text(x["ru"], x["en"], x["type"], x["decade"], x["qualityTier"], x["popularityTier"], " ".join(x["aiTags"]), limit=700)
    x["apexText"] = compact_text(x["omegaText"], x["qualityTier"], x["popularityTier"], " ".join(x["qualityFlags"]), limit=800)
    x["supremeText"] = compact_text(x["apexText"], x["omegaText"], x["decade"], limit=900)
    x["riskLevel"] = risk_level(x)
    x["ultraText"] = compact_text(x["supremeText"], x["riskLevel"], x["qualityTier"], limit=1000)
    x["scoreBand"] = final_score_band(x)
    x["infinityText"] = compact_text(x["ultraText"], x["scoreBand"], x["riskLevel"], limit=1100)
    x["absoluteRank"] = absolute_rank(x)
    x["absoluteText"] = compact_text(x["infinityText"], x["absoluteRank"], limit=1200)
    return x

def smart_score(x):
    r, v, y = float(x.get("rating") or 0), int(x.get("votes") or 0), int(x.get("year") or 0)
    if v < 30:
        return r - 25
    return r * 10 + min(v, 80000) / 80000 * 5 + (0.35 if y >= 2010 else 0)

def quality(x):
    return (
        int(x.get("votes") or 0) * 100 +
        float(x.get("rating") or 0) * 1000 +
        (10000 if x.get("poster") else 0) +
        len(x.get("overview") or "")
    )

def canonical_rule_key(item):
    hay = norm_latin(" ".join([item.get("ru",""), item.get("en",""), " ".join(item.get("aliases", []))]))
    best = ""
    best_len = 0
    for key, ru, aliases in TITLE_RULES:
        candidates = [key, ru] + aliases
        for c in candidates:
            nc = norm_latin(c)
            if nc and nc in hay and len(nc) > best_len:
                best = norm_latin(ru)
                best_len = len(nc)
    if best:
        # сохраняем сезон/часть, чтобы не склеить разные сезоны
        season = ""
        m = re.search(r"(season|сезон)\s*(\d+)", hay)
        if m:
            season = " season " + m.group(2)
        part = ""
        m2 = re.search(r"(part|часть)\s*(\d+)", hay)
        if m2:
            part = " part " + m2.group(2)
        return best + season + part
    return ""

def dedupe_key(item):
    canon = canonical_rule_key(item)
    title = canon or norm_latin(item.get("ru") or item.get("en"))
    year = item.get("year") or ""
    item_type = item.get("type") or ""
    # Для сериалов/аниме год не всегда нужен, но помогает не слить ремейки.
    return f"{item_type}|{title}|{year}"

def collect_items():
    chunks = find_chunk_files()
    print(f"Resolved chunks: {len(chunks)}")
    raw = []
    for p in chunks:
        data = load_json(p)
        items = extract_items(data)
        print(f"{p}: {len(items)}")
        raw.extend(items)
    return raw

def dedupe(raw_items):
    best, skipped = {}, 0
    type_stats = {"Фильм":0, "Сериал":0, "Аниме":0, "Мультфильм":0}
    for i, raw in enumerate(raw_items):
        item = card_item(raw, i)
        tk = norm_latin(item.get("ru") or item.get("en"))
        if not tk:
            skipped += 1
            continue
        key = dedupe_key(item)
        if key not in best or quality(item) > quality(best[key]):
            best[key] = item
    out = list(best.values())
    for x in out:
        type_stats[x.get("type", "Фильм")] = type_stats.get(x.get("type","Фильм"), 0) + 1
    print(f"Skipped without title: {skipped}")
    print(f"Dedup removed: {len(raw_items) - skipped - len(out)}")
    print(f"Type stats: {type_stats}")
    return out


def page_item(x):
    """Fields required by cards/details, without heavy recommender internals."""
    keep = (
        "id", "ru", "en", "aliases", "year", "type", "rating", "votes",
        "poster", "backdrop", "genres", "overview", "overviewGenerated",
        "episodes", "episodeCount", "studio", "studios", "country", "countries",
        "status", "ageRating", "age", "source", "recScore",
        "player", "playerUrl", "video", "videoUrl", "url", "src", "iframe",
        "rutube", "watchUrl", "watch", "trailer", "trailerUrl", "players",
        "videoLinks", "links", "sources", "tmdbId", "tmdb_id", "kinopoiskId",
        "filmId", "mal_id", "malId", "shikimori_id"
    )
    out = {}
    for key in keep:
        value = x.get(key)
        if value not in (None, "", [], {}):
            out[key] = value
    out.setdefault("id", x.get("id"))
    out.setdefault("ru", x.get("ru"))
    out.setdefault("type", x.get("type"))
    out.setdefault("rating", x.get("rating") or 0)
    out.setdefault("votes", x.get("votes") or 0)
    out.setdefault("genres", x.get("genres") or [])
    return out

def write_pages(base, tab, items):
    d = base / "pages" / tab
    d.mkdir(parents=True, exist_ok=True)
    pages = max(1, (len(items) + PAGE_SIZE - 1) // PAGE_SIZE)
    for page in range(1, pages + 1):
        save_json(d / f"page_{page:04d}.json", {
            "tab": tab,
            "page": page,
            "pages": pages,
            "count": len(items),
            "pageSize": PAGE_SIZE,
            "items": [page_item(x) for x in items[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]],
        })
    return {"count": len(items), "pages": pages, "pageSize": PAGE_SIZE}

def search_item(x):
    aliases = x.get("aliases", [])[:12]
    genres = x.get("genres", [])[:6]
    ai_words = x.get("aiWords", [])[:24]
    search_text = compact_text(
        x.get("ru"),
        x.get("en"),
        " ".join(aliases),
        x.get("year"),
        x.get("type"),
        " ".join(genres),
        " ".join(ai_words),
        x.get("qualityTier"),
        x.get("popularityTier"),
        limit=260,
    )
    return {
        "id": x.get("id"),
        "ru": x.get("ru"),
        "en": x.get("en"),
        "aliases": aliases,
        "year": x.get("year"),
        "type": x.get("type"),
        "rating": x.get("rating"),
        "votes": x.get("votes"),
        "poster": x.get("poster"),
        "genres": genres,
        "overview": (x.get("overview") or "")[:120],
        "episodes": x.get("episodes") or x.get("episodeCount") or "",
        "studio": x.get("studio") or x.get("studios") or "",
        "country": x.get("country") or x.get("countries") or "",
        "status": x.get("status") or "",
        "ageRating": x.get("ageRating") or x.get("age") or "",
        "source": x.get("source"),
        "search": search_text,
        "recScore": x.get("recScore"),
        "overviewGenerated": bool(x.get("overviewGenerated")),
    }

def main():
    raw = collect_items()
    print(f"Raw items: {len(raw)}")
    items = dedupe(raw)
    print(f"After clean dedupe: {len(items)}")
    if len(items) <= 0:
        raise SystemExit("ERROR: 0 items. Refusing to overwrite existing data/fast.")

    if FAST_TMP_DIR.exists():
        shutil.rmtree(FAST_TMP_DIR)
    FAST_TMP_DIR.mkdir(parents=True, exist_ok=True)

    genres_all = sorted(
        {g for x in items for g in x.get("genres", [])},
        key=lambda x: (GOOD_GENRE_ORDER.index(x) if x in GOOD_GENRE_ORDER else 999, x.lower())
    )
    years = sorted({x.get("year") for x in items if x.get("year")}, reverse=True)

    by = lambda seq: sorted(seq, key=smart_score, reverse=True)
    all_sorted = by(items)
    movies = by([x for x in items if x["type"] == "Фильм"])
    series = by([x for x in items if x["type"] == "Сериал"])
    anime = by([x for x in items if x["type"] == "Аниме"])
    cartoons = by([x for x in items if x["type"] == "Мультфильм"])
    new_items = sorted(
        [x for x in items if int(x.get("year") or 0) >= 2024 and int(x.get("votes") or 0) >= 10],
        key=lambda x: (int(x.get("year") or 0), smart_score(x)),
        reverse=True
    )
    popular = sorted([x for x in items if int(x.get("votes") or 0) >= 1000], key=lambda x: int(x.get("votes") or 0), reverse=True)
    top = by([x for x in items if int(x.get("votes") or 0) >= MIN_VOTES_FOR_TOP and float(x.get("rating") or 0) >= 7])

    pages = {
        "all": write_pages(FAST_TMP_DIR, "all", all_sorted),
        "movies": write_pages(FAST_TMP_DIR, "movies", movies),
        "series": write_pages(FAST_TMP_DIR, "series", series),
        "anime": write_pages(FAST_TMP_DIR, "anime", anime),
        "cartoons": write_pages(FAST_TMP_DIR, "cartoons", cartoons),
        "new": write_pages(FAST_TMP_DIR, "new", new_items),
        "popular": write_pages(FAST_TMP_DIR, "popular", popular),
        "top": write_pages(FAST_TMP_DIR, "top", top[:250]),
    }

    home = {
        "generatedAt": now_iso(),
        "total": len(items),
        "sections": {
            "popular": [page_item(x) for x in popular[:HOME_LIMIT]],
            "top": [page_item(x) for x in top[:HOME_LIMIT]],
            "new": [page_item(x) for x in new_items[:HOME_LIMIT]],
            "anime": [page_item(x) for x in anime[:HOME_LIMIT]],
            "movies": [page_item(x) for x in movies[:HOME_LIMIT]],
            "series": [page_item(x) for x in series[:HOME_LIMIT]],
            "cartoons": [page_item(x) for x in cartoons[:HOME_LIMIT]],
        }
    }

    search_index = [search_item(x) for x in all_sorted]

    meta = {
        "generatedAt": now_iso(),
        "rawCount": len(raw),
        "count": len(items),
        "dedupeRemoved": max(0, len(raw) - len(items)),
        "pageSize": PAGE_SIZE,
        "homeLimit": HOME_LIMIT,
        "genres": genres_all,
        "years": years,
        "pages": pages,
        "builderVersion": "v344-light-pages-search-lite-generated-overviews-2026-07-12",
        "searchIndexVersion": "v344-full-plus-lite-fallback",
        "notes": [
            "types are fixed at build time",
            "Scooby and western cartoons are cartoons, not anime",
            "anime aliases are deduped at build time",
            "browser app.js should stay light/stable",
            "search_lite contains the highest-ranked items for fast first search",
            "missing descriptions receive deterministic generated fallbacks",
            "page JSON contains only browser-required fields to reduce data/fast size"
        ]
    }

    search_lite = search_index[:max(1000, min(SEARCH_LITE_LIMIT, len(search_index)))]

    save_json(FAST_TMP_DIR / "home.json", home)
    save_json(FAST_TMP_DIR / "search_index.json", search_index)
    save_json(FAST_TMP_DIR / "search_lite.json", search_lite)
    save_json(FAST_TMP_DIR / "meta.json", meta)

    if FAST_DIR.exists():
        shutil.rmtree(FAST_DIR)
    FAST_TMP_DIR.rename(FAST_DIR)

    print("FAST DATA READY")
    print(f"rawCount={len(raw)}")
    print(f"count={len(items)}")
    print(f"dedupeRemoved={meta['dedupeRemoved']}")
    print(f"pages_all={pages['all']['pages']}")
    print(f"search_lite={len(search_lite)}")
    print(f"anime={pages['anime']['count']} cartoons={pages['cartoons']['count']}")

if __name__ == "__main__":
    main()
