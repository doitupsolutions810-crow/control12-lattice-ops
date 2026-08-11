import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.env.CONTROL12_WORKSPACE_ROOT || path.join(process.env.HOME || '/tmp', '.control12', 'workspaces'));
const TENANT = process.env.CONTROL12_MCP_TENANT || 'default';
const WORKSPACE = process.env.CONTROL12_MCP_WORKSPACE || 'default';
const REPO = path.resolve(process.env.CONTROL12_REPO_DIR || process.cwd());

function safeSeg(v){ if(!/^[A-Za-z0-9._-]{1,128}$/.test(v)) throw new Error('invalid workspace identity'); return v; }
function wroot(){ return path.join(ROOT, safeSeg(TENANT), safeSeg(WORKSPACE)); }
async function readJsonl(file){ try{return (await fs.readFile(file,'utf8')).split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code==='ENOENT')return[];throw e;} }
async function ensure(){ const r=wroot(); for(const d of ['source','generated','artifacts','attestations','execution','logs','memory']) await fs.mkdir(path.join(r,d),{recursive:true,mode:0o700}); return r; }
function response(id,result){ process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n'); }
function error(id,e){ process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32000,message:e.message}})+'\n'); }
const tools=[
 {name:'control12_workspace_status',description:'Read bounded workspace status and last revision.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'control12_memory_read',description:'Read recent workspace memory records.',inputSchema:{type:'object',properties:{scope:{type:'string'},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
 {name:'control12_validation_status',description:'Read latest CONTROL12 validation report. Does not execute deployment.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'control12_research_propose',description:'Record a research proposal for the separate bounded research broker.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
 {name:'control12_artifact_propose',description:'Record a staging artifact proposal. Does not deploy.',inputSchema:{type:'object',properties:{kind:{type:'string'},entrypoint:{type:'string'}},additionalProperties:false}}
];
async function call(name,args={}){
 const r=await ensure();
 if(name==='control12_workspace_status'){ const rev=await readJsonl(path.join(r,'execution','revisions.jsonl')); return {tenant:TENANT,workspace:WORKSPACE,revisions:rev.length,lastRevision:rev.at(-1)||null,productionAuthority:false}; }
 if(name==='control12_memory_read'){ const scope=/^[A-Za-z0-9._-]{1,128}$/.test(args.scope||'workspace')?(args.scope||'workspace'):'workspace'; const rec=await readJsonl(path.join(r,'memory',`${scope}.jsonl`)); return rec.slice(-Math.min(Math.max(Number(args.limit)||25,1),100)); }
 if(name==='control12_validation_status'){ const p=path.join(REPO,'.control12-validation','chat-fabric-validation.json'); try{return JSON.parse(await fs.readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT') return {status:'missing',productionAuthority:false}; throw e;} }
 if(name==='control12_research_propose' || name==='control12_artifact_propose'){ const rec={schema:'control12.mcp-proposal/v1',id:crypto.randomUUID(),type:name==='control12_research_propose'?'research':'artifact',state:'PROPOSED',productionAuthority:false,observedAt:new Date().toISOString(),payload:args}; const file=path.join(r,'memory','workspace.jsonl'); await fs.appendFile(file,JSON.stringify(rec)+'\n',{mode:0o600}); return rec; }
 throw new Error('unknown tool');
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',async line=>{ if(!line.trim())return; let m; try{m=JSON.parse(line);}catch{return;} try{
 if(m.method==='initialize') return response(m.id,{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'control12-bounded-mcp',version:'0.1.0'}});
 if(m.method==='notifications/initialized') return;
 if(m.method==='tools/list') return response(m.id,{tools});
 if(m.method==='tools/call'){ const out=await call(m.params?.name,m.params?.arguments||{}); return response(m.id,{content:[{type:'text',text:JSON.stringify(out,null,2)}]}); }
 if(m.id!=null) response(m.id,{});
 }catch(e){ if(m?.id!=null) error(m.id,e); }});
