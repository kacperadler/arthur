# AR0393 - Outcome

- Merged: 2026-10-25, `7c89d7fd`
- Branch: h/2026-10-25-ar0393-remote-url-transp-1c8e5d95
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.63, reviews $1.22; review rounds 2

## What went in

- `packages/github/src/github-git.ts`: `push()` runs `git push` and `git lfs push` with `GIT_PROTOCOL_FROM_USER=0`, so origin's URL cannot run a transport helper (`<name>::`, `<name>://`, `ext::`) or a local folder's hooks; `http`, `https`, `ssh` and `git` still work, and the owner allows others with `protocol.<name>.allow` in `~/.gitconfig`. The refusal names the transport.
- `packages/core/src/job-machine.ts` (`gitOver`): the push and fetch of a job on another machine run with the same variable.
- `packages/github/test/github.test.ts`, core tests: each transport refused, an allowed helper runs and pushes nothing (asserted on behaviour, not git's message, so it holds on the CI runner's git).
- `docs/deploy.md`: what is refused, how to allow it, what stays open. `test/structure.test.ts`: core 6073, github 654 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1094/1094 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40153215562

## Left open

- Tickets from findings: AR0398 (F1), AR0399 (F2).
