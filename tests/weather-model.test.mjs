import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/weather-model.js';
const model=globalThis.SportsWeatherModel;
const outdoor={id:'outdoor-1',league:'nfl',venueIndoor:false};
const coldWind={status:'forecast',tempF:27,windMph:20,gustMph:32,precipChance:72,fetchedAt:'2026-11-17T16:00:00Z'};
test('NFL wind and precipitation are observable feature inputs, not fabricated confidence',()=>{
 const a=model.assess(outdoor,coldWind);
 assert.equal(a.available,true);assert.equal(a.tier,'Elevated');assert.equal(a.features.wind_mph,20);
 assert.equal(a.features.precipitation_probability_pct,72);assert.equal(a.probabilityDelta,null);assert.equal(a.confidenceDelta,null);assert.equal(a.validated,false);
 assert.match(a.signals.join(' '),/passing and kicking/);
 assert.equal(model.modelInputs(outdoor,coldWind).weather_risk_tier,2);
});
test('indoor games require no outdoor forecast',()=>{let a=model.assess({league:'nba'},{status:'indoors'});assert.equal(a.available,false);assert.equal(a.severity,null);});
test('MLB wind direction not inferred and rain delay flagged',()=>{const a=model.assess({...outdoor,league:'mlb'},coldWind);assert.match(a.signals.join(' '),/direction is unknown/);assert.match(a.signals.join(' '),/delay/);});
test('missing weather fields are never coerced into invented forecast numbers',()=>{const a=model.assess(outdoor,{status:'forecast',tempF:33,windMph:10,precipChance:12});assert.equal(a.available,false);});
