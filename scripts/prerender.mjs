// Writes the server-rendered page into dist/index.html so crawlers and
// first paint get real content. The client still mounts with createRoot.
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const htmlPath = `${root}dist/index.html`;
const ssrDir = `${root}dist-ssr`;
const ROOT_PLACEHOLDER = '<div id="root"></div>';

const { render } = await import(pathToFileURL(`${ssrDir}/entry-server.js`).href);
const html = await readFile(htmlPath, "utf8");

if (!html.includes(ROOT_PLACEHOLDER)) {
  throw new Error(`dist/index.html is missing ${ROOT_PLACEHOLDER}`);
}

const appHtml = render();
if (!appHtml) throw new Error("Prerender produced empty HTML");

const pageHtml = html.replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`);
await writeFile(htmlPath, pageHtml);
// Vercel serves 404.html (with a 404 status) for unknown paths: visitors still
// see the home page, but crawlers are told the URL does not exist.
await writeFile(`${root}dist/404.html`, pageHtml);
await rm(ssrDir, { recursive: true, force: true });
console.log(`Prerendered dist/index.html (${appHtml.length} chars of app HTML)`);
