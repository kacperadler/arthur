import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { delivery } from "@arthur/delivery";
import { projects } from "@arthur/projects";

// Roadmap entry 54 with the plugin whose `merge.check` it asks: `arthur merge` of an onboarding's branch, which the projects
// plugin lets in only when it changes the vision and the criteria files. A plugin's own tests never load another plugin; this
// one, outside every package, loads both.

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" }).trim();

async function load(t: TestContext) {
	const shop = temporaryFolder();
	git(shop, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries({ "README.md": "# Shop\n", "spec/vision.md": "# Vision\n", ".agents/arthur/criteria/styleguide.md": "# Styleguide\n" })) {
		mkdirSync(dirname(join(shop, path)), { recursive: true });
		writeFileSync(join(shop, path), text);
	}
	git(shop, "add", "--all");
	git(shop, "commit", "--quiet", "-m", "first");
	git(shop, "config", "user.name", "t");
	git(shop, "config", "user.email", "t@example.com");
	const list = [{ name: "shop", prefix: "SH", path: shop }];
	const fake = fakeHost({ name: "projects" });
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[projects({ list }), { list }], [delivery(), {}]];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	// orchestration's check of the owner's decision is its own tests' (AR0355): here every id is the owner's.
	fake.provide("decision.owner", () => "");
	const saved = process.env.PATH;
	t.after(() => {
		process.env.PATH = saved;
	});
	// An onboarding whose branch commits `files`, once its record says it ended.
	const onboard = async (files: Readonly<Record<string, string>>) => {
		process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "## Drafts\nDone." }] }))}${delimiter}${saved}`;
		const job = await fake.host.jobs.spawn({ task: "Onboard shop.", kind: "onboarding" });
		const state = join(dirname(fake.host.folder), "jobs", job.id, "state");
		for (const deadline = Date.now() + 15_000; !existsSync(state) || readFileSync(state, "utf8") !== "ended"; await sleep(50))
			if (Date.now() > deadline) throw new Error(`timed out waiting for ${job.id} to end`);
		for (const [path, text] of Object.entries(files)) writeFileSync(join(job.worktree, path), text);
		git(job.worktree, "add", "--all");
		git(job.worktree, "commit", "--quiet", "-m", "docs: draft the vision");
		return job;
	};
	const merge = async (...args: string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === "merge")?.run({ args, project: undefined })).catch((error: Error) => (err.push(`arthur merge: ${error.message}`), 1));
		t.mock.restoreAll();
		return { code, out: out.join("\n"), err: err.join("\n") };
	};
	return { shop, onboard, merge };
}

test("an onboarding's branch that changes a file besides the vision and criteria is refused by projects, main unchanged; its drafts alone go in", async (t) => {
	const { shop, onboard, merge } = await load(t);
	const wide = await onboard({ "spec/vision.md": "# Vision\n\nSell tools.\n", "README.md": "# Shop, rewritten\n" });
	const start = git(shop, "rev-parse", "HEAD");
	assert.deepEqual(await merge(wide.id, "--unreviewed", "--decision", "SH-D1"), {
		code: 1,
		out: "",
		err: `arthur merge: refused by merge.check: ${wide.branch} changes README.md; an onboarding's merge accepts only spec/vision.md and .agents/arthur/criteria/*.md; main is unchanged`,
	});
	assert.equal(git(shop, "rev-parse", "HEAD"), start);
	assert.match((await merge(wide.id)).err, new RegExp(`^arthur merge: no PASS on ${wide.branch}'s tip `), "an onboarding is merged only on the owner's word");
	const drafts = await onboard({ "spec/vision.md": "# Vision\n\nSell garden tools.\n" });
	const merged = await merge(drafts.id, "--unreviewed", "--decision", "SH-D1");
	assert.equal(merged.code, undefined, merged.err);
	assert.match(merged.out, /\nno checks: package\.json declares no check or test script\nno ticket: no outcome\.md, nothing moved\n/);
	assert.equal(readFileSync(join(shop, "spec/vision.md"), "utf8"), "# Vision\n\nSell garden tools.\n");
});
