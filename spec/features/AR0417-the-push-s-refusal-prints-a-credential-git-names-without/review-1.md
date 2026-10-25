# AR0417 - Review 1

- Job: 2026-10-25-review-3f0bac2f
- Branch: arthur/2026-10-25-worker-0786d1ba
- Commit reviewed: f03f28209ed7ba33047828b6f826c6bf6f0420a4
- Verdict: PASS

## Final message

No findings. The branch makes exactly the change AR0417 asks for and adds the test it asks for. A mutation that removes the fix is caught, and every check passes when I run it.

**Findings**

None.

**Notes (not blocking)**

- `packages/github/src/github-git.ts:49`: `.replace(/\S*@\S+/g, "origin")` is the regex the ticket names, applied after the quote rule and the `://` rule. It catches a credential git prints as `user:pass@host`, an scp-like `user@host:path`, and a URL with userinfo (the `://` rule already caught that). Every form I could think of is covered: userinfo in a URL cannot hold an unescaped space, so git cannot print it as two words. One cosmetic cost: a word with an `@` that is not a credential also becomes `origin` (for example a branch `arthur/a@b` named in "src refspec … does not match any"). That is the same tradeoff the clone's refusal already makes (AR0342), and the ticket asks for it.
- `packages/github/test/github.test.ts:474-501`: the new `userinfo` project sits next to the push refusals, as the ticket says. The test checks the whole line up to `(port 9418)` and that `s3cret` is absent. The error text that follows depends on the resolver, but the assertion stops before it, so the test does not break when that text changes. [INFERENCE] git hands the name `arthur:s3cret@127.0.0.1` to getaddrinfo, which may ask the configured DNS resolver, so "no lookup leaves the machine" is not proven. The ticket approved this origin as written.
- The comment at `github-git.ts:32` was reworded to cover the new rule and stays one line. Source lines are net zero, so no line budget is affected.
- Commit `f03f2820 fix(AR0417): …` follows Conventional Commits with the ticket id as scope. The diff touches only the two files in the ticket's scope.
- The worker's final message matches what I see, including its statement that it did not run the full `npm test`.

**Checks run**

- `npm ci`: added 22 packages, no errors.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1107 tests, 1049 passed, 0 failed, 0 cancelled, 58 skipped. My first run piped the output through a `grep` that matched no line and ended with exit 1. It showed no results, so I ran the suite again with `tail`, and the counts above are from that run.
- Mutation: I deleted `.replace(/\S*@\S+/g, "origin")` from `src/github-git.ts`, then ran `node --test --test-name-pattern="github.push pushes" test/github.test.ts`. Result: 0 pass, 1 fail, with actual line `'github: main not pushed to origin: fatal: unable to look up arthur:s3cret@127.0.0.1:1 (port 9418) (Name or service not known)'`, so the test catches it. I restored the file with `git checkout -- src/github-git.ts`, and `git status --short` was clean afterwards.

PASS