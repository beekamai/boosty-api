/* renderText: paragraphs, styles, headers and lists, and the malformed input blog authors can put into a post. */
import { describe, expect, test } from "bun:test";
import { renderText, type Entity } from "../src";

const text = (s: string, styles: unknown[] = []) => ({ type: "text", content: JSON.stringify([s, "unstyled", styles]), modificator: "" });
const end = () => ({ type: "text", content: "", modificator: "BLOCK_END" });
const link = (s: string, url: string, styles: unknown[] = []) => ({ type: "link", content: JSON.stringify([s, "unstyled", styles]), url, modificator: "" });
const list = (items: unknown, style = "unordered") => ({ type: "list", style, items });
const render = (blocks: unknown[], options = {}) => renderText(blocks as any, options);
const pieces = (out: string, entities: Entity[]) => entities.map((e) => [e.type, out.slice(e.offset, e.offset + e.length)]);

describe("renderText blocks", () => {
    test("BLOCK_END separates paragraphs", () => {
        expect(render([text("one"), end(), text("two"), end()])[0]).toBe("one\ntwo");
    });

    test("styled ranges are relative to the paragraph, not the block", () => {
        const [out, entities] = render([
            text("Hello ", [[0, 0, 5]]), link("world", "https://x", [[2, 6, 5]]), text(" again", [[4, 11, 6]]), end(),
            text("Second", [[0, 0, 6]]), end(),
        ]);
        expect(out).toBe("Hello world again\nSecond");
        expect(pieces(out, entities)).toEqual([
            ["bold", "Hello"], ["text_link", "world"], ["italic", "world"], ["underline", " again"], ["bold", "Second"],
        ]);
    });

    test("header and nested ordered list", () => {
        const [out, entities] = render([
            { type: "header", content: JSON.stringify(["Title", "unstyled", []]), modificator: "" }, end(),
            list([{ data: [text("one", [[0, 0, 3]])], items: [{ data: [text("nested")], items: [] }] }, { data: [text("two")], items: [] }], "ordered"),
            text("after"),
        ]);
        expect(out).toBe("Title\n1. one\n  1. nested\n2. two\nafter");
        expect(pieces(out, entities)).toEqual([["bold", "one"]]);
    });

    test("unknown, zero-length and out-of-block ranges are dropped or clipped", () => {
        const [out, entities] = render([text("abc", [[0, 1, 10], [2, 0, 0], [null, 0, 2], [7, 0, 2]])]);
        expect(pieces(out, entities)).toEqual([["bold", "bc"]]);
    });
});

describe("renderText on malformed input", () => {
    const cases: [string, unknown[]][] = [
        ["style entries that are not triples", [text("hello", [0, null, {}, "abc", [0, "1", "2"]])]],
        ["list item without items", [list([{ data: [text("a")] }])]],
        ["list item without data", [list([{ items: [] }])]],
        ["null list item", [list([null])]],
        ["list items not an array", [list("x"), list({})]],
        ["null and non-object blocks inside an item", [list([{ data: [null, 5], items: [] }])]],
        ["item data not an array", [list([{ data: {}, items: [] }])]],
        ["top-level null block", [null, text("ok")]],
        ["non-string content", [{ type: "text", content: 123 }, { type: "text", content: {} }, { type: "link", content: [1] }]],
    ];
    for (const [name, blocks] of cases) {
        test(name, () => expect(() => render(blocks)).not.toThrow());
    }

    test("format codes never resolve to Object.prototype members", () => {
        const [, entities] = render([text("hello", [["__proto__", 0, 5], ["constructor", 0, 5], ["toString", 0, 2]])]);
        expect(entities).toEqual([]);
    });

    test("deep nesting stays linear: indentation is capped", () => {
        let items: unknown[] = [];
        for (let i = 0; i < 20000; i++) items = [{ data: [text("x")], items }];
        const started = performance.now();
        const [out] = render([list(items)]);
        expect(performance.now() - started).toBeLessThan(2000);
        expect(out.split("\n").length).toBe(20000);
        expect(Math.max(...out.split("\n").map((l) => l.length))).toBeLessThanOrEqual(2 * 8 + 3);
    });

    /* Each of these was quadratic at some point: 50k blocks took seconds. Linear work does them in tens of ms. */
    const linear = (name: string, blocks: () => unknown[]) =>
        test(`stays linear: ${name}`, () => {
            const input = blocks();
            const started = performance.now();
            expect(() => render(input)).not.toThrow();
            expect(performance.now() - started).toBeLessThan(1000);
        });
    const N = 50000;
    linear("text and images interleaved", () => Array.from({ length: N }, (_, i) => (i % 2 ? { type: "image" } : text("word "))));
    linear("many styles, then many images", () => [text("x", Array.from({ length: N }, () => [0, 0, 1])), ...Array.from({ length: N }, () => ({ type: "image" }))]);
    linear("blocks ending in long newlines", () => Array.from({ length: N }, () => text("line\n\n\n\n\n")));
    linear("text blocks", () => Array.from({ length: N }, () => text("word ", [[0, 0, 4]])));

    test("entities are clipped when trailing whitespace is trimmed", () => {
        const [out, entities] = render([text("bold     ", [[0, 0, 9]]), { type: "image" }]);
        expect(out).toBe("bold");
        expect(entities).toEqual([{ type: "bold", offset: 0, length: 4 }]);
    });

    test("postData that is not an array gives just the header", () => {
        expect(renderText({} as any, { header: "H" })).toEqual(["H", []]);
        expect(renderText(5 as any)).toEqual(["", []]);
    });

    test("styles after collapsed newlines inside a paragraph keep their place", () => {
        const [out, entities] = render([text("hello\n\n\n\n\n"), text("world", [[0, 10, 5]])]);
        expect(out).toBe("hello\n\n\nworld");
        expect(pieces(out, entities)).toEqual([["bold", "world"]]);
    });

    test("an entity does not spill into the next paragraph after long newlines are collapsed", () => {
        const [out, entities] = render([text("bo\n\n\n\n\n", [[0, 0, 7]]), text("XY")]);
        expect(out).toBe("bo\n\n\nXY");
        expect(pieces(out, entities)).toEqual([["bold", "bo\n\n\n"]]);
    });
});
