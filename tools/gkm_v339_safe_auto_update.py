#!/usr/bin/env python3
"""GKM V339 — safe append-only Kinopoisk catalog update.
Never publishes a smaller catalog. Writes chunks to a temp directory, validates,
then atomically replaces the active chunk set and rebuilds data/index.json.
"""
from __future__ import annotations
import json, os, re, time, shutil, sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

VERSION="v339-safe-auto-update-complete-workflow-2026-07-12"
DATA=Path("data")
TMP=DATA/".gkm_v338_tmp"
REPORT=DATA/"gkm_v338_auto_update_report.json"
API="https://api.kinopoisk.dev/v1.4/movie"
KEY=(os.environ.get("KINOPOISK_API_KEY") or "").strip()
PAGES=int(os.environ.get("GKM_KP_PAGES_PER_TYPE","2"))
LIMIT=int(os.environ.get("GKM_KP_LIMIT","250"))
SLEEP=float(os.environ.get("GKM_KP_SLEEP","0.35"))
CHUNK=int(os.environ.get("GKM_AUTO_UPDATE_CHUNK_SIZE","500"))
TYPES=[("movie","Фильм"),("tv-series","Сериал"),("cartoon","Мультфильм"),("animated-series","Мультсериал"),("anime","Аниме")]
FIELDS=["id","name","alternativeName","enName","type","year","description","shortDescription","poster","rating","votes","genres","countries","ageRating","status","updatedAt"]

def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
def clean(v): return re.sub(r"\s+"," ",str(v or "")).strip()
def norm(v): return re.sub(r"\s+"," ",re.sub(r"[^0-9a-zа-яё一-龯ぁ-ゔァ-ヴー]+"," ",str(v or "").lower().replace("ё","е"))).strip()
def load(p,d=None):
    try:return json.loads(p.read_text(encoding="utf-8"))
    except:return d

def save(p,x,pretty=False):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(x,ensure_ascii=False,indent=2 if pretty else None,separators=None if pretty else (",",":")),encoding="utf-8")
def active_chunks():
    root=sorted(DATA.glob("chunk_*.json"))
    if root:return DATA,root
    sub=sorted((DATA/"chunks").glob("chunk_*.json"))
    return (DATA/"chunks",sub)
def items_from_chunks(files):
    out=[]
    for p in files:
        x=load(p,[])
        if isinstance(x,list):out.extend(v for v in x if isinstance(v,dict))
    return out
def key(it):
    kid=clean(it.get("kinopoiskId") or it.get("kpId"))
    if kid:return "kp::"+kid
    sid=clean(it.get("id"))
    if sid.startswith("kp_"):return sid
    return f"{norm(it.get('type') or it.get('category'))}::{norm(it.get('ru') or it.get('name') or it.get('title') or it.get('en'))}::{it.get('year') or ''}"
def list_names(v,n=10):
    out=[]
    if not isinstance(v,list):return out
    for x in v:
        s=clean((x.get("name") or x.get("title")) if isinstance(x,dict) else x)
        if s and s not in out:out.append(s)
        if len(out)>=n:break
    return out
def rating(doc):
    x=doc.get("rating") if isinstance(doc.get("rating"),dict) else {}
    for k in ("kp","imdb","filmCritics"):
        try:
            v=float(x.get(k) or 0)
            if v:return round(v,1)
        except:pass
    return 0
def votes(doc):
    x=doc.get("votes") if isinstance(doc.get("votes"),dict) else {}
    for k in ("kp","imdb","filmCritics"):
        try:
            v=int(x.get(k) or 0)
            if v:return v
        except:pass
    return 0
def map_doc(doc,typ):
    kid=doc.get("id")
    if not kid:return None
    poster=doc.get("poster") if isinstance(doc.get("poster"),dict) else {}
    ru=clean(doc.get("name") or doc.get("alternativeName") or doc.get("enName"))
    en=clean(doc.get("alternativeName") or doc.get("enName") or doc.get("name"))
    item={"id":f"kp_{kid}","kinopoiskId":kid,"ru":ru,"en":en,"year":doc.get("year") or "","type":typ,"category":typ,
          "rating":rating(doc),"votes":votes(doc),"genres":list_names(doc.get("genres"),12),
          "overview":clean(doc.get("description") or doc.get("shortDescription")),"shortDescription":clean(doc.get("shortDescription")),
          "poster":clean(poster.get("url") or poster.get("previewUrl")),"country":list_names(doc.get("countries"),6),
          "status":clean(doc.get("status")),"ageRating":(str(doc.get("ageRating"))+"+") if doc.get("ageRating") else "",
          "source":"kinopoisk_auto_v339","updated_at":now()}
    return {k:v for k,v in item.items() if v not in (None,"",[],{})}
def request(params):
    url=API+"?"+urlencode(params,doseq=True)
    req=Request(url,headers={"accept":"application/json","X-API-KEY":KEY,"User-Agent":"GKM-Safe-AutoUpdate/339"})
    try:
        with urlopen(req,timeout=40) as r:return json.loads(r.read().decode("utf-8","replace"))
    except HTTPError as e:
        body=e.read().decode("utf-8","ignore")
        raise RuntimeError(f"HTTP {e.code}: {body[:1000]}")
    except URLError as e:raise RuntimeError(str(e))
def fetch_type(api_type,ru_type):
    out=[];seen=set()
    for page in range(1,PAGES+1):
        base=[("selectFields",f) for f in FIELDS]+[("page",page),("limit",LIMIT),("type",api_type)]
        data=None;last=None
        for sf in ("updatedAt","year","votes.kp"):
            try:data=request(base+[("sortField",sf),("sortType","-1")]);break
            except Exception as e:last=e
        if data is None:raise last or RuntimeError("request failed")
        docs=data.get("docs") if isinstance(data,dict) else []
        if not isinstance(docs,list) or not docs:break
        for d in docs:
            it=map_doc(d,ru_type)
            if it and key(it) not in seen:seen.add(key(it));out.append(it)
        time.sleep(SLEEP)
    return out
def merge(old,new):
    out=dict(old)
    for k,v in new.items():
        if v in (None,"",[],{}):continue
        if k in ("rating","votes"):
            try:
                if float(v)>=float(out.get(k) or 0):out[k]=v
            except:out[k]=v
        elif k in ("overview","shortDescription","poster","genres","country","status","ageRating","ru","en"):
            if not out.get(k) or str(out.get("source","")).startswith(("tmdb","jikan","kinopoisk_auto")):out[k]=v
        elif not out.get(k):out[k]=v
    out["updated_at"]=now()
    return out
def main():
    if "--validate-only" in sys.argv:
        root,files=active_chunks();items=items_from_chunks(files);assert items and len({key(x) for x in items})>0
        print(json.dumps({"version":VERSION,"count":len(items),"chunks":len(files)},ensure_ascii=False));return 0
    if not KEY:raise SystemExit("KINOPOISK_API_KEY is missing")
    root,files=active_chunks();existing=items_from_chunks(files)
    by={key(x):x for x in existing if key(x)};before=len(by)
    fetched=[]
    for api_type,ru_type in TYPES:fetched.extend(fetch_type(api_type,ru_type))
    added=updated=0
    for x in fetched:
        k=key(x)
        if k in by:
            y=merge(by[k],x);updated+=int(y!=by[k]);by[k]=y
        else:by[k]=x;added+=1
    items=list(by.values())
    items.sort(key=lambda x:(int(x.get("votes") or 0),float(x.get("rating") or 0),str(x.get("year") or "")),reverse=True)
    after=len(items)
    if after<before:raise SystemExit(f"SAFETY STOP: {before=} {after=}")
    if TMP.exists():shutil.rmtree(TMP)
    TMP.mkdir(parents=True)
    for i in range(0,after,CHUNK):save(TMP/f"chunk_{i//CHUNK+1:04d}.json",items[i:i+CHUNK])
    test=items_from_chunks(sorted(TMP.glob("chunk_*.json")))
    if len(test)!=after or len({key(x) for x in test})!=after:raise SystemExit("SAFETY STOP: temp validation failed")
    root.mkdir(parents=True,exist_ok=True)
    for p in root.glob("chunk_*.json"):p.unlink()
    for p in sorted(TMP.glob("chunk_*.json")):shutil.move(str(p),root/p.name)
    shutil.rmtree(TMP,ignore_errors=True)
    prefix="data/" if root==DATA else "data/chunks/"
    chunks=sorted(root.glob("chunk_*.json"))
    save(DATA/"index.json",{"version":VERSION,"total":after,"chunkSize":CHUNK,"chunks":[prefix+p.name for p in chunks],"updatedAt":now(),"source":"kinopoisk.dev safe append-only"},True)
    report={"version":VERSION,"before":before,"fetched":len(fetched),"added":added,"updated":updated,"after":after,"chunks":len(chunks),"updatedAt":now()}
    save(REPORT,report,True);print(json.dumps(report,ensure_ascii=False));return 0
if __name__=="__main__":raise SystemExit(main())
