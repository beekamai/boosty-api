/* renderText: the behaviour every version so far agrees on. */
import { describe, expect, test } from "bun:test";
import { renderText } from "../src";

const text = (s: string) => ({ type: "text", content: JSON.stringify([s, "unstyled", []]), modificator: "" });
const link = (s: string, url: string) => ({ type: "link", content: JSON.stringify([s, "unstyled", []]), url, modificator: "" });

describe("renderText", () => {
    test("empty input", () => {
        expect(renderText(null)).toEqual(["", []]);
        expect(renderText([])).toEqual(["", []]);
    });

    test("link becomes a text_link entity over its own text", () => {
        const [out, entities] = renderText([text("Hello "), link("world", "https://boosty.to")]);
        expect(out).toBe("Hello world");
        expect(entities).toEqual([{ type: "text_link", url: "https://boosty.to", offset: 6, length: 5 }]);
    });

    test("media blocks turn into the placeholder", () => {
        expect(renderText([text("a"), { type: "image", url: "u" }, text("b")])[0]).toBe("a\n\nb");
    });

    test("malformed content is skipped, not thrown", () => {
        expect(renderText([{ type: "text", content: "{not json", modificator: "" }, text("ok")])[0]).toBe("ok");
    });
});
