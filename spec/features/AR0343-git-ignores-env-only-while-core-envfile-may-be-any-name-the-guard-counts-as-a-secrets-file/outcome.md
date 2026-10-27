# AR0343 - Outcome

- Merged: 2026-10-27, `56876e1e`
- Branch: arthur/2026-10-27-worker-2a49ca52
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $2.16, reviews n/a; review rounds 3

## What went in

- `packages/core/src/requirements.ts`: a critical doctor line, `core env ignored`: when the env file's own folder lies in a Git checkout that does not ignore it (or tracks it), the line is `missing` and `arthur run` refuses to start (AR-D116); outside every checkout it is `ok`.
- `.gitignore`: ignores dotted env file names too.
- `packages/core/test/doctor.test.ts`, `setup.test.ts`: the line for a file not ignored, ignored, ignored by name only, tracked, in a subfolder, outside any checkout, and decided by the env file's folder, not the folder Arthur runs in.
- Docs: `doctor.md`, `config.md`. `test/structure.test.ts`: core's line budget 6345 (AR-D115).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1123/1190 passed.

## Left open

- Findings: none. The reviews' notes were about comment order in the budget file only.
