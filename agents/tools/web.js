// Web search + fetch with SSRF protection (private/loopback addresses blocked unless WEB_ALLOW_PRIVATE=true).
const dns = require("node:dns/promises");
const net = require("node:net");
const config = require("../config");

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("invalid URL"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http(s) URLs are allowed");
  if (config.get().tools.webAllowPrivate) return u;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("blocked: URL resolves to a private or loopback address");
  return u;
}

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

async function fetchText(raw, { signal } = {}) {
  const cfg = config.get().tools;
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(url);
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "User-Agent": "GrokLocalAgent/2.0", Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location"), u).toString(); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chunks = [];
    let size = 0;
    for await (const c of res.body) {
      size += c.length;
      chunks.push(c);
      if (size >= cfg.fetchMaxBytes) break;
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const type = res.headers.get("content-type") || "";
    return /html/i.test(type) || /^\s*<(!doctype|html)/i.test(body) ? htmlToText(body) : body;
  }
  throw new Error("too many redirects");
}

async function search(query, { signal } = {}) {
  const cfg = config.get().tools;
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  if (cfg.searxUrl) {
    const res = await fetch(`${cfg.searxUrl}/search?format=json&q=${encodeURIComponent(query)}`, { signal: sig });
    if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);
    const j = await res.json();
    return (j.results || []).slice(0, 6).map((r) => `${r.title}\n${r.url}\n${(r.content || "").slice(0, 240)}`).join("\n\n") || "no results";
  }
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": "Mozilla/5.0 GrokLocalAgent/2.0" }, signal: sig });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const html = await res.text();
  const out = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    let link = m[1];
    const q = link.match(/uddg=([^&]+)/);
    if (q) link = decodeURIComponent(q[1]);
    out.push(`${htmlToText(m[2])}\n${link}\n${htmlToText(m[3] || "").slice(0, 240)}`);
  }
  return out.join("\n\n") || "no results";
}

module.exports = {
  isPrivateIp, htmlToText, assertPublicUrl,
  tools: [
    {
      name: "web_search", group: "web",
      description: "Search the web and return the top results (title, url, snippet).",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      async run({ query }, ctx) {
        if (!config.get().tools.webEnabled) throw new Error("web access is disabled (WEB_ENABLED=false)");
        return search(String(query), { signal: ctx?.signal });
      },
    },
    {
      name: "web_fetch", group: "web",
      description: "Fetch a public web page and return its readable text.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
      async run({ url }, ctx) {
        if (!config.get().tools.webEnabled) throw new Error("web access is disabled (WEB_ENABLED=false)");
        const text = await fetchText(String(url), { signal: ctx?.signal });
        const cap = config.get().tools.outputCap;
        return text.length > cap ? `${text.slice(0, cap)}\n...[truncated]` : text;
      },
    },
  ],
};
