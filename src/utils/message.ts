/* utils/message.ts — assembles content blocks for SENDING a message to a chat/comment.
   Boosty format: an array of blocks; the content field is a JSON string ["text","unstyled",[]]. */

export type ContentBlock = Record<string, unknown>;

export function textBlock(text: string): ContentBlock {
    return { type: "text", content: JSON.stringify([text, "unstyled", []]), modificator: "" };
}

export function linkBlock(url: string): ContentBlock {
    return { type: "link", content: JSON.stringify([url, "unstyled", []]), url, explicit: false };
}

/**
 * Convenience builder: an array of strings/links → blocks.
 * A `{ link: "https://..." }` item becomes a link block; a string becomes a text block.
 */
export function buildMessage(parts: Array<string | { link: string }>): ContentBlock[] {
    return parts.map((p) => (typeof p === "string" ? textBlock(p) : linkBlock(p.link)));
}
