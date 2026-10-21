# arthur retro

Usage: `arthur retro [--project <name>]`, and `/retro` on a channel. Comes with the `manage` plugin (roadmap entry 63). Answered without the model.

The newest retro's phone page: `spec/retro/<date>.html`, which `arthur ticket file` writes beside each retro's report (docs/manage.md, "The retro"), the newest by its name's date and number (`2026-10-16-2.html` after `2026-10-16.html`).

- `arthur retro` prints its path from the project's folder, of the main project unless `--project` names another.
- `/retro` sends the main project's page as a file through the channel the command came from, to the place it came from (a topic), with the channel's `channel.send` (`arthur send --help`), and answers one line, `<page>: <channel>: <what the channel said>`. A channel that refuses the file answers `<page> not sent by <channel>: <its refusal>`; a channel with no `channel.send`, `<page> not sent: <channel> provides no channel.send`; a send that fails on its way, `/retro failed: <reason>`, as any phone command that fails.

With no page yet, both answer so instead of failing: `no retro page yet: spec/retro/ in <project folder> holds none; a retro's filing writes one beside its report`, and `arthur retro` exits 0.

More than nothing after the command prints `usage: arthur retro [--project <name>]` and exits 2, and more than nothing after `/retro` answers `usage: /retro`; an unknown project exits 1 with the board's refusal.
