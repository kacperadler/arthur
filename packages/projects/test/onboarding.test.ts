import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { everyOption } from "@arthur/core/option-table";
import { type FakeHost, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { table } from "../src/project-options.ts";
import { type ProjectEntry, projects } from "../src/projects.ts";

const PATH = process.env.PATH ?? "";
const PROCEDURE = readFileSync(new URL("../roles/coordinator/onboarding-ended.md", import.meta.url), "utf8").trim();
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" }).trim();

// The repository `shop` with a README, its vision and styleguide in one commit, the plugin set up on the fake host with it.
async function load(entry: Partial<ProjectEntry> = {}): Promise<{ readonly fake: FakeHost; readonly shop: string; readonly home: string }> {
	const shop = temporaryFolder();
	git(shop, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries({ "README.md": "# Shop\n", "spec/vision.md": "# Vision\n", ".agents/arthur/criteria/styleguide.md": "# Styleguide\n" })) {
		mkdirSync(dirname(join(shop, path)), { recursive: true });
		writeFileSync(join(shop, path), text);
	}
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", "first");
	const list = [{ name: "shop", prefix: "SH", path: shop, ...entry }];
	const fake = fakeHost({ name: "projects" });
	await fake.setup({ setup: (host) => projects({ list }).setup({ ...host, options: { list } }) });
	return { fake, shop, home: dirname(fake.host.folder) };
}

// An onboarding of `shop` whose one run ends with `message`, once its record says it ended.
async function onboard(t: TestContext, fake: FakeHost, home: string, message: string): Promise<string> {
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message }] }))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const { id } = await fake.host.jobs.spawn({ task: "Onboard shop.", kind: "onboarding" });
	const state = join(home, "jobs", id, "state");
	await until(`${id} to end`, () => existsSync(state) && readFileSync(state, "utf8") === "ended");
	return id;
}

const asked = (count: number, from = 1) => Array.from({ length: count }, (_, index) => `${from + index}. Question ${from + index}?\n   Proposed: yes.`);
const finished = (id: string) => ({ id, kind: "onboarding", project: "shop", state: "ended", reason: "finished" });
// The wake's lines as orchestration asks them: with the job-ended data and the job's final message.
const woken = (fake: FakeHost, job: Readonly<Record<"id" | "kind" | "project" | "state" | "reason", string>>, result = fake.host.jobs.result(job.id)) => fake.collect("coordinator.wake", job, result);

test("the kind onboarding has its own branch and role, and its prompt names the files it drafts, where prompts puts them", async (t) => {
	const { fake, home } = await load({ prompts: { vision: "docs/vision.md", criteriaDir: "docs/criteria/" } });
	assert.deepEqual(fake.kinds, [{ name: "onboarding", readOnly: false, role: "onboarding" }]);
	assert.deepEqual(fake.roles.map((role) => [role.name, role.criteria]), [["onboarding", ["styleguide"]]]);
	const section = "## The files this onboarding drafts\n\n- The vision: `docs/vision.md`\n- The criteria: `docs/criteria/styleguide.md`\n\nIts merge accepts only `docs/vision.md` and `docs/criteria/*.md`.";
	assert.deepEqual(fake.collect("prompt", "worker", { project: "shop" }), [undefined]);
	const id = await onboard(t, fake, home, "## Repository\nA shop.\n");
	const prompt = readFileSync(join(home, "jobs", id, "prompt"), "utf8");
	assert.match(prompt, /^# Onboarding\n/);
	assert.ok(prompt.endsWith(`${section}\n`), prompt);
	assert.match(readFileSync(join(home, "jobs", id, "branch"), "utf8"), /^arthur\/\d{4}-\d\d-\d\d-onboarding-[0-9a-f]{8}$/);
});

test("the prompts the option table names as the default are the files the roles read and the onboarding drafts with prompts left out", async (t) => {
	const values = everyOption(table).filter(({ path, entry }) => entry.default !== undefined && !["list.*.title", "list.*.install"].includes(path));
	assert.deepEqual(values.map(({ path }) => path), ["list.*.prompts"], "every other default is words for a person");
	const [vision, criteriaDir, rolesDir] = (values[0]?.entry.default ?? "").split(", ");
	const { fake, shop, home } = await load();
	mkdirSync(join(shop, ".agents/arthur/roles"), { recursive: true });
	writeFileSync(join(shop, ".agents/arthur/roles/onboarding.md"), "Ask about the shop's customers.\n");
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", "override");
	const id = await onboard(t, fake, home, "## Repository\nA shop.\n");
	const prompt = readFileSync(join(home, "jobs", id, "prompt"), "utf8");
	for (const part of [`## Project override, which wins over the role above (${rolesDir}/onboarding.md)`, `## Styleguide (${criteriaDir}/styleguide.md)`, `- The vision: \`${vision}\``, `- The criteria: \`${criteriaDir}/styleguide.md\``])
		assert.ok(prompt.includes(part), `${part}\n---\n${prompt}`);
});

test("an onboarding asking more than 10 questions is cut at 10, the same however often its wake is built, and later questions at 0", async (t) => {
	const { fake, home } = await load();
	const id = await onboard(t, fake, home, ["## Repository", "A shop.", "", "## Questions", ...asked(14), "", "## Notes", "13. Not a question."].join("\n"));
	const wake = `${PROCEDURE}\n\nIts questions to send the owner, the first 10 of its 14: an onboarding asks at most 10 in all, the rest are cut:\n${asked(10).join("\n")}`;
	assert.deepEqual(woken(fake, finished(id)), [wake]);
	assert.deepEqual(woken(fake, finished(id)), [wake], "a wake built twice counts its questions once");
	// Its next run's final message, after the owner's answers.
	writeFileSync(join(home, "jobs", id, "result"), ["## Questions", ...asked(2, 11)].join("\n"));
	assert.deepEqual(woken(fake, finished(id)), [`${PROCEDURE}\n\nIts 2 new questions are cut: it asked 10 already, and an onboarding asks at most 10. Send none.`]);
});

test("questions within 10 go whole; a later run gets what is left of the 10", async (t) => {
	const { fake, home } = await load();
	const id = await onboard(t, fake, home, ["## Questions", ...asked(7)].join("\n"));
	assert.deepEqual(woken(fake, finished(id)), [`${PROCEDURE}\n\nIts questions to send the owner:\n${asked(7).join("\n")}`]);
	writeFileSync(join(home, "jobs", id, "result"), ["## Questions", ...asked(5, 8)].join("\n"));
	const rest = `${PROCEDURE}\n\nIts questions to send the owner, the first 3 of its 5: an onboarding asks at most 10 in all, the rest are cut:\n${asked(3, 8).join("\n")}`;
	assert.deepEqual(woken(fake, finished(id)), [rest]);
});

test("a job in no home, an eval's, gets the questions of the final message it is given, and its wake writes nothing", async () => {
	const { fake } = await load();
	const id = "2026-10-22-onboarding-4e5f6a7b";
	const result = ["## Questions", ...asked(12)].join("\n");
	const wake = `${PROCEDURE}\n\nIts questions to send the owner, the first 10 of its 12: an onboarding asks at most 10 in all, the rest are cut:\n${asked(10).join("\n")}`;
	assert.deepEqual(woken(fake, finished(id), result), [wake]);
	assert.deepEqual(woken(fake, finished(id), result), [wake], "no earlier run counted, however often it is built");
	assert.equal(existsSync(join(fake.host.folder, "onboarding")), false, "nothing written in the home");
});

test("a run that ended without questions, or did not finish, brings the procedure alone; another kind brings nothing", async (t) => {
	const { fake, home } = await load();
	const id = await onboard(t, fake, home, "Drafted spec/vision.md.\nReview focus: the commands.");
	assert.deepEqual(woken(fake, finished(id)), [PROCEDURE]);
	writeFileSync(join(home, "jobs", id, "result"), ["## Questions", ...asked(2)].join("\n"));
	assert.deepEqual(woken(fake, { ...finished(id), reason: "limit: budget: its cost $1.0000 reached its budget of $1" }), [PROCEDURE]);
	assert.deepEqual(woken(fake, { ...finished(id), state: "blocked", reason: "user: which shop?" }), [PROCEDURE]);
	assert.deepEqual(woken(fake, { ...finished(id), kind: "worker" }), [undefined]);
	assert.match(PROCEDURE, /arthur continue <job id> '<the answers, by number>'/);
	assert.match(PROCEDURE, /arthur merge <job id> --unreviewed --decision <its id>`, then the committed files/);
});

// A branch `name` from `from` of `shop` with `change` committed on it; the checkout goes back to main.
function branch(shop: string, name: string, change: () => void, from = "main"): string {
	git(shop, "switch", "--quiet", "-c", name, from);
	change();
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", name);
	git(shop, "switch", "--quiet", "main");
	return name;
}

test("merge.check lets in a draft of the vision and criteria, refuses one touching another file or adding a symlink, and checks no other kind", async () => {
	const { fake, shop } = await load();
	const check = (name: string, kind = "onboarding", project = "shop") => fake.collect("merge.check", { id: "x", kind, project, branch: name });
	const write = (path: string, text: string) => {
		mkdirSync(dirname(join(shop, path)), { recursive: true });
		writeFileSync(join(shop, path), text);
	};
	const drafts = branch(shop, "arthur/drafts", () => {
		write("spec/vision.md", "# Vision\n\n## Purpose\n\nSell tools.\n");
		write(".agents/arthur/criteria/autopilot.md", "# Autopilot\n");
	});
	// Main moving on after the branch is not the branch's change.
	write("README.md", "# Shop, moved on\n");
	git(shop, "commit", "--quiet", "-am", "main moves on");
	assert.deepEqual(check(drafts), [undefined]);
	const other = branch(shop, "arthur/other", () => {
		write("spec/vision.md", "# Vision\n");
		write(".nvmrc", "22\n");
		write("package.json", "{}\n");
		write(".agents/arthur/criteria/deep/styleguide.md", "# Deep\n");
		write(".agents/arthur/criteria/check.sh", "npm test\n");
		git(shop, "rm", "--quiet", "README.md");
	});
	const accepts = "an onboarding's merge accepts only spec/vision.md and .agents/arthur/criteria/*.md";
	const changed = ".agents/arthur/criteria/check.sh, .agents/arthur/criteria/deep/styleguide.md, .nvmrc, README.md, package.json";
	assert.deepEqual(check(other), [`arthur/other changes ${changed}; ${accepts}`]);
	const link = branch(shop, "arthur/link", () => symlinkSync("../../../.env", join(shop, ".agents/arthur/criteria/env.md")));
	assert.deepEqual(check(link), ["arthur/link adds or changes the symlink .agents/arthur/criteria/env.md; an onboarding's merge accepts no symlink"]);
	assert.deepEqual(check(other, "worker"), [undefined]);
	assert.deepEqual(check(drafts, "onboarding", "blog"), ["project blog is not in the list"]);
	assert.match(String(check("arthur/gone")[0]), /^git diff HEAD\.\.\.arthur\/gone: fatal: /);
});
