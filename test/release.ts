import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// The one step of .github/workflows/release.yml (spec/roadmap.md, entry 105), run in a checkout of main's pushed tip: when the
// tag v<version> of the root package.json's version does not exist on origin yet, `npm ci`, `npm run check` and `npm test`, then
// `gh release create` at this commit, with that version's section of CHANGELOG.md, which the release ticket's merge wrote, as
// the notes. gh takes the workflow's own token from GH_TOKEN. Exits 0 when there is nothing to release, 1 when a step failed.

function say(line: string, code: number): never {
	(code === 0 ? console.log : console.error)(line);
	process.exit(code);
}
const version: unknown = JSON.parse(readFileSync("package.json", "utf8")).version;
if (typeof version !== "string") say("package.json has no version: no release", 0);
const tag = `v${version}`;
const remote = spawnSync("git", ["ls-remote", "--exit-code", "origin", `refs/tags/${tag}`], { encoding: "utf8" });
if (remote.status === 0) say(`${tag} exists on origin: no release`, 0);
// --exit-code makes 2 "no such ref"; anything else is a fetch that failed.
if (remote.status !== 2) say(`git ls-remote origin failed: ${remote.stderr.trim()}; no release of ${tag}`, 1);
// The section is from its `## <version> (<date>)` line to the next `## ` heading, the heading left out.
const section = (existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : "").split(/^(?=## )/m).find((part) => part.startsWith(`## ${version} (`));
if (section === undefined) say(`CHANGELOG.md has no section ${version}: no release of ${tag}; a release ticket's merge writes it`, 0);
for (const step of [["ci"], ["run", "check"], ["test"]]) {
	if (spawnSync("npm", step, { stdio: "inherit" }).status !== 0) say(`npm ${step.join(" ")} failed: no release of ${tag}`, 1);
}
const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const notes = `${section.slice(section.indexOf("\n")).trim()}\n`;
const made = spawnSync("gh", ["release", "create", tag, "--target", sha, "--notes-file", "-"], { input: notes, stdio: ["pipe", "inherit", "inherit"] });
say(made.status === 0 ? `released ${tag} at ${sha.slice(0, 7)}` : `gh release create ${tag} failed`, made.status === 0 ? 0 : 1);
