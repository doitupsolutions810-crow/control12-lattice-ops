const [, , action, ...args] = process.argv;
const base =
  process.env.CONTROL12_URL ||
  "http://127.0.0.1:4312";

async function call(path, options = {}) {
  const timeout =
    path.includes("mode=quorum")
      ? 900000
      : 180000;

  const response = await fetch(base + path, {
    ...options,
    signal:
      options.signal ??
      AbortSignal.timeout(timeout)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${text}`
    );
  }

  try {
    console.log(
      JSON.stringify(JSON.parse(text), null, 2)
    );
  } catch {
    console.log(text);
  }
}

switch (action) {
  case "chat":
  case "quorum": {
    const message = args.join(" ").trim();

    if (!message) {
      throw new Error("A message is required");
    }

    await call(
      action === "quorum"
        ? "/api/chat?mode=quorum"
        : "/api/chat",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message
        })
      }
    );

    break;
  }

  case "task": {
    const command = args.join(" ").trim();

    if (!command) {
      throw new Error("A command is required");
    }

    await call("/api/tools/terminal", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        command,
        cwd: process.cwd()
      })
    });

    break;
  }

  case "agent": {
    const [role, ...messageParts] = args;
    const message = messageParts.join(" ").trim();

    if (!role || !message) {
      throw new Error("Usage: control12-app agent <role> <message>");
    }

    await call(`/api/agents/${encodeURIComponent(role)}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message,
        includeEvidence: true
      })
    });

    break;
  }

  case "agents":
    await call("/api/agents");
    break;

  case "evidence":
    await call("/api/evidence");
    break;

  case "memory": {
    const limit = args[0] || "100";
    await call(`/api/memory?limit=${encodeURIComponent(limit)}`);
    break;
  }

  case "health":
    await call("/health");
    break;

  case "capabilities":
    await call("/api/capabilities");
    break;

  default:
    console.log(`
CONTROL12 v0.8.0

  control12-app chat "message"
  control12-app quorum "task"
  control12-app agent <role> "message"
  control12-app agents
  control12-app evidence
  control12-app task "command"
  control12-app memory [limit]
  control12-app health
  control12-app capabilities
`);
}
