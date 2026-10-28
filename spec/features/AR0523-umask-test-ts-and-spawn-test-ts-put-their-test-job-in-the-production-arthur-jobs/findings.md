# AR0523 - Findings

## F1. A three-part slice name is not in the test's accepted values

- What: review 1: changing `^\w+(-\w+)*$` in `packages/core/src/host.ts:44` to `^\w+(-\w+)?$` passes `host.test.ts`; it would refuse a valid name such as `a-b-c`.
- Status: dropped (refuses more, opens nothing; nobody names such a slice)

## F2. A bad slice name is reported as a config that did not load

- What: review 1: a bad `ARTHUR_JOB_SLICE` prints `arthur.config.ts did not load:` before the variable's own line, and names no next command.
- Status: dropped (only tests set the variable; the line after names the variable and the expected form)

## F3. Nothing fails if a test stops passing `ARTHUR_JOB_SLICE` in its own env

- What: review 1: only the systemd-run test in `spawn.test.ts` checks the slice a test hands the CLI; removing it from `umask.test.ts:34` goes unnoticed.
- Status: dropped (the kit sets the variable in the test process too, which a spawned CLI inherits)
