// Tiny "key: value" frontmatter parser/serializer (no YAML dependency).
function parse(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: String(text).trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
}
function serialize(meta, body) {
  const head = Object.entries(meta).map(([k, v]) => `${k}: ${String(v).replace(/[\r\n]+/g, " ")}`).join("\n");
  return `---\n${head}\n---\n${body.trim()}\n`;
}
module.exports = { parse, serialize };
