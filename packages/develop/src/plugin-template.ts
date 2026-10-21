// The files of a new plugin package, by path inside `packages/<name>/` (`arthur plugin new`, docs/commands/plugin.md): its
// package.json, one plugin file that is its options file too, a test against the fake host, and its doc page. `fn` is the
// name of the plugin's function, `name` in camelCase. What it does is the plugin's ticket's to write.

export function pluginFiles(name: string, fn: string): Record<string, string> {
	const manifest = { name: `@arthur/${name}`, private: true, type: "module", license: "Apache-2.0", exports: { ".": `./src/${name}.ts`, "./options": `./src/${name}.ts` } };
	return {
		"package.json": `${JSON.stringify(manifest, null, 2)}\n`,
		[`src/${name}.ts`]: `import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options, Plugin } from "@arthur/core/plugin";

// The ${name} plugin: what it does, with the roadmap entry that builds it. docs/${name}.md.

// Its options file too (\`./options\`), which \`arthur setup\` reads: what it is in one line, the tools it runs, its options.
export const summary = "${name}: what the plugin does, in one line";

export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; ${name} has no options but enabled" }));
}

export function ${fn}(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "${name}",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup() {},
	};
}
`,
		[`test/${name}.test.ts`]: `import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { checkOptions, ${fn} } from "../src/${name}.ts";

// The ${name} plugin against the fake host. docs/${name}.md.

test("${name} sets up on the fake host and refuses an option it does not know", async () => {
	await fakeHost({ name: "${name}" }).setup(${fn}());
	assert.deepEqual(checkOptions({ nope: 1 }), [{ path: "nope", problem: "unknown option; ${name} has no options but enabled" }]);
});
`,
		[`docs/${name}.md`]: `# The ${name} plugin

What it does, with the roadmap entry that builds it.

\`\`\`ts
plugins: [orchestration({}), ${fn}()],
\`\`\`

It has no options but \`enabled\`; any other is refused at load (\`${name}.<key>: unknown option; ${name} has no options but enabled\`).
`,
	};
}
