const $ = selector => document.querySelector(selector);

async function json(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function refresh() {
  const [health, components, workflows, agents, spectrum] = await Promise.all([
    json('/health'),
    json('/api/v1/components'),
    json('/api/v1/workflows'),
    json('/api/v1/agents'),
    json('/api/v1/audio/spectrum').catch(() => null)
  ]);
  $('#health').textContent = health.status.toUpperCase();
  $('#components').textContent = components.length;
  $('#workflows').textContent = workflows.length;
  $('#agents').innerHTML = Object.entries(agents).map(([id,purpose]) => `<div class="pill"><strong>${id}</strong><br>${purpose}</div>`).join('');
  const dep = health.dependencies.localAgent;
  $('#dependency').innerHTML = `<div class="pill">Local Agent: ${dep.ok ? 'READY' : 'UNAVAILABLE'}</div><div class="pill">Latency: ${dep.latencyMs} ms</div>`;

  if (spectrum) {
    const el = $('#resonant');
    if (el) {
      el.innerHTML = [
        `<div class="pill"><strong>belief</strong> ${spectrum.belief?.toFixed?.(3) ?? spectrum.belief}</div>`,
        `<div class="pill"><strong>tension</strong> ${spectrum.tension?.toFixed?.(3) ?? spectrum.tension}</div>`,
        `<div class="pill"><strong>carrier</strong> ${spectrum.carrier}</div>`,
        `<div class="pill"><strong>partials</strong> ${(spectrum.partials || []).slice(0,6).join(', ')}</div>`
      ].join('');
    }
  }
}

$('#refresh').addEventListener('click', () => refresh().catch(error => $('#output').textContent = error.message));
$('#workflow-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const workflow = await json('/api/v1/workflows', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({name:form.get('name'),steps:[{type:'agent',role:'verifier',message:form.get('message'),options:{includeEvidence:true}}]})
    });
    const result = await json(`/api/v1/workflows/${workflow.id}/run`, {method:'POST'});
    $('#output').textContent = JSON.stringify(result,null,2);
    await refresh();
  } catch (error) { $('#output').textContent = error.message; }
});
refresh().catch(error => $('#output').textContent = error.message);
