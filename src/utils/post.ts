import { Content, type ListItem } from "../types/content";

/** Telegram-like entity: `text_link` (with `url`), `bold`, `italic` or `underline`. Offsets are in UTF-16 units. */
export interface Entity {
    type: string;
    offset: number;
    length: number;
    url?: string;
}

/** Format codes of the styled ranges inside a text block. */
const FORMATS: Record<number, string> = { 0: "bold", 2: "italic", 4: "underline" };

/**
 * The content field of Boosty text blocks is a JSON string like `["text","unstyled",[[format,offset,length],...]]`.
 * Returns the text and its styled ranges, or `["", []]` on any parse error.
 */
function parseContent(content: string | undefined | null): [string, [number | null, number, number][]] {
    if (!content) return ["", []];
    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return ["", []];
        return [String(parsed[0] ?? ""), Array.isArray(parsed[2]) ? parsed[2] : []];
    } catch {
        return ["", []];
    }
}

export function renderText(
    postData: Content[] | undefined | null,
    options: { header?: string; placeholder?: string; fixLongNewlines?: boolean; fixEndNewlines?: boolean } = {}
): [string, Entity[]] {
    const { header = "", placeholder = "\n\n", fixLongNewlines = true, fixEndNewlines = true } = options;
    let text = header;
    const entities: Entity[] = [];

    // If postData is missing or empty, return an empty result
    if (!postData || postData.length === 0) {
        return [text, entities];
    }

    /** Where the current paragraph begins in `text`: the styled ranges of its blocks are relative to this point. */
    let paragraphStart = text.length;

    /** Appends a text, header or link block; an empty BLOCK_END block ends the paragraph. Returns false for any other block type. */
    const appendInline = (content: Content): boolean => {
        if (content.type !== "text" && content.type !== "header" && content.type !== "link") return false;
        const [rawText, formats] = parseContent(content.content);
        if (!rawText) {
            if (content.modificator === "BLOCK_END") {
                if (text) text += "\n";
                paragraphStart = text.length;
            }
            return true;
        }
        const offset = text.length;
        text += rawText;
        if (content.type === "link") entities.push({ type: "text_link", url: content.url, offset, length: rawText.length });
        for (const [format, start, length] of formats) {
            const type = format === null ? undefined : FORMATS[format];
            // Ranges count from the start of the paragraph, not of the block; keep the part that falls inside this block
            const from = Math.max(paragraphStart + start, offset);
            const to = Math.min(paragraphStart + start + length, text.length);
            if (type && to > from) entities.push({ type, offset: from, length: to - from });
        }
        return true;
    };

    /** Appends list items one per line ("- " or "1. "), nested items indented by two spaces. */
    const appendList = (items: ListItem[], style: string, depth: number): void => {
        items.forEach((item, index) => {
            if (text && !text.endsWith("\n")) text += "\n";
            text += "  ".repeat(depth) + (style === "ordered" ? `${index + 1}. ` : "- ");
            paragraphStart = text.length;
            item.data.forEach(appendInline);
            appendList(item.items, style, depth + 1);
        });
    };

    for (const content of postData) {
        if (fixLongNewlines) while (text.endsWith("\n\n\n\n")) text = text.slice(0, -1);
        paragraphStart = Math.min(paragraphStart, text.length);
        if (appendInline(content)) continue;
        if (content.type === "list") {
            appendList(content.items ?? [], content.style, 0);
            text += "\n";
        } else if (text) {
            // trimEnd, not trim: cutting leading whitespace would shift the offsets of the entities already collected
            text = text.trimEnd() + placeholder;
        }
        paragraphStart = text.length;
    }

    if (fixEndNewlines) while (text.endsWith("\n")) text = text.slice(0, -1);
    return [text, entities];
}