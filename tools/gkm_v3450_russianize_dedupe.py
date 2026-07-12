#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re, os, hashlib, html, shutil
from pathlib import Path
from collections import defaultdict, Counter
from typing import Any

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

def localize_item(item: dict, title_map: dict[str,str], stats: Counter) -> dict:
    x=dict(item)
    ru, original=localize_title(x,title_map)
    old_title=str(x.get('ru') or x.get('title') or x.get('name') or '')
    if ru!=old_title: stats['titles_localized']+=1
    x['ru']=ru
    if 'title' in x: x['title']=ru
    if 'name' in x and not x.get('title'): x['name']=ru
    if original and norm(original)!=norm(ru):
        x.setdefault('en',original)
        x.setdefault('originalTitle',original)
    x['type']=localize_type(x.get('type') or x.get('category'))
    if 'category' in x: x['category']=localize_type(x.get('category') or x['type'])
    genres=localize_genres(x.get('genres'))
    if genres!=x.get('genres'): stats['genres_localized']+=1
    x['genres']=genres
    if 'status' in x: x['status']=localize_status(x.get('status'))
    if 'source' in x:
        x['sourceLabel']=SOURCE_MAP.get(norm(x.get('source')),str(x.get('source') or ''))
    ov=str(x.get('overview') or x.get('description') or '').strip()
    if not ov or latin_only(ov):
        if ov: x.setdefault('overviewOriginal',ov)
        newov=generated_overview(x)
        if 'description' in x and 'overview' not in x: x['description']=newov
        else: x['overview']=newov
        x['overviewGeneratedRu']=True
        stats['descriptions_russianized']+=1
    # aliases retain both languages
    aliases=[]
    for a in x.get('aliases') or []:
        if a and str(a).strip(): aliases.append(str(a).strip())
    aliases += [ru,original]
    seen=set(); x['aliases']=[a for a in aliases if a and not (norm(a) in seen or seen.add(norm(a)))]
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
    return rows

def process_poster_wall(root: Path,items_by_id: dict[str,dict],stats: Counter,dry=False):
    wall=root/'data/fast/poster_wall_v333'
    if not wall.exists(): return
    for p in wall.glob('*.json'):
        if p.name in ('manifest.json','seed_all.json'): continue
        try: data=json.loads(p.read_text(encoding='utf-8'))
        except Exception: stats['json_errors']+=1; continue
        if not isinstance(data,list): continue
        out=[]; seen=set()
        for row in data:
            if not isinstance(row,list) or len(row)<2: continue
            iid=str(row[0]); item=items_by_id.get(iid)
            if item:
                row[1]=item.get('ru') or row[1]
                if len(row)>2: row[2]=item.get('en') or row[2]
                if len(row)>8: row[8]='|'.join(item.get('genres') or [])
                if len(row)>10: row[10]=item.get('status') or row[10]
            key=(iid,norm(row[1]),str(row[3] if len(row)>3 else ''))
            if key in seen: stats['wall_duplicates_removed']+=1; continue
            seen.add(key); out.append(row)
        if not dry: dump_json(p,out)
    # update manifest total
    mp=wall/'manifest.json'
    if mp.exists() and not dry:
        m=json.loads(mp.read_text(encoding='utf-8'))
        total=0; kinds={}
        for p in wall.glob('*.json'):
            if p.name in ('manifest.json','seed_all.json'): continue
            try: n=len(json.loads(p.read_text(encoding='utf-8')))
            except: continue
            total+=n; kinds.setdefault(p.stem.split('_')[0],0); kinds[p.stem.split('_')[0]]+=n
        m['total']=total; m['duplicatesRemoved']=int(m.get('duplicatesRemoved') or 0)+stats['wall_duplicates_removed']; m['russianized']=True
        dump_json(mp,m)

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
    if not film.exists(): return
    for p in film.glob('*.html'):
        if p.name.startswith('data'): continue
        try: s=p.read_text(encoding='utf-8')
        except: continue
        m=re.search(r'data-id=["\']([^"\']+)',s)
        iid=m.group(1) if m else p.stem
        item=title_by_id.get(iid)
        if not item: continue
        ru=str(item.get('ru') or '')
        en=str(item.get('en') or '')
        if not ru: continue
        old_candidates=[en]
        # title/h1 exact replacements only
        changed=False
        for old in old_candidates:
            if old and old!=ru and old in s:
                s=s.replace(f'<title>{html.escape(old)}',f'<title>{html.escape(ru)}')
                s=s.replace(f'>{html.escape(old)}<',f'>{html.escape(ru)}<')
                changed=True
        s=s.replace('<html lang="en">','<html lang="ru">')
        if changed: stats['static_pages_localized']+=1
        if not dry: p.write_text(s,encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('root'); ap.add_argument('--dry-run',action='store_true'); args=ap.parse_args()
    root=Path(args.root).resolve(); stats=Counter(); title_map=load_title_map(root)
    items=process_primary_chunks(root,title_map,stats,args.dry_run)
    for p in [root/'data/books_catalog.json',root/'data/games_catalog.json',root/'data/books/books.json',root/'data/books/comics.json',root/'data/books/manga.json',root/'data/books/ranobe.json']:
        process_catalog_file(p,title_map,stats,args.dry_run)
    rows=rebuild_search(root,items,stats,args.dry_run)
    byid={str(x.get('id')):x for x in items if x.get('id')}
    process_poster_wall(root,byid,stats,args.dry_run)
    process_derived_json(root,byid,title_map,stats,args.dry_run)
    patch_ui(root,stats,args.dry_run)
    process_static_pages(root,byid,stats,args.dry_run)
    # validate Russian coverage
    stats['titles_cyrillic_after']=sum(has_cyr(x.get('ru')) for x in items)
    stats['titles_total_after']=len(items)
    report={'version':'V3450','mode':'dry-run' if args.dry_run else 'apply','stats':dict(stats)}
    (root/'TEST_REPORT_V3450_RUSSIAN_DEDUPE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
