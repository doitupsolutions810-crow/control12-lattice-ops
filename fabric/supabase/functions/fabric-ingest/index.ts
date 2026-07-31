import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const event = await req.json();
  if (!event?.tenant || !event?.hash || !event?.type || !event?.actor) return Response.json({ error: "invalid event" }, { status: 400 });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await client.from("control12_fabric_events").upsert({
    tenant_id: event.tenant,
    event_hash: event.hash,
    prev_hash: event.prevHash,
    event_type: event.type,
    actor: event.actor,
    payload: event.payload,
    observed_at: event.observedAt
  }, { onConflict: "event_hash" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ accepted: true, hash: event.hash });
});
