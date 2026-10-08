/* repairBlocks and renderText({ repair }): the two Boosty editor artifacts, copied from real posts, and the cases left alone. */
import { describe, expect, test } from "bun:test";
import { renderText, repairBlocks } from "../src";

const text = (s: string, modificator = "", ranges: number[][] = []) => ({ type: "text", modificator, content: JSON.stringify([s, "unstyled", ranges]) });
const link = (s: string, url = "https://boosty.to/boosty", explicit = true) => ({ type: "link", url, explicit, content: JSON.stringify([s, "unstyled", []]) });
const END = { type: "text", content: "", modificator: "BLOCK_END" };

/* Post 935cced7 on boosty: the emoji link, its second half saved as the six characters "\ude1c". */
const splitEmoji = () => [
    text("P.S. emoji as link text! "),
    { type: "link", url: "https://boosty.to/boosty", explicit: true, content: JSON.stringify(["\ud83d", 0, []]) },
    { type: "text", modificator: "", content: JSON.stringify(["\\ude1c", 0, []]) },
    END,
];

/* Post 4af7c046 on boosty: the auto-link took the first word of the next paragraph into its URL. */
const swallowedWord = (explicit = false, next = "Далее необходимо указать e-mail.") => [
    { type: "link", url: "https://legal.my.com/us/da/privacy_policy_nonEU/Далее", explicit, content: JSON.stringify(["https://legal.my.com/us/da/privacy_policy_nonEU/", "unstyled", [[4, 0, 48]]]) },
    text(" "),
    END,
    text(next),
    END,
];

const bold = <T extends { type: string }>(entities: T[]) => entities.filter((e) => e.type === "bold");

describe("repairBlocks", () => {
    test("joins an emoji split into a lone high surrogate and an escaped low half", () => {
        const [rendered, entities] = renderText(splitEmoji() as any, { repair: true });
        expect(rendered).toBe("P.S. emoji as link text! 😜");
        expect(entities).toEqual([{ type: "text_link", url: "https://boosty.to/boosty", offset: 25, length: 2 }]);
        expect(renderText(splitEmoji() as any)[0]).toBe("P.S. emoji as link text! \ud83d\\ude1c");
    });

    test("cuts the swallowed word out of an auto-detected link URL", () => {
        const [, entities] = renderText(swallowedWord() as any, { repair: true });
        expect(entities.find((e) => e.type === "text_link")?.url).toBe("https://legal.my.com/us/da/privacy_policy_nonEU/");
    });

    test("leaves links the author set, and tails the next text does not start with", () => {
        const url = (blocks: any[]) => repairBlocks(blocks)[0].url;
        expect(url(swallowedWord(true))).toBe("https://legal.my.com/us/da/privacy_policy_nonEU/Далее");
        expect(url(swallowedWord(false, "Дальше всё просто."))).toBe("https://legal.my.com/us/da/privacy_policy_nonEU/Далее");
        const media = [swallowedWord()[0], { type: "image", url: "x" }, text("Далее")];
        expect(url(media)).toBe("https://legal.my.com/us/da/privacy_policy_nonEU/Далее");
    });

    test("a word right next to the link, an empty link text or a following link are not taken for a swallowed word", () => {
        const url = (blocks: any[]) => repairBlocks(blocks)[0].url;
        expect(url([link("https://a.com/x", "https://a.com/xyz", false), text("yz is cool")])).toBe("https://a.com/xyz");
        expect(url([link("", "https://a.com/x", false), text(" "), END, text("https://a.com/x")])).toBe("https://a.com/x");
        expect(url([link("https://a.com/", "https://a.com/y", false), END, link("y", "https://a.com/y", false)])).toBe("https://a.com/");
    });

    test("only a link is joined; ordinary text and non-low escapes are left alone", () => {
        const blocks = [text("a\ud83d"), text("\\udc00 stays"), link("b\ud83d"), text("\\n is not a low half"), link("c\ud83d"), text("\\ud83d is a high half")];
        expect(JSON.stringify(repairBlocks(blocks as any))).toBe(JSON.stringify(blocks));
    });

    test("styled ranges move back by the removed characters, with several joins in one paragraph", () => {
        /* "x" + link(high) + "\udc00" + "yy" + link(high) + "\udc01" + "zz": bold on "yy" (8..10) and "zz" (17..19). */
        const blocks = [text("x"), link("\ud83d"), text("\\udc00yy", "", [[0, 8, 2]]), link("\ud83d"), text("\\udc01zz", "", [[0, 17, 2]]), END];
        const [rendered, entities] = renderText(blocks as any, { repair: true });
        expect(rendered).toBe("x🐀yy🐁zz");
        expect(bold(entities)).toEqual([
            { type: "bold", offset: 3, length: 2 },
            { type: "bold", offset: 7, length: 2 },
        ]);
    });

    test("an emptied BLOCK_END block does not become a paragraph end; null blocks do not break the paragraph", () => {
        const blocks = [text("ab"), null, link("\ud83d"), text("\\udc00", "BLOCK_END"), text("cd", "", [[0, 9, 2]]), END];
        const [rendered, entities] = renderText(blocks as any, { repair: true });
        expect(rendered).toBe("ab🐀cd");
        expect(bold(entities)).toEqual([{ type: "bold", offset: 4, length: 2 }]);
    });

    test("works on a copy: the caller's blocks and their prototypes are kept", () => {
        class Block {
            [key: string]: any;
        }
        const blocks = splitEmoji().map((b) => Object.assign(new Block(), b));
        const before = JSON.stringify(blocks);
        const repaired = repairBlocks(blocks as any);
        expect(JSON.stringify(blocks)).toBe(before);
        expect(repaired[1]).toBeInstanceOf(Block);
        expect(repaired[1]).not.toBe(blocks[1]);
    });

    test("a __proto__ key in a block stays data and cannot add fields", () => {
        const block = JSON.parse('{"type":"link","content":"[\\"click\\"]","__proto__":{"url":"javascript:alert(1)"}}');
        const [copy] = repairBlocks([block]);
        expect(copy.url).toBeUndefined();
        expect(renderText([block], { repair: true })).toEqual(renderText([block]));
    });

    test("a block too deep to serialize leaves its whole paragraph as it came", () => {
        const deep = "[".repeat(60000) + "]".repeat(60000);
        const nested = { type: "link", url: "u", explicit: true, content: `["\\ud83d","unstyled",[],${deep}]` };
        const neighbour = { ...nested, content: `["\\\\udc00x","unstyled",[[0,1,6]],${deep}]` };
        for (const blocks of [[nested, text("\\udc00xBOLD", "", [[0, 2, 6]])], [link("\ud83d"), neighbour]]) {
            const out = repairBlocks(blocks as any);
            expect(out[0]).toBe(blocks[0] as any);
            expect(out[1]).toBe(blocks[1] as any);
        }
        /* The same pair without the nesting is repaired, so the revert above is what kept the input. */
        const shallow = { ...nested, content: `["\\ud83d","unstyled",[],[[]]]` };
        expect(renderText([shallow, text("\\udc00x")] as any, { repair: true })[0]).toBe("🐀x");
    }, 30_000);

    test("a text that cannot be read as a string is treated as empty, like renderText does", () => {
        const blocks = [text("a"), { type: "text", content: '[{"toString":1}]' }, text("b")];
        expect(() => repairBlocks(blocks as any)).not.toThrow();
        expect(renderText(blocks as any, { repair: true })).toEqual(renderText(blocks as any));
    });

    test("an empty block next to the link is not a gap: the word that follows is the author's", () => {
        const url = (blocks: any[]) => repairBlocks(blocks)[0].url;
        expect(url([link("https://a.com/x", "https://a.com/xyz", false), text(""), text("yz is")])).toBe("https://a.com/xyz");
        expect(url([link("https://a.com/x", "https://a.com/xyz", false), { type: "text", content: "[" }, text("yz is")])).toBe("https://a.com/xyz");
        expect(url([link("https://a.com/x", "https://a.com/xyz", false), text(""), END, text("yz is")])).toBe("https://a.com/x");
    });

    test("stays linear: twenty thousand joins in one paragraph", () => {
        const blocks: any[] = [];
        for (let i = 0; i < 20000; i++) blocks.push(link("\ud83d"), text("\\udc00x", "", [[0, i * 8 + 7, 1]]));
        const started = performance.now();
        const [rendered, entities] = renderText(blocks, { repair: true });
        expect(performance.now() - started).toBeLessThan(2000);
        expect(rendered.length).toBe(20000 * 3);
        const marks = bold(entities);
        expect(marks).toHaveLength(20000);
        expect(marks.every((e, i) => e.offset === i * 3 + 2 && e.length === 1)).toBe(true);
    });

    test("malformed blocks do not throw", () => {
        const odd = [null, 5, { type: "link" }, { type: "text", content: "{" }, { type: "link", url: 3, explicit: false, content: '["x"]' }, { type: "text", content: "[12345]" }];
        expect(() => repairBlocks(odd as any)).not.toThrow();
        expect(renderText(odd as any, { repair: true })).toEqual(renderText(odd as any));
        expect(repairBlocks([])).toEqual([]);
    });
});
