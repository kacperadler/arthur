# The models plugin

Roadmap entry 82: models on servers of the private network, a fallback chain, and each account's limit windows. The plugin is optional: without it a job's model is one name, which the agent resolves, and a list is refused (`a model list needs the models plugin`).

```ts
models({
	providers: {
		mac: { kind: "ollama", url: "http://mac.tail1234.ts.net:11434" },
		lab: { kind: "openai-compatible", url: "http://192.168.1.20:1234/v1", keyEnv: "ARTHUR_MODELS_LAB_KEY" },
	},
	probeSeconds: 3,
	limits: { warnAt: 80, stopAt: 95 },
}),
```

and in orchestration's `roles`, a role's model as an ordered list: `worker: { model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"] }`; on one spawn, `arthur spawn --model mac/qwen3-coder,anthropic/claude-haiku-5-5`.

## Providers

- `providers`: named, each `{ kind, url, keyEnv? }`. `kind` is `ollama` or `openai-compatible` (LM Studio, llama.cpp's server, vLLM). `url` is Ollama's root, or an OpenAI-compatible server's `/v1`. `keyEnv` names the variable that holds its API key (`ARTHUR_MODELS_<WHAT>`, in the shell or the env file).
- A url's host must be loopback (`localhost`, 127.0.0.0/8, `::1`), private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7, which holds Tailscale's fd7a:115c:a1e0::/48) or Tailscale (100.64.0.0/10, a `*.ts.net` name), but not the cloud metadata addresses inside them (`100.100.100.200`, `fd00:ec2::254`); any other host, and a url that is not `http` or `https`, refuses the start. A name is resolved at load, which a name resolving to any other address refuses, and again at each probe, which then refuses the provider (`refused: <name> resolves to <address>, not a private address`); a name that does not resolve at load is the probe's to report.
- A model is `<provider>/<model>`: one whose provider is in `providers` is a provider model, any other (`anthropic/claude-haiku-5-5`) a built-in one, the agent's own.

## Probes

The core asks `models.pick` at every spawn with a model, a single one too: the list, and the machine the job runs on. The first available model of the list is the job's; the job's record names it (`model`) and why (`model-why`), e.g. `mac/qwen3-coder unreachable: timed out after 3 s; using anthropic/claude-haiku-5-5`, and `arthur spawn` prints that line as `model: <why>` on stderr. None available refuses the spawn before any record exists, naming each model with its reason: `no model available: mac/qwen3-coder: unreachable: timed out after 3 s; lab/qwen3: not in its model list`.

- A provider model is available when its server answers its model list within `probeSeconds` and lists the model: Ollama's `GET <url>/api/tags`, where a name without a tag matches its `:latest`; an OpenAI-compatible server's `GET <url>/models`, with `Authorization: Bearer <key>` when `keyEnv` is set. Its reasons: `unreachable: <curl's or ssh's line>` (`timed out after 3 s` past `probeSeconds`), `its model list answered HTTP 401`, `its model list answered something that is not a model list`, `not in its model list`.
- A probe is `curl --config -` on the job's machine through `host.jobs.run`, so a job on another machine is probed from there: a loopback or private url may not reach the same server from here. The url, the key's header and the address the name resolved to here (curl's `resolve`) go on curl's stdin, never in an argument.
- One probe per provider and machine runs at a time, across every `arthur` process: a probe holds the lock `<home>/models/probe.<machine>.<provider>.lock`, and a process that waited for it takes the answer the first one wrote. Each answer is kept with its time in `<home>/models/probes.json`, written whole (a temporary name, then renamed), and reused for 30 s by every process, so two `arthur spawn` commands at once make one request. A `probes.json` that is not JSON, or an entry of another shape, keeps nothing.
- A built-in model is available unless its provider's window is at its limit (below).
- A job never changes model mid-run: a model lost while the job runs (the Mac goes to sleep) fails the job with the reason the agent gave.

## A job on a provider model

Through `prepare`, the job gets the provider in its own environment only, under omp's provider of its kind, which reads it there; `arthur continue` runs the prepare again, so a continued job gets it as at its spawn:

- `ollama`: omp's `ollama` provider, `OLLAMA_BASE_URL=<url>`, `OLLAMA_API_KEY` from `keyEnv`, `--model ollama/<model>`;
- `openai-compatible`: omp's `lm-studio` provider, which reads any OpenAI-compatible `/models`, `LM_STUDIO_BASE_URL=<url>`, `LM_STUDIO_API_KEY` from `keyEnv`, `--model lm-studio/<model>`.

The agent's `--model` comes from the variable `ARTHUR_AGENT_MODEL` the prepare returns; the record keeps the list's name, `mac/qwen3-coder`. Not a `models.yml`: omp reads that only from its own agent folder (`~/.omp/agent/models.yml`, the owner's global file), and moving that folder (`PI_CODING_AGENT_DIR`) moves omp's settings and state with it. A key reaches the probe's header and the job's environment only, never the record, the log or a refusal.

A provider model costs 0: its job keeps its time limit, its budget is 0 (no limit, entry 12), and its `model-why` ends `budget: none, free model <name>`.

## Limits

`arthur usage` and `/usage` (docs/commands/usage.md) print each account's windows from the agent's report. A list skips a built-in model whose provider has, on every account that reports, a window at or over `limits.stopAt` (default 95%), a window of one model tier (`scope.tier`) aside: `anthropic/claude-opus-5 at its limit: anthropic Claude 7 Day 96% used, resets in 10 h 0 min (limits.stopAt 95%)`. Every window at or over `limits.warnAt` (default 80%) ends the job's `model-why`, and so its spawn line, and is a section of the coordinator's context. An agent without a report skips nothing.

## arthur doctor

- `curl`: on the PATH here.
- `provider <name>`: its model list answers from here, `ok (<n> models)`.
- `model <provider>/<model>`, for each provider model a list names (orchestration's `roles`, through `models.lists`): its server lists it; the fix is `ollama pull <model>` there, or loading it in the server.
- `omp models.yml`: omp's own `models.yml` configures neither `ollama` nor `lm-studio` of the kinds in `providers`, since its provider would replace the one the job's environment sets; critical.
- `omp models.yml on <machine>`, for each machine registered with the core (the machines plugin's `list`): the same check of the `models.yml` omp reads there (`$PI_CODING_AGENT_DIR/models.yml`, else `~/.omp/agent/models.yml`), read with `cat` over SSH through `host.jobs.run`; none there is `ok (no models.yml)`; critical. A machine that does not answer is not checked, `ok (not reached: <ssh's line>)`: its own `machines <name>` line says why, and an offline machine never refuses the start.

A provider or a model line is critical only when a list names it with no later model on another provider or built in; `curl` when a provider is.
