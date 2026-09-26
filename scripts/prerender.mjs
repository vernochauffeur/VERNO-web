// Writes the server-rendered pages into dist/ so crawlers and first paint get
// real content. The client still mounts with createRoot.
//   dist/index.html                        home page
//   dist/404.html                          home page, served by Vercel with a 404 status
//   dist/<path>.html                       every page in src/content/pages.js (cleanUrls serves them without .html)
//   dist/sitemap.xml                       home + landing pages
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;
const htmlPath = `${dist}/index.html`;
const ssrDir = `${root}dist-ssr`;
const ROOT_PLACEHOLDER = '<div id="root"></div>';

const { render, PAGES, SITE_URL, faqSchemaFor } =
  await import(pathToFileURL(`${ssrDir}/entry-server.js`).href);
const html = await readFile(htmlPath, "utf8");

if (!html.includes(ROOT_PLACEHOLDER)) {
  throw new Error(`dist/index.html is missing ${ROOT_PLACEHOLDER}`);
}

function withApp(template, appHtml) {
  if (!appHtml) throw new Error("Prerender produced empty HTML");
  return template.replace(ROOT_PLACEHOLDER, `<div id="root">${appHtml}</div>`);
}

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Replaces exactly one match, so a changed index.html fails the build instead
// of silently shipping landing pages with the home page's title or canonical.
function replaceOnce(source, pattern, replacement) {
  const matches = source.match(new RegExp(pattern, "g")) || [];
  if (matches.length !== 1) throw new Error(`Expected one match for ${pattern}, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

const FAQ_SCHEMA_PLACEHOLDER = "<!-- FAQ_SCHEMA -->";
const jsonLd = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n    </script>`;

// Every page (home included) gets FAQPage data for only the questions it shows.
function withFaqSchema(template, props) {
  if (!template.includes(FAQ_SCHEMA_PLACEHOLDER)) throw new Error(`dist/index.html is missing ${FAQ_SCHEMA_PLACEHOLDER}`);
  return template.replace(FAQ_SCHEMA_PLACEHOLDER, () => jsonLd(faqSchemaFor(props))); // answers contain "$"
}

function withHead(template, { title, description, url }, schema) {
  const t = escapeAttr(title), d = escapeAttr(description), u = escapeAttr(url);
  let out = template;
  out = replaceOnce(out, /<title>[^<]*<\/title>/, `<title>${t}</title>`);
  out = replaceOnce(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${u}" />`);
  for (const [attr, key, value] of [
    ["name", "title", t], ["name", "description", d],
    ["property", "og:url", u], ["property", "og:title", t], ["property", "og:description", d],
    ["name", "twitter:url", u], ["name", "twitter:title", t], ["name", "twitter:description", d],
  ]) {
    out = replaceOnce(out, new RegExp(`<meta ${attr}="${key}" content="[^"]*" />`), `<meta ${attr}="${key}" content="${value}" />`);
  }
  if (!schema) return out;
  return replaceOnce(out, /<\/head>/, `  ${jsonLd(schema)}\n  </head>`);
}

const homeHtml = withFaqSchema(withApp(html, render()), {});
await writeFile(htmlPath, homeHtml);
await writeFile(`${dist}/404.html`, homeHtml);

for (const page of PAGES) {
  await mkdir(dirname(`${dist}${page.path}`), { recursive: true });
  const pageHtml = withFaqSchema(withApp(html, render(page.props)), page.props);
  await writeFile(`${dist}${page.path}.html`, withHead(pageHtml, page.head, page.schema));
}

const urls = [`${SITE_URL}/`, ...PAGES.map((p) => `${SITE_URL}${p.path}`)];
await writeFile(`${dist}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>\n`).join("") +
  `</urlset>\n`);

await rm(ssrDir, { recursive: true, force: true });
console.log(`Prerendered home, 404 and ${PAGES.length} pages; sitemap has ${urls.length} URLs`);
