import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { server, TOKEN } from "./fake-youtrack.ts";

// The attributes of each entity the fake answers, by its `$type`, recorded in youtrack-shapes.json from a YouTrack instance's
// OpenAPI description (its `source`, read on its `recorded` day). The fake changes shape only through a reviewed change of that file.
const { entities } = JSON.parse(readFileSync(new URL("youtrack-shapes.json", import.meta.url), "utf8")) as { entities: Record<string, readonly string[]> };

type Tree = { [key: string]: Tree };
// The `fields` a request asks for, as a tree: `a,b(c,d)` is { a: {}, b: { c: {}, d: {} } }.
const asked = (fields: string): Tree => {
	const stack: Tree[] = [{}];
	let last = "";
	for (const [, name = "", mark = ""] of fields.matchAll(/([\w$]*)([(),]|$)/g)) {
		const top = stack.at(-1) ?? {};
		if (name !== "") top[(last = name)] = {};
		if (mark === "(") stack.push(top[last] ?? {});
		if (mark === ")") stack.pop();
	}
	return stack[0] ?? {};
};

// Each way an answer leaves YouTrack's shape: an object whose `$type` is missing or not recorded, `+` a key its entity does
// not have, `-` a key the request asked for that its entity has and the answer leaves out (YouTrack answers each such key).
const drift = (got: unknown, wanted: Tree, at: string): string[] => {
	if (Array.isArray(got)) return got.flatMap((item, index) => drift(item, wanted, `${at}[${index}]`));
	if (got === null || typeof got !== "object") return [];
	const has = got as Record<string, unknown>;
	const documented = typeof has.$type === "string" ? entities[has.$type] : undefined;
	if (documented === undefined) return [`${at}: $type ${String(has.$type)} is not recorded`];
	const keys = Object.keys(has).filter((key) => key !== "$type");
	return [
		...Object.keys(wanted).filter((key) => documented.includes(key) && !(key in has)).map((key) => `- ${at}.${key}`),
		...keys.filter((key) => !documented.includes(key)).map((key) => `+ ${at}.${key}`),
		...keys.flatMap((key) => drift(has[key], wanted[key] ?? {}, `${at}.${key}`)),
	];
};

// Every answer of the fake the plugin reads, with the `fields` the plugin asks for it.
const ISSUES = "idReadable,summary,resolved,customFields(name,value(name))";
const ISSUE = "idReadable,summary,description,created,updated,resolved,reporter(login,name),tags(name),customFields(name,value(name,presentation,text))";
const ARTICLES = "idReadable,summary,updated";
const ARTICLE = "idReadable,summary,content,created,updated,reporter(login,name),parentArticle(idReadable)";
const ATTACHMENTS = "id,name,url,mimeType,comment(id)";
const upload = () => {
	const form = new FormData();
	form.append("upload", new Blob(["x"]), "notes.txt");
	return form;
};
const ROUTES: readonly [string, string, string, unknown?][] = [
	["GET", "issues?query=project: SHOP&customFields=State", ISSUES],
	["GET", "issues/SHOP-1", ISSUE],
	["GET", "issues/SHOP-1", "updated,updater(login,name)"],
	["GET", "issues/SHOP-1", "customFields(name,projectCustomField(field(fieldType(id))))"],
	["GET", "issues/SHOP-2", "id"],
	["GET", "articles?query=(project: SHOP) and (release)", ARTICLES],
	["GET", "admin/projects/SHOP/articles", ARTICLES],
	["GET", "articles/SHOP-A-2", ARTICLE],
	["GET", "articles/SHOP-A-2", "updated,updatedBy(login,name)"],
	["GET", "articles/SHOP-A-1", "id"],
	["GET", "admin/projects/SHOP/customFields", "field(name),bundle(values(name,ordinal))"],
	["GET", "admin/projects/SHOP", "id"],
	["GET", "issues/SHOP-1/links", "id,direction,linkType(name,sourceToTarget,targetToSource),issues(id,idReadable,summary)"],
	["GET", "tags?query=back", "id,name"],
	["GET", "issues/SHOP-1/tags", "id,name"],
	["GET", "issues/SHOP-1/timeTracking/workItems", "id,date,text,duration(minutes,presentation),author(login,name),type(name)"],
	["GET", "issues/SHOP-1/comments", "id,text,created,deleted,author(login,name)"],
	["GET", "articles/SHOP-A-2/comments", "id,text,created,author(login,name)"],
	["GET", "issues/SHOP-1/attachments", ATTACHMENTS],
	["GET", "articles/SHOP-A-2/attachments", ATTACHMENTS],
	["POST", "issues", "idReadable", { project: { id: "0-0" }, summary: "New" }],
	["POST", "articles", "idReadable", { project: { id: "0-0" }, summary: "New" }],
	["POST", "issues/SHOP-1", "idReadable,updated", { summary: "Changed" }],
	["POST", "issues/SHOP-1", "idReadable", { project: { id: "0-3" } }],
	["POST", "issues/SHOP-1", "idReadable", { customFields: [{ name: "Priority", $type: "SingleEnumIssueCustomField", value: { name: "Major" } }] }],
	["POST", "articles/SHOP-A-2", "idReadable,updated", { summary: "Changed" }],
	["POST", "issues/SHOP-1/links/80-1t/issues", "id", { id: "2-2" }],
	["POST", "tags", "id,name", { name: "new" }],
	["POST", "issues/SHOP-1/tags", "id,name", { id: "6-1" }],
	["POST", "issues/SHOP-1/timeTracking/workItems", "duration(minutes,presentation)", { duration: { minutes: 90 } }],
	["POST", "issues/SHOP-1/comments", "id", { text: "Done." }],
	["POST", "issues/SHOP-1/comments/4-17", "id", { text: "Done." }],
	["POST", "articles/SHOP-A-2/comments", "id", { text: "Done." }],
	["POST", "articles/SHOP-A-2/comments/251-0", "id", { text: "Done." }],
	["POST", "issues/SHOP-1/attachments", "id,name", upload],
	["POST", "articles/SHOP-A-2/attachments", "id,name", upload],
];

test("every answer of the fake YouTrack the plugin reads holds the keys the plugin asks for, and only keys the OpenAPI description documents for its $type", async (t) => {
	const { url } = await server(t);
	const problems: string[] = [];
	for (const [method, path, fields, body] of ROUTES) {
		const sent = typeof body === "function" ? body() : body === undefined ? undefined : JSON.stringify(body);
		const headers = { authorization: `Bearer ${TOKEN}`, ...(typeof sent === "string" ? { "content-type": "application/json" } : {}) };
		const response = await fetch(`${url}/api/${path}${path.includes("?") ? "&" : "?"}fields=${encodeURIComponent(fields)}`, { method, headers, body: sent });
		const where = `${method} ${path} ${fields}`;
		const got: unknown = response.status === 200 ? await response.json() : undefined;
		if (got === undefined || (Array.isArray(got) && got.length === 0)) problems.push(`${where}: ${response.status}, nothing to compare`);
		else problems.push(...drift(got, asked(fields), where));
	}
	assert.deepEqual(problems, []);
});

test("the comparison names a missing or unrecorded $type, a key the entity lacks, and an asked key left out, at any depth and in any item", () => {
	assert.deepEqual(asked("id,author(login,name),issues(id,customFields(value(name)))"), { id: {}, author: { login: {}, name: {} }, issues: { id: {}, customFields: { value: { name: {} } } } });
	const comment = { id: "4-1", text: "Hi", author: { login: "jane", name: "Jane", $type: "User" }, $type: "IssueComment" };
	assert.deepEqual(drift([comment], asked("id,text,author(login,name)"), ""), []);
	assert.deepEqual(drift([comment, { ...comment, author: { login: "jane", $type: "User" } }], asked("id,author(login,name)"), ""), ["- [1].author.name"]);
	assert.deepEqual(drift({ id: "4-1", author: { login: "jane" } }, {}, "at"), ["at: $type undefined is not recorded"]);
	assert.deepEqual(drift({ ...comment, mood: "glad", author: { name: "Jane", $type: "User" } }, asked("id,presentation"), ""), ["+ .mood"], "an asked key the entity lacks is not required, nor one not asked");
	assert.deepEqual(drift({ id: "4-1", $type: "Comment" }, {}, "at"), ["at: $type Comment is not recorded"]);
	assert.deepEqual(drift({ customFields: [{ name: "Points", value: 5, $type: "SimpleIssueCustomField" }], $type: "Issue" }, asked("customFields(value(name))"), ""), [], "a value that is no object holds no keys");
});
