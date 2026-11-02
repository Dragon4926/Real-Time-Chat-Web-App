// Split a fetch() body stream into text lines.
async function* readLines(body) {
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of body) {
    buf += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, i);
      buf = buf.slice(i + 1);
    }
  }
  buf += decoder.decode();
  if (buf) yield buf;
}
module.exports = { readLines };
