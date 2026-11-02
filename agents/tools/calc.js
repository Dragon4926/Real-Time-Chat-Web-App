// Safe calculator: recursive-descent parser, no eval().
const FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: Math.log10, ln: Math.log, log2: Math.log2, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function evaluate(src) {
  if (typeof src !== "string" || !src.trim()) throw new Error("empty expression");
  if (src.length > 500) throw new Error("expression too long");
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|(\*\*|[-+*/%^(),]))/gy;
  let m;
  let pos = 0;
  src = src.toLowerCase();
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error(`unexpected character at ${pos}`); }
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ t: "num", v: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: "id", v: m[2] });
    else tokens.push({ t: "op", v: m[3] });
  }
  let i = 0;
  const peek = () => tokens[i];
  const eat = (v) => { if (peek()?.t === "op" && peek().v === v) { i++; return true; } return false; };

  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      if (eat("+")) v += parseTerm();
      else if (eat("-")) v -= parseTerm();
      else return v;
    }
  }
  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      if (eat("*")) v *= parseUnary();
      else if (eat("/")) v /= parseUnary();
      else if (eat("%")) v %= parseUnary();
      else return v;
    }
  }
  function parseUnary() {
    if (eat("-")) return -parseUnary();
    if (eat("+")) return parseUnary();
    return parsePow();
  }
  function parsePow() {
    const base = parseAtom();
    if (eat("^") || eat("**")) return Math.pow(base, parseUnary()); // right-assoc
    return base;
  }
  function parseAtom() {
    const tok = tokens[i++];
    if (!tok) throw new Error("unexpected end of expression");
    if (tok.t === "num") return tok.v;
    if (tok.t === "id") {
      if (eat("(")) {
        const fn = Object.hasOwn(FUNCS, tok.v) ? FUNCS[tok.v] : null;
        if (!fn) throw new Error(`unknown function ${tok.v}`);
        const args = [];
        if (!eat(")")) {
          do args.push(parseExpr()); while (eat(","));
          if (!eat(")")) throw new Error("missing )");
        }
        return fn(...args);
      }
      if (Object.hasOwn(CONSTS, tok.v)) return CONSTS[tok.v];
      throw new Error(`unknown identifier ${tok.v}`);
    }
    if (tok.v === "(") {
      const v = parseExpr();
      if (!eat(")")) throw new Error("missing )");
      return v;
    }
    throw new Error(`unexpected token ${tok.v}`);
  }
  const out = parseExpr();
  if (i < tokens.length) throw new Error(`unexpected token ${tokens[i].v}`);
  if (!Number.isFinite(out)) throw new Error("result is not a finite number");
  return out;
}

module.exports = {
  evaluate,
  tools: [{
    name: "calc", group: "calc",
    description: "Evaluate a math expression exactly (supports + - * / % ^, parentheses, sqrt, sin, cos, log, ln, abs, round, min, max, pi, e).",
    parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
    async run({ expression }) { return String(evaluate(expression)); },
  }],
};
