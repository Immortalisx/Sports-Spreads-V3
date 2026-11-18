function navigation(){return `<aside class="sidebar"><div class="brand-wrap"><div class="brand"><span class="brand-symbol">↗</span><span>sports<span>spreads</span></span></div><div class="beta">THE EDGE, SIMPLIFIED</div></div><nav class="nav" aria-label="Primary navigation">${[['games','grid','Games'],['teams','teams','Teams'],['tickets','ticket','Builder'],['history','history','Saved']].map(([id,svg,label])=>`<button data-action="nav" data-section="${id}" class="${state.section===id?'active':''}" aria-current="${state.section===id?'page':'false'}">${icon(svg)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><button class="nav-settings" data-action="about">⚙  About & sources</button></div><div class="sidebar-foot">SPORTS SPREADS / V3</div></aside>`;}
function topbar(){
 const titles={games:['Games','Scores, schedules & team details'],teams:['Teams','Rosters, injuries & news'],tickets:['Build a parlay','Odds in. Numbers out.'],history:['Saved tickets','Your snapshots, on this device'],about:['Sources & settings','What is connected, and what is not']};
 const [h,sub]=titles[state.section];
 return `<div class="topbar"><div class="hero"><div class="eyebrow">THE GAME, AT A GLANCE</div><h1>${esc(h)}</h1><p>${esc(sub)}</p></div><div class="top-actions"><button class="header-action big-screen-launch" data-action="big-screen" aria-label="Enter big screen mode" title="TV / big screen display">▣ Big Screen</button><button class="header-action" data-action="share" aria-label="Copy clean website link">↗ Share</button><button class="header-action header-feedback" data-action="feedback" aria-label="Give feedback">Feedback</button><div class="status ${state.error?'warning':''}" title="${esc(state.error?'Live feed unavailable — examples shown':state.loading?'Checking sports feed':state.feed?.demo?'Sample preview':'Sports feed connected')}"><i></i>${state.loading?'Checking':state.error?'Examples':'Feed ready'}</div><button class="icon-button about-trigger" data-action="about" aria-label="About data sources" title="About sources">ⓘ</button></div></div>`;
}
function leaguebar(){return `<div class="leaguebar" role="tablist" aria-label="League">${Object.entries(SPORTS).map(([id,s])=>`<button role="tab" aria-selected="${state.league===id}" class="league ${state.league===id?'active':''}" data-action="league" data-league="${id}"><span class="emoji">${s.emoji}</span> ${s.label}</button>`).join('')}</div>`;}
function logo(team,league){
 const abbr=String(team.abbr||'').toLowerCase();
 const name=String(team.name||'');
 const code=league==='nba'&&(/trail blazers/i.test(name)||abbr==='por')?'por':league==='nba'&&(/spurs/i.test(name)||abbr==='sas')?'sa':abbr;
 const fallback=/^[a-z0-9]{2,5}$/.test(code)?'https://a.espncdn.com/i/teamlogos/'+encodeURIComponent(league)+'/500/'+encodeURIComponent(code)+'.png':null;
 const primary=safeUrl(team.logo);
 const initials=String(team.abbr||name||'TEAM').replace(/[^a-z0-9]/gi,'').slice(0,4).toUpperCase()||'TEAM';
 // Text remains in the DOM even if an external image fails or is blocked.
 const image=primary||fallback;
 const retry=fallback&&fallback!==primary?fallback:'';
 return '<span class="team-logo" aria-hidden="true"><span class="team-logo-initials">'+esc(initials)+'</span>'+
 (image?'<img alt="" src="'+esc(image)+'" loading="lazy" decoding="async" data-fallback="'+esc(retry)+'" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback=\'\';}else{this.hidden=true;}" onload="this.previousElementSibling.hidden=true">':'')+'</span>';
}
