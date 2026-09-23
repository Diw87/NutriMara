import { build } from "vite";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "docs");
await rm(output, { recursive: true, force: true });
await build({ configFile: path.join(root, "pwa/vite.config.ts") });
await mkdir(path.join(output, "icons"), { recursive: true });
await copyFile(path.join(root, "public/marakesia-logo.png"), path.join(output, "marakesia-logo.png"));
for (const file of await readdir(path.join(root, "pwa/icons"))) await copyFile(path.join(root, "pwa/icons", file), path.join(output, "icons", file));
await copyFile(path.join(root, "pwa/manifest.webmanifest"), path.join(output, "manifest.webmanifest"));
await writeFile(path.join(output, ".nojekyll"), "");
async function inventory(dir, prefix = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await inventory(path.join(dir, entry.name), `${name}/`));
    else if (entry.name !== ".nojekyll") files.push(name);
  }
  return files.sort();
}
const files = await inventory(output);
const hash = createHash("sha256");
for (const file of files) { hash.update(file); hash.update(await readFile(path.join(output, file))); }
const worker = (await readFile(path.join(root, "pwa/service-worker.js"), "utf8")).replace('"__VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16))).replace("__ASSETS__", JSON.stringify(files));
await writeFile(path.join(output, "sw.js"), worker);
console.log(`GitHub Pages: ${files.length + 2} arquivos prontos em docs/.`);
