import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { linkFeatures, writePlugins } from "../scripts/plugins.ts";

const temp = mkdtempSync(join(tmpdir(), "arthur-site-plugins-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const README = [
	"# Arthur",
	"",
	"Runs jobs.",
	"",
	"## Features",
	"",
	"- **core**, built: the config, the host ([commands](packages/core/docs/commands/), [API](docs/plugin-api.md)).",
	"- **alpha**, partly built: alpha things ([alpha](packages/alpha/docs/alpha.md)).",
	"- Planned: beta.",
	"",
].join("\n");

const VISION = [
	"# Vision",
	"",
	"| Plugin | First or later | Does |",
	"| --- | --- | --- |",
	"| alpha (named) | first | Alpha. More. |",
	"| beta (named) | later | A channel, through a \\| bridge. Below. |",
	"",
	"| Other | table |",
].join("\n");

const CORE_COMMAND = ["# arthur run", "", "Runs. See [the setup](../../../../docs/setup.md).", "", "## Steps", "", "```", "# not a heading", "```", ""].join("\n");

/** A repository with `files` (path → text) in a fresh folder; returns its root and the folder pages go to. */
function repository(files: Readonly<Record<string, string>>): { root: string; pages: string } {
	const root = mkdtempSync(join(temp, "repo-"));
	const all: Record<string, string> = { "README.md": README, "spec/vision.md": VISION, ...files };
	for (const [path, text] of Object.entries(all)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return { root, pages: join(root, "out") };
}

const TREE = {
	"packages/core/docs/core.md": "# The core\n\nThe core [plugin API](../../../docs/plugin-api.md).\n\n## Options\n\n- `home`\n",
	"packages/core/docs/commands/run.md": CORE_COMMAND,
	"packages/core/docs/commands/notes.txt": "not a page",
	"packages/alpha/docs/alpha.md": "# alpha\n\nAlpha overview.\n",
	"packages/README.md": "a file, not a package",
};

test("the Plugins page lists every package, core first, linking its page, then the planned plugins without one", () => {
	const { root, pages } = repository(TREE);
	assert.deepEqual(writePlugins(root, pages), ["core", "alpha"]);
	const page = readFileSync(join(pages, "plugins.md"), "utf8");
	assert.match(page, /^title: "Plugins"$/m);
	const rows = page.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Plugin") && !line.startsWith("| ---"));
	assert.deepEqual(rows, [
		"| [core](core/) | built | the config, the host |",
		"| [alpha](alpha/) | partly built | alpha things |",
		"| beta | planned | A channel, through a \\| bridge |",
	]);
});

test("a plugin's page is its overview, then each command page with its headings one level down", () => {
	const { root, pages } = repository(TREE);
	writePlugins(root, pages);
	const [, head, body] = readFileSync(join(pages, "plugins/core.md"), "utf8").split("---\n");
	assert.match(head, /^title: "core"$/m);
	assert.match(head, /^sidebar: \{"order":0\}$/m);
	assert.equal(
		body.trim(),
		[
			"The core [plugin API](https://github.com/kacperadler/arthur/blob/main/docs/plugin-api.md).",
			"",
			"## Options",
			"",
			"- `home`",
			"",
			"## arthur run",
			"",
			"Runs. See [the setup](https://github.com/kacperadler/arthur/blob/main/docs/setup.md).",
			"",
			"### Steps",
			"",
			"```",
			"# not a heading",
			"```",
		].join("\n"),
	);
	const alpha = readFileSync(join(pages, "plugins/alpha.md"), "utf8");
	assert.match(alpha, /^sidebar: \{"order":1\}$/m);
	assert.ok(alpha.endsWith("---\n\nAlpha overview."));
});

test("a package without a docs folder or without its overview fails the build", () => {
	const bare = repository({ ...TREE, "packages/gamma/src/gamma.ts": "" });
	assert.throws(() => writePlugins(bare.root, bare.pages), /^Error: packages\/gamma\/docs: missing/);
	const commandsOnly = repository({ ...TREE, "packages/delta/docs/commands/delta.md": "# arthur delta\n" });
	assert.throws(() => writePlugins(commandsOnly.root, commandsOnly.pages), /^Error: packages\/delta\/docs\/delta\.md: missing/);
});

test("two command pages of the same name in one package fail the build", () => {
	const { root, pages } = repository({ ...TREE, "packages/core/docs/commands/Run.md": "# arthur Run\n" });
	assert.throws(() => writePlugins(root, pages), /^Error: packages\/core\/docs\/commands: Run\.md and run\.md are two command pages of the same name$/);
	const apart = repository({ ...TREE, "packages/alpha/docs/commands/run.md": "# arthur run\n" });
	assert.deepEqual(writePlugins(apart.root, apart.pages), ["core", "alpha"]);
});

test("a package without a README Features line, or a vision without its plugin table, fails the build", () => {
	const unlisted = repository({ ...TREE, "packages/gamma/docs/gamma.md": "# gamma\n" });
	assert.throws(() => writePlugins(unlisted.root, unlisted.pages), /^Error: README\.md: no line `- \*\*gamma\*\*, <state>: <summary>`/);
	const noTable = repository({ ...TREE, "spec/vision.md": "# Vision\n\n| Part | Does |\n" });
	assert.throws(() => writePlugins(noTable.root, noTable.pages), /^Error: spec\/vision\.md: no plugin table/);
});

test("the landing page's Features list links each package's page, and nothing else", () => {
	const body = "## Features\n\n- **core**, built: x.\n- **beta**, planned: y.\n  - **core**, nested\n- Planned: z.";
	assert.equal(linkFeatures(body, ["core", "alpha"]), "## Features\n\n- [**core**](plugins/core/), built: x.\n- **beta**, planned: y.\n  - **core**, nested\n- Planned: z.");
});
