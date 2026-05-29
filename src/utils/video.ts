import type { API } from "../client";
import { Video, PlayerUrl } from "../types/media-types";

/** Decodes HTML entities found in the player's data-options attribute. */
function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

/**
 * Extracts the list of available video sizes from the external player's HTML page (ok.ru).
 * Parses the embedded JSON `data-options` → flashvars.metadata.videos.
 */
export async function getVideoSizes(api: API, name: string, content: Video): Promise<PlayerUrl[]> {
    const response = await fetch(content.url, {
        headers: { "User-Agent": api.auth.headers["User-Agent"] ?? "", referer: `https://boosty.to/${name}` },
    });
    const playerHtml = await response.text();

    const marker = "data-options=";
    const ind = playerHtml.indexOf(marker);
    if (ind === -1) throw new Error("data-options not found in player HTML");

    /* After `data-options="` comes the attribute value up to the next quote. */
    const doIndex = ind + marker.length + 1; // +1 — the attribute's opening quote
    const endIndex = playerHtml.indexOf('"', doIndex);
    if (endIndex === -1) throw new Error("Malformed data-options attribute in player HTML");

    /* FIX: HTML entities (&quot; etc.) must be decoded before JSON.parse. */
    const videoDataRaw = decodeHtmlEntities(playerHtml.slice(doIndex, endIndex));

    let sizesList: Array<{ url: string; name: string }>;
    try {
        const videoData = JSON.parse(videoDataRaw);
        sizesList = JSON.parse(videoData.flashvars.metadata).videos;
    } catch (e) {
        throw new Error(`Failed to parse video metadata: ${String(e)}`);
    }

    return sizesList.map((size) => new PlayerUrl({ url: size.url, type: size.name }));
}
