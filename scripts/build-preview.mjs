import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const logoData =
  "data:image/jpeg;base64," +
  (await readFile("public/logo.jpg")).toString("base64");
const { outputFiles } = await build({
  entryPoints: ["scripts/preview-entry.tsx"],
  bundle: true,
  minify: true,
  write: false,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_LOGO_DATA": JSON.stringify(logoData),
  },
  tsconfig: "tsconfig.json",
});
let css = await readFile("app/globals.css", "utf8");
css = css.replace(/@import\s+["']tailwindcss["'];/, "");
for (const face of [
  "devanagari-400",
  "devanagari-700",
  "latin-400",
  "latin-700",
]) {
  const font = await readFile(`public/fonts/${face}.woff2`);
  css = css.replaceAll(
    `/fonts/${face}.woff2`,
    "data:font/woff2;base64," + font.toString("base64"),
  );
}
await mkdir("public", { recursive: true });
await writeFile(
  "public/preview.html",
  '<!doctype html><html lang="mr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>शिवतेज ग्रुप — नमुना पूर्वावलोकन</title><style>' +
    css +
    '</style></head><body><div id="root"></div><script>' +
    outputFiles[0].text.replace(/<\/script/gi, "<\\/script") +
    "</script></body></html>",
);
