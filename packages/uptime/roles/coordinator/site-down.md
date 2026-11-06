# A project's site is down

The uptime plugin sent this runbook with `[Arthur: uptime]`: a site of project `<p>` failed 2 checks in a row while `arthur run` ran. Work through the steps in order, in this turn. The reads (steps 1 to 4) go without asking; a redeploy goes only on the owner's word. A step's command that fails is a result too: write it down for the report and go on as the step says.

1. **Confirm from this machine.** `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 15 '<url>'`.
   - It answers as the site should (a 2xx status, or the status the project's piece expects): it came back by itself. Go to the report; the up message follows.
   - No answer, an error or a wrong status: go on.
2. **This machine online.** `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 15 https://1.1.1.1/`.
   - Any status: online; go on.
   - No answer: nothing else can run from here. Tell the owner in one line that the site looks down and this machine is offline, and stop.
3. **The Dokploy server reachable.** `arthur dokploy app --project <p>`.
   - The app's name and status: reachable; go on.
   - `arthur: unknown command dokploy`, or `project <p> has no dokploy.project(...)`: the site is not on Dokploy, or Arthur does not know where it runs. Go to the report.
   - `no answer in <n> s from <url>` or `cannot reach <url>`: the server or its panel is down too, and a redeploy cannot run. Go to the report.
   - `401` or `403`: the token needs the owner. Go to the report.
4. **The application's status and its last deployments.** `arthur dokploy status --project <p>`.
   - A deployment still `running`: it may be what took the site down, or bring it back; wait for the up message. No redeploy.
   - The last deployment `error`; the app `idle` or `error`; or the app `done` while the site gives no answer, `502` or `503`: these point to a redeploy (step 5).
   - A reason a redeploy does not fix: `its host name is not found` (DNS), `TLS error (...)` (a certificate), `redirected to <host>, a private address ...`, or a wrong status from an app that is `done` with a deployment that succeeded (the app's own error): no redeploy. Go to the report.
5. **The action: a redeploy, only when step 4 points to one.** The container's state is not read: `arthur dokploy` has no verb for it.
   - First ask, in the project's own log: `arthur decision ask --kind question --project <p> --question "Redeploy project <p>'s Dokploy app <app>? <url> is down since <time>: <reason>; <what steps 3 and 4 showed>" --option 'Redeploy now' --option 'Leave it to me' --recommend 1`.
   - It prints `answered by policy (<class id>)` (a class the owner approved for this project): that is his answer. Run `arthur dokploy deploy --project <p>`, then `arthur dokploy status --project <p>` once, and say in the report that a class answered it.
   - Any other output (only the id, `answered by recommendation (<grant id>)` among others): not his word for a redeploy. Ask the owner with that id, as every question (in silent mode, `arthur silent ask`), and wait. Only on his own `Redeploy now`, recorded (`arthur decision answer`), run the deploy and `status` as above.
   - Never deploy without that answer; never upload, never ssh, never change the server's settings.
6. **The report.** One message to the owner: the site, since when and the reason; one line per step with what it showed; what was done or asked, with the decision's id. In quiet hours, one line.
7. **When `[Arthur: uptime]` says the site answers again.** Tell the owner how it ended: how long it was down, and what brought it back (the redeploy, or by itself). If the redeploy question is still open, close it: `arthur decision close <id> 'the site answers again'`.
