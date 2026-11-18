import datetime as dt
import importlib.util
import pathlib
import unittest
module=pathlib.Path(__file__).resolve().parents[1]/"engine"/"collect-qb-blitz-holdout.py"
spec=importlib.util.spec_from_file_location("extract",module)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def game(name,date):
    return {"gameId":"nfl-"+name,"sourceGameId":name,"season":2025,
            "gameDate":date,"homeTeam":"BUF","awayTeam":"MIA"}
def stats(date,sideQb="q1",blitz=20,nonblitz=45):
    from collections import defaultdict
    q=defaultdict(lambda:{"b":0,"n":0,"eb":0.,"en":0.})
    q[("BUF",sideQb)]={"b":blitz,"n":nonblitz,"eb":blitz*.3,"en":nonblitz*.15}
    q[("MIA","q2")]={"b":25,"n":40,"eb":25*.1,"en":40*.1}
    d=defaultdict(lambda:{"b":0,"n":0})
    d["BUF"]={"b":28,"n":60};d["MIA"]={"b":30,"n":60}
    return {"qb":q,"def":d}
class ExtractionTest(unittest.TestCase):
    def test_last_game_qb_only_after_publication_lag(self):
        games=[game("week1","2025-09-01"),game("week2","2025-09-03"),
               game("week3","2025-09-04"),game("week4","2025-09-09")]
        chart={"week1":stats("2025-09-01"),"week2":stats("2025-09-03")}
        x={r["gameId"]:r for r in m.features_for_season(games,chart)}
        self.assertFalse(x["nfl-week2"]["available"])
        self.assertTrue(x["nfl-week3"]["available"])
        self.assertTrue(x["nfl-week4"]["available"])
        self.assertEqual(x["nfl-week4"]["home"]["projectedQb"],"q1")
        self.assertEqual(x["nfl-week4"]["sourceDataThrough"],"2025-09-06")
    def test_same_day_future_qb_cannot_relabel_pregame_starter(self):
        games=[game("prior","2025-09-01"),game("a","2025-09-10"),
               game("b","2025-09-10"),game("later","2025-09-16")]
        chart={"prior":stats("2025-09-01"),"a":stats("2025-09-10","future"),
               "b":stats("2025-09-10","future")}
        x={r["gameId"]:r for r in m.features_for_season(games,chart)}
        self.assertEqual(x["nfl-a"]["home"]["projectedQb"],"q1")
        self.assertEqual(x["nfl-b"]["home"]["projectedQb"],"q1")
        self.assertEqual(x["nfl-later"]["home"]["projectedQb"],"future")
if __name__=="__main__":unittest.main()
