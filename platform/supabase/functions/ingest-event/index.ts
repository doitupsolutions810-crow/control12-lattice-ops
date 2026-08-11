import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  const auth = request.headers.get("authorization");
  if (!auth) return new Response("unauthorized", { status: 401 });

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const body = await request.json();
  const required = ["tenant_id", "topic", "payload", "digest"];
  for (const key of required) {
    if (!body[key]) return Response.json({ error: `${key} is required` }, { status: 400 });
  }
  const { data, error } = await client.from("control12_events").insert({
    tenant_id: body.tenant_id,
    topic: body.topic,
    payload: body.payload,
    metadata: body.metadata ?? {},
    digest: body.digest,
    event_id: body.event_id
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
});
