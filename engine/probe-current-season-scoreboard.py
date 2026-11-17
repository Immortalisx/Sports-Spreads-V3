#!/usr/bin/env python3
"""Probe the public ESPN per-calendar-year scoreboard without storing/raw-republishing matches."""
import json, urllib.request, urllib.parse
for league,path in [('nfl','football/nfl'),('nba','basketball/nba'),('nhl','hockey/nhl'),('mlb','baseball/mlb')]:
 base='https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard'
 for date,limit in [('202610','1000'),('202611','1000'),('202609','1000')]:
  url=base+'?'+urllib.parse.urlencode(dict(dates=date,limit=limit))
  try:
   request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
   with urllib.request.urlopen(request,timeout=18) as response: payload=json.load(response)
   ev=payload.get('events',[])
   dates=sorted(e.get('date','') for e in ev if e.get('date'))
   print(json.dumps(dict(league=league,queryDate=date,limit=limit,
    returned=len(ev),earliest=dates[0] if dates else None,latest=dates[-1] if dates else None,
    season=payload.get('season'),leagues=len(payload.get('leagues',[])))))
  except Exception as e:print(json.dumps(dict(league=league,queryDate=date,limit=limit,error=str(e)[:200])))
