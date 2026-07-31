import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "data", "posts");
const distDir = path.join(root, "dist");
const siteDir = path.join(root, "site");
const config = JSON.parse(await readFile(path.join(root, "gallery.config.json"), "utf8"));

await rm(distDir, { recursive: true, force: true });
await cp(siteDir, distDir, { recursive: true });
await mkdir(path.join(distDir, "data"), { recursive: true });

const posts = [];
for (const filename of await readdir(postsDir).catch(() => [])) {
  if (!filename.endsWith(".json")) continue;
  try {
    const post = JSON.parse(await readFile(path.join(postsDir, filename), "utf8"));
    if (post.coverImage && post.title) posts.push(post);
  } catch (error) {
    console.warn(`Skipping invalid post file ${filename}: ${error.message}`);
  }
}

posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort();
const meta = {
  generatedAt: new Date().toISOString(),
  count: posts.length,
  categories,
  repository: process.env.GITHUB_REPOSITORY || "1564269628/open-wallpaper",
  siteTitle: config.siteTitle,
  siteDescription: config.siteDescription
};

await writeFile(path.join(distDir, "data", "images.json"), `${JSON.stringify(posts, null, 2)}\n`);
await writeFile(path.join(distDir, "data", "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`Built ${posts.length} gallery posts into dist/.`);
