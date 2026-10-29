# AR0547 - Outcome

- Merged: 2026-10-29, `0eca382f`
- Branch: arthur/2026-10-28-worker-1185a1c6
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.93, reviews $1.63; review rounds 2

## What went in

- The guard's shell parser reads a `~` right after an unquoted `:` in an assignment (or an argument shaped like one) as bash does, so `x=a:~acme/y; echo x > $x` is refused; review-1's hole (`~-:x`) is refused again, with test rows.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1193/1261 passed.

## Left open

- Deferred (client summary): F1. A `~-` after an assignment's `:` is not refused while OLDPWD is unknown
- Deferred (client summary): F2. A quoted name before `=` still counts as an assignment for `~`
- Deferred (client summary): F3. `$OLDPWD` followed by anything but `/` passes the guard
- Deferred (client summary): F4. A `~` right before a `:` is refused, where bash expands it
