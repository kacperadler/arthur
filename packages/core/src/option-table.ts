// The option table (spec/roadmap.md, entry 93): every option the core or a plugin accepts, with its meaning in one line. The
// package's own option check walks the same table, so an option without its meaning cannot exist. Each package's options file
// (`@arthur/core/options`, `@arthur/<plugin>/options`) exports its `table`, a one-line `summary` and its `tools`, and loads
// without setting up anything.

// What a value should be ("a non-empty string"), or undefined when it is.
export type Check = (value: unknown) => string | undefined;

// One option: `about` is its meaning, `default` what holds when it is left out, each one line as a person reads it. A value has
// its `check`, and a list or record of objects the table of their keys in `each`; a nested object has its `fields`.
export type ValueOption = { readonly about: string; readonly default?: string; readonly check: Check; readonly each?: OptionTable };
export type ObjectOption = { readonly about: string; readonly default?: string; readonly fields: OptionTable };
export type OptionEntry = ValueOption | ObjectOption;
export type OptionTable = { readonly [key: string]: OptionEntry };

// A tool the package runs, beyond those the core names, and the command that prints its version.
export type Tool = { readonly name: string; readonly version: readonly string[] };

// Every option of `table` at any depth, by its dotted path from `at`, a nested one after its parent; `*` stands for each item
// of a list or record.
export function everyOption(table: OptionTable, at = ""): { readonly path: string; readonly entry: OptionEntry }[] {
	return Object.entries(table).flatMap(([key, entry]) => {
		const path = at === "" ? key : `${at}.${key}`;
		const inner = "fields" in entry ? everyOption(entry.fields, path) : entry.each === undefined ? [] : everyOption(entry.each, `${path}.*`);
		return [{ path, entry }, ...inner];
	});
}
