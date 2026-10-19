# AR0161 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. schedule.register still finds a plugin's package folder by its name

- Kind: risk
- Found by: 2026-10-19-ar0190-core-batch-2-27eddfc2 (worker), 2026-10-19
- Where: `packages/schedule/src/register.ts:21`
- What: `host.code` now holds the package folder around each plugin's own `module` (AR0161), but schedule's `register` picks the registering plugin's folder from that list by `basename(folder) === plugin`. A plugin from a package folder of another name (`node_modules/@acme/arthur-discord/` for plugin `discord`) is in `host.code` yet gets no folder there, so its registered entries' procedures are refused with `plugin discord has no package folder, so its entries take no procedure` [INFERENCE: read from the lines; no test registers from such a plugin]. The workspace's plugins, each in `packages/<name>/`, are not affected.
- Suggestion: the host hands each plugin its own package folder (for example `host.package`, the folder `host.code` took from its `module`), and `schedule.register` takes the registering plugin's folder from the plugin itself rather than from the list by name; out: anything else about procedures.
- Status: ticket AR0219
