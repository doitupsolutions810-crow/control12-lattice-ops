import http from "node:http";
import { createRuntime } from "./runtime.mjs";
import { bearer, readJson, requestId, sendJson, serveStatic } from "./http/router.mjs";

const rt = await createRuntime();
setInterval(() => rt.workers.reap().catch(() => {}), 15000).unref();

function auth(req, scopes = []) { return rt.tokens.verify(bearer(req), scopes); }
function tenantOf(claims, url) { const requested = url.searchParams.get("tenant"); if (requested && requested !== claims.tenant && !claims.scopes.includes("fabric.admin")) throw Object.assign(new Error("cross-tenant access denied"), { statusCode: 403 }); return requested || claims.tenant; }

const server = http.createServer(async (req, res) => {
  const id = requestId(req); res.setHeader("x-request-id", id); const url = new URL(req.url, `http://${req.headers.host || `${rt.config.host}:${rt.config.port}`}`); const started = Date.now();
  try {
    rt.limiter.consume(req.socket.remoteAddress || "unknown");
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { status:"ok", service:"control12-sovereign-fabric", version:rt.config.version, environment:rt.config.environment });
    if (req.method === "GET" && url.pathname === "/ready") { const chain=await rt.ledger.verify(); return sendJson(res, chain.ok?200:503, { status:chain.ok?"ready":"not_ready", ledger:chain }); }
    if (req.method === "GET" && url.pathname === "/metrics") { res.writeHead(200,{"content-type":"text/plain; version=0.0.4"}); return res.end(rt.metrics.render()); }
    if (req.method === "POST" && url.pathname === "/api/v2/auth/token") { if (!rt.config.bootstrapSecret || req.headers["x-control12-bootstrap"] !== rt.config.bootstrapSecret) throw Object.assign(new Error("bootstrap authentication failed"), { statusCode:401 }); const body=await readJson(req,rt.config.maxBodyBytes); return sendJson(res,201,{token:rt.tokens.issue(body)}); }
    if (req.method === "GET" && url.pathname === "/api/v2/events/stream") { const claims=auth(req,["event.read"]); const tenant=tenantOf(claims,url); res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache","connection":"keep-alive"}); const unsubscribe=rt.bus.subscribe("*",event=>{if(event.tenant===tenant)res.write(`data: ${JSON.stringify(event)}\n\n`)}); req.on("close",unsubscribe); return; }
    if (url.pathname.startsWith("/api/v2/")) {
      const scopeMap={"/api/v2/system":"system.read","/api/v2/events":"event.read","/api/v2/workflows":"workflow.read","/api/v2/approvals":"approval.read","/api/v2/workers":"worker.read","/api/v2/plugins":"plugin.read","/api/v2/components":"component.read","/api/v2/graph":"graph.read"};
      const base=Object.keys(scopeMap).find(prefix=>url.pathname===prefix||url.pathname.startsWith(`${prefix}/`)); const claims=auth(req, req.method==="GET" ? [scopeMap[base]||"fabric.admin"] : []); const tenant=tenantOf(claims,url);
      if (req.method === "GET" && url.pathname === "/api/v2/system") return sendJson(res,200,{version:rt.config.version,tenant,plugins:rt.plugins.list().map(x=>({id:x.id,capabilities:x.capabilities})),ledger:await rt.ledger.verify(),replication:rt.replicator.snapshot()});
      if (req.method === "GET" && url.pathname === "/api/v2/events") return sendJson(res,200,(await rt.ledger.tail(Number(url.searchParams.get("limit")||100))).filter(x=>x.tenant===tenant));
      if (req.method === "GET" && url.pathname === "/api/v2/workflows") return sendJson(res,200,await rt.workflows.list(tenant));
      if (req.method === "POST" && url.pathname === "/api/v2/workflows") { const actor=auth(req,["workflow.write"]); return sendJson(res,202,await rt.workflows.submit({tenant,actor:actor.sub,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "POST" && /^\/api\/v2\/workflows\/[^/]+\/run$/.test(url.pathname)) { const actor=auth(req,["workflow.write"]); const workflowId=url.pathname.split("/")[4]; return sendJson(res,200,await rt.workflows.run(workflowId,tenant,actor.scopes)); }
      if (req.method === "POST" && /^\/api\/v2\/workflows\/[^/]+\/cancel$/.test(url.pathname)) { const actor=auth(req,["workflow.write"]); return sendJson(res,202,await rt.workflows.cancel(url.pathname.split("/")[4],tenant,actor.sub)); }
      if (req.method === "GET" && url.pathname === "/api/v2/approvals") return sendJson(res,200,await rt.approvals.list(tenant));
      if (req.method === "POST" && url.pathname === "/api/v2/approvals") { const actor=auth(req,["approval.write"]); return sendJson(res,201,await rt.approvals.create({tenant,requester:actor.sub,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "POST" && /^\/api\/v2\/approvals\/[^/]+\/decision$/.test(url.pathname)) { const actor=auth(req,["approval.write"]); return sendJson(res,200,await rt.approvals.decide(url.pathname.split("/")[4],{tenant,actor:actor.sub,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "GET" && url.pathname === "/api/v2/workers") return sendJson(res,200,await rt.workers.list(tenant));
      if (req.method === "POST" && url.pathname === "/api/v2/workers/register") { auth(req,["worker.write"]); return sendJson(res,201,await rt.workers.register({tenant,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "POST" && /^\/api\/v2\/workers\/[^/]+\/heartbeat$/.test(url.pathname)) { auth(req,["worker.write"]); return sendJson(res,200,await rt.workers.heartbeat(url.pathname.split("/")[4],tenant)); }
      if (req.method === "POST" && /^\/api\/v2\/workers\/[^/]+\/lease$/.test(url.pathname)) { auth(req,["worker.write"]); return sendJson(res,200,await rt.workers.lease(url.pathname.split("/")[4],tenant)); }
      if (req.method === "POST" && /^\/api\/v2\/workers\/[^/]+\/tasks\/[^/]+\/complete$/.test(url.pathname)) { auth(req,["worker.write"]); const p=url.pathname.split("/"); return sendJson(res,200,await rt.workers.complete(p[4],p[6],tenant,await readJson(req,rt.config.maxBodyBytes))); }
      if (req.method === "GET" && url.pathname === "/api/v2/plugins") return sendJson(res,200,rt.plugins.list());
      if (req.method === "POST" && url.pathname === "/api/v2/plugins") { const actor=auth(req,["plugin.write"]); return sendJson(res,201,await rt.plugins.register({...await readJson(req,rt.config.maxBodyBytes),tenant},actor.sub)); }
      if (req.method === "POST" && /^\/api\/v2\/plugins\/[^/]+\/invoke$/.test(url.pathname)) { const actor=auth(req,["plugin.invoke"]); const pluginId=url.pathname.split("/")[4]; return sendJson(res,200,await rt.pluginExecutor.invoke({tenant,actor:actor.sub,actorScopes:actor.scopes,pluginId,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "GET" && url.pathname === "/api/v2/components") return sendJson(res,200,await rt.components.list(tenant));
      if (req.method === "POST" && url.pathname === "/api/v2/components") { const actor=auth(req,["component.write"]); return sendJson(res,201,await rt.components.register({tenant,...await readJson(req,rt.config.maxBodyBytes)},actor.sub)); }
      if (req.method === "POST" && url.pathname === "/api/v2/artifacts") { auth(req,["artifact.write"]); return sendJson(res,201,await rt.artifacts.put({tenant,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "POST" && url.pathname === "/api/v2/deployments/plan") { const actor=auth(req,["deployment.write"]); return sendJson(res,200,await rt.deployments.plan({tenant,actor:actor.sub,actorScopes:actor.scopes,...await readJson(req,rt.config.maxBodyBytes)})); }
      if (req.method === "POST" && url.pathname === "/api/v2/policy/evaluate") { const actor=auth(req,["policy.evaluate"]); return sendJson(res,200,await rt.policy.evaluate({...await readJson(req,rt.config.maxBodyBytes),actorScopes:actor.scopes})); }
      if (req.method === "GET" && url.pathname === "/api/v2/graph") return sendJson(res,200,await rt.graph.snapshot(tenant));
    }
    if (req.method === "GET" && await serveStatic(res,rt.config.dashboardDir,url.pathname)) return;
    return sendJson(res,404,{error:"not found",requestId:id});
  } catch (error) {
    rt.metrics.inc("control12_http_errors_total",{status:error.statusCode||500}); await rt.bus.publish({tenant:"system",type:"http.error",actor:"server",payload:{requestId:id,path:url.pathname,message:error.message}}).catch(()=>{});
    return sendJson(res,error.statusCode||500,{error:error.message,requestId:id},error.retryAfter?{"retry-after":String(error.retryAfter)}:{});
  } finally { rt.metrics.inc("control12_http_requests_total",{method:req.method,path:url.pathname}); rt.metrics.set("control12_http_last_duration_ms",{},Date.now()-started); }
});
server.listen(rt.config.port,rt.config.host,()=>console.log(`CONTROL12 Sovereign Fabric v${rt.config.version} listening on http://${rt.config.host}:${rt.config.port}`));
