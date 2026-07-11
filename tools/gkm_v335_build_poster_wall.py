#!/usr/bin/env python3
"""Rebuild compact poster_wall_v333 data from data/fast/search_lite.json."""
import json,re,shutil
from pathlib import Path
from datetime import datetime,timezone
SRC=Path("data/fast/search_lite.json")
DEST=Path("data/fast/poster_wall_v333")
TMP=Path("data/fast/.poster_wall_v335_tmp")
CHUNK=5000
SEED=6000

def now():return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
def clean(v):return re.sub(r"\s+"," ",str(v or "")).strip()
def kind(it):
    t=clean(it.get("type") or it.get("category")).lower()
    if "аниме" in t or "anime" in t:return "anime",2
    if "мульт" in t or "cartoon" in t:return "cartoons",3
    if "сериал" in t or "series" in t:return "series",1
    return "movies",0
def poster_code(v):
    s=clean(v)
    m=re.search(r"image\.tmdb\.org/t/p/(?:w\d+|original)/(.+)$",s)
    if m:return "t:"+m.group(1)
    m=re.search(r"cdn\.myanimelist\.net/(.+)$",s)
    if m:return "m:"+m.group(1)
    return "u:"+s if s else ""
def compact(it,code):
    g=it.get("genres") or []
    if isinstance(g,str):g=re.split(r"[,|/;]+",g)
    g="|".join(clean(x.get("name") if isinstance(x,dict) else x) for x in g if clean(x.get("name") if isinstance(x,dict) else x))
    return [str(it.get("id") or it.get("kinopoiskId") or ""),clean(it.get("ru") or it.get("title_ru") or it.get("title") or it.get("name")),clean(it.get("en") or it.get("original_title") or it.get("original_name")),str(it.get("year") or ""),code,float(it.get("rating") or 0),int(it.get("votes") or 0),poster_code(it.get("poster") or it.get("image")),g,clean(it.get("source")),clean(it.get("status"))]
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
def main():
    data=json.loads(SRC.read_text(encoding="utf-8")); pools={k:[] for k in ("movies","series","anime","cartoons")};seen=set()
    for it in data:
        k=str(it.get("id") or it.get("kinopoiskId") or "")+"|"+clean(it.get("ru") or it.get("title") or it.get("name"))+"|"+str(it.get("year") or "")
        if k in seen:continue
        seen.add(k);name,code=kind(it);pools[name].append(compact(it,code))
    if TMP.exists():shutil.rmtree(TMP)
    TMP.mkdir(parents=True)
    manifest={"version":"v335-auto-rebuilt-poster-wall-2026-07-12","generatedAt":now(),"total":sum(map(len,pools.values())),"chunkSize":CHUNK,"seed":"seed_all.json","types":list(pools),"kinds":{}}
    for name,rows in pools.items():
        files=[]
        for i in range(0,len(rows),CHUNK):
            fn=f"{name}_{i//CHUNK:03d}.json";save(TMP/fn,rows[i:i+CHUNK]);files.append(fn)
        manifest["kinds"][name]={"count":len(rows),"files":files}
    seed=[];idx={k:0 for k in pools};names=list(pools)
    while len(seed)<SEED and any(idx[k]<len(pools[k]) for k in names):
        for k in names:
            if idx[k]<len(pools[k]):seed.append(pools[k][idx[k]]);idx[k]+=1
            if len(seed)>=SEED:break
    save(TMP/"seed_all.json",seed);save(TMP/"manifest.json",manifest)
    if manifest["total"]<1:raise SystemExit("poster wall build empty")
    if DEST.exists():shutil.rmtree(DEST)
    shutil.move(str(TMP),str(DEST))
    print(json.dumps(manifest,ensure_ascii=False))
if __name__=="__main__":main()
