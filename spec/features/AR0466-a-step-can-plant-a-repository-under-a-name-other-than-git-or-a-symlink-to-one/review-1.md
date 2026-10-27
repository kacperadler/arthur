# AR0466 - Review 1

- Job: 2026-10-27-review-e8079990
- Branch: arthur/2026-10-27-worker-cae1ba87
- Commit reviewed: b713ce5d6b987b01da9e8ae90ec58b2245c1b576
- Verdict: FAIL

## Final message

I'm failing this. The new rules keep the owner's clones, bare repositories and unchanged outward links, and the install's links inside the checkout survive. But one owner link that existed before the first step and never changed still gets removed, and one guard that stops the whole checkout from being deleted has no test.

## Findings

1. **An owner's symlink from before the first step, itself unchanged, is removed** (`packages/delivery/src/merge-checks.ts:65` and `escapes`, `:75-88`).
   - **Why:** `before` holds a symlink only if `escapes` said yes at snapshot time. A link that pointed to a file then is not recorded. If its target later disappears or turns into a folder, the link is dangling outside the checkout. The sweep then finds it as new, though its own stamp (`ino`/`ctime`) is the same, and removes it.
   - **Reproduced** with a throwaway `node -e` script through the real `stepRunner`, in a `mktemp -d` checkout (removed afterwards). The owner's `tools/py -> <tmp>/out/py` existed and was committed before the first step. The step ran `rm <tmp>/out/py`, and the log printed `removed tools/py, which rm …/out/py left: …`. `ls -l tools` afterwards showed only `outdir`.
   - **Reachable:** the sandbox lets a step write the temporary folder and the cache folder. Anything outside the step can also change a target during a merge, for example an nvm or Python upgrade.
   - **Why it matters:** this breaks the rule the code comment (`:24`) and the doc state: "not there, the same, before the first is removed". It is exactly what you asked me to check.
   - **Fix:** record every symlink's stamp in `before`, whether or not it escapes, so an unchanged link is always kept.
   - No test covers a link from before the first step whose target changes.

2. **A mutation of a protective guard goes uncaught: the `folder !== root` test in the `HEAD` rule** (`merge-checks.ts:62`).
   - **Why it matters:** this condition is the only thing that stops a `HEAD` at the checkout's top from making the root itself a "repository". The sweep would then stamp `""` and remove the whole checkout. A step run without the sandbox can write a top-level `HEAD`.
   - **Mutation:** with `folder !== root &&` removed, `merge-checks.test.ts` still passes 11 of 11.

## Notes (not blocking)
- **`.git-old` removal:** when a step runs without the sandbox and does only `mv .git .git-old`, `.git-old` is now removed, and it is the checkout's only Git folder. With the sandbox this can't happen, because the checkout's top takes no new entry (`job-sandbox.ts:121-124`). Without the sandbox, a malicious step could delete `.git` itself anyway. The worker tests this and says so.
- **Install links outside the checkout:** links an install makes to a folder outside are removed, as the ticket's Done means asks. Examples are an npm `file:../sibling` dependency or a global pnpm store. Only links inside the checkout and links to files survive. Worth one line in `merge.md`'s list of what stays.
- **The worker's F1** (`before` is taken after `git merge`) is real and correctly marked `open` in `findings.md`.
- The `delivery` budget raise 1584 → 1610 is recorded as AR-D159. `merge-checks.ts` is 197 lines.

## Checks run
- **`npm run check`:** tsc, no errors.
- **`node --test packages/delivery/test/merge-checks.test.ts test/structure.test.ts`:** 27 run, 27 pass, 0 fail, 0 skipped. This matches the worker's claim.
- **Mutations**, each run against `merge-checks.test.ts` with the file restored by `git checkout` after each; `git status` is clean:

| Mutation | Result |
|---|---|
| `HEAD` rule off | 2 fail |
| `..` check dropped | 1 fail |
| `.git` check dropped | 1 fail |
| Exception for links to files off | 1 fail |
| Dangling fallback `continue` → `return false` | 1 fail |
| Walk into a `HEAD` folder | 1 fail |
| Every symlink swept | 1 fail |
| **Root exclusion `folder !== root` removed** | **0 fail, not caught** |

- **Smoke test** through `stepRunner` in a temporary checkout, removed afterwards:
  - `npm install --offline` with a workspace: `node_modules/w -> ../packages/w` and `.bin/w -> ../w/bin/w.js` were kept. So were the owner's `tools/outdir` link to an outside folder and the pre-existing case above until its target went away.
  - The venv check could not run: `python3-venv` is not installed on this host.
  - systemd scopes were not available here (`uncapped:` line), so the steps ran bare.
- The full `npm test` was not run, as you instructed; the coordinator runs it.

FAIL