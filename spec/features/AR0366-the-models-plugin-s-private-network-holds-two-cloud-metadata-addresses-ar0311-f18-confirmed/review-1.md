# AR0366 - Review 1

- Job: 2026-10-25-review-dafb690c
- Branch: arthur/2026-10-25-worker-7ffd56dc
- Commit reviewed: 7b94a26120be7321b2cb1993c55276f3f5facf6d
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0366 asks. Checks pass, I could reproduce what the worker claims, and every key mutation I tried makes a test fail.

**Findings**

None.

**Notes (not blocking)**

- **IPv6 address left out of machines** (`packages/machines/src/machine-check.ts:37`): only `100.100.100.200` is listed, though the ticket's Done means says "the same two". The worker's reason holds. In this plugin, private IPv6 means only `::1` and `fd7a:115c:a1e0::/48`, so `fd00:ec2::254` is already refused as public. The ticket's own Scope says "metadata addresses inside the private ranges", and its Out clause excludes listing addresses outside them. Adding the address would be a line that never matches. The final message gives the reason, as the criteria require.
- **Inexact load error** (`packages/models/src/models.ts:35`, unchanged): a name that resolves to `100.100.100.200` is refused with "…, a public address". It does refuse, but the wording is off. The worker reported this.
- **Probe path not tested for the metadata address**: `probe.ts:59` checks addresses with the same `isPrivate`, but no test covers this case there. The worker said so, and the ticket asks for no such test.
- **Statements joined to hold the budget**: to keep machines at 488 lines and models at 509, some statements now share a line, e.g. `machine-check.ts:36` `PRIVATE.addAddress(...); PRIVATE.addSubnet(...)`. This is a style matter only.
- **Broader IPv6 block not caught**: widening the models IPv6 entry upward, for example to `fd00:ec2::254/126`, would fail no test. The accepted neighbour `fd00:ec2::253` sits below the address. This is minor and not a key behavior.

**Checks run**

- `npm ci`: OK. `npm run check`: `tsc` clean.
- `npm test`: 1106 tests, 1048 pass, 0 fail, 58 skipped.
- Bypass attempts on the models url check. All were refused:
  - decimal `1684301000`
  - octal `0144.0144.0144.0310`
  - hex `0x64.0x64.0x64.0xc8`
  - short form `100.100.25800`
  - trailing dot `100.100.100.200.`
  - `[::ffff:6464:64c8]`, `[::100.100.100.200]`, `[64:ff9b::6464:64c8]`
  - `[fd00:ec2:0:0:0:0:0:254]`, `[FD00:EC2::254]`

  `isPrivate` returns false for `::ffff:100.100.100.200` and `FD00:EC2::0254`, and true for `100.100.100.199`.
- Mutations, each restored with `git checkout --`; `git status` was clean at the end:

| Mutation | File | Tests that fail |
|---|---|---|
| Remove `!METADATA.check(...) &&` | models | 2 (url list, name refusal) |
| Drop `fd00:ec2::254` | models | 1 (url list) |
| Drop `100.100.100.200` | models | 2 |
| Remove `METADATA.check(...) \|\|` | machines | 1 (verdict test) |
| Remove the `METADATA.addAddress` line | machines | 1 |
| Widen the entry to `100.100.100.200/31` | machines | 1 (`100.100.100.201` must stay accepted) |

PASS