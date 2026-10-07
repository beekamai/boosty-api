import { rmSync } from "node:fs";
import { defineConfig } from "tsup";

/* Cleaned once here, before both builds start: tsup's per-config `clean` wipes the whole outDir, */
/* and the two configs below run in parallel into the same dist/. */
rmSync("dist", { recursive: true, force: true });

export default defineConfig([
    {
        entry: ["src/index.ts"],
        format: ["esm", "cjs"],
        dts: true,
        sourcemap: true,
        target: "node18",
        outDir: "dist",
        /* puppeteer is an optional peer — never bundle it, load lazily at runtime. */
        external: ["puppeteer"],
    },
    {
        /* The `boosty-api` bin: ESM only, one file. */
        entry: ["src/cli.ts"],
        format: ["esm"],
        splitting: false,
        target: "node18",
        outDir: "dist",
        external: ["puppeteer"],
    },
]);
