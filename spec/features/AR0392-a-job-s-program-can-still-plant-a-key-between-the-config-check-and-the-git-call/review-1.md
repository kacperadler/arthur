# AR0392 - Review 1

- Job: 2026-11-02-review-9b8e8072
- Branch: arthur/2026-11-02-worker-c822fb9b
- Commit reviewed: 1482cc0f0950a50b53c8688a278f18a7c2e6d21a
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what the ticket asks, and the one place it departs from the ticket (`commit.gpgSign`) is justified by an earlier decision from the owner.

**`commit.gpgSign`: passing the owner's value is right.** AR-D184 (`spec/decisions.jsonl:369`) reads: "Jobs commit unsigned: Arthur turns commit signing off inside every job and merge step; the merge commit Arthur makes stays signed". The ticket's fixed `commit.gpgSign=false` would contradict that. Here is how the worker's choice holds for each call that gets the pins:
- **`arthur merge` (the merge commit and the `spec:` commit):** these run in the coordinator's environment, so `checkConfig` picks up the owner's `commit.gpgsign=true` and the commit is signed, as AR-D184 asks. A merge step or job runs with signing turned off through `GIT_CONFIG_*`. `checkConfig` reads that as command-line scope, so the pin there is `false`. The worker's smoke shows exactly that: `commit.gpgsign=false` from the job's environment.
- **Pushes, `ls-remote`, delete on origin, `gitOver`'s push and fetch, health's `git log`:** these make no commit, so the `commit.gpgSign` value doesn't matter. A `push.gpgSign` or `log.showSignature` planted in the gap can only start the signing program, and that program is pinned.
- **Does pinning the signing programs close the same gap?** Yes. A planted `commit.gpgSign=true` can only start the program that `gpg.format`, `gpg.program`/`gpg.openpgp.program`, `gpg.ssh.program`, `gpg.x509.program` and `gpg.ssh.defaultKeyCommand` resolve to. All of those are pinned with `-c`, which Git reads after the repository's config, to the owner's value or Git's default. Owner values come only from outside the repository: a local `commit.*` or `gpg.*` key is outside `ALLOWED`, so the check refuses it. `git-config.test.ts` runs real Git for each planted key and shows the planted program never runs with the pins and does run without them.

**Budget:** core 7056 → 7069 is decided (AR-D452 under AR-D63). `merge-command.ts` is 218 lines, but it was already yellow at 217 on the base, so no file entered yellow or red.

**Worker's claims:** the test counts, the call sites that pass the pins, and the docs (`deploy.md` Threat model, `plugin-api.md` export and its AR0392 entry) all match what I saw. Outside the dated AR0380 history entry, no doc or code still names `configRefusal` or `originRefusal`.

## Notes
- (risk) docs/deploy.md:40: the Threat model's list of keys that can still win the race leaves some out. It names only filters, merge drivers and `core.gitProxy`. A `protocol.file.allow`/`protocol.<name>.allow` or `url.<base>.insteadOf` written in the gap can still send `github.push` to a folder's hooks. That gap is the worker's F2 in `findings.md`, but the doc doesn't mention it.
- (minor) packages/core/src/git-config.ts:42: a `user.signingKey` written in the gap is not pinned. It runs no program, but it can make the merge commit sign with another key the owner's agent holds.
- (minor) packages/delivery/src/merge-command.ts: 218 lines, yellow (it was 217 on the base).

## Checks
- `npm run check`: tsc clean.
- `npm test` (run twice, first output cut short by my filter): tests 1491, pass 1427, fail 0, skipped 64, matching the worker's numbers.
- Hand mutation, removing the leading `credential.helper=` reset in `checkConfig`: `git-config.test.ts` 2 fail, caught. Restored.
- Hand mutation, removing the `protocol.ext.allow=never` pin: `machine.test.ts` 1 fail, caught. Restored; `git status --short` empty.
- Empty `gpg.ssh.defaultKeyCommand` pin with ssh signing and no signing key: the commit fails with the same `user.signingKey needs to be set` error as without the pin, so the empty default doesn't change Git's behaviour.
- I did not run `npm run mutate`, to save budget; the worker ran it with `--max 10` (10 caught).

PASS