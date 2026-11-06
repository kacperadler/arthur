import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { NOTHING, text } from "./dokploy-api.ts";

// What `arthur dokploy upload` sends (AR0603): a ready `.zip` as it is, or a zip of a file or folder, written here since Node
// writes none. A folder's regular files go at the zip's root, as Dokploy's unzipDrop expects; a symlink or special file in it
// is refused, never followed. No zip64: at most 65535 entries, and the whole zip under 4 GiB.

const [ENTRIES, BYTES] = [0xffff, 0xffffffff];
// The zip and what it holds, in words: `3 files, 1200 bytes, as a zip of 640 bytes`.
export type Upload = { readonly zip: Buffer<ArrayBuffer>; readonly said: string };

export function zipOf(path: string): Upload {
	const refuse = (why: string) => new Error(`${text(path)}: ${why}; ${NOTHING}`);
	const look = <T>(read: () => T): T => { try { return read(); } catch (error) { throw refuse(`cannot be read (${(error as NodeJS.ErrnoException).code})`); } };
	const top = look(() => lstatSync(path));
	if (top.isFile() && /\.zip$/i.test(path)) {
		const zip = look(() => readFileSync(path));
		if (zip.subarray(0, 4).equals(Buffer.from("PK\x03\x04"))) return { zip, said: `${text(basename(path))} as it is, ${zip.length} bytes` };
	}
	if (!top.isFile() && !top.isDirectory()) throw refuse(`is ${top.isSymbolicLink() ? "a symlink; give the path it points to" : "no file or folder"}`);
	const found = top.isFile() ? [] : look(() => readdirSync(path, { withFileTypes: true, recursive: true })).map((entry) => ({ entry, each: relative(path, join(entry.parentPath, entry.name)) }));
	const odd = found.find(({ entry }) => !entry.isFile() && !entry.isDirectory());
	if (odd !== undefined) throw refuse(`${text(odd.each)} is ${odd.entry.isSymbolicLink() ? "a symlink" : "a special file"}, not a regular file`);
	const names = top.isFile() ? [basename(path)] : found.filter(({ entry }) => entry.isFile()).map(({ each }) => each).sort();
	if (names.length === 0) throw refuse("is a folder without any file");
	if (names.length > ENTRIES) throw refuse(`holds ${names.length} files, more than the ${ENTRIES} a zip holds`);
	const files = names.map((each) => ({ each, file: top.isFile() ? path : join(path, each) })).map((one) => ({ ...one, stat: look(() => lstatSync(one.file)) }));
	// The largest the zip can come to, every file stored as it is: a header of 30 and 46 bytes and the name twice each, then 22.
	const most = files.reduce((sum, { each, stat }) => sum + stat.size + 76 + 2 * Buffer.byteLength(each), 22);
	if (most > BYTES) throw refuse(`its files come to ${most} bytes as a zip, more than the 4 GiB a zip without zip64 holds`);
	const [parts, central] = [[] as Buffer[], [] as Buffer[]];
	let [offset, bytes] = [0, 0];
	for (const { each, file } of files) {
		const data = look(() => readFileSync(file));
		const deflated = deflateRawSync(data);
		// Stored when deflate does not make it smaller, so the zip never outgrows `most`.
		const [method, body] = deflated.length < data.length ? [8, deflated] : [0, data];
		const named = Buffer.from(each);
		// Flags (UTF-8 names), method, time and date (1980-01-01), CRC-32, sizes, name length, no extra field.
		const common: [number, number][] = [[0x0800, 2], [method, 2], [0, 2], [0x21, 2], [crc32(data), 4], [body.length, 4], [data.length, 4], [named.length, 2], [0, 2]];
		parts.push(le([0x04034b50, 4], [20, 2], ...common), named, body);
		// Made by Unix, zip 2.0; no comment, disk 0; a regular file's mode, 0644 (unzipDrop writes none); where its local header starts.
		central.push(le([0x02014b50, 4], [0x0314, 2], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0o100644 * 0x10000, 4], [offset, 4]), named);
		offset += 30 + named.length + body.length;
		bytes += data.length;
	}
	const dir = Buffer.concat(central);
	const zip = Buffer.concat([...parts, dir, le([0x06054b50, 4], [0, 2], [0, 2], [names.length, 2], [names.length, 2], [dir.length, 4], [offset, 4], [0, 2])]);
	return { zip, said: `${names.length} ${names.length === 1 ? "file" : "files"}, ${bytes} bytes, as a zip of ${zip.length} bytes` };
}

// Little-endian fields, each [value, bytes].
function le(...fields: readonly (readonly [number, number])[]): Buffer {
	const out = Buffer.alloc(fields.reduce((sum, [, size]) => sum + size, 0));
	fields.reduce((at, [value, size]) => (size === 2 ? out.writeUInt16LE(value, at) : out.writeUInt32LE(value, at)), 0);
	return out;
}
