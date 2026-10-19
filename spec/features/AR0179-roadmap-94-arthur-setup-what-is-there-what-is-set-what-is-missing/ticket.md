# AR0179 - Roadmap 94: arthur setup, what is there, what is set, what is missing

```json
{
  "id": "AR0179",
  "title": "Roadmap 94: arthur setup, what is there, what is set, what is missing",
  "date": "2026-10-19"
}
```

## Description

Builds roadmap entry 94, `arthur setup`: a report the owner runs on a new machine, and again after each fix. It shows:
- the tools and their versions;
- what the config sets;
- what `arthur doctor` finds missing;
- the plugins that could still be turned on;
- the next steps, in order.

## Goal

Roadmap entry 94 in `spec/roadmap.md` is the specification: its Delivers, its example run, its Done means with every edge case, and its Covers (S8). It depends on entries 93 (option tables, AR0170) and 80 (`arthur doctor`, AR0166), both merged. With it, Arthur can be installed without the harness's help (vision, direction A).

- Kind: improvement
- Budget: 12

## Done means

- Everything entry 94's Delivers and Done means list, each edge case with its own test:
  - no config;
  - a config that does not load;
  - a tool whose version command fails or hangs, cut after 5 s;
  - an installed plugin that is not in the config;
  - every other case the entry names.
- A test sets a known value for one variable in the shell and another in the env file, and finds neither value in the output.
- The exit code is 1 when a step in Next would refuse `arthur run`, else 0.
- Tests are deterministic on a 2-core CI runner: they wait for the very state they assert, never for a fixed sleep.
- README's table and `arthur.mmd` show 94 as built.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core`: the command, its doc page and its tests.
- `docs/setup.md`, `README.md`, `arthur.mmd`.
- `test/structure.test.ts`: any budget raise, with the lines cut first named in the commit.

Out:
- Plugins that are not built yet: each shows its table once it exists.

## Decisions

- 2026-10-19: The owner raised the Arthur usage ceiling to 80% of Claude 7 Day ("mozesz zmienic limit na 80%"). The coordinator starts the next roadmap entry under it.
