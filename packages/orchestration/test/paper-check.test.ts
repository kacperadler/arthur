import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

// AR0570: orchestration's `merge.check` refuses a worker's branch that changes a ticket's ticket.md, the decision log or the
// board, naming each file, by path from where the branch left HEAD.

const TICKET = "spec/features/AC0001-shop/ticket.md";
const FILES: Readonly<Record<string, string>> = {
	[TICKET]: "# AC0001 - Shop\n",
	"spec/features/AC0001-shop/findings.md": "# AC0001 - Findings\n",
	"spec/decisions.jsonl": "{}\n",
	"spec/build.json": "[]\n",
	"spec/vision.md": "# Vision\n",
	"src/shop.ts": "export const shop = 1;\n",
};

// The repository `acme` (AC) with FILES committed on main, the plugin set up on the fake host outside any job. `branch(name,
// change)` makes `name` one commit of `change` off main and goes back to main; `check(branch)` asks merge.check for a worker.
async function setup(t: TestContext) {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => {
		if (saved !== undefined) process.env.ARTHUR_JOB = saved;
	});
	const root = join(temporaryFolder(), "acme");
	const write = (path: string, text: string) => (mkdirSync(dirname(join(root, path)), { recursive: true }), writeFileSync(join(root, path), text));
	for (const [path, text] of Object.entries(FILES)) write(path, text);
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", root, ...args], { encoding: "utf8" });
	git("init", "--quiet", "--initial-branch=main");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	const fake = fakeHost({ name: "orchestration", root, timeZone: "UTC", now: new Date("2026-10-30T08:00:00Z") });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(orchestration());
	const branch = (name: string, change: () => void) => {
		git("switch", "--quiet", "-c", name);
		change();
		git("add", "--all");
		git("commit", "--quiet", "-m", name);
		git("switch", "--quiet", "main");
		return name;
	};
	const check = (name: string, kind = "worker", project = "acme") => fake.collect("merge.check", { id: "2026-10-30-worker-0000abcd", kind, project, branch: name, state: "ended" });
	return { root, git, write, branch, check };
}

const REFUSED = (branch: string, files: string) => [`${branch} changes ${files}, which only the coordinator's arthur ticket, arthur decision and board commands write on main; put each back as main has it on the branch (git checkout <main> -- <file>, or git rm one main lacks) and commit, with what it was for in the ticket's findings.md or the final message`];

test("a worker's branch that adds, changes, deletes or renames a ticket.md, or changes the decision log or the board, is refused naming each file; the rest pass", async (t) => {
	const { root, write, branch, check } = await setup(t);
	const decisions = branch("arthur/decisions", () => write(TICKET, "# AC0001 - Shop\n\n## Decisions\n\n- 2026-10-30: forged\n"));
	assert.deepEqual(check(decisions), REFUSED("arthur/decisions", TICKET));
	const added = branch("arthur/added", () => write("spec/features/AC0002-new/ticket.md", "# AC0002\n"));
	assert.deepEqual(check(added), REFUSED("arthur/added", "spec/features/AC0002-new/ticket.md"));
	const deleted = branch("arthur/deleted", () => rmSync(join(root, TICKET)));
	assert.deepEqual(check(deleted), REFUSED("arthur/deleted", TICKET));
	const renamed = branch("arthur/renamed", () => renameSync(join(root, TICKET), join(root, "spec/features/AC0001-shop/old.md")));
	assert.deepEqual(check(renamed), REFUSED("arthur/renamed", TICKET), "a rename is the old file deleted");
	const papers = branch("arthur/papers", () => {
		write("spec/decisions.jsonl", '{}\n{"answer":"approved"}\n');
		write("spec/build.json", '[{"id":"AC0001","status":"done"}]\n');
		write("src/shop.ts", "export const shop = 2;\n");
	});
	assert.deepEqual(check(papers), REFUSED("arthur/papers", "spec/build.json, spec/decisions.jsonl"));
	const free = branch("arthur/free", () => {
		write("spec/features/AC0001-shop/findings.md", "# AC0001 - Findings\n\n## F1. A bug\n");
		write("spec/features/AC0001-shop/plan.md", "# Plan\n");
		write("spec/features/AC0001-shop/notes/ticket.md", "# Notes\n");
		write("spec/features/AC0001-shop/ticket.md.orig", "# A merge's leftover\n");
		write("spec/features/ticket.md", "# Not a ticket's\n");
		write("docs/spec/build.json", "[]\n");
		write("spec/build.json.bak", "[]\n");
		write("spec/vision.md", "# Vision, moved\n");
		write("src/shop.ts", "export const shop = 3;\n");
	});
	assert.deepEqual(check(free), [undefined], "findings.md, a plan and paths that only look alike pass");
});

test("judged as the merge goes, for a worker only: main's own later change to a ticket is not the branch's, a conflict in one is; a missing project or branch refuses", async (t) => {
	const { git, write, branch, check } = await setup(t);
	const code = branch("arthur/code", () => write("src/shop.ts", "export const shop = 2;\n"));
	write(TICKET, "# AC0001 - Shop, moved by the coordinator\n");
	write("spec/build.json", '[{"id":"AC0001"}]\n');
	git("commit", "--quiet", "-am", "board moves");
	assert.deepEqual(check(code), [undefined]);
	const ticket = branch("arthur/ticket", () => write(TICKET, "# AC0001 - Shop, by the branch\n"));
	assert.deepEqual(check(ticket), REFUSED("arthur/ticket", TICKET));
	git("switch", "--quiet", "-c", "arthur/conflict", "main~1");
	write(TICKET, "# AC0001 - Shop, by the branch before the board moved\n");
	write("src/shop.ts", "export const shop = 4;\n");
	git("commit", "--quiet", "-am", "conflict");
	git("switch", "--quiet", "main");
	assert.deepEqual(check("arthur/conflict"), REFUSED("arthur/conflict", TICKET), "a merge that conflicts in the ticket changes it too");
	assert.deepEqual(check(ticket, "onboarding"), [undefined], "another kind is another plugin's to check");
	assert.deepEqual(check(ticket, "worker", "blog"), ["project blog is not in the list"]);
	assert.deepEqual(check("arthur/gone"), ["cannot tell what merging arthur/gone changes: merge-tree: arthur/gone - not something we can merge"]);
});

// Git's diff of `HEAD...<branch>` takes one of several merge bases, by commit date: either order of the sibling's commit and the
// owner's decision makes one of the two bases hide the branch's change from it, so both are tried.
for (const siblingFirst of [false, true]) {
	test(`a branch with two merge bases is judged as the merge goes: one that merged a sibling and main, then put back the sibling's ticket, is refused before it drops the owner's line (the sibling's commit ${siblingFirst ? "before" : "after"} the decision)`, async (t) => {
		const { root, write, check } = await setup(t);
		let clock = 1_800_000_000;
		const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", root, ...args], { encoding: "utf8", env: { ...process.env, GIT_COMMITTER_DATE: `${(clock += 100)} +0000`, GIT_AUTHOR_DATE: `${clock} +0000` } });
		const decided = "# AC0001 - Shop\n\n## Decisions\n\n- 2026-10-30: the owner's\n";
		// The sibling branches off main before the decision, its one commit dated before or after it.
		git("branch", "arthur/x");
		const steps = [
			() => {
				write(TICKET, decided);
				git("commit", "--quiet", "-am", "the owner's decision");
			},
			() => {
				git("switch", "--quiet", "arthur/x");
				write("src/x.ts", "export const x = 1;\n");
				git("add", "--all");
				git("commit", "--quiet", "-m", "x");
				git("switch", "--quiet", "main");
			},
		];
		for (const step of siblingFirst ? steps.toReversed() : steps) step();
		git("switch", "--quiet", "-c", "arthur/c", "main~1");
		git("merge", "--quiet", "--no-ff", "--no-edit", "arthur/x");
		git("merge", "--quiet", "--no-edit", "main");
		git("checkout", "arthur/x", "--", TICKET);
		git("commit", "--quiet", "-m", "the sibling's ticket");
		git("switch", "--quiet", "main");
		git("merge", "--quiet", "--no-ff", "--no-edit", "arthur/x");
		assert.equal(git("merge-base", "--all", "main", "arthur/c").trim().split("\n").length, 2, "two merge bases");
		assert.deepEqual(check("arthur/c"), REFUSED("arthur/c", TICKET));
		git("merge", "--quiet", "--no-ff", "--no-edit", "arthur/c");
		assert.notEqual(readFileSync(join(root, TICKET), "utf8"), decided, "what the refusal kept out: the merge drops the owner's line");
	});
}
