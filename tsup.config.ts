import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node18",
    outDir: "dist",
    /* puppeteer is an optional peer — never bundle it, load lazily at runtime. */
    external: ["puppeteer"],
});
