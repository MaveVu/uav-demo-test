// Tiny safe expression compiler for user-typed equations such as "10*cos(0.3*t)". Variable: t. No eval.
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, log: Math.log, ln: Math.log, sqrt: Math.sqrt,
  abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, pow: Math.pow
};
const CONSTS = { pi: Math.PI, e: Math.E };

export function compileExpression(src) {
  const toks = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z_]\w*|[-+*/^(),]|\S/gi) ?? [];
  let pos = 0;
  const peek = () => toks[pos], next = () => toks[pos++];
  const expect = tok => { if (next() !== tok) throw new Error(`Expected "${tok}" in "${src}"`); };

  function expr() {
    let l = term();
    while (peek() === "+" || peek() === "-") { const op = next(), r = term(), a = l; l = op === "+" ? t => a(t) + r(t) : t => a(t) - r(t); }
    return l;
  }
  function term() {
    let l = unary();
    while (peek() === "*" || peek() === "/") { const op = next(), r = unary(), a = l; l = op === "*" ? t => a(t) * r(t) : t => a(t) / r(t); }
    return l;
  }
  function unary() {
    if (peek() === "-") { next(); const a = unary(); return t => -a(t); }
    if (peek() === "+") { next(); return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === "^") { next(); const ex = unary(); return t => base(t) ** ex(t); }
    return base;
  }
  function atom() {
    const tok = next();
    if (tok === undefined) throw new Error(`Unexpected end of "${src}"`);
    if (/^\d|^\./.test(tok)) { const v = Number(tok); return () => v; }
    if (tok === "(") { const e = expr(); expect(")"); return e; }
    if (/^[a-z_]/i.test(tok)) {
      const name = tok.toLowerCase();
      if (peek() === "(") {
        const fn = FUNCS[name];
        if (!fn) throw new Error(`Unknown function "${tok}"`);
        next(); const args = [];
        if (peek() !== ")") { args.push(expr()); while (peek() === ",") { next(); args.push(expr()); } }
        expect(")");
        return t => fn(...args.map(a => a(t)));
      }
      if (name === "t") return t => t;
      if (name in CONSTS) { const v = CONSTS[name]; return () => v; }
      throw new Error(`Unknown name "${tok}" (use t, pi, e)`);
    }
    throw new Error(`Unexpected "${tok}" in "${src}"`);
  }

  const fn = expr();
  if (pos < toks.length) throw new Error(`Unexpected "${toks[pos]}" in "${src}"`);
  return fn;
}
