# arthur stats windows

Usage: `arthur stats windows`. Comes with the `stats` plugin (roadmap entry 112), and needs the `models` plugin, which reads the account's usage windows from the agent's report (`arthur usage --help`) and gives them to stats as `models.windows`. Answered without the model; the report is fetched again when the last one is 10 minutes old, as `arthur usage` does. Every project.

One line per window of the report, beside what Arthur spent at list price (`arthur stats --help`) on that provider's models in the window's span, by role:

```
Usage windows, each beside Arthur's spend at list price on its provider's models in its span; by role, its share ≈ its part of the window, at most: the account's use outside Arthur counts too.
- anthropic Claude 7 Day 40% used, since 2026-11-07 11:00: $13.00; worker 46% ≈ 18%, coordinator 35% ≈ 14%, review 15% ≈ 6%, plan 4% ≈ 2%
- anthropic Claude 5 Hour 13% used, since 2026-11-13 06:00: $0.00
- anthropic Claude 7 Day (fable) 90% used: the report gives no span
```

- The span runs from the window's reset less its length (`durationMs`) to now, its start in `core.timeZone`; a window whose report gives no reset is taken as the span of that length before now; one whose report gives no length has no span, and nothing is compared.
- The spend in the span is that of the runs and turns of `<home>/stats/` whose usage names a model of the window's provider (`anthropic/...` for `anthropic`): only those models' cost counts. A run whose record had no `usage` (a backfill line of a record older than roadmap entry 108) or was gone (`missing`) counts for no window.
- Each role, the most expensive first, has its share of that spend, then `≈` the window's used share times it: an estimate, and an upper bound. omp's report gives one used share per window for the whole account, nothing per session or call, and the owner's own use of the account outside Arthur counts in the window too, so a role's real part is at most the figure. The cost is at list price, what the tokens would cost on the API, whatever the account pays.

Without a window to show, one line, exit 0: `no usage windows: the models plugin is not loaded`; `no usage windows: the agent has no usage report (<why>)`, also when the last fetch failed; `no usage windows: no account reports one`.

Refused: a word after `windows` prints `usage: arthur stats windows` and exits 2. Inside a job, Arthur's home is hidden from the job's sandbox: it prints the spend view's refusal (`arthur stats --help`, "Refused") and exits 1.
