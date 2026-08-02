/**
 * Tenant object storage for Tenzro Network.
 *
 * Files are erasure-coded across independent providers and paid for by a
 * streaming storage deal. The shape mirrors OpenAI's files API, so code that
 * already calls `client.files.create(...)` against a vendor endpoint reads the
 * same here.
 *
 * ## Two things worth knowing before you store anything
 *
 * **The API key's subject owns the file** — not the node, not the caller's
 * wallet, but the DID recorded as the key's `subject` at issuance. Two keys
 * with different subjects are two different tenants: a file uploaded with one
 * is invisible to the other, and there is no cross-tenant read. Use a key
 * issued with the `storage` scope; anything else is refused before the upload
 * starts.
 *
 * **Deletion is not erasure.** Objects are content-addressed and erasure-coded
 * across providers this node does not control, so {@link FilesClient.delete}
 * unlinks your reference and stops the deal paying for the shards — it cannot
 * reach into every provider holding one and wipe it. Shards expire when the
 * deal stops funding them. Do not treat deletion as redaction, and do not store
 * material where that distinction matters.
 */

import { RpcClient } from "./rpc";

/** What a file is for, mirroring OpenAI's `purpose`. */
export type FilePurpose =
	| "assistants"
	| "batch"
	| "fine_tune"
	| "vision"
	| "user_data";

/** A stored file. */
export interface FileObject {
	/** Opaque id, `file-<uuid>`. */
	id: string;
	/** Always `"file"`. */
	object: string;
	/** Size in bytes. */
	bytes: number;
	/** Unix seconds. */
	created_at: number;
	/** Original filename. */
	filename: string;
	/** What it is for. */
	purpose: FilePurpose;
	/** The owning tenant's DID. */
	owner: string;
	/**
	 * The storage deal funding its shards. `null` means the bytes are stored
	 * but nothing is paying to keep them — the operator is carrying it, and it
	 * should not be relied on to persist.
	 */
	deal_id: string | null;
}

/** A page of a tenant's files. */
export interface FileList {
	/** Always `"list"`. */
	object: string;
	/** The files, newest first. */
	data: FileObject[];
	/** Everything this tenant is storing on the node, not only this page. */
	total_bytes: number;
}

/** The outcome of a delete. */
export interface FileDeletion {
	/** The id that was unlinked. */
	id: string;
	/** Always `"file"`. */
	object: string;
	/** Whether the reference was removed. */
	deleted: boolean;
	/**
	 * What deletion actually did. Returned on every call, because
	 * `deleted: true` alone invites exactly the wrong conclusion.
	 */
	note: string;
}

/** What a tenant is storing, and what it bills against. */
export interface StorageUsage {
	owner: string;
	file_count: number;
	total_bytes: number;
	files_with_open_deal: number;
	/**
	 * Files stored but unbilled. Non-zero means some of your data is not funded
	 * and may not survive.
	 */
	files_without_open_deal: number;
	/** The derived address deals settle against. */
	renter_address: string;
}

/** Options for {@link FilesClient.list}. */
export interface ListFilesOptions {
	purpose?: FilePurpose;
	/** How many to return, newest first. The node clamps this to 1000. */
	limit?: number;
}

/**
 * Base64 for a byte array, working in both Node and the browser.
 *
 * `Buffer` exists only in Node; `btoa` only in the browser. Feature-detecting
 * rather than picking one means the SDK does not silently become
 * Node-only the first time someone bundles it for the web.
 */
function toBase64(data: Uint8Array): string {
	const g = globalThis as {
		Buffer?: { from(d: Uint8Array): { toString(enc: string): string } };
	};
	if (typeof g.Buffer !== "undefined") {
		return g.Buffer.from(data).toString("base64");
	}
	let binary = "";
	for (const byte of data) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** Inverse of {@link toBase64}. */
function fromBase64(b64: string): Uint8Array {
	const g = globalThis as {
		Buffer?: { from(s: string, enc: string): Uint8Array };
	};
	if (typeof g.Buffer !== "undefined") {
		return new Uint8Array(g.Buffer.from(b64, "base64"));
	}
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

/** Object-storage client. */
export class FilesClient {
	constructor(private readonly rpc: RpcClient) {}

	/**
	 * Stores `data` as a file owned by the API key's subject.
	 *
	 * The bytes are erasure-coded (4 data + 2 parity shards, surviving two
	 * simultaneous provider losses) and a storage deal is opened to pay for
	 * them. Check `deal_id` on the result: a `null` there means the upload
	 * succeeded but nothing is funding it.
	 *
	 * @example
	 * ```ts
	 * const bytes = await fs.promises.readFile("corpus.jsonl");
	 * const file = await client.files.upload("corpus.jsonl", bytes, "assistants");
	 * console.log(`stored ${file.id} (${file.bytes} bytes)`);
	 * ```
	 */
	async upload(
		filename: string,
		data: Uint8Array,
		purpose: FilePurpose = "user_data",
	): Promise<FileObject> {
		return this.rpc.call("tenzro_uploadFile", [
			{ filename, data: toBase64(data), purpose },
		]);
	}

	/**
	 * Lists the caller's own files, newest first.
	 *
	 * Never returns another tenant's files — the listing is scoped to the
	 * subject on the presented key, server-side.
	 */
	async list(options: ListFilesOptions = {}): Promise<FileList> {
		return this.rpc.call("tenzro_listFiles", [options]);
	}

	/**
	 * Fetches one file's record.
	 *
	 * A file owned by another tenant reports the same "no such file" as one
	 * that never existed, so ownership cannot be probed by guessing ids.
	 */
	async get(fileId: string): Promise<FileObject> {
		return this.rpc.call("tenzro_getFile", [{ file_id: fileId }]);
	}

	/** Retrieves a file's contents, rebuilt from its shards. */
	async download(fileId: string): Promise<Uint8Array> {
		const result = await this.rpc.call<{ data: string }>(
			"tenzro_downloadFile",
			[{ file_id: fileId }],
		);
		return fromBase64(result.data);
	}

	/**
	 * Unlinks a file and stops its storage deal.
	 *
	 * This is **not** erasure — read `note` on the result, and the module
	 * documentation, before relying on it for anything.
	 */
	async delete(fileId: string): Promise<FileDeletion> {
		return this.rpc.call("tenzro_deleteFile", [{ file_id: fileId }]);
	}

	/** What the caller is storing on this node, and what it bills against. */
	async usage(): Promise<StorageUsage> {
		return this.rpc.call("tenzro_fileStorageUsage", []);
	}
}
