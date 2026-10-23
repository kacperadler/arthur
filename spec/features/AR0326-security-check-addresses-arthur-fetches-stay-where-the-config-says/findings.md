# AR0326 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry below is a gap of `check.md` beside this file (its row is named), written as the check that is missing, never as steps of an attack. F1 confirms the note F18 of AR0311.

## F1. The models plugin's private network holds two cloud metadata addresses (AR0311 F18, confirmed)

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23
- Where: `packages/models/src/model-options.ts:27-30` (`PRIVATE`), `:32` (`isPrivate`); `packages/machines/src/machine-check.ts:35` (the same 100.64.0.0/10 for an `ssh` address); `packages/models/docs/models.md:21`
- Rule: a model provider is never a public host or a cloud metadata address (`check.md`, "Model providers", row 2).
- Input not covered: a provider `url` whose host is `fd00:ec2::254` (AWS's instance metadata over IPv6, inside the unique-local fc00::/7 the list takes for Tailscale's fd7a:115c:a1e0::/48) or `100.100.100.200` (Alibaba Cloud's metadata, inside the carrier-grade 100.64.0.0/10 the list takes for Tailscale), which `isPrivate` answers `true` to and `checkOptions` accepts (probe in `check.md`); every link-local address (`169.254.0.0/16`, the metadata address of AWS, GCP, Azure, Oracle and Hetzner) is already refused.
- What: the probe (`probe.ts:70`), with the provider's key as a `Bearer` header, and then the job's agent (`models.ts:73`) talk to the metadata service of the cloud the job's machine runs in; the answer is never shown (`its model list answered something that is not a model list`), so what the owner's config can reach this way is the request itself. The input is the owner's config file, which keeps the severity low; a job that can rewrite `arthur.config.ts` is AR0320 F1.
- Suggestion: in `model-options.ts`, a second `BlockList` of the metadata addresses inside the private ranges, `100.100.100.200/32` and `fd00:ec2::254/128`, checked first by `isPrivate` (`false` when it matches), and the same two in `machine-check.ts:34-37` (or one list exported by the core, since both plugins may import only `@arthur/core`); `docs/models.md:21` names the two exceptions. Tests: `packages/models/test/models.test.ts:104`, the refused list gets `http://100.100.100.200/` and `http://[fd00:ec2::254]/`, and `:118` a name resolving to `100.100.100.200` refuses the load; `packages/machines/test/machines.test.ts:303`, a `hostname` of `100.100.100.200` refused. Out: a deny-list of every cloud's addresses outside the private ranges (already refused as public).
- Status: open

## F2. A site check follows a redirect to any address, loopback and metadata included

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23
- Where: `packages/uptime/src/site-check.ts:12` (`fetch` with its default `redirect: "follow"`), `:16-26` (the landing page judged); `packages/uptime/docs/uptime.md:24`; `packages/uptime/src/uptime-options.ts:25`
- Rule: a site check cannot be pointed at loopback or metadata services unless the config says so (`check.md`, "Site checks", row 3).
- Input not covered: a `Location` header of the site itself (whoever runs the site, or a page of it they do not control), `http://127.0.0.1:<port>/…`, `http://169.254.169.254/…` or a private or Tailscale address, which `fetch` follows for up to 20 hops from Arthur's host and judges as the site; the config named only the first URL (probe in `check.md`: a 302 to another port on loopback gave `{ ok: true }` and the second server saw the GET).
- What: a GET from Arthur's host, with `user-agent: arthur-uptime` and no credential, to an address the config never named, once per `everySeconds`; and one bit of its answer (the status, or whether the page holds `expect`) in the down and up notices to the owner. The site's operator sees none of the notices, which keeps the severity low.
- Suggestion: in `site-check.ts`, `redirect: "manual"` and a loop of at most 20 hops that follows a `Location` only when its host is the config URL's host, or resolves (`dns.lookup`, all addresses) to nothing that is loopback, link-local (`169.254.0.0/16`, `fe80::/10`) or private (the ranges of `model-options.ts:27-30`); a refused hop is `redirected to <host>, a private address the config does not name` with `answered: true`, so the site counts as down with that reason. Say it in `docs/uptime.md:24` and `uptime-options.ts:25`. Test in `packages/uptime/test/uptime.test.ts:108`: a site at `http://localhost:<a>/` redirected to `http://127.0.0.1:<b>/` is down with that reason and `<b>` sees no request; one redirected to another path of its own host is followed as now. Out: a check of the first URL (the config's own choice).
- Status: open

## F3. The probe's curl reads the user's `.curlrc` and the proxy variables, so the request with the key goes where they say

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23
- Where: `packages/models/src/probe.ts:62-70` (`curl --config -`, no `-q`, no `noproxy`); `packages/core/src/job-machine.ts:91` (`spawn` with the inherited environment); `packages/models/docs/models.md:29`
- Rule: a model provider is never a public host: the probe's request goes to the checked address and nowhere else (`check.md`, "Model providers", row 7).
- Input not covered: a `.curlrc` in the home of Arthur's user on the job's machine (`CURL_HOME`, `XDG_CONFIG_HOME/.curlrc`, `~/.curlrc`), or `http_proxy`, `HTTPS_PROXY`, `ALL_PROXY` in the environment of `arthur run` or of the SSH login on another machine. Probe in `check.md`: with `proxy = "http://127.0.0.1:<p>"` in `.curlrc`, or `http_proxy` set, the exact config lines of `probe.ts` sent the request with `Authorization: Bearer key-1` to the proxy; with `location` in `.curlrc`, a 302 was followed and the other server's model list taken as the provider's.
- What: the provider's key and the request leave the private network for whatever address the file or the variable names; the resolution at `probe.ts:55-60` and the `resolve` pin at `:66` do not see it. The file and the variables are the owner's, or a job's (every job runs as Arthur's user and can write `~/.curlrc`: AR0320 F1), which keeps this low on its own.
- Suggestion: start curl as `["curl", "-q", "--config", "-"]` (`-q` as the first argument disables every curlrc) and add `noproxy = "*"` to the config lines (curl then ignores the proxy variables); say both in `docs/models.md:29`. Test in `packages/models/test/models.test.ts`, beside `:152`: the test process sets `CURL_HOME` to a temporary folder holding a `.curlrc` of `proxy = "http://127.0.0.1:1"` and `http_proxy` the same (the child inherits `process.env`), and a pick on a local Ollama fake still answers its list; without `-q` and `noproxy` the probe answers `unreachable: curl: (7) …`. Out: the agent's own request (F4), and omp's handling of the same variables.
- Status: open

## F4. The agent's own request to a provider is never checked against the private network

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0326-security-check-b12a34be (worker), 2026-10-23
- Where: `packages/models/src/models.ts:67-74` (the `prepare`: `OLLAMA_BASE_URL`/`LM_STUDIO_BASE_URL` as the url was written), `packages/models/docs/models.md:21,29`
- Rule: a model provider is never a public host (`check.md`, "Model providers", row 8).
- Input not covered: the address a provider's name (`localhost`, `*.ts.net`) resolves to at the moment the agent connects: the load (`models.ts:31-39`) and the probe (`probe.ts:55-60`, pinned with `resolve`) check it, the agent resolves it again on its own, after the probe and for every request of the job, with no pin; a name whose answer changes between the probe and a request (Tailscale's MagicDNS down on the machine, a `*.ts.net` name then answered by public DNS with Tailscale's relay addresses, which the load refuses when it sees them) sends the key and the prompt there.
- What: a window of seconds on a name the owner chose, under Tailscale's DNS; the only way to it is the resolver of the job's machine, which keeps this low. It is said nowhere: `docs/models.md:21` says a name "is resolved at load ... and again at each probe", which reads as the whole story.
- Suggestion: say in `docs/models.md:21` that the agent's own requests resolve the name again, unchecked, so a provider by address is the stricter choice; and in the `prepare` at `models.ts:67`, resolve the name once more right before the job starts and refuse the spawn (`provider <name>: <host> resolves to <address>, not a private address`, as a prepare's refusal) when any address is not private, which closes the gap between the pick and the start. Test in `packages/models/test/models.test.ts:118`'s shape: the `dns.lookup` answer turned public after the pick and before the spawn's prepare refuses the spawn with that message. Out: a pin for the agent (omp's HTTP client is not Arthur's).
- Status: open
