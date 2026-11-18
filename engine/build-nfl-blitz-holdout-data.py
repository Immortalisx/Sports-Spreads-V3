#!/usr/bin/env python3
"""Build an ephemeral, pregame-compatible NFL QB/blitz research ledger.

Sources (public releases, not visitor API calls):
 nflverse/nfldata REG completed game scores 2022-2025
 nflverse-data FTN charting and play_by_play 2022-2025

FTN charting credit: FTN Data via nflverse (CC BY-SA 4.0).
Only aggregate metrics leave temporary downloads; do not ship the ledger or raw
FTN rows in the site's front end or GitHub build artifacts.
"""
import csv
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = "https://github.com/nflverse/nflverse-data/releases/download"
GAMES = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
YEAR_RANGE = range(2022, 2026)
MAX_BYTES = 210_000_000

def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "Sports-Spreads-Reproducible-Research/1.0"})
    with urllib.request.urlopen(req, timeout=65) as remote, path.open("wb") as f:
        size = 0
        while True:
            chunk = remote.read(1024*512)
            if not chunk: break
            size += len(chunk)
            if size > MAX_BYTES: raise RuntimeError("Historical research request exceeded bounded size")
            f.write(chunk)
    return size

def stream_csv(path, required):
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = set(required).difference(reader.fieldnames or ())
        if missing: raise ValueError("Source schema mismatch: "+",".join(sorted(missing)))
        yield from reader

def number(text):
    try: return float(text)
    except (TypeError, ValueError): return None

def numeric_score(text):
    try:
        if text is None or text == "": return None
        v = int(text)
        return v if 0 <= v <= 150 else None
    except (ValueError, TypeError): return None

def eligible(row):
    if row.get("game_type") != "REG" or row.get("season") not in set(map(str,YEAR_RANGE)): return False
    h, a = numeric_score(row.get("home_score")), numeric_score(row.get("away_score"))
    return h is not None and a is not None and h != a

def build():
    with tempfile.TemporaryDirectory(prefix="nfl-blitz-study-") as td:
        folder = Path(td)
        games_path=folder/"games.csv"
        size=download(GAMES,games_path)
        print(f"Game-results source {size} bytes",file=sys.stderr,flush=True)
        seasons=defaultdict(dict)
        required_games={"game_id","game_type","gameday","season","home_team","away_team","home_score","away_score"}
        for r in stream_csv(games_path,required_games):
            if not eligible(r): continue
            y=int(r["season"])
            date=r["gameday"]
            if len(date)!=10 or date[4]!='-' or date[7]!='-': raise ValueError("Invalid NFL game date")
            g={"gameId":r["game_id"],"season":y,"gameDate":date,
               "league":"nfl","homeTeam":r["home_team"],"awayTeam":r["away_team"],
               "homeScore":int(r["home_score"]),"awayScore":int(r["away_score"])}
            if not g["homeTeam"] or not g["awayTeam"] or not g["gameId"]: raise ValueError("Missing completed NFL game ID")
            seasons[y][g["gameId"]]=g
        aggregate={"games":[],"qbs":[],"defenses":[],"audit":{}}
        for year in YEAR_RANGE:
            game_map=seasons[year]
            if len(game_map)<250 or len(game_map)>280: raise ValueError(f"Insufficient complete NFL schedule {year}: {len(game_map)}")
            aggregate["games"].extend(game_map.values())
            ftn=folder/f"ftn-{year}.csv"
            pbp=folder/f"pbp-{year}.csv"
            for source,target in [
              (f"{ROOT}/ftn_charting/ftn_charting_{year}.csv",ftn),
              (f"{ROOT}/pbp/play_by_play_{year}.csv",pbp)]:
                size=download(source,target)
                print(f"Fetched {year} {target.name}: {size} bytes",file=sys.stderr,flush=True)
            charts={}
            ftn_columns={"nflverse_game_id","nflverse_play_id","n_blitzers"}
            for row in stream_csv(ftn,ftn_columns):
                gid=row["nflverse_game_id"]
                if gid not in game_map: continue
                play=row["nflverse_play_id"]
                if not play: continue
                n=number(row["n_blitzers"])
                if n is None or not n.is_integer() or n<0 or n>12: continue
                k=(gid,play)
                if k in charts: raise ValueError("Duplicate charted play ID")
                charts[k]=int(n>0)
            qbs=defaultdict(lambda:[0,0,0.0,0.0])
            defenses=defaultdict(lambda:[0,0])
            matched=0
            pass_total=0
            seen=set()
            pbp_columns={"game_id","play_id","posteam","defteam","passer_player_id","epa","pass_attempt","sack"}
            for row in stream_csv(pbp,pbp_columns):
                gid=row["game_id"]
                if gid not in game_map: continue
                if row["pass_attempt"] not in ("1","1.0") and row["sack"] not in ("1","1.0"): continue
                qb=row["passer_player_id"]
                offense=row["posteam"];defense=row["defteam"]
                if not qb or not offense or not defense: continue
                pass_total+=1
                k=(gid,row["play_id"])
                if k not in charts or k in seen: continue
                seen.add(k)
                ep=number(row["epa"])
                if ep is None or not -9<=ep<=9: continue
                if offense not in (game_map[gid]["homeTeam"],game_map[gid]["awayTeam"]): continue
                if defense not in (game_map[gid]["homeTeam"],game_map[gid]["awayTeam"]) or defense==offense: continue
                blitz=charts[k]
                matched+=1
                q=qbs[(gid,offense,qb)]
                if blitz: q[0]+=1;q[2]+=ep
                else: q[1]+=1;q[3]+=ep
                d=defenses[(gid,defense)]
                d[0]+=1;d[1]+=blitz
            if matched<10000 or matched/max(1,pass_total)<.90:
                raise ValueError(f"FTN/PBP match coverage unexpectedly low: {year} {matched}/{pass_total}")
            aggregate["audit"][str(year)]={"regularGames":len(game_map),"pbpPassAttemptsAndSacks":pass_total,
                "joinedPassingPlays":matched,"coverage":matched/max(1,pass_total),
                "qbGameRows":len(qbs),"defenseGameRows":len(defenses)}
            for (gid,team,qb),q in qbs.items():
                aggregate["qbs"].append({"gameId":gid,"season":year,"date":game_map[gid]["gameDate"],
                 "team":team,"qb":qb,"blitzN":q[0],"cleanN":q[1],
                 "blitzEpaSum":q[2],"cleanEpaSum":q[3]})
            for (gid,team),d in defenses.items():
                aggregate["defenses"].append({"gameId":gid,"season":year,
                 "date":game_map[gid]["gameDate"],"team":team,
                 "n":d[0],"blitzN":d[1]})
            ftn.unlink();pbp.unlink()
            print(json.dumps({"season":year,**aggregate["audit"][str(year)]}),file=sys.stderr,flush=True)
        return aggregate

if __name__=="__main__":
    output = Path(sys.argv[1]) if len(sys.argv)>1 else Path("research/_temporary-nfl-blitz-aggregates.json")
    report=build()
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,separators=(",",":")),encoding="utf-8")
    print(json.dumps({"status":"aggregated","completedGames":len(report["games"]),
      "qbs":len(report["qbs"]),"defensiveGames":len(report["defenses"]),
      "seasons":report["audit"],"tempFile":str(output)},indent=2))
