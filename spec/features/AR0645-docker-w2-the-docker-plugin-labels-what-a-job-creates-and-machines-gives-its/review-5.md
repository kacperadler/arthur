# AR0645 - Review 5

- Job: 2026-11-11-review-b040a112
- Branch: arthur/2026-11-09-worker-69fae305
- Commit reviewed: 87467d5c1550168ad322197f3dbde75f43647799
- Verdict: PASS

## Final message

No blocking findings. At 87467d5c the branch does W2 of the AR0604 plan and follows AR-D597 (the job sees its own `<home>/docker/jobs/<id>`) and AR-D627 (the roadmap 70 line is reworded to match). The merge of main (87467d5c) resolves the conflicts correctly:
- docker's entries sit in name order in `PLUGINS` and `TOOLS` (`test/option-tables.test.ts`).
- `class docker partial;` replaces main's `planned` line in `arthur.mmd`.
- `docker: 275` sits next to main's `dokploy: 690` (`test/structure.test.ts`).
- The roadmap 70 "Done means" line says an `arthur.job` word after the image is dropped too, which matches `docs/docker.md`.

Everything the worker's final message claims matches what I see. That includes the check counts, the two mutate survivors (`test/option-tables.test.ts` catches both) and machines' budget going from 535 to 538.

## Notes
- (bug) packages/docker/src/docker-label.ts:45: buildx's own options before `build` hide the command, so no label is added and a foreign one stays. `labelled(["buildx","--builder","x","build","--label","arthur.job=other","."], "mine")` returns the arguments unchanged. Docker 29.9.2 on this machine runs that spelling as `buildx build`: `docker buildx --builder default build --help` and `docker buildx --debug build --help` both print `Usage:  docker buildx build`. `buildx build` is on roadmap 70's list. F2 covers other commands (`builder build`, `buildx b`, `commit`, `image import`), not this spelling. Calling `docker` by its absolute path already gets past the label, as documented, so this is a hole in what gets labelled, not a new way around a security boundary.
- (minor) packages/docker/src/docker-label.ts:39: removing `args[at] !== "-" &&` survives `labels.test.ts`. The `["-", "run"]` row only passes by accident: `-` is then read as a short option that takes a value, which skips past the last argument. It does no harm, because Docker refuses `-` as a command.

## Checks (on 87467d5c, detached checkout; `git status --short` empty afterwards)
- **`npm run check`:** no errors.
- **`npm test`:** 1719 tests, 1655 pass, 0 fail, 64 skipped. Same as the worker's numbers.
- **`npm run mutate`:** 25 mutants, 23 caught, 2 survived: `docker-options.ts:10` (`summary` deleted) and `:12` (`tools` deleted).
- **Those two by hand, against `test/option-tables.test.ts`:** each deletion gives pass 4, fail 1.
- **Hand mutations of `docker-label.ts`, against `packages/docker/test/labels.test.ts`, each restored with `git checkout --`:**
  - Six were caught, with 1 or 2 failing tests each: the group's `-d` not kept after its `l` is removed (`-dl`); the `-` group not kept; the leading `--` not skipped; `KEY` with `$` removed; `before === "--label"` removed; `GLOBAL.includes` forced to 1.
  - Two survived:
    - the `startsWith("--") ? null` guard removed: the result is the same, because `SHORT` cannot match a word starting with `--`;
    - the `"-"` guard removed: in the notes above.
- **Merge resolution:** read with `git show --cc 87467d5c`. Only `arthur.mmd`, `spec/roadmap.md`, `test/option-tables.test.ts` and `test/structure.test.ts` were resolved by hand, and each keeps both sides.
- **Whitespace and case spellings of the key, real Docker 29.9.2 client with `DOCKER_HOST` pointed at a local listener that logged each request:**
  - `docker volume create --label arthur.job=mine --label <v> v` sent the keys `" arthur.job"`, `"arthur.job\n"` and `"ARTHUR.JOB"` as separate labels next to `arthur.job: mine`.
  - The CLI refused `"arthur.job =other"` and `"arthur.job\t=other"` with exit 125.
  - So no foreign `arthur.job` gets through these spellings. The listener was stopped and its folder removed afterwards.

PASS