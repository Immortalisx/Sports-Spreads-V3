#!/usr/bin/env python3
"""Offline, bounded QB/blitz history builder — no betting provider credits.

Sources:
  nflverse/nfldata games.csv (regular-season schedule and final results)
  nflverse-data releases: FTN charting and play_by_play (2022–2025)
FTN licensing: CC BY-SA 4.0; retain attribution/share-alike for derived data.
No raw play-by-play or charted plays are written to the research artifact.

Most important: a game's projected QB is inferred from earlier eligible games,
NEVER its actually recorded starting QB. FTN is conservatively delayed 3 days.
"""
from __future__ import annotations
import csv
import datetime as dt
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict, deque
from pathlib import Path

BASE="https://github.com/nflverse/nflverse-data/releases/download"
SCHEDULE="https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
YEARS=(2022,2023,2024,2025)
MAX_BYTES=250_000_000
LAG_DAYS=3
QB_BLITZ_MIN=8
QB_BASE_MIN=20
DEF_PASS_MIN=50
ALIASES={"LAR":"LA","STL":"LA","JAC":"JAX","WSH":"WAS","OAK":"LV","SD":"LAC","SDG":"LAC"}
def team(t):
    t=(t or "").strip().upper()
    return ALIASES.get(t,t)
def download(url,dest):
    req=urllib.request.Request(url,headers={"Accept":"text/csv","User-Agent":"Sports-Spreads-Historical-Research/1.0"})
    h=hashlib.sha256()
    with urllib.request.urlopen(req,timeout=60) as stream,open(dest,"wb") as out:
        total=0
        while True:
            b=stream.read(512*1024)
            if not b:break
            total+=len(b)
            if total>MAX_BYTES:raise ValueError("Source file exceeds configured download limit")
            h.update(b);out.write(b)
    return {"sha256":h.hexdigest(),"bytes":total}
def rows(file,fields):
    with open(file,newline="",encoding="utf-8-sig") as f:
        r=csv.DictReader(f)
        missing=fields-set(r.fieldnames or [])
        if missing:raise ValueError("Source columns missing: "+",".join(sorted(missing)))
        yield from r
def read_games(file):
    out={}
    for r in rows(file,{"game_id","gameday","season","game_type","home_team","away_team","home_score","away_score"}):
        try:
            season=int(r["season"])
            if season not in YEARS or r["game_type"]!="REG":continue
            h=int(float(r["home_score"]));a=int(float(r["away_score"]))
            if h<0 or a<0 or h==a:continue
            date=dt.date.fromisoformat(r["gameday"])
            hid,aid=team(r["home_team"]),team(r["away_team"])
            key=r["game_id"]
            if not hid or not aid or hid==aid or key in out:raise ValueError("Invalid/duplicate fixture")
            out[key]={"gameId":"nfl-"+key,"sourceGameId":key,"league":"nfl","season":season,
                      "gameDate":date.isoformat(),"homeTeam":hid,"awayTeam":aid,
                      "homeScore":h,"awayScore":a}
        except (TypeError,ValueError):
            if r.get("home_score") and r.get("away_score") and r.get("game_type")=="REG" and r.get("season") in ("2022","2023","2024","2025"):
                raise
    return out
def summarize(a):
    return {"b":a["b"],"n":a["n"],"eb":a["eb"],"en":a["en"]}
def group_charted(year,pbp,ftn,fixture):
    chart={}
    for r in rows(ftn,{"nflverse_game_id","nflverse_play_id","n_blitzers"}):
        k=(r["nflverse_game_id"],r["nflverse_play_id"])
        if k in chart:raise ValueError("FTN duplicate play key: "+str(k))
        try:n=float(r["n_blitzers"])
        except (ValueError,TypeError):continue
        if int(n)==n and 0<=n<=12:chart[k]=int(n)>0
    data=defaultdict(lambda:{"qb":defaultdict(lambda:{"b":0,"n":0,"eb":0.0,"en":0.0}),
                              "def":defaultdict(lambda:{"b":0,"n":0})})
    total=matched=0
    for r in rows(pbp,{"game_id","play_id","posteam","defteam","passer_player_id","epa","pass_attempt","sack"}):
        key=r["game_id"]
        if key not in fixture or fixture[key]["season"]!=year:continue
        if r["pass_attempt"] not in ("1","1.0") and r["sack"] not in ("1","1.0"):continue
        qb=(r["passer_player_id"] or "").strip()
        offense,defense=team(r["posteam"]),team(r["defteam"])
        if not qb or not offense or not defense:continue
        game=fixture[key]
        if set((offense,defense))!=set((game["homeTeam"],game["awayTeam"])):continue
        total+=1
        k=(key,r["play_id"])
        if k not in chart:continue
        try:epa=float(r["epa"])
        except (ValueError,TypeError):continue
        if not -9<=epa<=9:continue
        blitz=chart[k];matched+=1
        q=data[key]["qb"][(offense,qb)]
        d=data[key]["def"][defense]
        bucket="b" if blitz else "n"
        q[bucket]+=1;q["e"+bucket]+=epa;d[bucket]+=1
    if total<3000 or matched/total<.95:
        raise ValueError("FTN/PBP join not reliable in "+str(year)+": "+str((matched,total)))
    return data,{"matched":matched,"passPlays":total,"coverage":matched/total,"ftnPlays":len(chart)}
def empty():
    return {"b":0,"n":0,"eb":0.0,"en":0.0}
def accumulate(records):
    o=empty()
    for x in records:
        for k in o:o[k]+=x.get(k,0)
    return o
def features_for_season(games,chart):
    ordered=sorted(games,key=lambda x:(x["gameDate"],x["sourceGameId"]))
    # Eligible game stats are inserted ONLY after a three-day publication lag.
    # Every game on the same calendar date sees exactly the same prior data.
    all_dates=sorted(set(g["gameDate"] for g in ordered))
    eligible=0
    qb_history=defaultdict(lambda:deque(maxlen=5))
    defense_history=defaultdict(lambda:deque(maxlen=5))
    latest_qb={}
    outputs={}
    for date in all_dates:
        cutoff=(dt.date.fromisoformat(date)-dt.timedelta(days=LAG_DAYS)).isoformat()
        while eligible<len(ordered) and ordered[eligible]["gameDate"]<=cutoff:
            prev=ordered[eligible];eligible+=1
            stats=chart.get(prev["sourceGameId"])
            if stats is None:continue
            for (offense,qb),values in stats["qb"].items():
                qb_history[(offense,qb)].append(dict(values))
            for defense,values in stats["def"].items():
                defense_history[defense].append(dict(values))
            # "Starter" is guessed from MOST charted dropbacks in prior game,
            # with publication delay. No later game lineup hindsight.
            for t in (prev["homeTeam"],prev["awayTeam"]):
                qbs=[(v["b"]+v["n"],q) for (offense,q),v in stats["qb"].items() if offense==t]
                if qbs and max(qbs)[0]>=8:latest_qb[t]=max(qbs)[1]
        def side(t,opponent):
            qb=latest_qb.get(t)
            q=accumulate(qb_history.get((t,qb),[])) if qb else empty()
            d=accumulate(defense_history.get(opponent,[]))
            qb_valid=q["b"]>=QB_BLITZ_MIN and q["n"]>=QB_BASE_MIN
            def_valid=d["b"]+d["n"]>=DEF_PASS_MIN
            if not qb_valid or not def_valid:
                return {"available":False,"projectedQb":qb or None,"blitzSample":q["b"],
                        "noBlitzSample":q["n"],"opponentSamples":d["b"]+d["n"],
                        "expectedEPA":None,"exposure":None}
            rate=d["b"]/(d["b"]+d["n"])
            qb_b=q["eb"]/q["b"];qb_n=q["en"]/q["n"]
            return {"available":True,"projectedQb":qb,"blitzSample":q["b"],
                    "noBlitzSample":q["n"],"opponentSamples":d["b"]+d["n"],
                    "expectedEPA":rate*qb_b+(1-rate)*qb_n,
                    "exposure":(qb_b-qb_n)*(rate-.28),
                    "opponentBlitzRate":rate}
        for g in (x for x in ordered if x["gameDate"]==date):
            home=side(g["homeTeam"],g["awayTeam"]);away=side(g["awayTeam"],g["homeTeam"])
            both=home["available"] and away["available"]
            outputs[g["gameId"]]={
                "gameId":g["gameId"],"season":g["season"],"gameDate":date,
                "sourceDataThrough":cutoff,"home":home,"away":away,"available":both,
                "qbMatchupEPA":max(-2,min(2,home["expectedEPA"]-away["expectedEPA"])) if both else None,
                "qbBlitzExposure":max(-1.5,min(1.5,home["exposure"]-away["exposure"])) if both else None
            }
    return [outputs[g["gameId"]] for g in ordered]
def build():
    with tempfile.TemporaryDirectory() as directory:
        base=Path(directory);files={}
        schedule=base/"schedule.csv";files["schedule"]=download(SCHEDULE,schedule)
        games=read_games(schedule)
        if any(sum(1 for g in games.values() if g["season"]==y)<230 for y in YEARS):
            raise ValueError("Incomplete NFL historical regular season schedule")
        report={"status":"source_integrity_verified","seasons":{},"sourceHashes":files,
                "modelPromoted":False,"timestampRule":"FTN prior game results available only after >= 3 calendar days",
                "qbIdentityRule":"last eligible game's most charted QB for that offense (not same-game oracle)"}
        all_feats=[]
        for year in YEARS:
            ftn=base/("ftn_"+str(year)+".csv")
            pbp=base/("pbp_"+str(year)+".csv")
            files["ftn_"+str(year)]=download(f"{BASE}/ftn_charting/ftn_charting_{year}.csv",ftn)
            files["pbp_"+str(year)]=download(f"{BASE}/pbp/play_by_play_{year}.csv",pbp)
            chart,coverage=group_charted(year,pbp,ftn,games)
            season=[g for g in games.values() if g["season"]==year]
            feats=features_for_season(season,chart);all_feats.extend(feats)
            complete=sum(f["available"] for f in feats)
            report["seasons"][str(year)]={"games":len(feats),"fullQbSampleGames":complete,
                "usableRate":complete/max(1,len(feats)),**coverage}
            print("YEAR",year,json.dumps(report["seasons"][str(year)]),file=sys.stderr)
        report["sourceHashes"]=files
        return {"metadata":report,
                "games":[{k:v for k,v in g.items() if k!="sourceGameId"} for g in games.values()],
                "features":all_feats}
if __name__=="__main__":
    destination=Path(sys.argv[1] if len(sys.argv)>1 else "research/nfl-qb-blitz-history.json")
    try:
        output=build()
    except Exception as err:
        print(json.dumps({"status":"source_failed","error":str(err),"noPromotion":True}),file=sys.stderr)
        raise
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(output,separators=(",",":"))+"\n",encoding="utf-8")
    print(json.dumps({"status":output["metadata"]["status"],"seasons":output["metadata"]["seasons"],"artifactBytes":destination.stat().st_size},indent=2))
