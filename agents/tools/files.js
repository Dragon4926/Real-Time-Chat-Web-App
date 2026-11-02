// Workspace file tools, confined to the workspace directory.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const config = require("../config");

function resolveSafe(rel, root = config.get().paths.workspace) {
  if (typeof rel !== "string" || rel.includes("\0")) throw new Error("invalid path");
  fs.mkdirSync(root, { recursive: true });
  const realRoot = fs.realpathSync(root);
  const abs = path.resolve(realRoot, rel.replace(/^[/\\]+/, ""));
  if (abs !== realRoot && !abs.startsWith(realRoot + path.sep)) throw new Error("path escapes the workspace");
  // Resolve symlinks on the deepest existing ancestor to stop symlink escapes.
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== realRoot) probe = path.dirname(probe);
  const realProbe = fs.realpathSync(probe);
  if (realProbe !== realRoot && !realProbe.startsWith(realRoot + path.sep)) throw new Error("path escapes the workspace");
  return { abs, realRoot };
}

const cap = (s, n) => (s.length > n ? `${s.slice(0, n)}\n...[truncated ${s.length - n} chars]` : s);

module.exports = {
  resolveSafe,
  tools: [
    {
      name: "file_list", group: "files",
      description: "List files and folders in the sandboxed workspace directory.",
      parameters: { type: "object", properties: { path: { type: "string", description: "folder, default '.'" } } },
      async run({ path: p = "." }) {
        const { abs, realRoot } = resolveSafe(p);
        const entries = await fsp.readdir(abs, { withFileTypes: true });
        const rows = entries.filter((e) => e.name !== ".run").map((e) => `${e.isDirectory() ? "dir " : "file"} ${path.relative(realRoot, path.join(abs, e.name))}`);
        return rows.join("\n") || "(empty)";
      },
    },
    {
      name: "file_read", group: "files",
      description: "Read a text file from the workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      async run({ path: p }) {
        const { abs } = resolveSafe(p);
        const st = await fsp.stat(abs);
        if (!st.isFile()) throw new Error("not a file");
        if (st.size > config.get().tools.fileMaxBytes) throw new Error("file too large");
        return cap(await fsp.readFile(abs, "utf8"), config.get().tools.outputCap);
      },
    },
    {
      name: "file_write", group: "files",
      description: "Create or overwrite a text file in the workspace (parent folders are created).",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      async run({ path: p, content }) {
        const { abs } = resolveSafe(p);
        if (typeof content !== "string") throw new Error("content must be a string");
        if (Buffer.byteLength(content) > config.get().tools.fileMaxBytes) throw new Error("content too large");
        await fsp.mkdir(path.dirname(abs), { recursive: true });
        await fsp.writeFile(abs, content, "utf8");
        return `wrote ${Buffer.byteLength(content)} bytes to ${p}`;
      },
    },
    {
      name: "file_delete", group: "files",
      description: "Delete a file in the workspace.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      async run({ path: p }) {
        const { abs, realRoot } = resolveSafe(p);
        if (abs === realRoot) throw new Error("refusing to delete the workspace root");
        const st = await fsp.stat(abs);
        if (!st.isFile()) throw new Error("only files can be deleted");
        await fsp.unlink(abs);
        return `deleted ${p}`;
      },
    },
  ],
};
