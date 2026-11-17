#!/usr/bin/env python3
"""Source audit only: no wagering prediction, no redistribution of licensed raw rows.
Fetches exactly one season's public FTN and nflverse PBP release CSV, joining
(nflverse_game_id, nflverse_play_id) with (game_id,play_id).
No paid APIs, no Firecrawl, no website visitor requests.
"""
import csv, hashlib, json, os, sys, tempfile, urllib.request
from pathlib import Path

ROOT="https://github.com/nflverse/nflverse-data/releases/download"
FIELDS_PBP={"game_id","play_id","game_date","posteam","defteam","passer_player_id","receiver_player_id","epa","pass_attempt","sack"}
FIELDS_FTN={"nflverse_game_id","nflverse_play_id","n_blitzers"}
MAX_BYTES=250_000_000
def download(url,dest):
    req=urllib.request.Request(url,headers={"User-Agent":"Sports-Spreads-Research/1.0","Accept":"text/csv"})
    with urllib.request.urlopen(req,timeout=40) as res,open(dest,"wb") as out:
        seen=0;digest=hashlib.sha256()
        while True:
            data=res.read(1024*512)
            if not data:break
            seen+=len(data)
            if seen>MAX_BYTES:raise ValueError("Source larger than research budget")
            out.write(data);digest.update(data)
    return {"bytes":seen,"sha256":digest.hexdigest()}
def rows(path,fields):
    with open(path,newline="",encoding="utf-8-sig") as fp:
        rd=csv.DictReader(fp)
        columns=set(rd.fieldnames or [])
        missing=fields-columns
        if missing:raise ValueError("Source schema changed; required columns missing: "+",".join(sorted(missing)))
        yield from rd
def main(year):
    if year not in (2022,2023,2024,2025):raise ValueError("Specify a completed NFL research season 2022-2025")
    with tempfile.TemporaryDirectory() as folder:
        ft=Path(folder)/"ftn.csv";pb=Path(folder)/"pbp.csv"
        ft_url=f"{ROOT}/ftn_charting/ftn_charting_{year}.csv"
        pb_url=f"{ROOT}/pbp/play_by_play_{year}.csv"
        meta_ft=download(ft_url,ft);meta_pb=download(pb_url,pb)
        chart={}
        for r in rows(ft,FIELDS_FTN):
            k=(r["nflverse_game_id"],r["nflverse_play_id"])
            try:count=int(float(r["n_blitzers"]))
            except (ValueError,TypeError):continue
            if k in chart:raise ValueError("Duplicate FTN chart game/play ID")
            if 0<=count<=12:chart[k]=count
        total_pass=matches=blitz=0
        quarterbacks=set();receivers=set();game_ids=set();samples_by_qb={}
        for r in rows(pb,FIELDS_PBP):
            if r["pass_attempt"] not in ("1","1.0") and r["sack"] not in ("1","1.0"):continue
            if not r["passer_player_id"] or not r["posteam"] or not r["defteam"]:continue
            total_pass+=1
            k=(r["game_id"],r["play_id"])
            if k not in chart:continue
            try:epa=float(r["epa"])
            except (ValueError,TypeError):continue
            if not -9<=epa<=9:continue
            matches+=1
            blitz+=int(chart[k]>0)
            quarterbacks.add(r["passer_player_id"]);game_ids.add(r["game_id"])
            if r["receiver_player_id"]:receivers.add(r["receiver_player_id"])
            x=samples_by_qb.setdefault(r["passer_player_id"],[0,0])
            x[0]+=1
            x[1]+=int(chart[k]>0)
        data={"researchOnly":True,"status":"verified_join" if matches>=500 else "insufficient_join",
         "season":year,"source":"FTN Data via nflverse; nflverse PBP",
         "license":"FTN CC-BY-SA-4.0; PBP source attribution required",
         "files":{"ftn":meta_ft,"pbp":meta_pb},
         "ftnChartedPlays":len(chart),"pbpPassAndSackPlays":total_pass,
         "joinedPassAndSackPlays":matches,"joinCoverage":matches/max(total_pass,1),
         "blitzShare":blitz/max(matches,1),"distinctQuarterbacks":len(quarterbacks),
         "distinctTargetedReceivers":len(receivers),"matchedGames":len(game_ids),
         "quarterbacksWith70SamplePlays":sum(a>=70 for a,b in samples_by_qb.values()),
         "receiverVsManZoneSource":"unavailable; FTN public 29-field data has no official man/zone label",
         "injuryHistoricalSnapshotStatus":"not joined; requires dated official weekly report",
         "liveModelPromoted":False,"modelConfidenceCalculated":False}
        return data
if __name__=="__main__":
    year=int(sys.argv[1]) if len(sys.argv)>1 else 2025
    try:
        report=main(year)
    except Exception as err:
        print(json.dumps({"status":"source_failed","season":year,"reason":str(err),"modelConfidenceCalculated":False},indent=2))
        sys.exit(1)
    os.makedirs("research",exist_ok=True)
    with open(f"research/nfl-ftn-source-coverage-{year}.json","w") as f:
        json.dump(report,f,indent=2)
    print(json.dumps(report,indent=2))
    if report["status"]!="verified_join":sys.exit(2)
