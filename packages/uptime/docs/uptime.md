# The uptime plugin

Roadmap entry 98: Arthur checks each project's sites over plain HTTP while `arthur run` runs, and tells the owner when one is down and when it is back, before a client calls. A check is a `GET` in the plugin itself: no model is called, so it costs no usage. It has no command; what it says goes out as notices, through every channel (telegram), and as events on the event stream. Each down and each up also wakes the coordinator with a runbook, the checks and steps it works through in order (AR0607, "The coordinator's runbook").

```ts
// arthur.config.ts
plugins: [orchestration({}), projects({ folders: ["projects/acme"] }), uptime()], // or uptime({ probes: ["https://1.1.1.1/"] })

// projects/acme/project.config.ts
export default [
	projects.project({ prefix: "AC", path: "../../../acme" }),
	uptime.project([
		{ url: "https://acme.example/" }, // a 2xx status, checked every 60 s
		{ url: "https://acme.example/health", expect: "ok", everySeconds: 30 }, // a 2xx status and the page holds "ok"
		{ url: "https://admin.acme.example/", expect: 401 }, // exactly this status
	], { runbook: "site-down.md" }), // optional: the project's own runbook, beside this file
];
```

## Options

- `probes`: a list of `https://` URLs outside the projects, asked with the other sites before a site with no answer is down, so that even with one site this machine offline is told apart from the site down ("This machine offline"). Default `["https://1.1.1.1/", "https://dns.google/"]`, two independent ones; `[]` turns the probes off. Each must be a public host: a URL that is not `https://`, `localhost` (or a name under it), or an address that is unspecified, loopback, link-local or private (the ranges below, IPv4-mapped IPv6 included) is refused at load as `probes[<i>]: expected an https URL of a public host, not a loopback, link-local or private address, got "<url>"`; a value that is no list as `probes: expected a list of https URLs, [] for none, got <value>`. A probe is one `GET`, cut after 10 s, its redirect not followed: any HTTP answer, of any status, proves the network works.

Any other option but `enabled`, the old `sites` among them, is refused as unknown.

## Its piece

A project's sites are its piece, `uptime.project([...], { runbook? })` in its project file (`arthur projects --help`, "A project's file"): a list of at least one `{ url, expect?, everySeconds? }`, and, optionally, `runbook`, the path of the project's own runbook from its project folder (the folder of `project.config.ts`), such as `site-down.md` or `ops/site-down.md`. The helper builds `{ sites, runbook? }`; a piece written by hand in another shape, the bare list of sites among them, is refused.
- `url`: required, an `http://` or `https://` address. A redirect is followed (at most 20; the answer to a 21st is judged as it is), and the page it leads to is judged. A redirect to another host (a host and port other than the `url`'s) is followed only when none of its addresses (`dns.lookup`, all of them) is unspecified (`0.0.0.0/8`, `::`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16` with the cloud metadata address, `fe80::/10`) or private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, Tailscale's `100.64.0.0/10`, `fc00::/7`), IPv4-mapped IPv6 included. That hop goes through `node:http`/`node:https`, whose connection resolves the name once more and is refused the same way, so a name whose DNS answers a public address first and a private one next never reaches the private one. A redirect to a port of the Fetch standard's bad-port list (below) fails the check with `bad port`, before any connection. The `url`'s own host is followed to whatever its address.
- `expect`: a status code from 100 to 599, which the answer must have exactly; or non-empty text, which a page with a 2xx status must hold. Left out: any 2xx status.
- `everySeconds`: a whole number of seconds, 1 or more, between two checks of the site; default 60. A check is cut after 10 s, or after `everySeconds` when that is shorter, so two checks of one site never overlap.

Refused at load, before the plugin's setup, as `plugin uptime: setup failed: project <project>: uptime.project(...): <problems>`, each problem with the site's place (`[1].url: ...`) and all of them on one line, `; ` between: sites that are no list or an empty one, a site that is not an object, an unknown key, a site without a `url`, a `url` that is not http or https, an `expect` or `everySeconds` out of range, and the same `url` twice in one project. A `url` on a port of the Fetch standard's bad-port list (9, 25, 6000, 6665 to 6669, 10080 and others), which fetch never reaches, is refused too: `[<i>].url: <url> is on port <port>, which fetch never reaches: the Fetch standard blocks it; use another port`.

Also refused at load, on the same line: a piece that is not `{ sites, runbook? }` (`expected { sites, runbook? }, as uptime.project([...sites], { runbook? }) builds it, got <value>`), another key beside them (`<key>: unknown key; keys: sites, runbook`), and a `runbook` that is not a non-empty path inside the project's folder, absolute or climbing out with `..` (`runbook: expected a path inside the project's folder, such as "site-down.md", got <value>`). Whether the file exists is not checked at load: see below.

## Down and up

Each site is checked at the start of `arthur run`, then every `everySeconds`. A check fails on:

- no answer within the time above: `no answer within <n> s`;
- the connection refused: `connection refused`; a host name not found: `its host name is not found`;
- a TLS error: `TLS error (<code>)`, such as an expired or self-signed certificate;
- a wrong status: `answered <status>, expected <expect>` (`a 2xx status` when `expect` is left out or is text);
- a redirect to another host with a loopback, link-local or private address: `redirected to <host>, a private address the config does not name`; the site answered, so this is never taken as this machine offline;
- the text missing: `answered <status> without the text "<expect>"`;
- any other network error: its message and code.

A site is down after 2 failed checks in a row; a failed check followed by one that passes is nothing. Once down, one notice:

`uptime: <url> (project <project>) is down since <HH:MM> on <day> <date> (<time zone>): <reason>`

with the time of its first failed check in the row, and the event `uptime-down`, `{ project, url, reason, since }` (`since` an ISO time). Once a check passes again, one notice:

`uptime: <url> (project <project>) answers again, after <how long> down since <HH:MM> on <day> <date> (<time zone>)`

and `uptime-up`, `{ project, url, since, downSeconds }`. Nothing repeats while the state holds: a down site that keeps failing, for another reason too, says nothing more. The notices go out as every notice does: without a sound in the core's `quietHours`, and held while the coordinator's silent mode holds notices.

## The coordinator's runbook

With each down notice the plugin sends the coordinator one message (the event `coordinator-message`, which the orchestration plugin queues for its turn and marks `[Arthur: uptime]`):

`Site <url> of project <project> is down since <HH:MM> on <day> <date> (<time zone>): <reason>. Work through <runbook>, step by step, and report to the owner.`

and with each up notice one more:

`Site <url> of project <project> answers again, after <how long> down since <HH:MM> on <day> <date> (<time zone>). Finish <runbook> with its last step: tell the owner how it ended.`

Each is sent once per change, as the notices are: not for a down site that keeps failing, not after a restart while it stays down, and never while this machine looks offline. `<runbook>` is, looked at when the message is written:

- `the project's runbook <its absolute path>`, when the piece names one and it is a regular file inside the project's folder, reached through no symlink;
- `the runbook <boilerplate> (the project's own, <its absolute path>, is missing, not a regular file, or reached through a symlink)`, when the piece names one and it is not, so the owner's runbook is the only one a project can give, never a file a link leads to;
- `the runbook <boilerplate>`, when the piece names none.

The boilerplate ships with the plugin, [`../roles/coordinator/site-down.md`](../roles/coordinator/site-down.md): confirm from this machine with `curl`, this machine online, the Dokploy server reachable (`arthur dokploy app --project <p>`), the application's status and last deployments (`arthur dokploy status --project <p>`), then a redeploy only when those point to one, the report to the owner, and how it ended once the site answers again. `arthur dokploy` reads no container, so the runbook judges by the app's status and its last deployment. To start a project's own, copy the boilerplate beside its `project.config.ts`, change the steps, and name it: `uptime.project([...], { runbook: "site-down.md" })`.

The reads go without asking. A redeploy goes only on the owner's word: the runbook asks it first as `arthur decision ask --kind question --project <p> --question "Redeploy project <p>'s Dokploy app <app>? ..."` (`arthur decision --help`), and runs `arthur dokploy deploy --project <p>` only when that prints `answered by policy (<class id>)`, or after his own answer; any other output, `answered by recommendation (<grant id>)` of a silent-mode grant among others, means it asks him and waits. To pre-approve redeploys of one project, approve a class of them, as any class: `arthur decision class propose --kind question --match 'redeploy <p>' --decided '<his decision>' --backed-by <id>` in that project's log (`--project <p>`). A class needs at least one earlier answer of his to back it, so a project's first redeploy always waits for him.

## This machine offline

A site that is about to go down for want of an answer (no answer in time, refused, not found, a TLS error; an HTTP answer of any status proves the network works) makes the plugin ask, at once, every other site, also one not due yet, and each probe (`probes` above). When none of them answers either, the sites are taken as fine and this machine as offline. The owner gets nothing for it: no notice, no site's own, no `uptime-down`; one line on `arthur run`'s output,

`uptime: none of the <n> sites answers, nor <probe> nor <probe>, so this machine looks offline: no site is checked, only the probes, until one answers`

While it lasts no project site is requested: at each site's `everySeconds` only the probes are asked, each cut after 10 s. Once a probe answers, one more line, `uptime: a probe answers again, so the site checks run again, after <how long> offline`, and the site checks go on as before, with no notice: a site still failing then needs 2 failed checks in a row again, and is down after them while a probe answers; its down notice is the only one the owner gets. So with one site and the default probes, a lost connection sends nothing, never a site down; a site that fails while a probe answers is down after its 2 failed checks.

With `probes: []` nothing tells this machine offline apart from its sites down: each site is judged alone, and a site with no answer is down after its 2 failed checks, however many sites there are.

## Across a restart

`.arthur/uptime/state.json` holds each site that is down (since when, and the reason told) and since when this machine looks offline, written to a temporary name and renamed at each change. At the next `arthur run` a site down before stays down without a second notice, and its up notice counts from its first failed check before the restart; a machine offline before stays offline, sends nothing, and asks only the probes until one answers, its line counting from before the restart. With `probes: []` a stored offline is ignored: each site is checked and judged alone, and the offline is dropped from the file at the next change. A file that is not what the plugin writes (broken, edited by hand) is taken as no site down, and a site no longer listed is dropped from it at the next change.
