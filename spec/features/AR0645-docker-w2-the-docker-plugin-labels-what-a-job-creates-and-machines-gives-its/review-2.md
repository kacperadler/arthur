# AR0645 - Review 2

- Job: 2026-11-10-review-9d07b886
- Branch: arthur/2026-11-09-worker-69fae305
- Commit reviewed: e3d8f6b474f292a099f558b7cd5f8140e8bc78e6
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/docs/commands/setup.md:37` is now wrong about docker.** The `arthur setup` example still shows `docker (not in the config): labels and removes the Docker resources of each job`. That line is the plugin's `summary`, printed as it is (`packages/core/src/setup.ts:122`). The example quotes the other summaries word for word; session's matches `session-options.ts:6`. This branch builds the docker package with a different summary (`packages/docker/src/docker-options.ts:10`): "Docker on machines labelled tools: docker: what a job creates is labelled arthur.job=<id>, …". Before this branch the line described a package that did not exist. Now it describes a real one, and it says the plugin removes resources, which the branch's own `docs/docker.md` and README say is not built yet. The worker updated the other docker mentions (README, `arthur.mmd`, `docs/setup.md`, `arthur.config.example.ts`) but missed this one. The Scope's Out does not name this file, so the review criteria count it as a stale doc line, which fails the branch. The fix is one line: the real summary.

Everything else holds:
- **Plan W2:** done as the plan's Approach and Files lay it out, and it follows Decision AR-D597.
- **Sandbox change:** `job-sandbox.ts` `hidden()` shows the job's own `<home>/docker/jobs/<id>` once the prepare has made it. The test checks that bash can run the job's own script, and that the job is denied another job's script and `docker/told`.
- **Label flags against docker/cli v29.9.2:** I fetched `cli/command/container/opts.go`, `run.go`, `create.go` and `cli/flags/options.go`. `BARE`, `RUN_SHORT`, `GLOBAL` and `GLOBAL_SHORT` match them exactly, so no boolean option is missing that could let a later `--label arthur.job=<other>` through.

## Notes
- (bug) `packages/docker/src/docker-label.ts:34`: `docker -- run img` gets no label. Docker 29.9.2 runs the command after a leading `--` (I ran `docker -- version` and `docker -- create --help` on this machine), but the rewrite treats `--` as the end of the global options and passes the arguments unchanged. `labels.test.ts:22` even pins `["--", "run"]` as "passes unchanged". The list of unlabelled cases in `docs/docker.md` leaves this one out. A `--label arthur.job=<other>` there also reaches Docker, as it already does with docker called by its absolute path.
- (minor) `packages/docker/src/docker.ts:26`: deleting `after: ["projects"]` survives mutate. The host already sets up plugins with a piece after projects (AR0589); delivery, machines, findings and uptime declare it the same way.
- (minor) `packages/docker/test/fake-docker.ts:25,32`: three mutants in the test fake survive (`Platform` default inverted, the ssh option loop's bound). Not a behavior of the plugin itself.

## Checks (on e3d8f6b4, detached checkout)
- **`npm run check`:** no errors.
- **`npm test`:** 1700 tests, 1636 pass, 0 fail, 64 skipped. Matches the worker's numbers.
- **`npm run mutate`:** 25 mutants, 23 caught, 2 survived: `docker-options.ts:10` (`summary`) and `:12` (`tools`). Matches the worker.
- **`npm run mutate -- --max 120`:** 120 mutants, 111 caught, 9 survived:
  - `summary`, `tools` and `module` deleted: each makes `test/option-tables.test.ts` fail. I checked `tools` and `module` by hand: `fail 1` each.
  - `after` deleted: in Notes.
  - `memoryBytes(value, 0)` changed to 1 and to -1: no effect, as the worker said.
  - three in `fake-docker.ts`: in Notes.
- **Hand mutations, each restored with `git checkout --` (`git status` clean afterwards):**
  - Sandbox, run with the AR0593 test alone:
    - the shown docker folder removed: fail 1;
    - the whole `docker/` folder shown instead: fail 1;
    - the `existsSync` filter removed: 9 fail in `sandbox.test.ts`.
  - Docker, against `packages/docker/test/*.test.ts`, every one caught (fail 1 to 4):
    - the `container` condition set to `true`;
    - the `"-"` guard on the global options removed;
    - the kept `group.before` dropped;
    - `env.PATH ??` removed;
    - `slice(-8)` changed to `slice(-7)`;
    - the told-once check removed;
    - the data-root cache removed;
    - `rootless` forced false;
    - the TCP warning regex loosened;
    - the label check in the prepare disabled.
  - Machines: `machines.labels` answering the first machine whatever the name: fail 1 in `machines.test.ts`.
- **`arthur setup`:** not run. It refused inside this job (`refused inside a job`), so I confirmed what it prints by reading `setup.ts:122` and `installed.ts:31`.

FAIL