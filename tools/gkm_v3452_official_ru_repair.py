#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, os, hashlib, html, shutil, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path
from collections import defaultdict, Counter
from typing import Any
from concurrent.futures import ThreadPoolExecutor, as_completed

CYR = re.compile(r'[А-Яа-яЁё]')
LAT = re.compile(r'[A-Za-z]')
WORD = re.compile(r'[A-Za-zА-Яа-яЁё0-9]+')

GENRE_MAP = {
'action':'Боевик','adventure':'Приключения','animation':'Мультфильм','comedy':'Комедия','crime':'Криминал',
'documentary':'Документальный','drama':'Драма','family':'Семейный','fantasy':'Фэнтези','history':'История',
'horror':'Ужасы','music':'Музыка','mystery':'Детектив','romance':'Романтика','science fiction':'Фантастика',
'sci-fi':'Фантастика','science-fiction':'Фантастика','tv movie':'Телевизионный фильм','thriller':'Триллер',
'war':'Военный','western':'Вестерн','supernatural':'Сверхъестественное','suspense':'Саспенс',
'psychological':'Психология','shounen':'Сёнэн','seinen':'Сэйнэн','school':'Школа','sports':'Спорт','sport':'Спорт',
'military':'Военное','survival':'Выживание','gore':'Жесть','award winning':'Призовые','adult cast':'Взрослые персонажи',
'parody':'Пародия','super power':'Суперспособности','historical':'Историческое','mecha':'Меха','kids':'Детский',
'performing arts':'Сценическое искусство','mythology':'Мифология','urban fantasy':'Городское фэнтези',
'time travel':'Путешествия во времени','workplace':'Работа','childcare':'Воспитание детей',
'martial arts':'Боевые искусства','samurai':'Самураи','vampire':'Вампиры','space':'Космос',
'detective':'Детектив','medical':'Медицина','gag humor':'Юмор','otaku culture':'Культура отаку',
'reality':'Реалити-шоу','soap':'Мыльная опера','talk':'Ток-шоу','short':'Короткометражка',
'rpg':'Ролевая игра','open world':'Открытый мир','platformer':'Платформер','strategy':'Стратегия',
'shooter':'Шутер','simulation':'Симулятор','racing':'Гонки','puzzle':'Головоломка','indie':'Инди',
}
TYPE_MAP = {
'movie':'Фильм','film':'Фильм','tv movie':'Фильм','series':'Сериал','tv-series':'Сериал','tv series':'Сериал',
'anime':'Аниме','cartoon':'Мультфильм','animated series':'Мультсериал','animated-series':'Мультсериал',
'game':'Игра','games':'Игра','book':'Книга','books':'Книга','manga':'Манга','ranobe':'Ранобэ','light novel':'Ранобэ','comics':'Комикс','comic':'Комикс'
}
STATUS_MAP = {
'released':'Вышел','ended':'Завершён','returning series':'Продолжается','in production':'В производстве',
'planned':'Запланирован','rumored':'Слухи','post production':'Постпродакшн','canceled':'Отменён','cancelled':'Отменён',
'airing':'Выходит','finished airing':'Завершён','currently airing':'Выходит','not yet aired':'Ещё не вышел',
}
SOURCE_MAP = {
'tmdb':'TMDB','kinopoisk_auto_v339':'Кинопоиск','jikan / myanimelist':'MyAnimeList','myanimelist':'MyAnimeList',
'openlibrary isbn cover':'OpenLibrary','steam':'Steam'
}
COMMON_TITLE_MAP = {
'attack on titan':'Атака титанов','shingeki no kyojin':'Атака титанов','death note':'Тетрадь смерти',
'one punch man':'Ванпанчмен','one-punch man':'Ванпанчмен','demon slayer':'Истребитель демонов',
'kimetsu no yaiba':'Истребитель демонов','jujutsu kaisen':'Магическая битва','solo leveling':'Поднятие уровня в одиночку',
'chainsaw man':'Человек-бензопила','frieren beyond journey s end':'Провожающая в последний путь Фрирен',
'sousou no frieren':'Провожающая в последний путь Фрирен','fullmetal alchemist brotherhood':'Стальной алхимик: Братство',
'hunter x hunter':'Охотник х Охотник','my hero academia':'Моя геройская академия','boku no hero academia':'Моя геройская академия',
'vinland saga':'Сага о Винланде','cowboy bebop':'Ковбой Бибоп','code geass':'Код Гиас','neon genesis evangelion':'Евангелион',
'cyberpunk 2077':'Киберпанк 2077','the last of us':'Одни из нас','the last of us part i':'Одни из нас: Часть I',
'fallout 4':'Фоллаут 4','the witcher':'Ведьмак','the witcher 3 wild hunt':'Ведьмак 3: Дикая Охота',
'dune':'Дюна','interstellar':'Интерстеллар','the lord of the rings':'Властелин колец','harry potter':'Гарри Поттер',
}

# Readable transliteration fallback, not semantic translation.
REPL = [
 ('tion','шн'),('sion','жн'),('ture','чер'),('ph','ф'),('sh','ш'),('ch','ч'),('th','т'),('wh','у'),('ck','к'),
 ('qu','кв'),('ee','и'),('oo','у'),('ea','и'),('ou','ау'),('ow','оу'),('ai','эй'),('ay','эй'),('oy','ой'),('oi','ой'),
 ('dge','дж'),('ge','дж'),('gi','джи'),('ce','с'),('ci','си'),('cy','си'),('x','кс')]
CHAR_MAP = {'a':'а','b':'б','c':'к','d':'д','e':'е','f':'ф','g':'г','h':'х','i':'и','j':'дж','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п','q':'к','r':'р','s':'с','t':'т','u':'у','v':'в','w':'у','x':'кс','y':'й','z':'з'}


def norm(s: Any) -> str:
    s = str(s or '').lower().replace('ё','е')
    return ' '.join(WORD.findall(s))

def has_cyr(s: Any) -> bool: return bool(CYR.search(str(s or '')))
def latin_only(s: Any) -> bool:
    s=str(s or '')
    return bool(LAT.search(s)) and not has_cyr(s) and not has_foreign_script(s)

def has_foreign_script(s: Any) -> bool:
    for ch in str(s or ''):
        if ch.isalpha() and not (('A'<=ch<='Z') or ('a'<=ch<='z') or ('А'<=ch<='я') or ch in 'Ёё'):
            return True
    return False

def translit_word(word: str) -> str:
    if not LAT.search(word): return word
    if word.isupper() and len(word) <= 6: return word
    lower=word.lower()
    out=''
    i=0
    while i<len(lower):
        hit=False
        for a,b in REPL:
            if lower.startswith(a,i): out+=b; i+=len(a); hit=True; break
        if hit: continue
        out+=CHAR_MAP.get(lower[i],lower[i]); i+=1
    if word[:1].isupper(): out=out[:1].upper()+out[1:]
    return out

def translit_title(s: str) -> str:
    parts=re.split(r'([\s:;,.!?/\\\-–—()\[\]{}&+]+)',str(s or ''))
    return ''.join(translit_word(p) if LAT.search(p) else p for p in parts)

def load_title_map(root: Path) -> dict[str,str]:
    result=dict(COMMON_TITLE_MAP)
    for p in [root/'data/ru_titles_map.json',root/'film/data/ru_titles_map.json']:
        if p.exists():
            try:
                d=json.loads(p.read_text(encoding='utf-8'))
                for k,v in d.items():
                    if v and has_cyr(v): result[norm(k)]=str(v).strip()
            except Exception: pass
    return result

def localize_title(item: dict, title_map: dict[str,str]) -> tuple[str,str]:
    candidates=[item.get('ru'),item.get('title_ru'),item.get('title'),item.get('name'),item.get('en'),item.get('originalTitle'),item.get('original_title'),item.get('original_name')]
    candidates=[str(x).strip() for x in candidates if str(x or '').strip()]
    current=candidates[0] if candidates else 'Без названия'
    original=next((x for x in candidates if latin_only(x)), current)
    if has_cyr(current): return current, original
    for cand in candidates:
        mapped=title_map.get(norm(cand))
        if mapped: return mapped, original
    # fallback: transliterate a Latin candidate; for CJK-only names use a Russian generic label.
    latin_candidate=next((x for x in candidates if latin_only(x)), '')
    tr=translit_title(latin_candidate or current)
    if has_cyr(tr) and not has_foreign_script(tr): return tr, original
    typ=localize_type(item.get('type') or item.get('category'))
    year=str(item.get('year') or '').strip()
    iid=str(item.get('id') or '').strip()
    label=typ + (f' {year} года' if year else '') + (f' №{iid}' if iid else '')
    return label, original

def localize_genres(value: Any) -> list[str]:
    if isinstance(value,str): parts=re.split(r'[|,;/]+',value)
    elif isinstance(value,list): parts=value
    else: parts=[]
    out=[]; seen=set()
    for raw in parts:
        if isinstance(raw,dict): raw=raw.get('name') or raw.get('title') or ''
        s=str(raw or '').strip()
        if not s: continue
        key=norm(s)
        loc=GENRE_MAP.get(key,s)
        # discard English duplicate when Russian equivalent already exists
        k=norm(loc)
        if k and k not in seen:
            seen.add(k); out.append(loc[:1].upper()+loc[1:] if loc else loc)
    return out

def localize_type(v: Any) -> str:
    s=str(v or '').strip(); return TYPE_MAP.get(norm(s),s or 'Материал')
def localize_status(v: Any) -> str:
    s=str(v or '').strip(); return STATUS_MAP.get(norm(s),s)

def generated_overview(item: dict) -> str:
    title=str(item.get('ru') or item.get('title') or item.get('name') or 'Материал')
    typ=localize_type(item.get('type') or item.get('category'))
    year=str(item.get('year') or '').strip()
    genres=localize_genres(item.get('genres'))[:4]
    rating=item.get('rating')
    bits=[f'«{title}» — {typ.lower()}']
    if year: bits[-1]+=f' {year} года'
    if genres: bits.append('Жанры: '+', '.join(genres))
    try:
        if float(rating)>0: bits.append(f'Рейтинг: {float(rating):.1f}')
    except Exception: pass
    bits.append('Карточка представлена в русской версии каталога «ГОЛУБЬ Каталог Мира».')
    return '. '.join(bits).replace('..','.').strip()


RESOLVER = None

class OfficialRussianResolver:
    """Fetches and caches official/curated Russian metadata before fallback transliteration."""

    USER_AGENT = "GKM-Catalog/3451 (+https://github.com/dragokas371158989-png/films-series-best-5000)"

    def __init__(self, root: Path, stats: Counter, online: bool = True):
        self.root = root
        self.stats = stats
        self.online = online
        self.cache_path = root / "data" / "ru_official_cache_v3452.json"
        self.cache = {"version": "V3452", "items": {}}
        if self.cache_path.exists():
            try:
                loaded = json.loads(self.cache_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    self.cache.update(loaded)
                    self.cache.setdefault("items", {})
            except Exception:
                stats["official_cache_read_errors"] += 1
        else:
            previous = root / "data" / "ru_official_cache_v3451.json"
            if previous.exists():
                try:
                    loaded = json.loads(previous.read_text(encoding="utf-8"))
                    if isinstance(loaded, dict) and isinstance(loaded.get("items"), dict):
                        self.cache["items"].update(loaded["items"])
                        stats["previous_cache_items_imported"] = len(loaded["items"])
                except Exception:
                    stats["previous_cache_read_errors"] += 1

        self.tmdb_key = (os.environ.get("TMDB_API_KEY") or "").strip()
        self.tmdb_token = (os.environ.get("TMDB_READ_TOKEN") or "").strip()
        self.kp_key = (os.environ.get("KINOPOISK_API_KEY") or "").strip()
        self.http_timeout = int(os.environ.get("GKM_RU_HTTP_TIMEOUT", "30"))
        self.tmdb_workers = max(1, min(16, int(os.environ.get("GKM_RU_TMDB_WORKERS", "8"))))
        self.kp_workers = max(1, min(8, int(os.environ.get("GKM_RU_KP_WORKERS", "4"))))

    def save(self):
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(self.cache, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def _get_json(self, url: str, headers: dict | None = None, retries: int = 4):
        if not self.online:
            return None
        req_headers = {"User-Agent": self.USER_AGENT, "Accept": "application/json"}
        if headers:
            req_headers.update(headers)
        for attempt in range(retries):
            try:
                req = urllib.request.Request(url, headers=req_headers)
                with urllib.request.urlopen(req, timeout=self.http_timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                if exc.code == 404:
                    return None
                if exc.code in (429, 500, 502, 503, 504):
                    wait = float(exc.headers.get("Retry-After") or (1.5 * (attempt + 1)))
                    time.sleep(min(wait, 12))
                    continue
                self.stats["official_http_errors"] += 1
                return None
            except Exception:
                if attempt + 1 >= retries:
                    self.stats["official_network_errors"] += 1
                    return None
                time.sleep(1.2 * (attempt + 1))
        return None

    @staticmethod
    def _strip_html(value: Any) -> str:
        text = str(value or "")
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        return html.unescape(re.sub(r"\s+", " ", text)).strip()

    @staticmethod
    def _current_title(item: dict) -> str:
        for key in ("ru", "title_ru", "title", "name", "en", "originalTitle", "original_title", "original_name"):
            value = str(item.get(key) or "").strip()
            if value:
                return value
        return ""

    @staticmethod
    def _cache_source(value: dict) -> str:
        return norm(value.get("source")) if isinstance(value, dict) else ""

    def _has_verified_cache(self, item_key: str, provider: str) -> bool:
        value = self.cache.get("items", {}).get(item_key)
        if not isinstance(value, dict) or not has_cyr(value.get("ru")):
            return False
        source = self._cache_source(value)
        expected = {
            "shikimori": ("shikimori",),
            "kinopoisk": ("кинопоиск", "kinopoisk"),
            "tmdb": ("tmdb ru",),
        }.get(provider, ())
        return any(token in source for token in expected)

    @staticmethod
    def _mal_id(item: dict) -> str:
        iid = str(item.get("id") or "").strip()
        match = re.fullmatch(r"mal_(\d+)", iid)
        return match.group(1) if match else ""

    @staticmethod
    def _kinopoisk_id(item: dict) -> str:
        for key in ("kinopoiskId", "kinopoisk_id", "kpId", "kp_id"):
            value = str(item.get(key) or "").strip()
            if value.isdigit():
                return value
        iid = str(item.get("id") or "").strip()
        match = re.fullmatch(r"kp_(\d+)", iid)
        if match:
            return match.group(1)
        source = norm(item.get("source"))
        if iid.isdigit() and "kinopoisk" in source:
            return iid
        return ""

    @staticmethod
    def _tmdb_id(item: dict) -> str:
        for key in ("tmdbId", "tmdb_id"):
            value = str(item.get(key) or "").strip()
            if value.isdigit():
                return value
        iid = str(item.get("id") or "").strip()
        match = re.fullmatch(r"tmdb_(\d+)", iid)
        if match:
            return match.group(1)
        source = norm(item.get("source"))
        hints = ("tmdb", "movie top", "tv top", "discover", "trending")
        if iid.isdigit() and any(token in source for token in hints):
            return iid
        return ""

    @staticmethod
    def _item_key(item: dict) -> str:
        return str(item.get("id") or "").strip()

    def _needs_provider_repair(self, item: dict) -> bool:
        current = self._current_title(item)
        localization_source = norm(item.get("titleLocalizationSource"))
        bad_sources = (
            "transliteration",
            "machine transliteration",
            "fallback transliteration",
            "fallback",
        )
        return (not has_cyr(current)) or any(token in localization_source for token in bad_sources)

    def _store(self, item_id: str, payload: dict):
        if not item_id or not payload:
            return
        current = self.cache["items"].get(item_id, {})
        for key, value in payload.items():
            if value not in ("", None, [], {}):
                current[key] = value
        self.cache["items"][item_id] = current

    def _prefetch_shikimori(self, items: list[dict]):
        # V3452: EVERY mal_* record is a candidate unless a verified Shikimori
        # value already exists in cache. Existing Cyrillic may be transliteration.
        by_mal = {}
        for item in items:
            mal_id = self._mal_id(item)
            item_key = self._item_key(item)
            if not mal_id or not item_key:
                continue
            by_mal.setdefault(mal_id, item)
        ids = sorted(by_mal, key=int)
        candidates = [
            mal_id for mal_id in ids
            if not self._has_verified_cache(self._item_key(by_mal[mal_id]), "shikimori")
        ]
        self.stats["shikimori_total_mal_ids"] = len(ids)
        self.stats["shikimori_candidates"] = len(candidates)

        batch_size = max(1, min(50, int(os.environ.get("GKM_SHIKI_BATCH_SIZE", "50"))))
        delay = max(0.75, float(os.environ.get("GKM_SHIKI_DELAY", "0.85")))
        individual_limit = max(0, int(os.environ.get("GKM_SHIKI_INDIVIDUAL_LIMIT", "500")))
        individual_used = 0

        for offset in range(0, len(candidates), batch_size):
            batch = candidates[offset:offset + batch_size]
            query = urllib.parse.urlencode({"ids": ",".join(batch), "limit": batch_size})
            data = self._get_json(f"https://shikimori.one/api/animes?{query}")
            returned = set()
            unresolved = []

            if isinstance(data, list):
                for row in data:
                    mal_id = str(row.get("id") or "")
                    if not mal_id or mal_id not in by_mal:
                        continue
                    returned.add(mal_id)
                    item_key = self._item_key(by_mal[mal_id])
                    ru = str(row.get("russian") or "").strip()
                    payload = {
                        "source": "Shikimori V3452",
                        "original": str(row.get("name") or "").strip(),
                        "externalId": mal_id,
                    }
                    if has_cyr(ru):
                        payload["ru"] = ru
                    else:
                        unresolved.append(mal_id)
                    if has_cyr(ru):
                        self._store(item_key, payload)
                        self.stats["shikimori_titles_resolved"] += 1
            else:
                self.stats["shikimori_batch_failures"] += 1

            missing = [mal_id for mal_id in batch if mal_id not in returned]
            fallback_ids = missing + [x for x in unresolved if x not in missing]

            for mal_id in fallback_ids:
                if individual_used >= individual_limit:
                    self.stats["shikimori_individual_limit_reached"] += 1
                    break
                individual_used += 1
                row = self._get_json(f"https://shikimori.one/api/animes/{mal_id}")
                if not isinstance(row, dict):
                    self.stats["shikimori_individual_missing"] += 1
                    continue
                item_key = self._item_key(by_mal[mal_id])
                ru = str(row.get("russian") or "").strip()
                description = self._strip_html(row.get("description"))
                payload = {
                    "source": "Shikimori V3452",
                    "original": str(row.get("name") or "").strip(),
                    "externalId": mal_id,
                }
                if has_cyr(ru):
                    payload["ru"] = ru
                if has_cyr(description):
                    payload["overview"] = description
                if has_cyr(ru):
                    self._store(item_key, payload)
                    self.stats["shikimori_individual_resolved"] += 1
                else:
                    self.stats["shikimori_unresolved"] += 1
                time.sleep(delay)

            self.save()
            self.stats["shikimori_batches_completed"] += 1
            time.sleep(delay)

        self.stats["shikimori_individual_requests"] = individual_used
        self.save()


    @staticmethod
    def _is_tmdb_item(item: dict) -> bool:
        iid = str(item.get("id") or "")
        if not iid.isdigit():
            return False
        source = norm(item.get("source"))
        if "kinopoisk" in source or "jikan" in source or "myanimelist" in source:
            return False
        hints = ("tmdb", "discover", "trending", "movie top", "tv top", "popular movie", "popular tv")
        return any(hint in source for hint in hints)

    def _tmdb_one(self, item: dict):
        item_key = self._item_key(item)
        external_id = self._tmdb_id(item)
        if not item_key or not external_id:
            return item_key, None
        typ = localize_type(item.get("type") or item.get("category"))
        endpoint = "tv" if typ in ("Сериал", "Мультсериал") else "movie"
        params = {"language": "ru-RU"}
        headers = {}
        if self.tmdb_key:
            params["api_key"] = self.tmdb_key
        elif self.tmdb_token:
            headers["Authorization"] = f"Bearer {self.tmdb_token}"
        else:
            return item_key, None
        url = f"https://api.themoviedb.org/3/{endpoint}/{external_id}?{urllib.parse.urlencode(params)}"
        row = self._get_json(url, headers=headers)
        if not isinstance(row, dict):
            return item_key, None
        ru = str(row.get("title") or row.get("name") or "").strip()
        overview = str(row.get("overview") or "").strip()
        genres = [
            str(x.get("name") or "").strip()
            for x in row.get("genres") or []
            if isinstance(x, dict) and str(x.get("name") or "").strip()
        ]
        payload = {"source": "TMDB ru-RU V3452", "externalId": external_id}
        if has_cyr(ru):
            payload["ru"] = ru
        if has_cyr(overview):
            payload["overview"] = overview
        if genres:
            payload["genres"] = genres
        return item_key, payload if has_cyr(payload.get("ru")) else None

    def _prefetch_tmdb(self, items: list[dict]):
        if not (self.tmdb_key or self.tmdb_token):
            self.stats["tmdb_skipped_no_secret"] += 1
            return
        candidates = [
            item for item in items
            if self._tmdb_id(item)
            and self._needs_provider_repair(item)
            and not self._has_verified_cache(self._item_key(item), "tmdb")
        ]
        limit = int(os.environ.get("GKM_RU_TMDB_LIMIT", "0"))
        if limit > 0:
            candidates = candidates[:limit]
        self.stats["tmdb_candidates"] = len(candidates)
        with ThreadPoolExecutor(max_workers=self.tmdb_workers) as pool:
            futures = [pool.submit(self._tmdb_one, item) for item in candidates]
            for index, future in enumerate(as_completed(futures), 1):
                iid, payload = future.result()
                if payload:
                    self._store(iid, payload)
                    self.stats["tmdb_titles_resolved"] += int(bool(payload.get("ru")))
                    self.stats["tmdb_overviews_resolved"] += int(bool(payload.get("overview")))
                if index % 250 == 0:
                    self.save()
        self.save()

    def _kp_one(self, item: dict):
        item_key = self._item_key(item)
        external_id = self._kinopoisk_id(item)
        if not item_key or not external_id:
            return item_key, None
        row = self._get_json(
            f"https://api.kinopoisk.dev/v1.4/movie/{external_id}",
            headers={"X-API-KEY": self.kp_key},
        )
        if not isinstance(row, dict):
            return item_key, None
        ru = str(row.get("name") or "").strip()
        overview = str(row.get("description") or row.get("shortDescription") or "").strip()
        genres = [
            str(x.get("name") or "").strip()
            for x in row.get("genres") or []
            if isinstance(x, dict) and str(x.get("name") or "").strip()
        ]
        payload = {"source": "Кинопоиск V3452", "externalId": external_id}
        if has_cyr(ru):
            payload["ru"] = ru
        if has_cyr(overview):
            payload["overview"] = overview
        if genres:
            payload["genres"] = genres
        return item_key, payload if has_cyr(payload.get("ru")) else None

    def _prefetch_kinopoisk(self, items: list[dict]):
        if not self.kp_key:
            self.stats["kinopoisk_skipped_no_secret"] += 1
            return
        candidates = [
            item for item in items
            if self._kinopoisk_id(item)
            and self._needs_provider_repair(item)
            and not self._has_verified_cache(self._item_key(item), "kinopoisk")
        ]
        self.stats["kinopoisk_candidates"] = len(candidates)
        with ThreadPoolExecutor(max_workers=self.kp_workers) as pool:
            futures = [pool.submit(self._kp_one, item) for item in candidates]
            for index, future in enumerate(as_completed(futures), 1):
                iid, payload = future.result()
                if payload:
                    self._store(iid, payload)
                    self.stats["kinopoisk_titles_resolved"] += int(bool(payload.get("ru")))
                if index % 100 == 0:
                    self.save()
        self.save()

    def prefetch(self, items: list[dict]):
        if not self.online:
            return
        self._prefetch_shikimori(items)
        self._prefetch_kinopoisk(items)
        self._prefetch_tmdb(items)
        self.save()

    def overlay(self, item: dict) -> dict:
        iid = str(item.get("id") or "")
        value = self.cache.get("items", {}).get(iid)
        return dict(value) if isinstance(value, dict) else {}


def localize_item(item: dict, title_map: dict[str,str], stats: Counter) -> dict:
    x=dict(item)
    before_title=str(x.get('ru') or x.get('title') or x.get('name') or '')
    official = RESOLVER.overlay(x) if RESOLVER else {}

    if has_cyr(official.get('ru')):
        x['ru']=official['ru']
        x['titleLocalizationSource']=official.get('source') or 'official'
        stats['official_titles_applied']+=1

    if has_cyr(official.get('overview')):
        x['overview']=official['overview']
        if 'description' in x:
            x['description']=official['overview']
        x['overviewLocalizationSource']=official.get('source') or 'official'
        stats['official_overviews_applied']+=1

    if official.get('genres'):
        x['genres']=official['genres']

    ru, original=localize_title(x,title_map)
    if ru!=before_title:
        stats['titles_localized']+=1
    x['ru']=ru
    if 'title' in x:
        x['title']=ru
    if 'name' in x and not x.get('title'):
        x['name']=ru

    if original and norm(original)!=norm(ru):
        x.setdefault('en',original)
        x.setdefault('originalTitle',original)

    if not x.get('titleLocalizationSource'):
        if has_cyr(before_title):
            x['titleLocalizationSource']='existing'
        elif any(title_map.get(norm(str(x.get(k) or ''))) for k in ('ru','title','name','en','originalTitle')):
            x['titleLocalizationSource']='manual-map'
        else:
            x['titleLocalizationSource']='transliteration'
            stats['fallback_transliterated_titles']+=1

    x['type']=localize_type(x.get('type') or x.get('category'))
    if 'category' in x:
        x['category']=localize_type(x.get('category') or x['type'])

    genres=localize_genres(x.get('genres'))
    if genres!=x.get('genres'):
        stats['genres_localized']+=1
    x['genres']=genres

    if 'status' in x:
        x['status']=localize_status(x.get('status'))

    if 'source' in x:
        x['sourceLabel']=SOURCE_MAP.get(norm(x.get('source')),str(x.get('source') or ''))

    ov=str(x.get('overview') or x.get('description') or '').strip()
    if not ov or latin_only(ov):
        if ov:
            x.setdefault('overviewOriginal',ov)
        newov=generated_overview(x)
        if 'description' in x and 'overview' not in x:
            x['description']=newov
        else:
            x['overview']=newov
        x['overviewGeneratedRu']=True
        stats['descriptions_russianized']+=1

    aliases=[]
    for a in x.get('aliases') or []:
        if a and str(a).strip():
            aliases.append(str(a).strip())
    aliases += [ru,original,official.get('original','')]
    seen=set()
    x['aliases']=[
        a for a in aliases
        if a and not (norm(a) in seen or seen.add(norm(a)))
    ]
    return x


def quality(x: dict) -> tuple:
    return (
        1 if has_cyr(x.get('ru')) else 0,
        1 if x.get('poster') else 0,
        1 if x.get('overview') and not x.get('overviewGeneratedRu') else 0,
        int(x.get('votes') or 0),
        float(x.get('rating') or 0),
        len(json.dumps(x,ensure_ascii=False))
    )

def strong_dup_key(x: dict) -> tuple:
    typ=norm(x.get('type') or x.get('category'))
    year=str(x.get('year') or '')
    names=[norm(x.get(k)) for k in ('ru','en','title','name','originalTitle','original_title','original_name') if x.get(k)]
    names=[n for n in names if n]
    canonical=names[0] if names else ''
    return canonical,year,typ

def evidence_overlap(a: dict,b: dict) -> bool:
    if str(a.get('id') or '') and str(a.get('id'))==str(b.get('id')): return True
    pa=str(a.get('poster') or ''); pb=str(b.get('poster') or '')
    if pa and pb and pa==pb: return True
    na={norm(a.get(k)) for k in ('ru','en','title','name','originalTitle','original_title','original_name') if a.get(k)}
    nb={norm(b.get(k)) for k in ('ru','en','title','name','originalTitle','original_title','original_name') if b.get(k)}
    overlap={n for n in na&nb if len(n)>=4}
    return bool(overlap)

def merge_items(items: list[dict], stats: Counter) -> list[dict]:
    # First remove exact ID duplicates across sources/chunks.
    by_id=defaultdict(list); without_id=[]
    for x in items:
        iid=str(x.get('id') or '').strip()
        (by_id[iid] if iid else without_id).append(x) if iid else without_id.append(x)
    id_clean=[]
    for iid,group in by_id.items():
        if len(group)==1:
            id_clean.append(group[0]); continue
        best=max(group,key=quality).copy()
        aliases=[]
        for x in group:
            aliases.extend(x.get('aliases') or [])
            for k,v in x.items():
                if (k not in best or best.get(k) in ('',None,[],{})) and v not in ('',None,[],{}): best[k]=v
        seen=set(); best['aliases']=[a for a in aliases if a and not (norm(a) in seen or seen.add(norm(a)))]
        stats['duplicates_removed']+=len(group)-1
        id_clean.append(best)
    items=id_clean+without_id
    groups=defaultdict(list)
    for x in items: groups[strong_dup_key(x)].append(x)
    out=[]
    for key,group in groups.items():
        if not key[0] or len(group)==1:
            out.extend(group); continue
        clusters=[]
        for x in group:
            placed=False
            for cl in clusters:
                if any(evidence_overlap(x,y) for y in cl): cl.append(x); placed=True; break
            if not placed: clusters.append([x])
        for cl in clusters:
            if len(cl)==1: out.append(cl[0]); continue
            best=max(cl,key=quality).copy()
            aliases=[]
            for x in cl:
                aliases.extend(x.get('aliases') or [])
                for k,v in x.items():
                    if (k not in best or best.get(k) in ('',None,[],{})) and v not in ('',None,[],{}): best[k]=v
            seen=set(); best['aliases']=[a for a in aliases if a and not (norm(a) in seen or seen.add(norm(a)))]
            best['mergedDuplicateIds']=[str(x.get('id')) for x in cl if x.get('id') and str(x.get('id'))!=str(best.get('id'))]
            stats['duplicates_removed']+=len(cl)-1
            out.append(best)
    return out

def dump_json(path: Path,data: Any):
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def process_primary_chunks(root: Path,title_map: dict[str,str],stats: Counter,dry=False):
    files=sorted((root/'data').glob('chunk_*.json'))
    all_items=[]
    for p in files:
        try: all_items.extend(json.loads(p.read_text(encoding='utf-8')))
        except Exception: stats['json_errors']+=1
    stats['primary_before']=len(all_items)
    localized=[localize_item(x,title_map,stats) for x in all_items if isinstance(x,dict)]
    clean=merge_items(localized,stats)
    clean.sort(key=lambda x:(localize_type(x.get('type')), -int(x.get('votes') or 0), norm(x.get('ru'))))
    stats['primary_after']=len(clean)
    if not dry:
        size=500
        for p in files: p.unlink()
        for i in range(0,len(clean),size): dump_json(root/'data'/f'chunk_{i//size+1:04d}.json',clean[i:i+size])
        # mirror canonical chunks directory
        chunks=root/'data/chunks'; chunks.mkdir(exist_ok=True)
        for p in chunks.glob('chunk_*.json'): p.unlink()
        for i in range(0,len(clean),size): dump_json(chunks/f'chunk_{i//size+1:04d}.json',clean[i:i+size])
    return clean

def process_catalog_file(path: Path,title_map: dict[str,str],stats: Counter,dry=False):
    if not path.exists(): return
    try: data=json.loads(path.read_text(encoding='utf-8'))
    except Exception: stats['json_errors']+=1; return
    if isinstance(data,list):
        arr=[localize_item(x,title_map,stats) if isinstance(x,dict) else x for x in data]
        arr=merge_items([x for x in arr if isinstance(x,dict)],stats)
        if not dry: dump_json(path,arr)
    elif isinstance(data,dict):
        changed=False
        for k,v in list(data.items()):
            if isinstance(v,list) and v and isinstance(v[0],dict):
                data[k]=merge_items([localize_item(x,title_map,stats) for x in v],stats); changed=True
        if changed and not dry: dump_json(path,data)

def rebuild_search(root: Path,items: list[dict],stats: Counter,dry=False):
    rows=[]
    for x in items:
        row={k:x.get(k,'') for k in ('id','ru','en','year','type','rating','votes','poster','genres','overview','episodes','studio','country','status','ageRating','source')}
        row['aliases']=x.get('aliases') or []
        row['search']=' '.join(str(v) for v in [row['ru'],row['en'],' '.join(row['aliases']),' '.join(row['genres']),row['year'],row['type']] if v)
        rows.append(row)
    # append books/games
    for p in [root/'data/books_catalog.json',root/'data/games_catalog.json']:
        if p.exists():
            d=json.loads(p.read_text(encoding='utf-8'))
            arr=d if isinstance(d,list) else d.get('items',[]) if isinstance(d,dict) else []
            for x in arr:
                if not isinstance(x,dict): continue
                row={k:x.get(k,'') for k in ('id','ru','en','year','type','rating','votes','poster','genres','overview','description','status','source')}
                row['ru']=x.get('ru') or x.get('title') or x.get('name')
                row['en']=x.get('en') or x.get('originalTitle') or ''
                row['overview']=x.get('overview') or x.get('description') or ''
                row['aliases']=x.get('aliases') or []
                row['search']=' '.join(str(v) for v in [row['ru'],row['en'],' '.join(row['aliases']),' '.join(row.get('genres') or []),row['year'],row['type']] if v)
                rows.append(row)
    rows=merge_items(rows,stats)
    stats['search_total']=len(rows)
    if not dry:
        fast=root/'data/fast'; fast.mkdir(exist_ok=True)
        dump_json(fast/'search_index.json',rows)
        lite=[{k:x.get(k,'') for k in ('id','ru','en','aliases','year','type','rating','votes','poster','genres','search')} for x in rows]
        dump_json(fast/'search_lite.json',lite)
        film_fast=root/'film/data/fast'
        if film_fast.exists():
            film_fast.mkdir(parents=True,exist_ok=True)
            dump_json(film_fast/'search_index.json',rows)
            dump_json(film_fast/'search_lite.json',lite)
    return rows

def process_poster_wall(root: Path,items_by_id: dict[str,dict],stats: Counter,dry=False):
    wall=root/'data/fast/poster_wall_v333'
    if not wall.exists():
        return

    total=0
    kind_counts={}
    global_seen=set()

    for prefix in ('movies','series','anime','cartoons'):
        files=sorted(wall.glob(f'{prefix}_*.json'))
        kind_count=0
        for p in files:
            try:
                data=json.loads(p.read_text(encoding='utf-8'))
            except Exception:
                stats['json_errors']+=1
                continue
            if not isinstance(data,list):
                continue

            out=[]
            for row in data:
                if not isinstance(row,list) or len(row)<2:
                    continue
                iid=str(row[0] or '')
                dedupe_key=(prefix,iid) if iid else (prefix,norm(row[1]),str(row[3] if len(row)>3 else ''))
                if dedupe_key in global_seen:
                    stats['poster_wall_duplicates_removed']+=1
                    continue
                global_seen.add(dedupe_key)

                item=items_by_id.get(iid)
                if item:
                    row[1]=item.get('ru') or row[1]
                    if len(row)>2:
                        row[2]=item.get('en') or item.get('originalTitle') or row[2]
                    if len(row)>8:
                        row[8]='|'.join(item.get('genres') or [])
                    if len(row)>9 and item.get('source'):
                        row[9]=item.get('source')
                    if len(row)>10 and item.get('status'):
                        row[10]=item.get('status')
                    stats['poster_wall_rows_localized']+=1
                out.append(row)

            kind_count+=len(out)
            if not dry:
                dump_json(p,out)

        kind_counts[prefix]=kind_count
        total+=kind_count

    seed_path=wall/'seed_all.json'
    if seed_path.exists():
        try:
            seed=json.loads(seed_path.read_text(encoding='utf-8'))
        except Exception:
            seed=[]
        out=[]
        seen=set()
        for row in seed if isinstance(seed,list) else []:
            if not isinstance(row,list) or len(row)<2:
                continue
            iid=str(row[0] or '')
            key=iid or (norm(row[1]),str(row[3] if len(row)>3 else ''))
            if key in seen:
                continue
            seen.add(key)
            item=items_by_id.get(iid)
            if item:
                row[1]=item.get('ru') or row[1]
                if len(row)>2:
                    row[2]=item.get('en') or item.get('originalTitle') or row[2]
                if len(row)>8:
                    row[8]='|'.join(item.get('genres') or [])
                if len(row)>10 and item.get('status'):
                    row[10]=item.get('status')
            out.append(row)
        if not dry:
            dump_json(seed_path,out)

    manifest_path=wall/'manifest.json'
    if manifest_path.exists():
        try:
            manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
        except Exception:
            manifest={}
        manifest['version']='v3452-official-russian-repair'
        manifest['total']=total
        manifest['duplicatesRemoved']=int(manifest.get('sourceTotal') or total)-total
        for kind,count in kind_counts.items():
            manifest.setdefault('kinds',{}).setdefault(kind,{})['count']=count
        if not dry:
            dump_json(manifest_path,manifest)

    stats['poster_wall_total_after']=total


def process_derived_json(root: Path,items_by_id: dict[str,dict],title_map: dict[str,str],stats: Counter,dry=False):
    targets=[]
    fast=root/'data/fast'
    for p in [fast/'home.json', fast/'seed.json', fast/'seed_all.json']:
        if p.exists(): targets.append(p)
    pages=fast/'pages'
    if pages.exists(): targets.extend(pages.rglob('*.json'))
    for p in targets:
        try: data=json.loads(p.read_text(encoding='utf-8'))
        except Exception: stats['json_errors']+=1; continue
        changed=False
        def walk(v):
            nonlocal changed
            if isinstance(v,list):
                out=[]; seen=set()
                for x in v:
                    y=walk(x)
                    if isinstance(y,dict):
                        iid=str(y.get('id') or '')
                        key=iid or (norm(y.get('ru') or y.get('title') or y.get('name')),str(y.get('year') or ''),norm(y.get('type')))
                        if key in seen: stats['derived_duplicates_removed']+=1; changed=True; continue
                        seen.add(key)
                    out.append(y)
                return out
            if isinstance(v,dict):
                iid=str(v.get('id') or '')
                if iid and iid in items_by_id:
                    src=items_by_id[iid]
                    for k in ('ru','en','year','type','rating','votes','poster','genres','overview','status','aliases'):
                        if k in src:
                            v[k]=src[k]; changed=True
                elif any(k in v for k in ('ru','title','name')):
                    v=localize_item(v,title_map,stats); changed=True
                for k,val in list(v.items()):
                    if isinstance(val,(list,dict)): v[k]=walk(val)
                return v
            return v
        data=walk(data)
        if changed and not dry: dump_json(p,data)
        if changed: stats['derived_files_localized']+=1

def patch_ui(root: Path,stats: Counter,dry=False):
    index=root/'index.html'; features=root/'features_v344.js'; app=root/'app.js'
    if index.exists():
        s=index.read_text(encoding='utf-8')
        s=s.replace('<html lang="en">','<html lang="ru">')
        replacements={'Top anime':'Топ аниме','Movie tonight':'Фильм на вечер','Open card':'Открыть карточку','Loading...':'Загрузка...','Search':'Поиск','Back':'Назад','Next':'Вперёд'}
        for a,b in replacements.items(): s=s.replace(a,b)
        if not dry: index.write_text(s,encoding='utf-8')
    for p in [features,app]:
        if not p.exists(): continue
        s=p.read_text(encoding='utf-8')
        # visible labels only; identifiers untouched
        for a,b in {'Open card':'Открыть карточку','No results':'Ничего не найдено','Loading...':'Загрузка...','Unknown':'Неизвестно'}.items(): s=s.replace(a,b)
        if not dry: p.write_text(s,encoding='utf-8')
    stats['ui_patched']=1

def process_static_pages(root: Path,title_by_id: dict[str,dict],stats: Counter,dry=False):
    film=root/'film'
    if not film.exists():
        return

    def attr_replace(source: str, property_name: str, value: str) -> str:
        escaped=html.escape(value,quote=True)
        pattern=rf'(<meta\s+(?:name|property)=["\']{re.escape(property_name)}["\']\s+content=)["\'][^"\']*["\']'
        return re.sub(pattern,lambda m:m.group(1)+f'"{escaped}"',source,flags=re.I)

    for p in film.glob('*.html'):
        if p.name.startswith('data'):
            continue
        try:
            source=p.read_text(encoding='utf-8')
        except Exception:
            continue

        match=re.search(r'data-id=["\']([^"\']+)',source)
        iid=match.group(1) if match else p.stem
        item=title_by_id.get(iid)
        if not item:
            continue

        ru=str(item.get('ru') or '').strip()
        if not ru:
            continue
        original=str(item.get('en') or item.get('originalTitle') or '').strip()
        typ=localize_type(item.get('type'))
        year=str(item.get('year') or '').strip()
        rating=str(item.get('rating') or '').strip()
        votes=str(item.get('votes') or '0').strip()
        genres=localize_genres(item.get('genres'))
        overview=str(item.get('overview') or item.get('description') or generated_overview(item)).strip()

        title_text=f"{ru} — {typ}" + (f" {year}" if year else "") + (f", рейтинг {rating}" if rating else "")
        meta_desc=f"{ru} — {typ.lower()}" + (f" {year} года" if year else "")
        if rating:
            meta_desc+=f", рейтинг {rating}"
        if genres:
            meta_desc+=f". Жанры: {', '.join(genres)}"
        meta_desc+="."

        changed=source
        changed=changed.replace('<html lang="en">','<html lang="ru">')
        changed=re.sub(r'<title>.*?</title>',f'<title>{html.escape(title_text)}</title>',changed,count=1,flags=re.S|re.I)
        changed=attr_replace(changed,'description',meta_desc)
        changed=attr_replace(changed,'og:title',ru)
        changed=attr_replace(changed,'og:description',meta_desc)
        changed=re.sub(r'(<h1[^>]*>).*?(</h1>)',lambda m:m.group(1)+html.escape(ru)+m.group(2),changed,count=1,flags=re.S|re.I)
        changed=re.sub(
            r'(<p class=["\']meta["\']>).*?(</p>)',
            lambda m:m.group(1)+html.escape(f"{typ} · {year or 'год не указан'} · голосов: {votes}")+m.group(2),
            changed,count=1,flags=re.S|re.I
        )
        changed=re.sub(
            r'(<p class=["\']genres["\']>).*?(</p>)',
            lambda m:m.group(1)+html.escape(' · '.join(genres))+m.group(2),
            changed,count=1,flags=re.S|re.I
        )
        changed=re.sub(
            r'(<p class=["\']overview["\']>).*?(</p>)',
            lambda m:m.group(1)+html.escape(overview)+m.group(2),
            changed,count=1,flags=re.S|re.I
        )
        changed=re.sub(
            r'(<img\b[^>]*\balt=)["\'][^"\']*["\']',
            lambda m:m.group(1)+f'"{html.escape(ru,quote=True)}"',
            changed,count=1,flags=re.I
        )

        ld_match=re.search(r'(<script type=["\']application/ld\+json["\']>)(.*?)(</script>)',changed,re.S|re.I)
        if ld_match:
            try:
                ld=json.loads(ld_match.group(2))
                if isinstance(ld,dict):
                    ld['name']=ru
                    ld['description']=overview
                    ld['genre']=genres
                    if original and norm(original)!=norm(ru):
                        ld['alternateName']=original
                    ld_json=json.dumps(ld,ensure_ascii=False,separators=(',',':'))
                    changed=changed[:ld_match.start(2)]+ld_json+changed[ld_match.end(2):]
            except Exception:
                stats['static_jsonld_errors']+=1

        if changed!=source:
            stats['static_pages_localized']+=1
            if not dry:
                p.write_text(changed,encoding='utf-8')


def collect_prefetch_items(root: Path) -> list[dict]:
    items=[]
    for p in sorted((root/'data').glob('chunk_*.json')):
        try:
            value=json.loads(p.read_text(encoding='utf-8'))
            if isinstance(value,list):
                items.extend(x for x in value if isinstance(x,dict))
        except Exception:
            pass
    for p in [
        root/'data/books_catalog.json',
        root/'data/games_catalog.json',
        root/'data/books/books.json',
        root/'data/books/comics.json',
        root/'data/books/manga.json',
        root/'data/books/ranobe.json',
        root/'anime-tv/anime_data.json',
    ]:
        if not p.exists():
            continue
        try:
            value=json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        if isinstance(value,list):
            items.extend(x for x in value if isinstance(x,dict))
        elif isinstance(value,dict):
            for child in value.values():
                if isinstance(child,list):
                    items.extend(x for x in child if isinstance(x,dict))
    return items


def main():
    global RESOLVER
    ap=argparse.ArgumentParser()
    ap.add_argument('root')
    ap.add_argument('--dry-run',action='store_true')
    ap.add_argument('--offline',action='store_true')
    args=ap.parse_args()

    root=Path(args.root).resolve()
    stats=Counter()
    title_map=load_title_map(root)

    RESOLVER=OfficialRussianResolver(root,stats,online=not args.offline)
    prefetch_items=collect_prefetch_items(root)
    stats['prefetch_items']=len(prefetch_items)
    RESOLVER.prefetch(prefetch_items)

    items=process_primary_chunks(root,title_map,stats,args.dry_run)

    for p in [
        root/'data/books_catalog.json',
        root/'data/games_catalog.json',
        root/'data/books/books.json',
        root/'data/books/comics.json',
        root/'data/books/manga.json',
        root/'data/books/ranobe.json',
        root/'anime-tv/anime_data.json',
    ]:
        process_catalog_file(p,title_map,stats,args.dry_run)

    rows=rebuild_search(root,items,stats,args.dry_run)
    byid={str(x.get('id')):x for x in items if x.get('id')}

    process_poster_wall(root,byid,stats,args.dry_run)
    process_derived_json(root,byid,title_map,stats,args.dry_run)
    patch_ui(root,stats,args.dry_run)
    process_static_pages(root,byid,stats,args.dry_run)

    stats['titles_cyrillic_after']=sum(has_cyr(x.get('ru')) for x in items)
    stats['titles_total_after']=len(items)
    stats['latin_display_titles_after']=sum(latin_only(x.get('ru')) for x in items)
    stats['official_cache_items']=len(RESOLVER.cache.get('items',{}))

    unresolved=[
        {
            'id':x.get('id'),
            'ru':x.get('ru'),
            'en':x.get('en'),
            'year':x.get('year'),
            'type':x.get('type'),
            'source':x.get('source'),
            'localizationSource':x.get('titleLocalizationSource'),
        }
        for x in items
        if norm(x.get('titleLocalizationSource')) not in (
            'shikimori v3452','tmdb ru-ru v3452','кинопоиск v3452',
            'shikimori','tmdb ru-ru','кинопоиск','existing'
        )
    ]
    if not args.dry_run:
        (root/'data/unresolved_official_ru_v3452.json').write_text(
            json.dumps(unresolved,ensure_ascii=False,indent=2),
            encoding='utf-8'
        )
        RESOLVER.save()

    report={
        'version':'V3452',
        'mode':'dry-run' if args.dry_run else 'apply',
        'online':not args.offline,
        'stats':dict(stats),
        'fallback_transliterated_examples':unresolved[:100],
    }
    (root/'TEST_REPORT_V3452_OFFICIAL_RU_REPAIR.json').write_text(
        json.dumps(report,ensure_ascii=False,indent=2),
        encoding='utf-8'
    )
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
