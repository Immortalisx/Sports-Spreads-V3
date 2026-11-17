import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const dir=join(root,'public');
let html=await readFile(join(dir,'index.html'),'utf8');
const css=await readFile(join(dir,'style.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="/style.css" />',`<style>\n${css}\n</style>`);
for(const name of ['weather.js','weather-model.js','prediction-model.js','matchup-intelligence.js','multifactor-engine.js','autocomplete.js','cloud-browser.js','app.js']){
 const code=await readFile(join(dir,name),'utf8');if(code.includes('</script>'))throw Error('Inline script contains unexpected close tag: '+name);
 html=html.replace(`<script src="/${name}" defer></script>`,`${name==='app.js'?'<script>window.__STANDALONE_PREVIEW__=true;</script>\n  ':''}<script>\n${code}\n</script>`);
}
const svg=await readFile(join(dir,'favicon.svg'),'utf8');
const icon=`data:image/svg+xml,${encodeURIComponent(svg)}`;
html=html.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',`<link rel="icon" href="${icon}" type="image/svg+xml" />`);
html=html.replace('<title>Sports Spreads — Live games, teams & ticket builder</title>',`<title>Sports Spreads | Games • Teams • Weather • Builder</title>
  <link rel="canonical" href="https://sports-spreads.onrender.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Sports Spreads" />
  <meta property="og:title" content="Sports Spreads" />
  <meta property="og:description" content="NFL • NBA • NHL • MLB. Games, team reports, weather context and a clean parlay builder." />
  <meta property="og:url" content="https://sports-spreads.onrender.com/" />
  <meta name="twitter:card" content="summary" />`);
await mkdir(join(root,'release'),{recursive:true});const dst=join(root,'release','index.html');await writeFile(dst,html);console.log('Built '+dst+' ('+html.length+' chars)');
