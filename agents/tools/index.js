// Tool registry. Groups are granted per agent via its definition; team + skill tools are added elsewhere.
const modules = [require("./calc"), require("./files"), require("./exec"), require("./web"), require("./memory"), require("./team"), require("./skills")];
const all = new Map();
for (const m of modules) for (const t of m.tools) all.set(t.name, t);

function register(tool) { all.set(tool.name, tool); }
function forGroups(groups) { return [...all.values()].filter((t) => groups.includes(t.group)); }
function get(name) { return all.get(name); }

module.exports = { register, forGroups, get, all };
