# The uptime plugin

Roadmap entry 98: Arthur checks each project's sites over plain HTTP while `arthur run` runs, and tells the owner when one is down and when it is back, before a client calls. A check is a `GET` in the plugin itself: no model is called, so it costs no usage. It has no command; what it says goes out as notices, through every channel (telegram), and as events on the event stream.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "acme", prefix: "AC", path: "../acme" }] }),
	uptime({
		sites: {
			acme: [
				{ url: "https://acme.example/" }, // a 2xx status, checked every 60 s
				{ url: "https://acme.example/health", expect: "ok", everySeconds: 30 }, // a 2xx status and the page holds "ok"
				{ url: "https://admin.acme.example/", expect: 401 }, // exactly this status
			],
		},
	}),
],
```

## Options

- `sites`: each project's sites, by the project's name, each a list of `{ url, expect?, everySeconds? }`. A key that is not a project of the projects list refuses the load: `plugin uptime: setup failed: sites names <keys>, not a project of the projects list; each key of sites is a project's name`.
- `url`: required, an `http://` or `https://` address. A redirect is followed (at most 20), and the page it leads to is judged.
- `expect`: a status code from 100 to 599, which the answer must have exactly; or non-empty text, which a page with a 2xx status must hold. Left out: any 2xx status.
- `everySeconds`: a whole number of seconds, 1 or more, between two checks of the site; default 60. A check is cut after 10 s, or after `everySeconds` when that is shorter, so two checks of one site never overlap.

Refused at load, with the option's path: an unknown option or key, `sites` not an object, a project's sites not a list, a site without a `url`, a `url` that is not http or https, an `expect` or `everySeconds` out of range, and the same `url` twice in one project. A `url` on a port of the Fetch standard's bad-port list (9, 25, 6000, 6665 to 6669, 10080 and others), which fetch never reaches, is refused too: `project <project>: <url> is on port <port>, which fetch never reaches: the Fetch standard blocks it; use another port`.

## Down and up

Each site is checked at the start of `arthur run`, then every `everySeconds`. A check fails on:

- no answer within the time above: `no answer within <n> s`;
- the connection refused: `connection refused`; a host name not found: `its host name is not found`;
- a TLS error: `TLS error (<code>)`, such as an expired or self-signed certificate;
- a wrong status: `answered <status>, expected <expect>` (`a 2xx status` when `expect` is left out or is text);
- the text missing: `answered <status> without the text "<expect>"`;
- any other network error: its message and code.

A site is down after 2 failed checks in a row; a failed check followed by one that passes is nothing. Once down, one notice:

`uptime: <url> (project <project>) is down since <HH:MM> on <day> <date> (<time zone>): <reason>`

with the time of its first failed check in the row, and the event `uptime-down`, `{ project, url, reason, since }` (`since` an ISO time). Once a check passes again, one notice:

`uptime: <url> (project <project>) answers again, after <how long> down since <HH:MM> on <day> <date> (<time zone>)`

and `uptime-up`, `{ project, url, since, downSeconds }`. Nothing repeats while the state holds: a down site that keeps failing, for another reason too, says nothing more. The notices go out as every notice does: without a sound in the core's `quietHours`, and held while the coordinator's silent mode holds notices.

## This machine offline

With 2 or more sites not down, a site that is about to go down for want of an answer (no answer in time, refused, not found, a TLS error; an HTTP answer of any status proves the network works) makes the plugin ask every other site at once, also one not due yet. When none of them answers either, the sites are taken as fine and this machine as offline: one notice, no site's own,

`uptime: none of the <n> sites answers (<url>: <reason>), so this machine looks offline and the checks cannot run; one notice follows when a site answers again`

and while it lasts nothing more. Once any site answers, one notice, `uptime: a site answers again, so the checks run again, after <how long> without an answer from any site`, and the checks go on as before; a site still failing then needs 2 failed checks in a row again. With one site, or one left that is not down, a site with no answer is down, as nothing tells the two apart.

## Across a restart

`.arthur/uptime/state.json` holds each site that is down (since when, and the reason told) and since when no site answers, written to a temporary name and renamed at each change. At the next `arthur run` a site down before stays down without a second notice, and its up notice counts from its first failed check before the restart; so does the offline notice. A file that is not what the plugin writes (broken, edited by hand) is taken as no site down, and a site no longer listed is dropped from it at the next change.
