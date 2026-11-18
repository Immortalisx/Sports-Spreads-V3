#!/usr/bin/env python3
"""NFL QB x opponent-blitz research: real 2022–25 FTN/nflverse charting.
No browser, no sportsbook provider or Firecrawl credits.
No future-game data, no fabricated starting QB or defensive scheme coverage.
QB is an explicitly labeled PRIOR-GAME playing-time proxy, never a confirmed starter.
Aggregated research output only, with source attribution (FTN CC BY-SA 4.0).
"""
import csv, datetime as dt, json, os, sys, tempfile, urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT="https://github.com/nflverse/nflverse-data/releases/download"
GAMES_URL="https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
MAX_BYTES=240_000_000
SEASONS=(2022,2023,2024,2025)
def download(url,dest):
    req=urllib.request.Request(url,headers={"User-Agent":"Sports-Spreads-Research/1.0","Accept":"text/csv"})
    with urllib.request.urlopen(req,timeout=45) as res,open(dest,"wb") as dst:
        seen=0
        while True:
            data=res.read(512*1024)
            if not data:break
            seen+=len(data)
            if seen>MAX_BYTES:raise ValueError("Source exceeded hard 240MB cap")
            dst.write(data)
    return seen
def rows(path,required):
    with open(path,newline="",encoding="utf-8-sig") as fp:
        rd=csv.DictReader(fp)
        missing=set(required)-set(rd.fieldnames or [])
        if missing:raise ValueError("Changed source columns: "+",".join(sorted(missing)))
        for r in rd:yield r
def valid_score(x):
    try:
        if x is None or not str(x).strip():return None
        a=int(x)
        return a if 0<=a<=150 else None
    except (TypeError,ValueError):return None
def fixtures_from_csv(path):
    games=[];seen=set()
    required=("season","game_type","game_id","gameday","home_team","away_team","home_score","away_score")
    for g in rows(path,required):
        try:year=int(g["season"])
        except ValueError:continue
        if year not in SEASONS or g["game_type"]!="REG":continue
        home=valid_score(g["home_score"]);away=valid_score(g["away_score"])
        if home is None or away is None or home==away:continue
        identifier=g["game_id"];date=g["gameday"]
        try:dt.date.fromisoformat(date)
        except ValueError:continue
        if not identifier or identifier in seen:raise ValueError("Duplicate official fixture "+identifier)
        seen.add(identifier)
        if g["home_team"]==g["away_team"]:continue
        games.append(dict(id=identifier,date=date,year=year,home=g["home_team"],away=g["away_team"],
          homeScore=home,awayScore=away))
    return sorted(games,key=lambda g:(g["year"],g["date"],g["id"]))
def ingest_charted_year(ft_path,pbp_path,legal_games):
    chart={}
    for row in rows(ft_path,("nflverse_game_id","nflverse_play_id","n_blitzers")):
        key=(row["nflverse_game_id"],row["nflverse_play_id"])
        if key in chart:raise ValueError("Duplicate FTN chart key")
        try:
            n=int(float(row["n_blitzers"]))
            if 0<=n<=12:chart[key]=n>=1
        except (ValueError,TypeError):pass
    pass_game=defaultdict(lambda:[0,0.,0,0.])
    defense_game=defaultdict(lambda:[0,0])
    seen=set();attempts=joined=0
    need=("game_id","play_id","posteam","defteam","passer_player_id","epa","pass_attempt","sack")
    for row in rows(pbp_path,need):
        if row["game_id"] not in legal_games:continue
        if row["pass_attempt"] not in ("1","1.0") and row["sack"] not in ("1","1.0"):continue
        if not row["passer_player_id"] or not row["posteam"] or not row["defteam"]:continue
        attempts+=1
        key=(row["game_id"],row["play_id"])
        if key in seen:continue
        seen.add(key)
        if key not in chart:continue
        try:epa=float(row["epa"])
        except (ValueError,TypeError):continue
        if not -9<=epa<=9:continue
        joined+=1;is_blitz=chart[key]
        record=pass_game[(row["game_id"],row["posteam"],row["passer_player_id"])]
        i=0 if is_blitz else 2;record[i]+=1;record[i+1]+=epa
        defense_game[(row["game_id"],row["defteam"])][0]+=1
        defense_game[(row["game_id"],row["defteam"])][1]+=int(is_blitz)
    return pass_game,defense_game,dict(passAttempts=attempts,matchedDropbacks=joined,
      matchingRate=round(joined/max(1,attempts),6),ftnRows=len(chart))
def feature_from_history(g,by_game_qb,by_game_def,games_by_id,
                         min_blitz=12,min_no=30,min_def=65,lag_days=3):
    date=dt.date.fromisoformat(g["date"])
    limit=(date-dt.timedelta(days=lag_days)).isoformat()
    def per_side(team,opponent):
        # Each team's last eligible QB came from the previous official completed game;
        # actual next-game starter is intentionally unknown.
        past_team=sorted((games_by_id[game_id] for game_id,t,qb in by_game_qb
          if t==team and games_by_id[game_id]["year"]==g["year"] and
             games_by_id[game_id]["date"]<=limit),
          key=lambda x:(x["date"],x["id"]),reverse=True)
        if not past_team:return None,0,None
        last=past_team[0]["id"]
        choices=[(r[0]+r[2],qb) for (gid,t,qb),r in by_game_qb.items() if gid==last and t==team]
        if not choices:return None,0,None
        qb=max(choices)[1]
        prior_games={x["id"] for x in past_team[:8]}
        counts=[0,0.,0,0.];last_data=None
        for (gid,t,q),r in by_game_qb.items():
            if t!=team or q!=qb or gid not in prior_games:continue
            for k in range(4):counts[k]+=r[k]
            last_data=max(last_data or games_by_id[gid]["date"],games_by_id[gid]["date"])
        past_def=sorted((games_by_id[gid] for (gid,t) in by_game_def
          if t==opponent and games_by_id[gid]["year"]==g["year"] and
             games_by_id[gid]["date"]<=limit),
          key=lambda x:(x["date"],x["id"]),reverse=True)[:5]
        n=sum(by_game_def[(x["id"],opponent)][0] for x in past_def)
        blitz=sum(by_game_def[(x["id"],opponent)][1] for x in past_def)
        if counts[0]<min_blitz or counts[2]<min_no or n<min_def:
            return None,counts[0]+counts[2],last_data
        rate=blitz/n
        expected=(counts[1]/counts[0])*rate+(counts[3]/counts[2])*(1-rate)
        if last_data and last_data>limit:raise ValueError("Premature charting used")
        return max(-2.,min(2.,expected)),counts[0]+counts[2],last_data
    h,nh,dh=per_side(g["home"],g["away"])
    a,na,da=per_side(g["away"],g["home"])
    ready=h is not None and a is not None
    return dict(id=g["id"],date=g["date"],season=g["year"],
      blitzInteraction=max(-3,min(3,h-a)) if ready else None,
      enoughData=ready,homeQbSamples=nh,awayQbSamples=na,
      dataThrough=max(dh or "",da or "") or None,
      earliestAllowedSourceDate=limit,
      qbIdentification="most passing plays in team's latest eligible prior game; NOT confirmed starter")
def run():
    with tempfile.TemporaryDirectory() as directory:
        schedule=Path(directory)/"games.csv"
        download(GAMES_URL,schedule)
        games=fixtures_from_csv(schedule)
        if len(games)<1000:raise ValueError("Expected four full regular seasons, got "+str(len(games)))
        by_id={x["id"]:x for x in games}
        by_game_qb={};by_game_def={}
        audits=[]
        for year in SEASONS:
            ft=Path(directory)/f"ftn-{year}.csv"
            pb=Path(directory)/f"pbp-{year}.csv"
            download(f"{ROOT}/ftn_charting/ftn_charting_{year}.csv",ft)
            download(f"{ROOT}/pbp/play_by_play_{year}.csv",pb)
            q,d,audit=ingest_charted_year(ft,pb,{x["id"] for x in games if x["year"]==year})
            for k,v in q.items():by_game_qb[k]=v
            for k,v in d.items():by_game_def[k]=v
            audits.append(dict(season=year,**audit))
            print("Scanned",year,audit,file=sys.stderr)
            ft.unlink();pb.unlink()
        features=[feature_from_history(g,by_game_qb,by_game_def,by_id) for g in games]
        covered=sum(x["enoughData"] for x in features)
        if any(x["dataThrough"] and x["dataThrough"]>x["earliestAllowedSourceDate"] for x in features):
            raise ValueError("Point-in-time source publication leakage detected")
        return dict(version="ftn-nfl-pregame-v1",years=list(SEASONS),
          license="FTN CC-BY-SA-4.0; nflverse PBP attribution",
          sourceStatus="sourced_real_plays",unverifiedStarterProxy=True,
          noManZoneCoverage=True,rawPlayDataStored=False,
          joinedCoverage=audits,fixtures=games,
          projectedFeatures=features,readyGames=covered,coverage=covered/max(1,len(features)))
def test():
    fixtures=[dict(id="g1",date="2025-10-01",year=2025,home="A",away="B",homeScore=20,awayScore=10),
              dict(id="g2",date="2025-10-02",year=2025,home="A",away="B",homeScore=13,awayScore=10)]
    qb={("g1","A","Q1"):[20,12.,40,8.],("g1","B","Q2"):[20,10.,40,7.]}
    defense={("g1","A"):[60,20],("g1","B"):[60,18]}
    res=feature_from_history(fixtures[1],qb,defense,{x["id"]:x for x in fixtures},
                             min_blitz=10,min_no=20,min_def=40,lag_days=3)
    assert not res["enoughData"],"3-day publication lag was not enforced"
    fixtures[1]["date"]="2025-10-06"
    result=feature_from_history(fixtures[1],qb,defense,{x["id"]:x for x in fixtures},
                             min_blitz=10,min_no=20,min_def=40,lag_days=3)
    assert result["enoughData"] and result["dataThrough"]=="2025-10-01"
    assert result["qbIdentification"].endswith("NOT confirmed starter")
    return "point-in-time QB/blitz charting synthetic tests passed"
if __name__=="__main__":
    if "--test" in sys.argv:
        print(test());sys.exit(0)
    result=run()
    os.makedirs("research",exist_ok=True)
    with open("research/nfl-qb-blitz-pregame-aggregate.json","w") as f:
        json.dump(result,f)
    print(json.dumps({k:v for k,v in result.items() if k not in ("fixtures","projectedFeatures")},indent=2))
