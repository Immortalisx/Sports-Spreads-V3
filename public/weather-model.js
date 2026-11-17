/* Sports Spreads weather feature model v1.
 * Real forecast features, deterministic and inspectable risk tiers.
 * This is NOT a trained, backtested probability-adjustment model.
 * Do not synthesize odds, EV, or a confidence grade from these tiers.
 */
(function(root){
 'use strict';
 const TIER=['Minimal','Watch','Elevated','High'];
 const round=n=>Math.round(n*10)/10;
 function assess(game, forecast){
  const league=String(game?.league||'').toLowerCase();
  const isOutdoor=forecast?.status==='forecast';
  if(!isOutdoor){return {version:'weather-context-v1',available:false,reason:forecast?.status==='indoors'?'Indoor event':'Forecast unavailable',tier:'Unavailable',severity:null,features:null,signals:[],probabilityDelta:null,confidenceDelta:null,validated:false};}
  const fields=['tempF','windMph','gustMph','precipChance'];
  if(fields.some(k=>!Number.isFinite(Number(forecast[k])) || forecast[k]==null))return {version:'weather-context-v1',available:false,reason:'Incomplete weather inputs',tier:'Unavailable',severity:null,features:null,signals:[],probabilityDelta:null,confidenceDelta:null,validated:false};
  const f={temperature_f:round(Number(forecast.tempF)),wind_mph:round(Number(forecast.windMph)),gust_mph:round(Number(forecast.gustMph)),precipitation_probability_pct:round(Number(forecast.precipChance)),weather_code:Number.isFinite(Number(forecast.weatherCode))?Number(forecast.weatherCode):null,forecast_fetched_at:forecast.fetchedAt||null,game_id:game.id||null,roof_confirmed_open:game.venueIndoor===false,venue_roof_unverified:game.venueIndoor!==false};
  let severity=0;
  if(f.wind_mph>=12||f.gust_mph>=20)severity=Math.max(severity,1);
  if(f.wind_mph>=18||f.gust_mph>=28)severity=Math.max(severity,2);
  if(f.wind_mph>=25||f.gust_mph>=40)severity=3;
  if(f.precipitation_probability_pct>=35)severity=Math.max(severity,1);
  if(f.precipitation_probability_pct>=65)severity=Math.max(severity,2);
  if(f.temperature_f<=32||f.temperature_f>=95)severity=Math.max(severity,1);
  if(f.temperature_f<=15)severity=Math.max(severity,2);
  const signals=[];
  if(league==='nfl'){
   if(f.wind_mph>=12||f.gust_mph>=20)signals.push('Wind: passing and kicking uncertainty');
   if(f.precipitation_probability_pct>=45)signals.push('Precipitation: ball-handling and footing risk');
   if(f.temperature_f<=32)signals.push('Freezing temperature: monitor conditions');
  }else if(league==='mlb'){
   if(f.wind_mph>=12||f.gust_mph>=20)signals.push('Wind may affect fly balls; direction is unknown');
   if(f.precipitation_probability_pct>=45)signals.push('Rain: possible delay or postponement');
   if(f.temperature_f<=45)signals.push('Cold conditions: check lineup and performance context');
  }else if(severity)signals.push('Confirm whether this event is outdoors');
  if(!signals.length)signals.push('No major weather flags at the forecast threshold');
  return {version:'weather-context-v1',available:true,tier:TIER[severity],severity,features:f,signals,probabilityDelta:null,confidenceDelta:null,validated:false,
   method:'Threshold-based weather context only; not an estimated change to hit rate or a betting recommendation.'};
 }
 function modelInputs(game,forecast){const a=assess(game,forecast);return a.available?{...a.features,weather_risk_tier:a.severity,weather_features_version:a.version}:null;}
 root.SportsWeatherModel=Object.freeze({assess,modelInputs});
})(globalThis);
