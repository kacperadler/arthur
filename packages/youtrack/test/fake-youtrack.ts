import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

// The fake YouTrack the youtrack tests share, and what they read of it.

export const TOKEN = "perm:YXJ0aHVy.dGVzdA==.Kn0wnT0kenN3verPr1nted";
export const ACME_TOKEN = "perm:YWNtZQ==.dGVzdA==.AcmeT0kenN3verPr1nted";
export const DAY = Date.UTC(2026, 9, 1);

// Entities as YouTrack's REST documentation shows them: every field the plugin asks for, `id` and `$type` too.
const issue = (project: string, number: number) => ({
	...{ idReadable: `${project}-${number}`, summary: `Issue ${number}`, resolved: number % 2 === 0 ? DAY : null, id: `2-${number}`, $type: "Issue" },
	customFields: [{ name: "State", value: STATES[number % 8] === null ? null : { name: STATES[number % 8], $type: "StateBundleElement" }, id: "92-0", $type: "StateIssueCustomField" }],
});
// Each issue's State, by its number modulo 8: the even, resolved ones Fixed or Verified; of the odd ones, SHOP-5 and every
// eighth after it has none, and SHOP-7's Submitted is a state the project's bundle does not hold.
const STATES = ["Verified", "In Progress", "Fixed", "Open", "Verified", null, "Fixed", "Submitted"];
// A value of a bundle as `bundle(values(name,ordinal))` asks for it; the server's order is not the ordinal's. SHOP's
// Reopened and Won't fix hold no issue.
const element = (name: string, ordinal: number, $type: string, isResolved?: boolean) => ({ name, ordinal, ...(isResolved === undefined ? {} : { isResolved }), id: `71-${ordinal}`, $type });
// A project's custom field as `admin/projects/<id>/customFields` answers it with `field(name),bundle(values(name,ordinal))`.
const projectField = (name: string, $type: string, values: readonly unknown[] | null) => ({ field: { name, id: `58-${name.length}`, $type: "CustomField" }, ...(values === null ? {} : { bundle: { values, id: "64-1", $type: "Bundle" } }), id: "102-1", $type });
const PRIORITY_FIELD = projectField("Priority", "EnumProjectCustomField", [element("Critical", 0, "EnumBundleElement"), element("Normal", 1, "EnumBundleElement")]);
const STATE_FIELD = projectField(
	"State",
	"StateProjectCustomField",
	[["Fixed", 3, true], ["Open", 1, false], ["Reopened", 0, false], ["In Progress", 2, false], ["Won't fix", 5, true], ["Verified", 4, true]].map(([name, ordinal, resolved]) => element(name as string, ordinal as number, "StateBundleElement", resolved as boolean)),
);
// A custom field of the issue: its project field's type, as `customFields(projectCustomField(field(fieldType(id))))` asks.
const custom = (name: string, value: unknown, $type: string, type: string, project: string) => ({
	name,
	value,
	projectCustomField: { field: { fieldType: { id: type, $type: "FieldType" }, $type: "CustomField" }, $type: project },
	id: `92-${name.length}`,
	$type,
});
export const FULL_ISSUE = {
	idReadable: "SHOP-1",
	summary: "Checkout fails\u001b[31m",
	description: "Steps:\n1. Pay.\n2. See the error.",
	created: DAY,
	updated: DAY + 86_400_000,
	updater: { login: "john", name: "John Smith", $type: "User" },
	resolved: null,
	reporter: { login: "jane", name: "Jane Doe", $type: "User" },
	customFields: [
		custom("Priority", { name: "Critical", $type: "EnumBundleElement" }, "SingleEnumIssueCustomField", "enum[1]", "EnumProjectCustomField"),
		custom("Assignee", null, "SingleUserIssueCustomField", "user[1]", "UserProjectCustomField"),
		custom("Fix versions", [{ name: "1.0", $type: "VersionBundleElement" }, { name: "1.1", $type: "VersionBundleElement" }], "MultiVersionIssueCustomField", "version[*]", "VersionProjectCustomField"),
		custom("Estimation", { presentation: "1d 2h", $type: "PeriodValue" }, "PeriodIssueCustomField", "period", "PeriodProjectCustomField"),
		custom("Story points", 5, "SimpleIssueCustomField", "integer", "SimpleProjectCustomField"),
		custom("Notes", { text: "See the wiki.", $type: "TextFieldValue" }, "TextIssueCustomField", "text", "TextProjectCustomField"),
		custom("Due Date", null, "DateIssueCustomField", "date", "SimpleProjectCustomField"),
		custom("Deployed", null, "SimpleIssueCustomField", "date and time", "SimpleProjectCustomField"),
		custom("Requester", "555", "SimpleIssueCustomField", "string", "SimpleProjectCustomField"),
	],
	tags: [{ name: "backend", id: "6-1", $type: "Tag" }],
	id: "2-1",
	$type: "Issue",
};
const PRIORITIES = ["Critical", "Major", "Normal", "Minor"];
export const ARTICLE = {
	idReadable: "SHOP-A-2",
	summary: "Release steps",
	content: "Tag, then deploy.",
	created: DAY,
	updated: DAY + 3_600_000,
	updatedBy: { login: "john", name: "John Smith", $type: "User" },
	reporter: { login: "jane", name: "Jane Doe", $type: "User" },
	parentArticle: { idReadable: "SHOP-A-1", $type: "Article" },
	id: "226-1",
	$type: "Article",
};
// An issue's comment as the documentation's IssueComment shows it.
const comment = (id: string, text: string, login: string, name: string, created: number, deleted: boolean) => ({
	...{ id, text, textPreview: text, created, updated: null, deleted, author: { login, name, $type: "User" } },
	...{ issue: { idReadable: "SHOP-1", $type: "Issue" }, attachments: [], visibility: null, $type: "IssueComment" },
});
// SHOP-1's comments: 4-17 by the token's user, 4-18 by jane, which that user may not change, 4-19 deleted.
const COMMENTS = [
	comment("4-17", "Fixed in the next build.\u001b[2J", "arthur", "Arthur", DAY, false),
	comment("4-18", "Still fails on Safari.\n\nSee the screenshot.", "jane", "Jane Doe", DAY + 86_400_000, false),
	comment("4-19", "Buy cheap watches", "bob", "Bob", DAY, true),
];
// An issue's attachment as the documentation's IssueAttachment shows it; `url` is the server's path to its bytes.
const attachment = (id: string, name: string, url: string, size: number, mimeType: string, comment: string | null) => ({
	...{ id, name, url, size, mimeType, extension: name.split(".").at(-1), charset: null, metaData: null, draft: false, removed: false, base64Content: null },
	...{ author: { login: "jane", name: "Jane Doe", $type: "User" }, created: DAY, updated: DAY, visibility: null, thumbnailURL: null },
	...{ issue: { idReadable: "SHOP-1", $type: "Issue" }, comment: comment === null ? null : { id: comment, $type: "IssueComment" }, $type: "IssueAttachment" },
});
// The bytes behind each attachment, by its id.
export const FILES: Readonly<Record<string, Buffer>> = {
	"74-1": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	"74-2": Buffer.from("#!/bin/sh\necho climbed\n"),
	"74-3": Buffer.alloc(0),
	"74-4": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
	"74-5": Buffer.from("SITE notes"),
	"75-1": Buffer.from("Tag."),
};
const ATTACHMENTS = (prefix: string) => [
	attachment("74-1", "screen.png", `${prefix}/api/files/74-1?sign=MTc2&updated=${DAY}`, 8, "image/png", null),
	attachment("74-2", "../../climb.sh", `${prefix}/api/files/74-2?sign=MTc3&updated=${DAY}`, 23, "application/x-sh", "4-18"),
	attachment("74-3", "empty.txt", `${prefix}/api/files/74-3?sign=MTc4&updated=${DAY}`, 0, "text/plain", null),
	attachment("74-4", "screen.png", `${prefix}/api/files/74-4?sign=MTc5&updated=${DAY}`, 5, "image/png", "4-18"),
];
// The tags the token's user sees, as the documentation's Tag shows them.
const TAGS = ["backend", "backend-old"].map((name, index) => ({ name, id: `6-${index + 1}`, owner: { login: "jane", name: "Jane Doe", $type: "User" }, visibleFor: null, $type: "Tag" }));
// A link type as `linkType(name,sourceToTarget,targetToSource)` asks for it, from the documentation's sample.
const linkType = (name: string, sourceToTarget: string, targetToSource: string, directed: boolean) => ({ name, sourceToTarget, targetToSource, directed, aggregation: name !== "Relates", localizedName: null, $type: "IssueLinkType" });
const [RELATES, DEPEND, DUPLICATE, SUBTASK] = [linkType("Relates", "relates to", "", false), linkType("Depend", "is required for", "depends on", true), linkType("Duplicate", "is duplicated by", "duplicates", true), linkType("Subtask", "parent for", "subtask of", true)];
// An issue's links: every link type in each direction, as YouTrack lists them; SHOP-1 relates to SHOP-3 and depends on SHOP-2.
const LINKS = (relates: readonly unknown[], dependsOn: readonly unknown[]) => [
	{ direction: "BOTH", linkType: RELATES, issues: relates, id: "80-0", $type: "IssueLink" },
	{ direction: "OUTWARD", linkType: DEPEND, issues: [], id: "80-1s", $type: "IssueLink" },
	{ direction: "INWARD", linkType: DEPEND, issues: dependsOn, id: "80-1t", $type: "IssueLink" },
	{ direction: "OUTWARD", linkType: DUPLICATE, issues: [], id: "80-2s", $type: "IssueLink" },
	{ direction: "INWARD", linkType: DUPLICATE, issues: [], id: "80-2t", $type: "IssueLink" },
	{ direction: "OUTWARD", linkType: SUBTASK, issues: [], id: "80-3s", $type: "IssueLink" },
	{ direction: "INWARD", linkType: SUBTASK, issues: [], id: "80-3t", $type: "IssueLink" },
];
// SHOP-1's work items as the documentation's IssueWorkItem shows them: 115-0 with a type and a text, 115-2 with neither.
const workItem = (id: string, minutes: number, presentation: string, text: string | null, type: string | null) => ({
	...{ date: DAY, duration: { id: String(minutes), minutes, presentation, $type: "DurationValue" }, type: type === null ? null : { name: type, id: "65-1", $type: "WorkItemType" }, text },
	...{ creator: { login: "jane", name: "Jane Doe", $type: "User" }, author: { login: "jane", name: "Jane Doe", $type: "User" }, id, $type: "IssueWorkItem" },
});
const WORK = [workItem("115-0", 300, "5h", "almost there\nsee the wiki", "Testing"), workItem("115-2", 60, "1h", null, null)];
// SHOP-A-2's comments as the documentation's ArticleComment shows them, which has no `deleted`: 251-0 by the token's user,
// 251-1 by jane, which that user may not delete.
const articleComment = (id: string, text: string, login: string, name: string) => ({ id, text, created: DAY, updated: null, pinned: false, reactions: [], attachments: [], visibility: null, author: { login, name, $type: "User" }, article: { idReadable: "SHOP-A-2", $type: "Article" }, $type: "ArticleComment" });

// What the plugin writes, as the fake reads it.
type Written = {
	readonly customFields?: readonly { readonly name: string; readonly value: { readonly name?: string } }[];
	readonly duration?: { readonly minutes: number };
	readonly deleted?: boolean;
	readonly name?: string;
	readonly project?: { readonly id: string };
};
export type Seen = { readonly method: string | undefined; readonly path: string; readonly params: URLSearchParams; readonly authorization: string | undefined; readonly body: Written | undefined; readonly form: FormData | undefined };

// A fake YouTrack on a loopback port the OS picks: the unnamed instance at `/`, holding project SHOP with `issues` issues, and
// `acme` under `/acme`, a server under a path, holding SITE. A wrong token gets YouTrack's 401, its reason echoing the token;
// `/slow` never answers; `/broken` answers HTML. A write is answered as the documentation's samples show; a Priority outside
// the project's values gets a 400 in the documented error shape (`error`, `error_description`), a change of jane's comment a
// 403. SHOP-1 and SITE-1 have attachments, SHOP-2 none, and SHOP-3 one on another server. SHOP's State field holds six states
// in an order other than their ordinals; SITE has none. A delete of SHOP-3, or an attachment to SHOP-2, gets a 403. SHOP-1
// has links, tags and work items; SHOP-2 none. SHOP-A-2 has comments, of which jane's 251-1 its delete gets a 403, and one
// attachment. OPS is another project of the unnamed instance. A new tag named `forbidden` gets a 403 echoing the token.
export async function server(t: TestContext, issues = 3) {
	const seen: Seen[] = [];
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const fake = createServer(async (request: IncomingMessage, response: ServerResponse) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk);
		const type = request.headers["content-type"] ?? "";
		const raw = Buffer.concat(chunks);
		const body: Written | undefined = type.startsWith("application/json") ? JSON.parse(raw.toString("utf8")) : undefined;
		const form = type.startsWith("multipart/form-data") ? await new Request("http://localhost", { method: "POST", headers: { "Content-Type": type }, body: raw }).formData() : undefined;
		seen.push({ method: request.method, path: url.pathname, params: url.searchParams, authorization: request.headers.authorization, body, form });
		if (url.pathname.startsWith("/slow/")) return;
		if (url.pathname.startsWith("/broken/")) return response.writeHead(200, { "Content-Type": "text/html" }).end("<html>Log in</html>");
		const acme = url.pathname.startsWith("/acme/");
		const path = acme ? url.pathname.slice("/acme".length) : url.pathname;
		const [project, token] = acme ? ["SITE", ACME_TOKEN] : ["SHOP", TOKEN];
		if (request.headers.authorization !== `Bearer ${token}`)
			return send(response, 401, { error: "Unauthorized", error_description: `You are not logged in: ${request.headers.authorization ?? ""}` });
		const page = (all: readonly unknown[]) => {
			const skip = Number(url.searchParams.get("$skip") ?? 0);
			return all.slice(skip, skip + Number(url.searchParams.get("$top") ?? 42));
		};
		// `#Unresolved` after the project leaves out the resolved issues, the even-numbered ones here.
		const all = Array.from({ length: acme ? 1 : issues }, (_, index) => issue(project, index + 1));
		if (path === "/api/issues" && url.searchParams.get("query") === `project: ${project}`) return send(response, 200, page(all));
		if (path === "/api/issues" && url.searchParams.get("query") === `project: ${project} #Unresolved`) return send(response, 200, page(all.filter(({ resolved }) => resolved === null)));
		// A search: SHOP-1 and SHOP-3 hold a Critical priority; a query that closes the parenthesis gets another project's issue too.
		if (path === "/api/issues" && url.searchParams.get("query") === "(project: SHOP #Unresolved) and (Priority: Critical)") return send(response, 200, page([issue("SHOP", 1), issue("SHOP", 3)]));
		if (path === "/api/issues" && url.searchParams.get("query") === "(project: SHOP) and (x) or (project: SITE)") return send(response, 200, page([issue("SITE", 1), issue("SHOP", 2)]));
		if (path === "/api/issues" && request.method === "GET") return send(response, 200, []);
		if (path === "/api/articles" && url.searchParams.get("query") === "(project: SHOP) and (release)") return send(response, 200, page([ARTICLE, { ...ARTICLE, idReadable: "SITE-A-1", summary: "Release notes" }]));
		if (path === "/api/articles" && request.method === "GET") return send(response, 200, []);
		if (path === `/api/admin/projects/${project}/customFields`) return send(response, 200, page(acme ? [PRIORITY_FIELD] : [PRIORITY_FIELD, projectField("Story points", "SimpleProjectCustomField", null), STATE_FIELD]));
		// A delete is answered 200 without a body.
		if (request.method === "DELETE" && !acme && ["/api/issues/SHOP-1", "/api/articles/SHOP-A-2", "/api/issues/SHOP-1/attachments/74-1"].includes(path)) return response.writeHead(200).end();
		if (request.method === "DELETE" && path === "/api/issues/SHOP-3") return send(response, 403, { error: "Forbidden", error_description: "You have no permission\nto delete issue SHOP-3" });
		if (request.method === "POST" && path === "/api/issues/SHOP-1/attachments" && !acme) {
			const upload = form?.get("upload");
			return send(response, 200, [{ name: upload instanceof File ? upload.name : "", id: "74-7", $type: "IssueAttachment" }]);
		}
		if (request.method === "POST" && path === "/api/issues/SHOP-2/attachments") return send(response, 403, { error: "Forbidden", error_description: `You may not attach\nfiles to SHOP-2: ${request.headers.authorization ?? ""}` });
		if (path === "/api/issues/SHOP-1" && !acme && request.method === "POST") {
			if (body?.project !== undefined) return send(response, 200, { idReadable: "OPS-1", $type: "Issue" });
			const [field] = body?.customFields ?? [];
			if (field?.name === "Priority" && !PRIORITIES.includes(field.value.name ?? ""))
				return send(response, 400, { error: "bad_request", error_description: `Unknown value ${field.value.name ?? ""}\nfor field Priority` });
			return send(response, 200, { idReadable: "SHOP-1", updated: DAY + 7_200_000, $type: "Issue" });
		}
		if (path === "/api/issues/SHOP-1" && !acme) return send(response, 200, FULL_ISSUE);
		if (path === "/api/issues/SHOP-500" && !acme) return send(response, 500, { error: "server_error", error_description: `Something went\nwrong at ${request.headers.host}` });
		if (path === `/api/admin/projects/${project}/articles`) return send(response, 200, page(acme ? [] : [{ ...ARTICLE, idReadable: "SHOP-A-1", summary: "Handbook", parentArticle: null }, ARTICLE]));
		if (path === "/api/articles/SHOP-A-2" && !acme && request.method === "POST") return send(response, 200, { idReadable: "SHOP-A-2", updated: DAY + 7_200_000, $type: "Article" });
		if (path === "/api/articles/SHOP-A-2" && !acme) return send(response, 200, ARTICLE);
		if (path === `/api/admin/projects/${project}` || path === "/api/admin/projects/OPS") return send(response, 200, { id: acme ? "0-7" : path.endsWith("OPS") ? "0-3" : "0-0", shortName: path.split("/").at(-1), $type: "Project" });
		if (path === "/api/issues/SHOP-2" && request.method === "GET") return send(response, 200, issue("SHOP", 2));
		if (path === "/api/articles/SHOP-A-1" && request.method === "GET") return send(response, 200, { ...ARTICLE, idReadable: "SHOP-A-1", summary: "Handbook", parentArticle: null, id: "226-0" });
		if (path === "/api/issues/SHOP-1/links" || path === "/api/issues/SHOP-2/links") return send(response, 200, page(path.includes("SHOP-1") ? LINKS([issue("SHOP", 3)], [issue("SHOP", 2)]) : LINKS([], [])));
		if (request.method === "POST" && /^\/api\/issues\/SHOP-1\/links\/80-[0-3][st]?\/issues$/.test(path)) return send(response, 200, { ...issue("SHOP", 2), $type: "Issue" });
		if (request.method === "DELETE" && path === "/api/issues/SHOP-1/links/80-1t/issues/2-2") return response.writeHead(200).end();
		if (path === "/api/tags" && request.method === "GET") return send(response, 200, page(TAGS.filter(({ name }) => name.includes((url.searchParams.get("query") ?? "").toLowerCase()))));
		if (path === "/api/tags" && body?.name === "forbidden") return send(response, 403, { error: "Forbidden", error_description: `You may not create\ntags: ${request.headers.authorization ?? ""}` });
		if (path === "/api/tags") return send(response, 200, { name: body?.name, id: "6-9", owner: { login: "arthur", name: "Arthur", $type: "User" }, visibleFor: null, $type: "Tag" });
		if (path === "/api/issues/SHOP-1/tags" && request.method === "POST") return send(response, 200, TAGS[0]);
		if (path === "/api/issues/SHOP-1/tags") return send(response, 200, page([TAGS[0]]));
		if (request.method === "DELETE" && path === "/api/issues/SHOP-1/tags/6-1") return response.writeHead(200).end();
		if (path === "/api/issues/SHOP-1/timeTracking/workItems" && request.method === "GET") return send(response, 200, page(WORK));
		if (request.method === "DELETE" && path === "/api/issues/SHOP-1/timeTracking/workItems/115-0") return response.writeHead(200).end();
		if (request.method === "POST" && path === "/api/issues") return send(response, 200, { idReadable: `${project}-4`, $type: "Issue" });
		if (request.method === "POST" && path === "/api/articles") return send(response, 200, { idReadable: `${project}-A-3`, $type: "Article" });
		if (request.method === "POST" && /^\/api\/issues\/SHOP-1\/timeTracking\/workItems(\/115-[02])?$/.test(path)) {
			const minutes = body?.duration?.minutes ?? 0;
			const duration = { presentation: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes, id: String(minutes), $type: "DurationValue" };
			return send(response, 200, { duration, id: "117-3", $type: "IssueWorkItem" });
		}
		if (path === "/api/issues/SHOP-1/comments" && request.method === "POST") return send(response, 200, { id: "4-20", $type: "IssueComment" });
		if (path === "/api/issues/SHOP-1/comments" && !acme) return send(response, 200, page(COMMENTS));
		if (path === "/api/issues/SHOP-1/comments/4-17") return send(response, 200, { id: "4-17", deleted: body?.deleted === true, $type: "IssueComment" });
		if (path === "/api/issues/SHOP-1/comments/4-18") return send(response, 403, { error: "Forbidden", error_description: "You have no permission\nto update the comment of jane" });
		if (path === "/api/issues/SHOP-2/comments" || path === "/api/issues/SHOP-2/attachments" || path === "/api/issues/SHOP-2/timeTracking/workItems") return send(response, 200, []);
		if (path === "/api/articles/SHOP-A-2/comments" && request.method === "POST") return send(response, 200, { id: "251-3", $type: "ArticleComment" });
		if (path === "/api/articles/SHOP-A-2/comments") return send(response, 200, page([articleComment("251-0", "Check step 2.", "arthur", "Arthur"), articleComment("251-1", "Done.", "jane", "Jane Doe")]));
		if (request.method === "DELETE" && path === "/api/articles/SHOP-A-2/comments/251-0") return response.writeHead(200).end();
		if (request.method === "DELETE" && path === "/api/articles/SHOP-A-2/comments/251-1") return send(response, 403, { error: "Forbidden", error_description: "You have no permission\nto delete the comment of jane" });
		if (path === "/api/articles/SHOP-A-2/comments/251-0") return send(response, 200, { id: "251-0", $type: "ArticleComment" });
		if (path === "/api/articles/SHOP-A-2/attachments" && request.method === "POST") return send(response, 200, [{ name: (form?.get("upload") as File | null)?.name, id: "75-2", $type: "ArticleAttachment" }]);
		if (path === "/api/articles/SHOP-A-2/attachments") return send(response, 200, page([{ ...attachment("75-1", "steps.txt", "/api/files/75-1?sign=MTgz", 4, "text/plain", null), issue: undefined, article: { idReadable: "SHOP-A-2", $type: "Article" }, $type: "ArticleAttachment" }]));
		if (request.method === "DELETE" && path === "/api/articles/SHOP-A-2/attachments/75-1") return response.writeHead(200).end();
		if (path === "/api/issues/SHOP-1/attachments" && !acme) return send(response, 200, page(ATTACHMENTS("")));
		if (path === "/api/issues/SITE-1/attachments" && acme) return send(response, 200, page([attachment("74-5", "notes.txt", "/acme/api/files/74-5?sign=MTgw", 10, "text/plain", null)]));
		if (path === "/api/issues/SHOP-3/attachments") return send(response, 200, page([ATTACHMENTS("")[0], attachment("74-6", "x.png", "http://youtrack.example/api/files/74-6?sign=MTgx", 3, "image/png", null)]));
		// SHOP-4's names: an absolute path, and one holding control characters (a line break, a bell, an escape).
		if (path === "/api/issues/SHOP-4/attachments") {
			const names = ["/etc/cron.d/evil", "line\nbreak\u0007\u001b[2J.txt"];
			return send(response, 200, page(names.map((name, index) => attachment(`74-${index + 1}`, name, `/api/files/74-${index + 1}?sign=MTgy`, 8, "text/plain", null))));
		}
		const file = FILES[path.replace(/^\/api\/files\//, "")];
		if (path.startsWith("/api/files/") && file !== undefined) return response.writeHead(200, { "Content-Type": "application/octet-stream" }).end(file);
		send(response, 404, { error: "Not Found", error_description: "HTTP 404 Not Found" });
	});
	fake.listen(0, "127.0.0.1");
	await once(fake, "listening");
	t.after(() => {
		fake.closeAllConnections();
		fake.close();
	});
	return { url: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`, seen };
}
