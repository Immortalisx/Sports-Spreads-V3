/** Sports Spreads on-demand game weather (forecast only; not a betting model). */
(function (root) {
 'use strict';
 const cache=new Map();
 const ROOF_PATTERN=/(allegiant stadium|caesars superdome|ford field|u\.s\. bank stadium)/i; // fixed indoor venues only; retractable roofs remain unverified
 const REGIONS={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',ON:'Ontario',QC:'Quebec',BC:'British Columbia',AB:'Alberta',MB:'Manitoba',SK:'Saskatchewan',NS:'Nova Scotia',NB:'New Brunswick'};
 const CONDITIONS=[[0,'Clear','☀️'],[1,'Mostly clear','🌤️'],[2,'Partly cloudy','⛅'],[3,'Cloudy','☁️'],[45,'Fog','🌫️'],[48,'Fog','🌫️'],[51,'Drizzle','🌦️'],[53,'Drizzle','🌦️'],[55,'Drizzle','🌦️'],[61,'Rain','🌧️'],[63,'Rain','🌧️'],[65,'Heavy rain','🌧️'],[71,'Snow','🌨️'],[73,'Snow','🌨️'],[75,'Heavy snow','❄️'],[80,'Rain showers','🌦️'],[81,'Rain showers','🌧️'],[82,'Heavy showers','🌧️'],[95,'Thunderstorms','⛈️'],[96,'Thunderstorms','⛈️'],[99,'Thunderstorms','⛈️']];
 function condition(c){const found=CONDITIONS.find(x=>x[0]===Number(c));return {description:found?found[1]:'Variable conditions',icon:found?found[2]:'🌤️'};}
 function key(g){return `${g.league}:${g.id}:${g.start||''}`;}
 function indoor(g){if(g.venueIndoor===true)return true;if(g.venueIndoor===false)return false;if(g.league==='nba'||g.league==='nhl')return true;return !!(g.venue&&ROOF_PATTERN.test(g.venue));}
 function roofNote(g){if(g.venueIndoor===false)return 'Outdoor venue • forecast is for the local area.';if(g.venueIndoor===true)return 'Indoor venue.';return 'Roof status not verified; forecast is for the stadium area. Retractable roofs may close.';}
 function siteCity(g){return String(g.venueCity||'').trim();}
 function forecastWindow(date,now){let target=new Date(date||'');if(!Number.isFinite(target.getTime()))return false;const ms=target.getTime()-now;return ms>=-24*3600*1000 && ms<=15.5*24*3600*1000;}
 async function json(url,fetcher){const resp=await fetcher(url,{headers:{accept:'application/json'}});if(!resp.ok)throw new Error('Weather service unavailable');return resp.json();}
 async function get(g,{force=false,now=Date.now(),fetcher=root.fetch?.bind(root)}={}){
  if(g.demo)return {status:'unavailable',message:'No weather for sample matchups.'};
  if(indoor(g))return {status:'indoors',note:g.venueIndoor===true?'The venue is listed as indoor.':'Usually played inside; confirm roof configuration for special events.'};
  if(!forecastWindow(g.start,now))return {status:'unavailable',message:'Kickoff forecast is available only as the game date approaches (up to about 16 days).'};
  const id=key(g),cached=cache.get(id);if(!force&&cached&&cached.expires>now)return cached.data;
  if(!fetcher)return {status:'unavailable',message:'Weather fetch is not supported in this browser.'};
  let lat=g.venueLatitude==null?NaN:Number(g.venueLatitude),lon=g.venueLongitude==null?NaN:Number(g.venueLongitude);
  const city=siteCity(g);
  if(!city&&!(Number.isFinite(lat)&&Number.isFinite(lon)))return {status:'unavailable',message:'Venue location is not available from the game feed.'};
  if(!Number.isFinite(lat)||!Number.isFinite(lon)){
   if(!city)return {status:'unavailable',message:'Venue location is not available.'};
   const qs=new URLSearchParams({name:city,count:'10',language:'en',format:'json'});
   const country=String(g.venueCountry||'').trim().toUpperCase();
   if(country==='US'||country==='USA'||country==='UNITED STATES')qs.set('countryCode','US');
   else if(country==='CA'||country==='CAN'||country==='CANADA')qs.set('countryCode','CA');
   const geo=await json('https://geocoding-api.open-meteo.com/v1/search?'+qs,fetcher);
   let places=geo.results||[];
   if(g.venueState){
    const st=String(g.venueState).trim().toLowerCase();const full=(REGIONS[st.toUpperCase()]||st).toLowerCase();
    const matched=places.filter(x=>[x.admin1_code,x.admin1,x.admin2].some(y=>{const normalized=String(y||'').trim().toLowerCase();return normalized===st||normalized===full||normalized.endsWith('-'+st);}));
    if(!matched.length)return {status:'unavailable',message:'The weather provider could not confirm the venue state.'};
    places=matched;
   }
   if(!g.venueState&&!country&&new Set(places.map(x=>x.admin1+'|'+x.country_code)).size>1)return {status:'unavailable',message:'The venue city is ambiguous; weather location needs confirmation.'};
   const found=places.find(x=>x.latitude!=null&&x.longitude!=null);
   if(!found)return {status:'unavailable',message:'No reliable weather location could be resolved for this venue.'};
   lat=Number(found.latitude);lon=Number(found.longitude);
  }
  const query=new URLSearchParams({latitude:String(lat),longitude:String(lon),hourly:'temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code',temperature_unit:'fahrenheit',wind_speed_unit:'mph',timezone:'UTC',forecast_days:'16'});
  const result=await json('https://api.open-meteo.com/v1/forecast?'+query,fetcher);
  const arr=result.hourly?.time||[];const target=new Date(g.start).getTime();let index=-1,min=Number.POSITIVE_INFINITY;
  arr.forEach((time,i)=>{const ms=Math.abs(new Date(time.endsWith('Z')?time:time+'Z').getTime()-target);if(ms<min){min=ms;index=i;}});
  if(index<0||min>60*60*1000)return {status:'unavailable',message:'Forecast for kickoff time is not yet available.'};
  const hourly=result.hourly;
  const values=['temperature_2m','precipitation_probability','wind_speed_10m','wind_gusts_10m'].map(k=>Number(hourly[k]?.[index]));
  if(values.some(x=>!Number.isFinite(x)))return {status:'unavailable',message:'The weather source returned incomplete data.'};
  const [tempF,precipChance,windMph,gustMph]=values;
  const flags=[];
  if(gustMph>=25||windMph>=15)flags.push('Wind may matter');
  if(precipChance>=45)flags.push('Rain/snow risk');
  if(tempF<=32)flags.push('Freezing conditions');
  const data={status:'forecast',...condition(hourly.weather_code?.[index]),tempF,windMph,gustMph,precipChance,weatherCode:Number(hourly.weather_code?.[index]),city:city||'Venue area',flags,roofNote:roofNote(g),fetchedAt:new Date(now).toISOString(),modelAdjusted:false};
  cache.set(id,{data,expires:now+20*60*1000});
  return data;
 }
 root.SportsWeather=Object.freeze({get,key,indoor,forecastWindow,condition,roofNote});
})(globalThis);
