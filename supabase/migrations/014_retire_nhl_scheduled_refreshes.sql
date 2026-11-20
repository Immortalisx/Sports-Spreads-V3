do $migration$
declare j record;
begin
  for j in select jobid, command from cron.job where jobname in
    ('sports-spreads-api-sports-daily-games','sports-spreads-cached-odds-2x-daily','sports-spreads-current-season-form')
  loop
    if position($old$('nfl'),('nba'),('nhl'),('mlb')$old$ in j.command)>0 then
      perform cron.alter_job(j.jobid, command := replace(j.command,$old$('nfl'),('nba'),('nhl'),('mlb')$old$,$new$('nfl'),('nba'),('mlb')$new$));
    elsif position($new$('nfl'),('nba'),('mlb')$new$ in j.command)=0 then
      raise exception 'Unrecognized league schedule %',j.jobid;
    end if;
  end loop;
  perform cron.alter_job(jobid,active := false) from cron.job where jobname='sports-spreads-nhl-goalie-form' and active;
end
$migration$;
