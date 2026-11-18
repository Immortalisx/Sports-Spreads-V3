// Anonymous, write-only feedback collector. Review privately in Supabase Studio.
// No public read endpoint, no secrets exposed, no third-party credits.
const ORIGINS=new Set(['https://sports-spreads.onrender.com','https://sports-spreads-v3.onrender.com','https://sports-spreads-v4-staging.onrender.com','http://localhost:4173','http://127.0.0.1:4173']);
const kinds=new Set(['Something works well','Something feels confusing','Bug or broken feature','Feature suggestion']);
const url=Deno.env.get('SUPABASE_URL')||'';
let secret='';try{secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')?.default||'';}catch{}
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||secret;
function headers(origin:string){return {'access-control-allow-origin':ORIGINS.has(origin)?origin:'https://sports-spreads.onrender.com','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','vary':'Origin','content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};}
function response(origin:string,status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:headers(origin)});}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=='POST')return response(origin,405,{error:'Method not allowed'});
 if(!ORIGINS.has(origin))return response(origin,403,{error:'Origin not allowed'});
 if(!url||!key)return response(origin,503,{error:'Feedback temporarily unavailable'});
 const length=Number(req.headers.get('content-length')||0);
 if(length>4000)return response(origin,413,{error:'Feedback too long'});
 let body:any;
 try{const raw=await req.text();if(raw.length>4000)return response(origin,413,{error:'Feedback too long'});body=JSON.parse(raw);}
 catch{return response(origin,400,{error:'Invalid submission'});}
 if(body?.website)return response(origin,200,{ok:true}); // hidden honeypot
 const category=body?.category, message=typeof body?.message==='string'?body.message.trim():'';
 if(!kinds.has(category)||message.length<3||message.length>1200)return response(origin,400,{error:'Choose a category and enter 3–1200 characters'});
 // Best-effort 10-minute per-IP rate limit, hashed with a private salt.
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const salt=Deno.env.get('FEEDBACK_RATE_SALT')||key;
 const bytes=new TextEncoder().encode(salt+'|'+ip+'|'+Math.floor(Date.now()/600000));
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 try{
  const res=await fetch(url+'/rest/v1/site_feedback',{method:'POST',headers:{apikey:key,'content-type':'application/json','prefer':'return=minimal',...(key.startsWith('sb_secret_')?{}:{authorization:'Bearer '+key})},body:JSON.stringify({category,message,submission_bucket:hash}),signal:AbortSignal.timeout(8000)});
  if(res.status===409)return response(origin,429,{error:'Please wait a few minutes before submitting again'});
  if(!res.ok)return response(origin,503,{error:'Unable to save feedback right now'});
  return response(origin,201,{ok:true});
 }catch{return response(origin,503,{error:'Unable to save feedback right now'});}
});
