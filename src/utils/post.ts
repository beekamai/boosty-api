import { Content, Text, Link } from "../types/content";

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

    for (const content of postData) {
        if (fixLongNewlines) while (text.endsWith("\n\n\n\n")) text = text.slice(0, -1);
        if (content.type === "text") {
            const textContent = content as Text;
            const rawText = parseContentText(textContent.content);
            if (!rawText) continue;
            text += rawText;
        } else if (content.type === "link") {
            const linkContent = content as Link;
            const rawText = parseContentText(linkContent.content);
            if (!rawText) continue;
            text += rawText;
            entities.push({
                type: "text_link",
                url: linkContent.url,
                offset: text.length - rawText.length,
                length: rawText.length,
            });
        } else if (text) {
            text = text.trim() + placeholder;
        }
    }

    if (fixEndNewlines) while (text.endsWith("\n")) text = text.slice(0, -1);
    return [text, entities];
}