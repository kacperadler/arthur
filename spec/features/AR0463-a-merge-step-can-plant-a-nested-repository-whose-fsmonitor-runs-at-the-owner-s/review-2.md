# AR0463 - Review 2

- Job: 2026-10-26-review-a55d068d
- Branch: arthur/2026-10-26-worker-8e0940d9
- Commit reviewed: 23695218f7fa18f610c1d5ec64d5696852674f60
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0463 asks.

The worker's line "I can't find decision AR-D101" doesn't matter: the ticket on main (c1dc8bb4) has it, and the code follows it. It removes every `.git` a step made or changed, not every untracked one. The 1500 budget matches AR-D103.

**What the branch does**
- **Sweep:** after every step, passed or failed, `packages/delivery/src/merge-checks.ts` (`stepRunner`) sweeps the checkout, and the `reinstall` after a reset runs through the same sweep. A `.git` is removed when it is new, or when its stamp (inode and change time of the `.git` and of every entry inside it) differs from the one taken before the first step. Each removal prints one line.
- **Tests:** they cover:
  - a `git init` with `core.fsmonitor` set;
  - a `.git` file in another subfolder;
  - an ordinary file change, which stays;
  - a real submodule, which stays the same file and still works;
  - a failed step, a folder the step made unreadable, and a `.git` the step made unremovable;
  - the checkout's own `.git`;
  - an owner's clone whose `config` the step appended to in place, and one whose `.git` it replaced.
- **Docs:** `merge.md` and `deploy.md` say it.

**Notes (not blocking)**
1. **Bypass when no systemd scope can be made.** The steps then run bare, and the sweep runs as soon as a step's main process exits. A background process can plant a `.git` after that. My probe ran the step `(sleep 1; git init -q late) >/dev/null 2>&1 &`, and `late/.git` was there after the step. This only happens in the bare case, which already prints `uncapped: … what they leave behind is not killed`. With a scope, `systemctl stop` kills such a process before the sweep.
2. **Bypass for a clone that already had an unreadable folder in its `.git`.** `stamp` returns `"unreadable"` both before and after the step, so a step's change there passes. My probe gave an owner's clone a `.git/private` folder set to mode 000, then had a step append `fsmonitor` to that clone's `.git/config`: the `.git` was kept. This is rare (the owner's own setup, not the step's), but the docs' "the same" claim doesn't hold for it.
3. **Mutations the tests don't catch, and why they don't matter:**
   - Removing `ino` from the stamp: the change time alone already catches every replacement.
   - Changing the `"unreadable"` constant: any value works except one that matches the earlier stamp.
4. **Untested path:** a symlink named `.git`. It goes through the same code as the `.git` file, which is tested.
5. **Side effects on the owner's folders:**
   - `entries` runs `chmod u+rwx` on any unreadable folder in the checkout, the owner's own included, even when no step touched it.
   - `remove` runs `chmod u+rwx` on the parent folder of each `.git` it removes.
6. **Data loss the owner asked for:** as the worker says, a check that runs git inside an owner's clone changes its `index`, and that clone's `.git` is then deleted, history included. This follows AR-D101, and the docs and the printed line say it.
7. **F1 is still open in `findings.md`:** a repository under a name other than `.git`, or a symlink to one. It is outside this ticket.

**Checks**
- `npm ci`: succeeded. `npm run check` (tsc): passed.
- Full `npm test`: I stopped my own run as instructed (the owner said not to run the full suite), so its 5 failed files are from that stop, not from the branch. The host's result counts: 1182 tests, 1176 pass, 0 fail, 6 skipped.
- `node --test packages/delivery/test/merge-checks.test.ts`: 4 tests, 4 pass. `node --test test/structure.test.ts`: 16 tests, 16 pass. That is the worker's 20.
- File sizes: `merge-checks.ts` is 158 lines and its test 102, both under 200.
- Mutations on `merge-checks.ts`, each restored with `git checkout`:

| Mutation | Result |
|---|---|
| Any `.git` there before is kept | 2 fail |
| Sweep disabled | 3 fail |
| `folder !== root` dropped | 2 fail |
| Change time dropped from the stamp | 1 fail |
| No walk inside a `.git` folder | 1 fail |
| `chmod` of unreadable folders in `entries` removed | 1 fail |
| Parent `chmod` in `remove` removed | 1 fail |
| Walk stops one level below the top | 2 fail |
| Inode dropped from the stamp | 0 fail (note 3) |
| `"unreadable"` changed to `""` | 0 fail (note 3) |

- Throwaway probe in `/tmp`, removed afterwards: confirmed notes 1 and 2.
- The working tree is clean after the mutations.

PASS