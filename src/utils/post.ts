import { Content, type ListItem } from "../types/content";

/** Telegram-like entity: `text_link` (with `url`), `bold`, `italic` or `underline`. Offsets are in UTF-16 units. */
export interface Entity {
    type: string;
    offset: number;
    length: number;
    url?: string;
}

/** Format codes of the styled ranges inside a text block. A Map: the codes come from the API and must not reach Object.prototype keys. */
const FORMATS = new Map<number, string>([[0, "bold"], [2, "italic"], [4, "underline"]]);

/** Deeper list levels are indented like this one, so the output cannot grow with the nesting a post carries. */
const MAX_LIST_INDENT = 8;

/** A styled range: [format, offset from the paragraph start, length]. */
type Range = [number, number, number];

const isRange = (r: unknown): r is Range =>
    Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]) && Number.isFinite(r[2]);

/**
 * The content field of Boosty text blocks is a JSON string like `["text","unstyled",[[format,offset,length],...]]`.
 * Returns the text and its well-formed styled ranges, or `["", []]` on any parse error.
 */
function parseContent(content: unknown): [string, Range[]] {
    if (typeof content !== "string" || !content) return ["", []];
    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return ["", []];
        return [String(parsed[0] ?? ""), Array.isArray(parsed[2]) ? parsed[2].filter(isRange) : []];
    } catch {
        return ["", []];
    }
}

function trailingNewlines(s: string): number {
    let i = s.length;
    while (i > 0 && s.charCodeAt(i - 1) === 10) i--;
    return s.length - i;
}

/**
 * Renders content blocks to plain text plus Telegram-like entities.
 * The blocks are written by blog authors and commenters: malformed ones are skipped, never thrown on,
 * and the work stays linear in the size of the input.
 */
export function renderText(
    postData: Content[] | undefined | null,
    options: { header?: string; placeholder?: string; fixLongNewlines?: boolean; fixEndNewlines?: boolean } = {}
): [string, Entity[]] {
    const { header = "", placeholder = "\n\n", fixLongNewlines = true, fixEndNewlines = true } = options;
    const entities: Entity[] = [];

    // If postData is missing, empty or not a list of blocks, return just the header
    if (!Array.isArray(postData) || postData.length === 0) {
        return [header, entities];
    }

    /** Output pieces, joined once at the end: no step reads or copies the text accumulated so far. */
    const parts: string[] = [];
    let size = 0;
    /** Whitespace and newlines at the end of the output, counted from the appended pieces. */
    let spaces = 0;
    let newlines = 0;
    /** End of the block each entity came from. Non-decreasing, so trimming only has to look at the tail. */
    const blockEnds: number[] = [];
    /** Where the current paragraph begins in the output: the styled ranges of its blocks are relative to this point. */
    let paragraphStart = 0;

    const append = (s: string): void => {
        if (!s) return;
        parts.push(s);
        size += s.length;
        const ws = s.length - s.trimEnd().length;
        const nl = trailingNewlines(s);
        spaces = ws === s.length ? spaces + ws : ws;
        newlines = nl === s.length ? newlines + nl : nl;
    };

    /**
     * Drops `count` characters of trailing whitespace and clips the entities that ran past the new end.
     * Callers drop either at most `newlines` characters or all of `spaces`.
     */
    const trimTail = (count: number): void => {
        count = Math.min(count, spaces);
        if (count <= 0) return;
        const length = size - count;
        for (let left = count; left > 0; ) {
            const last = parts[parts.length - 1];
            if (last.length <= left) {
                parts.pop();
                left -= last.length;
            } else {
                parts[parts.length - 1] = last.slice(0, last.length - left);
                left = 0;
            }
        }
        newlines = count <= newlines ? newlines - count : 0;
        spaces -= count;
        size = length;
        // Characters removed inside the current paragraph still count in its styled ranges
        paragraphStart = paragraphStart < length ? paragraphStart - count : length;

        let from = entities.length;
        while (from > 0 && blockEnds[from - 1] > length) from--;
        let kept = from;
        for (let i = from; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.offset >= length) continue;
            entity.length = Math.min(entity.length, length - entity.offset);
            entities[kept] = entity;
            blockEnds[kept] = length;
            kept++;
        }
        entities.length = kept;
        blockEnds.length = kept;
    };

    const pushEntity = (entity: Entity): void => {
        entities.push(entity);
        blockEnds.push(size);
    };

    /**
     * Appends a text, header or link block; an empty BLOCK_END block ends the paragraph.
     * Returns true when the block is consumed (non-objects are dropped), false for any other block type.
     */
    const appendInline = (content: Content | null | undefined): boolean => {
        if (!content || typeof content !== "object") return true;
        if (content.type !== "text" && content.type !== "header" && content.type !== "link") return false;
        const [rawText, ranges] = parseContent(content.content);
        if (!rawText) {
            if (content.modificator === "BLOCK_END") {
                if (size) append("\n");
                paragraphStart = size;
            }
            return true;
        }
        const offset = size;
        append(rawText);
        if (content.type === "link") pushEntity({ type: "text_link", url: content.url, offset, length: rawText.length });
        for (const [format, start, length] of ranges) {
            const type = FORMATS.get(format);
            // Ranges count from the start of the paragraph, not of the block; keep the part that falls inside this block
            const from = Math.max(paragraphStart + start, offset);
            const to = Math.min(paragraphStart + start + length, size);
            if (type && to > from) pushEntity({ type, offset: from, length: to - from });
        }
        return true;
    };

    /** Appends list items one per line ("- " or "1. "), nested items indented by two spaces. Iterative: nesting depth is up to the post. */
    const appendList = (items: unknown, style: unknown): void => {
        const stack: { items: unknown[]; index: number; depth: number }[] = [];
        if (Array.isArray(items)) stack.push({ items, index: 0, depth: 0 });
        while (stack.length) {
            const frame = stack[stack.length - 1];
            if (frame.index >= frame.items.length) {
                stack.pop();
                continue;
            }
            const index = frame.index++;
            const item = frame.items[index] as Partial<ListItem> | null;
            if (!item || typeof item !== "object") continue;
            if (size && newlines === 0) append("\n");
            append("  ".repeat(Math.min(frame.depth, MAX_LIST_INDENT)) + (style === "ordered" ? `${index + 1}. ` : "- "));
            paragraphStart = size;
            if (Array.isArray(item.data)) item.data.forEach(appendInline);
            if (Array.isArray(item.items) && item.items.length) stack.push({ items: item.items, index: 0, depth: frame.depth + 1 });
        }
    };

    append(String(header));
    paragraphStart = size;

    for (const content of postData) {
        if (fixLongNewlines && newlines > 3) trimTail(newlines - 3);
        if (appendInline(content)) continue;
        if (content.type === "list") {
            appendList(content.items, content.style);
            append("\n");
        } else if (size) {
            // Only trailing whitespace goes: cutting leading whitespace would shift the offsets of the entities already collected
            trimTail(spaces);
            append(String(placeholder));
        }
        paragraphStart = size;
    }

    if (fixEndNewlines) trimTail(newlines);
    return [parts.join(""), entities];
}
