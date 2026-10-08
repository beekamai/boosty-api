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

const isInline = (b: unknown): b is Content =>
    !!b && typeof b === "object" && ["text", "header", "link"].includes((b as Content).type);

/** A paragraph ends at a non-inline block or at an empty BLOCK_END block; non-objects are skipped, as in renderText. */
const endsParagraph = (block: unknown, text: string): boolean =>
    !!block && typeof block === "object" && (!isInline(block) || (!text && (block as Content).modificator === "BLOCK_END"));

/** The low half of a surrogate pair that Boosty saved as the six characters "\udXXX". */
const ESCAPED_LOW = /^\\u(d[c-f][0-9a-f]{2})/i;

/** Copies a block with its prototype; own keys are defined, never assigned, so a "__proto__" key stays plain data. */
function copyBlock(block: Content): Content {
    const copy = Object.create(Object.getPrototypeOf(block));
    for (const key of Object.keys(block)) {
        Object.defineProperty(copy, key, { value: (block as any)[key], writable: true, enumerable: true, configurable: true });
    }
    return copy;
}

/** Characters removed at original paragraph offset `at`; positions map through all of them in one sorted pass. */
interface Cut {
    at: number;
    removed: number;
}

function mapper(cuts: Cut[]): (pos: number) => number {
    const starts = cuts.map((c) => c.at);
    const before: number[] = [0];
    for (const c of cuts) before.push(before[before.length - 1] + c.removed);
    return (pos) => {
        let lo = 0;
        let hi = cuts.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (starts[mid] < pos) lo = mid + 1;
            else hi = mid;
        }
        /* Cuts 0..lo-1 start before pos: all but the last are fully before it, the last may contain it. */
        if (lo === 0) return pos;
        const last = cuts[lo - 1];
        return pos - before[lo - 1] - Math.min(pos - last.at, last.removed);
    };
}

/**
 * Repairs two artifacts of the Boosty editor found in real posts, on a copy of the blocks:
 * - an emoji split between a link and the next block, its second half saved as the literal text "\udXXX":
 *   the pair is joined back inside the link;
 * - an auto-detected link that swallowed the next word into its URL (link text ".../privacy_policy/", URL
 *   ".../privacy_policy/Далее", then a blank block or a paragraph break, then text starting with "Далее"):
 *   the URL is cut back to the link text. Only links Boosty detected itself (`explicit: false`) are touched.
 * Linear in the size of the blocks; malformed blocks are left as they are.
 * @experimental Heuristics drawn from 859 public posts with one case of each; the rules may change.
 */
export function repairBlocks(blocks: readonly Content[]): Content[] {
    const out = blocks.map((b) => (b && typeof b === "object" ? copyBlock(b) : b));
    /* One parse per block; text follows renderText (String of the first item), edits happen only on string texts. */
    const parsed = out.map((b) => (isInline(b) ? parseArray(b.content) : null));
    const textOf = (i: number) => String(parsed[i]?.[0] ?? "");
    /* Cuts are kept in the original coordinates, so offsets advance by the lengths before any edit. */
    const lengths = out.map((_, i) => textOf(i).length);
    const dirty = new Set<number>();
    /* Paragraph number of every block: a repair that cannot be serialized is undone for its whole paragraph. */
    const paragraphOf: number[] = [];
    let paragraphNo = 0;

    let paragraph: number[] = [];
    let cuts: Cut[] = [];
    let offset = 0;
    const closeParagraph = () => {
        if (cuts.length) {
            const move = mapper(cuts);
            for (const j of paragraph) {
                const ranges = parsed[j]?.[2];
                if (!Array.isArray(ranges) || !ranges.some(isRange)) continue;
                parsed[j]![2] = ranges.map((r) => (isRange(r) ? [r[0], move(r[1]), move(r[1] + r[2]) - move(r[1])] : r));
                dirty.add(j);
            }
        }
        paragraph = [];
        cuts = [];
        offset = 0;
        paragraphNo++;
    };

    for (let i = 0; i < out.length; i++) {
        const block = out[i];
        if (endsParagraph(block, textOf(i))) {
            closeParagraph();
            continue;
        }
        paragraphOf[i] = paragraphNo;
        const p = parsed[i];
        if (!p) continue;
        paragraph.push(i);

        const next = out[i + 1];
        const np = parsed[i + 1];
        const low = np && typeof np[0] === "string" ? ESCAPED_LOW.exec(np[0]) : null;
        if (block.type === "link" && typeof p[0] === "string" && /[\ud800-\udbff]$/.test(p[0]) && low && next) {
            p[0] += String.fromCharCode(parseInt(low[1], 16));
            np![0] = (np![0] as string).slice(6);
            /* An emptied block with BLOCK_END would read as a paragraph end, which it was not. */
            if (!np![0] && next.modificator === "BLOCK_END") next.modificator = "";
            dirty.add(i).add(i + 1);
            /* The escape began where the next block began: its first character now holds the low half, 5 are gone. */
            cuts.push({ at: offset + lengths[i] + 1, removed: 5 });
        }

        const text = textOf(i);
        if (block.type === "link" && block.explicit === false && typeof block.url === "string" && text) {
            const tail = block.url.startsWith(text) ? block.url.slice(text.length) : "";
            if (tail && !/\s/.test(tail) && wordAfterBreak(out, parsed, i + 1, tail)) block.url = text;
        }
        offset += lengths[i];
    }
    closeParagraph();

    const failed = new Set<number>();
    for (const i of dirty) {
        try {
            out[i].content = JSON.stringify(parsed[i]);
        } catch {
            failed.add(paragraphOf[i]);
        }
    }
    /* A block too deep to serialize: its paragraph goes back to the input, a half-applied join would render worse. */
    if (failed.size) out.forEach((_, i) => failed.has(paragraphOf[i]) && (out[i] = blocks[i]));
    return out;
}

/** The content array of an inline block, or null when it does not parse or its text cannot be read (as renderText). */
function parseArray(content: unknown): unknown[] | null {
    if (typeof content !== "string" || !content) return null;
    try {
        const value = JSON.parse(content);
        if (!Array.isArray(value)) return null;
        String(value[0] ?? ""); // throws for objects like {"toString":1}, which renderText reads as empty
        return value;
    } catch {
        return null;
    }
}

/**
 * True when the link at `from - 1` is followed by a blank inline block or a paragraph break, and the first
 * text after that starts with `tail`. A word right next to the link is the author's, not a swallowed one.
 */
function wordAfterBreak(blocks: readonly unknown[], parsed: readonly (unknown[] | null)[], from: number, tail: string): boolean {
    let crossedBlank = false;
    for (let j = from; j < blocks.length && j < from + 8; j++) {
        const block = blocks[j];
        if (!block || typeof block !== "object") continue;
        if (!isInline(block)) return false;
        const text = String(parsed[j]?.[0] ?? "");
        /* An empty block renders nothing, so it is neither a gap nor the word; a paragraph end or spaces are a gap. */
        if (!text) {
            if ((block as Content).modificator === "BLOCK_END") crossedBlank = true;
            continue;
        }
        if (!text.trim()) {
            crossedBlank = true;
            continue;
        }
        return crossedBlank && text.trimStart().startsWith(tail);
    }
    return false;
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
    options: {
        header?: string;
        placeholder?: string;
        fixLongNewlines?: boolean;
        fixEndNewlines?: boolean;
        /** Run `repairBlocks` first (experimental). */
        repair?: boolean;
    } = {}
): [string, Entity[]] {
    const { header = "", placeholder = "\n\n", fixLongNewlines = true, fixEndNewlines = true } = options;
    const entities: Entity[] = [];

    // If postData is missing, empty or not a list of blocks, return just the header
    if (!Array.isArray(postData) || postData.length === 0) {
        return [header, entities];
    }
    if (options.repair) postData = repairBlocks(postData);

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
