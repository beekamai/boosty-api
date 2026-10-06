import { Content, type ListItem } from "../types/content";

export interface Entity {
    type: string;
    offset: number;
    length: number;
    url?: string;
}

/**
 * The content field of Boosty text blocks is a JSON string like `["text","unstyled",[...]]`.
 * Returns the first element (the text itself), or "" on any parse error.
 */
function parseContentText(content: string | undefined | null): string {
    if (!content) return "";
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? String(parsed[0] ?? "") : "";
    } catch {
        return "";
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

    /** Appends a text, header or link block; a header gets a line of its own. Returns false for any other block type. */
    const appendInline = (content: Content): boolean => {
        if (content.type !== "text" && content.type !== "header" && content.type !== "link") return false;
        const rawText = parseContentText(content.content);
        if (!rawText) return true;
        const isHeader = content.type === "header";
        if (isHeader && text && !text.endsWith("\n")) text += "\n";
        text += rawText;
        if (isHeader) text += "\n";
        if (content.type === "link") {
            entities.push({
                type: "text_link",
                url: content.url,
                offset: text.length - rawText.length,
                length: rawText.length,
            });
        }
        return true;
    };

    /** Appends list items one per line ("- " or "1. "), nested items indented by two spaces. */
    const appendList = (items: ListItem[], style: string, depth: number): void => {
        items.forEach((item, index) => {
            if (text && !text.endsWith("\n")) text += "\n";
            text += "  ".repeat(depth) + (style === "ordered" ? `${index + 1}. ` : "- ");
            item.data.forEach(appendInline);
            appendList(item.items, style, depth + 1);
        });
    };

    for (const content of postData) {
        if (fixLongNewlines) while (text.endsWith("\n\n\n\n")) text = text.slice(0, -1);
        if (appendInline(content)) continue;
        if (content.type === "list") {
            appendList(content.items ?? [], content.style, 0);
            text += "\n";
        } else if (text) {
            text = text.trim() + placeholder;
        }
    }

    if (fixEndNewlines) while (text.endsWith("\n")) text = text.slice(0, -1);
    return [text, entities];
}