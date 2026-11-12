import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { manage } from "../src/manage.ts";
import { releaseNotice } from "../src/release-notice.ts";

// The notice of a new release (spec/roadmap.md, entry 107) against the fake host, the test providing `schedule.register` as
// the schedule plugin would and running the entry's code itself: Arthur's origin, a repository of the test's own with a
// commit and a tag per release, and a clone of it whose `packages/core` is the core's folder, `host.code[0]`.

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-C", cwd, ...args], { encoding: "utf8" });

// A commit on origin tagged with each of `tags`.
function release(origin: string, ...tags: string[]) {
	git(origin, "commit", "--quiet", "--allow-empty", "-m", tags.join(" "));
	for (const tag of tags) git(origin, "tag", tag);
}

// Origin with the releases 0.1.0 and 0.2.0, and a clone at `v0.2.0`, detached, as docs/setup.md installs one.
function arthur() {
	const base = temporaryFolder();
	const [origin, clone] = [join(base, "origin"), join(base, "arthur")];
	mkdirSync(join(origin, "packages/core"), { recursive: true });
	writeFileSync(join(origin, "packages/core/package.json"), "{}\n");
	git(base, "init", "--quiet", "--initial-branch=main", origin);
	git(origin, "add", "--all");
	git(origin, "commit", "--quiet", "-m", "core");
	git(origin, "tag", "v0.1.0");
	release(origin, "v0.2.0");
	git(base, "clone", "--quiet", origin, clone);
	git(clone, "checkout", "--quiet", "v0.2.0");
	return { origin, clone, core: join(clone, "packages/core") };
}

// Manage set up with `code` as the host's, its registered entries and the run of its release entry.
async function load(code: readonly string[]) {
	const fake = fakeHost({ name: "manage", code });
	const entries: Record<string, unknown>[] = [];
	fake.provide("schedule.register", (plugin: unknown, list: Record<string, unknown>[]) => void entries.push(...list.map((each) => ({ plugin, ...each }))));
	await fake.setup(manage());
	const run = () => (entries.find((each) => each.id === "release")?.run as () => Promise<void>)();
	return { fake, entries, run };
}

const notices = (fake: FakeHost) =>
	fake.emitted.flatMap((event) => (event.name === "notice" && typeof event.data === "object" && event.data !== null && "text" in event.data ? [String(event.data.text)] : []));
const out = (version: string, here = "0.2.0") => `Arthur ${version} is out; this one runs ${here}: arthur update`;

test("manage registers the release notice with the schedule every day at 09:00, with no option; without the schedule the load goes on", async () => {
	const { entries } = await load([]);
	assert.deepEqual(entries.map(({ run, ...rest }) => ({ ...rest, run: typeof run })), [{ plugin: "manage", id: "release", at: "09:00", option: "enabled", run: "function" }]);
	const alone = fakeHost({ name: "manage" });
	await alone.setup(manage());
	assert.deepEqual(alone.calls.filter((each) => each.name === "schedule.register").map((each) => each.kind), ["collect"], "asked, with no answer and no refusal");
});

test("each newer release on origin is told once, oldest first by version; older ones, the one here and other tags never", async () => {
	const { origin, clone, core } = arthur();
	release(origin, "v0.10.0");
	release(origin, "v0.3.0", "v0.2.1", "v0.4.0-rc1", "nightly", "old/v9.9.9");
	const { fake, run } = await load([core]);
	await run();
	assert.deepEqual(notices(fake), [out("0.2.1"), out("0.3.0"), out("0.10.0")]);
	assert.deepEqual(JSON.parse(readFileSync(join(fake.host.folder, "releases.json"), "utf8")), { told: "0.10.0" });
	await run();
	assert.equal(notices(fake).length, 3, "a second run tells nothing again");
	// A restart: a new load whose folder holds what the last one told.
	const again = await load([core]);
	copyFileSync(join(fake.host.folder, "releases.json"), join(again.fake.host.folder, "releases.json"));
	await again.run();
	assert.deepEqual(notices(again.fake), [], "nothing told again after a restart");
	release(origin, "v0.10.1");
	await again.run();
	assert.deepEqual(notices(again.fake), [out("0.10.1")]);
	// Updated to 0.10.1, which was told; 0.11.0 is told, against the version this one runs now.
	git(clone, "fetch", "--quiet", "--tags", "origin");
	git(clone, "checkout", "--quiet", "v0.10.1");
	release(origin, "v0.11.0");
	await again.run();
	assert.deepEqual(notices(again.fake), [out("0.10.1"), out("0.11.0", "0.10.1")]);
	// Updated past what was told, to 0.12.0 before it was told: the one it runs is no news, only a newer one is.
	release(origin, "v0.12.0");
	git(clone, "fetch", "--quiet", "--tags", "origin");
	git(clone, "checkout", "--quiet", "v0.12.0");
	await again.run();
	assert.equal(notices(again.fake).length, 2, "0.12.0 runs here: not told");
	release(origin, "v0.12.1");
	await again.run();
	assert.deepEqual(notices(again.fake).slice(2), [out("0.12.1", "0.12.0")]);
});

test("the newest release tag at HEAD is the one this checkout runs", async () => {
	const { origin, clone, core } = arthur();
	git(clone, "tag", "v0.1.9");
	git(clone, "tag", "v0.2.0-patched");
	release(origin, "v0.2.1");
	const { fake, run } = await load([core]);
	await run();
	assert.deepEqual(notices(fake), [out("0.2.1")]);
});

test("a told file that is broken or edited by hand is nothing told: every newer release is told once more", async () => {
	const { origin, core } = arthur();
	release(origin, "v0.3.0");
	for (const text of ["{", "null", '{ "told": "latest" }', '{ "told": 3 }', '{ "told": ["0.3.0"] }', "[]"]) {
		const { fake, run } = await load([core]);
		writeFileSync(join(fake.host.folder, "releases.json"), text);
		await run();
		assert.deepEqual(notices(fake), [out("0.3.0")], text);
	}
});

test("a checkout at no release tag, such as main, a core outside Git, or none, is not checked: no listing, no notice, no file", async () => {
	const { origin, clone, core } = arthur();
	release(origin, "v0.3.0");
	// Origin out of reach: a listing would fail the run, so each run that passes asked nothing of it.
	git(clone, "remote", "set-url", "origin", join(origin, "gone"));
	git(clone, "checkout", "--quiet", "main");
	git(clone, "commit", "--quiet", "--allow-empty", "-m", "work after 0.2.0");
	const outside = join(temporaryFolder(), "core");
	mkdirSync(outside);
	git(clone, "tag", "v0.2.0-rc1", "main");
	for (const code of [[core], [outside], []]) {
		const { fake, run } = await load(code);
		await run();
		assert.deepEqual(notices(fake), [], code.join(""));
		assert.equal(existsSync(join(fake.host.folder, "releases.json")), false);
	}
	git(clone, "checkout", "--quiet", "v0.2.0");
	await assert.rejects((await load([core])).run(), { message: `git ls-remote --tags --refs origin v* in ${core}: fatal: '${join(origin, "gone")}' does not appear to be a git repository` }, "at the tag the listing runs");
});

test("a listing that fails or is cut after its limit fails the run, naming it; nothing is told or written", async () => {
	const { clone, core } = arthur();
	// Origin that never answers: a helper reading what git sends until git is gone.
	const hang = join(temporaryFolder(), "hang");
	writeFileSync(hang, "#!/bin/sh\nwhile read -r line; do :; done\n");
	chmodSync(hang, 0o755);
	git(clone, "config", "protocol.ext.allow", "always");
	git(clone, "remote", "set-url", "origin", `ext::${hang}`);
	const fake = fakeHost({ name: "manage", code: [core] });
	await assert.rejects(releaseNotice(fake.host, 500), { message: `git ls-remote --tags --refs origin v* in ${core}: cut after 0.5 s` });
	assert.deepEqual(notices(fake), []);
	assert.equal(existsSync(join(fake.host.folder, "releases.json")), false);
});
