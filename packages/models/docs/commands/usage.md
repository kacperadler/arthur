# arthur usage

Usage: `arthur usage [--email]`; on a channel `/usage`.

Each authenticated account's limit windows (roadmap entry 82), from the agent's own report, `omp usage --json` (the core's `agent.command`), one line per account, answered without the model:

```
anthropic: Claude 5 Hour 13% used, resets in 23 min; Claude 7 Day 76% used, resets in 1 d 20 h
openai-codex: no data
```

- A provider with several accounts numbers them, `anthropic (account 2): ...`; `--email` names each account by its email instead. Without `--email` no email is printed, and `/usage` never prints one.
- `no data`: an account the report lists without usage (`accountsWithoutUsage`), or one without a window.
- The report is kept in `<home>/models/usage.json` and fetched again once the last fetch is 10 minutes old; `arthur run` asks every minute, so the coordinator's context stays current. A fetch that fails keeps the last report, and the answer starts with its age: `as of 14 min ago; the fetch 0 min ago failed: <reason>`.
- An agent without a usage report (the command fails, or prints no `reports` list): `the agent has no usage report (<reason>); no model is skipped for its limits`.

What the windows do elsewhere: a model list skips a built-in model whose provider has a window at or over `limits.stopAt` (default 95%) on every account, and a window at or over `limits.warnAt` (default 80%) is named on a job's spawn line and in the coordinator's context: docs/models.md, "Limits".

Exit code 2 for any argument other than `--email`.
