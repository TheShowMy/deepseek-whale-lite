// src/index.ts
import { readFile } from "node:fs/promises";

// src/engine.ts
import { join as join3 } from "node:path";

// src/host.ts
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// src/palettes.ts
var PALETTES = {
  rainbow: "linear-gradient(90deg,#e665b5,#77a2ed,#71b6a1,#e665b5)",
  "legacy-macaron": "linear-gradient(90deg,#e69aae,#9fafe7,#8ec6c3,#e69aae)",
  "legacy-bamboo": "linear-gradient(90deg,#57a165,#a6d09a,#57a165)",
  macaron: "linear-gradient(90deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200))",
  candy: "linear-gradient(90deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))",
  rouge: "linear-gradient(90deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))",
  bamboo: "linear-gradient(90deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))",
  aurora: "linear-gradient(90deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))",
  deepsea: "linear-gradient(90deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))",
  sunset: "linear-gradient(90deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))",
  forest: "linear-gradient(90deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))",
  champagne: "linear-gradient(90deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))",
  lavender: "linear-gradient(90deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))",
  mint: "linear-gradient(90deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))",
  lava: "linear-gradient(90deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))",
  galaxy: "linear-gradient(90deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))",
  ink: "linear-gradient(90deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))",
  indigo: "linear-gradient(90deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))",
  blaze: "linear-gradient(90deg,rgb(150,15,25),rgb(200,30,30),rgb(240,70,25),rgb(255,130,30),rgb(255,200,60),rgb(255,240,170),rgb(255,200,60),rgb(255,130,30),rgb(240,70,25),rgb(200,30,30),rgb(150,15,25))",
  amber: "linear-gradient(90deg,rgb(230,90,0),rgb(255,140,0),rgb(255,180,0),rgb(255,215,40),rgb(255,240,120),rgb(255,215,40),rgb(255,180,0),rgb(255,140,0),rgb(230,90,0))"
};

// src/bubbles.ts
var MODULE_LABELS = { text: "\u6587\u672C", link: "\u8D85\u94FE\u63A5", "random-text": "\u968F\u673A\u8BED\u53E5", image: "\u56FE\u7247\uFF0F\u52A8\u56FE", "random-image": "\u968F\u673A\u56FE\u7247", balance: "\u603B\u4F59\u989D", recharge: "\u5145\u503C\u4F59\u989D", bonus: "\u8D60\u91D1", today: "\u4ECA\u65E5\u6D88\u8D39", peak: "\u5CF0\u8C37\u65F6\u6BB5", session: "\u5BF9\u8BDD\u540D", cost: "\u672C\u8F6E\u8D39\u7528", effect: "\u5185\u7F6E\u52A8\u6548" };
var DEFAULT_STYLE = { font: "system-ui", size: 14, bold: false, italic: false, underline: false, color: "#536ba9", background: "", gradient: "none", backgroundGradient: "none" };
var PEAK_OPTIONS = [["default", "\u9AD8\u5CF0\uFF0F\u7A7A\u95F2"], ["liangwen", "\u6881\u6587\u5CF0\uFF0F\u6881\u6587\u8C37"], ["qiangqiang", "!?\u5CF0\u5CF0?!\uFF0F!?\u8C37\u8C37?!"], ["count", "\u65F6\u6BB5\u5012\u8BA1\u65F6"], ["mini", "\u7B80\u6D01\u5CF0\uFF0F\u8C37"], ["inherit", "\u7EE7\u627F 0.2 \u5168\u5C40\u6837\u5F0F"]];
function moduleOf(type, id = globalThis.crypto.randomUUID()) {
  return { id, type, source: "visible", style: { ...DEFAULT_STYLE }, text: type === "text" ? "\u4F60\u597D\u5440\uFF01" : "{value}", url: "https://www.deepseek.com", assetId: "", choices: [], length: 12, currency: "auto", effect: "pet", imageScale: 1, peakStyle: "default", peakPaint: { color: "#e0433f", background: "", gradient: "none", backgroundGradient: "none" }, offPaint: { color: "#2fa24c", background: "", gradient: "none", backgroundGradient: "none" } };
}
function definition(text2) {
  const m = moduleOf("text");
  m.text = text2;
  return { rows: [[m]] };
}
function defaultBubbles() {
  const title = moduleOf("text", "title");
  title.text = "DeepSeek \u4F59\u989D";
  title.style.bold = true;
  title.style.size = 15;
  const balance = moduleOf("balance", "balances");
  balance.text = "{source} {value}";
  balance.style.bold = true;
  balance.style.size = 18;
  const today = moduleOf("today", "today");
  today.text = "{source} \u4ECA\u65E5 {value}";
  today.style.size = 9;
  const peak = moduleOf("peak", "peak");
  peak.style.size = 9;
  peak.peakStyle = "inherit";
  const random = moduleOf("random-text", "greeting");
  random.choices = ["\u9CB8\u9CB8\u5E2E\u4F60\u770B\u597D\u4F59\u989D\u3002", "\u4ECA\u5929\u4E5F\u8981\u5F00\u5FC3\u5730\u5199\u4EE3\u7801\uFF01", "\u4F11\u606F\u4E00\u4E0B\uFF0C\u559D\u53E3\u6C34\u5427\u3002", "\u4E24\u4E2A\u8D26\u6237\uFF0C\u5206\u522B\u8BB0\u8D26\u3002"].map((value) => ({ value, weight: 1 }));
  const pet = moduleOf("effect", "pet");
  pet.effect = "pet";
  const coins = moduleOf("effect", "coins");
  coins.effect = "coins";
  const step = (id, bubble) => ({ id, options: [{ id: id + "-a", weight: 1, bubble }] });
  return { revision: 0, steps: [step("balance", { rows: [[title], [balance], [today], [peak]] }), step("greeting", { rows: [[random]] }), { id: "effects", options: [{ id: "pet", weight: 1, bubble: { rows: [[pet]] } }, { id: "coins", weight: 1, bubble: { rows: [[coins]] } }] }], library: [] };
}
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("\u6C14\u6CE1\u914D\u7F6E\u65E0\u6548");
  return value;
}
function text(value, max = 4e3) {
  if (typeof value !== "string" || value.length > max) throw new Error("\u6587\u672C\u8FC7\u957F\u6216\u683C\u5F0F\u65E0\u6548");
  return value;
}
function num(value, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("\u6C14\u6CE1\u6570\u503C\u65E0\u6548");
  return value;
}
function safeLink(url) {
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
function parseModule(value) {
  const v = record(value), type = text(v.type);
  if (!(type in MODULE_LABELS)) throw new Error("\u672A\u77E5\u6A21\u5757\u7C7B\u578B");
  const m = moduleOf(type, text(v.id, 100));
  if (!/^[\w-]+$/.test(m.id)) throw new Error("\u6A21\u5757 ID \u65E0\u6548");
  if (!["account", "api-key", "visible"].includes(String(v.source))) throw new Error("\u6A21\u5757\u6765\u6E90\u65E0\u6548");
  m.source = v.source;
  m.text = text(v.text);
  m.url = text(v.url, 2048);
  m.assetId = text(v.assetId, 100);
  if (type === "link" && !safeLink(m.url)) throw new Error("\u94FE\u63A5\u987B\u4E3A HTTP \u6216 HTTPS");
  m.length = num(v.length, 0, 1e3);
  if (!Number.isInteger(m.length)) throw new Error("\u5BF9\u8BDD\u540D\u957F\u5EA6\u65E0\u6548");
  if (!["CNY", "USD", "auto"].includes(String(v.currency))) throw new Error("\u6A21\u5757\u5E01\u79CD\u65E0\u6548");
  m.currency = v.currency;
  if (!["pet", "coins"].includes(String(v.effect))) throw new Error("\u52A8\u6548\u65E0\u6548");
  m.effect = v.effect;
  if (!Array.isArray(v.choices) || v.choices.length > 100) throw new Error("\u968F\u673A\u9879\u65E0\u6548");
  m.choices = v.choices.map((x) => {
    const c = record(x);
    return { value: text(c.value), weight: num(c.weight, 1, 1e4), ...c.style ? { style: parseStyle(c.style) } : {} };
  });
  m.style = parseStyle(v.style);
  m.imageScale = v.imageScale === void 0 ? 1 : num(v.imageScale, 0.1, 1);
  m.peakStyle = v.peakStyle === void 0 ? "inherit" : text(v.peakStyle);
  if (!PEAK_OPTIONS.some(([id]) => id === m.peakStyle)) throw new Error("\u5CF0\u8C37\u6837\u5F0F\u65E0\u6548");
  if (v.peakPaint !== void 0) m.peakPaint = parsePaint(v.peakPaint);
  if (v.offPaint !== void 0) m.offPaint = parsePaint(v.offPaint);
  return m;
}
function parsePaint(value) {
  const s = record(value), color = text(s.color, 32), background = text(s.background, 32);
  for (const c of [color, background]) if (c && !/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(c)) throw new Error("\u989C\u8272\u65E0\u6548");
  const gradient = (v) => {
    if (v !== "none" && (typeof v !== "string" || !Object.hasOwn(PALETTES, v))) throw new Error("\u6E10\u53D8\u65E0\u6548");
    return v;
  };
  const old = s.backgroundGradient === void 0, fg = old && ["macaron", "bamboo"].includes(String(s.gradient)) ? "legacy-" + String(s.gradient) : s.gradient;
  return { color, background, gradient: gradient(fg), backgroundGradient: gradient(s.backgroundGradient ?? "none") };
}
function parseStyle(value) {
  const s = record(value);
  return { ...parsePaint(s), font: text(s.font, 100), size: num(s.size, 6, 48), bold: s.bold === true, italic: s.italic === true, underline: s.underline === true };
}
function imageModule(m) {
  return ["image", "random-image", "effect"].includes(m.type);
}
function parseDefinition(value) {
  const v = record(value);
  if (!Array.isArray(v.rows) || !v.rows.length || v.rows.length > 6) throw new Error("\u6C14\u6CE1\u987B\u6709 1\u20136 \u884C");
  let images = 0;
  const ids = /* @__PURE__ */ new Set();
  const rows = v.rows.map((row) => {
    if (!Array.isArray(row) || !row.length || row.length > 6) throw new Error("\u6BCF\u884C\u987B\u6709 1\u20136 \u4E2A\u6A21\u5757");
    return row.map((x) => {
      const m = parseModule(x);
      if (ids.has(m.id)) throw new Error("\u6A21\u5757 ID \u91CD\u590D");
      ids.add(m.id);
      if (imageModule(m)) {
        images++;
        if (row.length !== 1) throw new Error("\u56FE\u7247\u987B\u72EC\u5360\u4E00\u884C");
      }
      return m;
    });
  });
  if (images > 1) throw new Error("\u4E00\u4E2A\u6C14\u6CE1\u6700\u591A\u4E00\u5F20\u56FE\u7247\u6216\u52A8\u6548");
  return { rows };
}
function parseBubbles(value) {
  const v = record(value);
  if (!Array.isArray(v.steps) || !v.steps.length || v.steps.length > 100) throw new Error("\u70B9\u51FB\u961F\u5217\u987B\u6709 1\u2013100 \u9879");
  const steps = v.steps.map((x) => {
    const s = record(x);
    if (!Array.isArray(s.options) || !s.options.length || s.options.length > 20) throw new Error("\u5E76\u5217\u9879\u65E0\u6548");
    return { id: text(s.id, 100), options: s.options.map((x2) => {
      const o = record(x2);
      return { id: text(o.id, 100), weight: num(o.weight, 1, 1e4), bubble: parseDefinition(o.bubble) };
    }) };
  });
  if (!Array.isArray(v.library) || v.library.length > 200) throw new Error("\u6A21\u5757\u5E93\u65E0\u6548");
  const library = v.library.map((x) => {
    const l = record(x);
    return { id: text(l.id, 100), name: text(l.name, 80), module: parseModule(l.module) };
  });
  if (new Set(steps.map((s) => s.id)).size !== steps.length) throw new Error("\u961F\u5217 ID \u91CD\u590D");
  const revision2 = num(v.revision, 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(revision2)) throw new Error("\u6C14\u6CE1\u7248\u672C\u65E0\u6548");
  return { revision: revision2, steps, library };
}

// src/shared.ts
var PREFIX = "/deepseek-whale-lite";
var SOURCES = ["account", "api-key"];
var CHARACTERS = [
  { id: "deepseek-smile", name: "DeepSeek \xB7 \u5FAE\u7B11" },
  { id: "deepseek-focus", name: "DeepSeek \xB7 \u4E13\u6CE8" },
  { id: "deepseek-sleepy", name: "DeepSeek \xB7 \u56F0\u56F0" },
  { id: "lumine", name: "\u8367" },
  { id: "vesna", name: "\u8587\u65AF\u7EB3" },
  { id: "vodyanitsa", name: "\u6C83\u96C5\u59AE\u838E" },
  { id: "tsaritsa", name: "\u51B0\u4E4B\u5973\u7687" }
];
function eventDefaults() {
  const make = (kind, text2) => ({ enabled: !["question", "approval", "budget"].includes(kind), bubble: true, sound: !["question", "approval"].includes(kind), volume: null, audio: kind === "complete" ? "complete" : "alert", closeSeconds: ["question", "approval"].includes(kind) ? 0 : 5, content: definition(text2) });
  return { complete: make("complete", "\u8FD9\u4E00\u8F6E\u5B8C\u6210\u5566\uFF01\n{cost}"), low: make("low", "{source} \u4F59\u989D\u504F\u4F4E\n{amount}"), budget: make("budget", "{source} \u4ECA\u65E5\u9884\u7B97\u5DF2\u8FBE\u5230\n{amount}"), question: make("question", "{session}\n\u6B63\u5728\u7B49\u5F85\u4F60\u7684\u56DE\u7B54"), approval: make("approval", "{session}\n\u6B63\u5728\u7B49\u5F85\u4F60\u7684\u6388\u6743") };
}
var DEFAULT_SETTINGS = {
  displayMode: null,
  character: "deepseek-smile",
  scale: 1,
  x: null,
  y: null,
  flip: false,
  sound: false,
  volume: 0.4,
  refreshSeconds: 60,
  lowBalance: { CNY: 5, USD: 1 },
  bubbleOn: true,
  stickyBalance: true,
  tapAdvance: false,
  menuButtonHide: false,
  autoFlip: true,
  scrollGap: 0,
  peakStyle: "countdown",
  pressGroup: "group-default",
  snap: { enabled: true, unit: "px", px: { top: 35, right: 35, bottom: 35, left: 35, flip: null }, percent: { top: 3, right: 3, bottom: 3, left: 3, flip: 15 } },
  anchor: null,
  events: eventDefaults(),
  outlineColor: "#ffffff",
  waitCharClose: false,
  pressSound: true
};
function initialMode(balances) {
  const account = !["signed-out", "unavailable"].includes(balances.account.status);
  const key = !["missing-key", "unavailable"].includes(balances["api-key"].status);
  return account && key ? "both" : account ? "account" : "api-key";
}
function parseSettings(input, previous, characters = CHARACTERS.map((c) => c.id)) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("\u8BBE\u7F6E\u683C\u5F0F\u65E0\u6548");
  const p = input;
  const next = structuredClone(previous);
  if (Object.keys(p).some((key) => !(key in DEFAULT_SETTINGS))) throw new Error("\u672A\u77E5\u8BBE\u7F6E\u5B57\u6BB5");
  if ("displayMode" in p) {
    if (!["account", "api-key", "both"].includes(String(p.displayMode))) throw new Error("\u663E\u793A\u6A21\u5F0F\u65E0\u6548");
    next.displayMode = p.displayMode;
  }
  if ("character" in p) {
    if (!characters.includes(String(p.character))) throw new Error("\u89D2\u8272\u65E0\u6548");
    next.character = String(p.character);
  }
  for (const key of ["sound", "flip", "bubbleOn", "stickyBalance", "tapAdvance", "menuButtonHide", "autoFlip", "waitCharClose", "pressSound"]) {
    if (!(key in p)) continue;
    if (typeof p[key] !== "boolean") throw new Error("\u5F00\u5173\u65E0\u6548");
    next[key] = p[key];
  }
  for (const [key, min, max] of [["scale", 0.6, 2.5], ["volume", 0, 1], ["refreshSeconds", 15, 600], ["scrollGap", 0, 100]]) {
    if (!(key in p)) continue;
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("\u8BBE\u7F6E\u6570\u503C\u8D85\u51FA\u8303\u56F4");
    next[key] = value;
  }
  for (const key of ["x", "y"]) {
    if (!(key in p)) continue;
    const value = p[key];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e5)) throw new Error("\u4F4D\u7F6E\u65E0\u6548");
    next[key] = value;
  }
  if ("lowBalance" in p) {
    const value = p.lowBalance;
    if (!value || typeof value !== "object" || Object.keys(value).some((k) => k !== "CNY" && k !== "USD")) throw new Error("\u4F59\u989D\u9608\u503C\u65E0\u6548");
    for (const currency of ["CNY", "USD"]) {
      const threshold = value[currency];
      if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0 || threshold > 1e6) throw new Error("\u4F59\u989D\u9608\u503C\u65E0\u6548");
      next.lowBalance[currency] = threshold;
    }
  }
  if ("peakStyle" in p) {
    if (!["simple", "countdown", "playful"].includes(String(p.peakStyle))) throw new Error("\u5CF0\u8C37\u6837\u5F0F\u65E0\u6548");
    next.peakStyle = p.peakStyle;
  }
  if ("outlineColor" in p) {
    if (typeof p.outlineColor !== "string" || !/^#[a-f\d]{6}$/i.test(p.outlineColor)) throw new Error("\u8F6E\u5ED3\u989C\u8272\u987B\u4E3A\u516D\u4F4D\u5341\u516D\u8FDB\u5236\u989C\u8272");
    next.outlineColor = p.outlineColor.toLowerCase();
  }
  if ("pressGroup" in p) {
    if (typeof p.pressGroup !== "string" || p.pressGroup.length > 100) throw new Error("\u6309\u538B\u97F3\u6548\u7EC4\u65E0\u6548");
    next.pressGroup = p.pressGroup;
  }
  if ("snap" in p) next.snap = parseSnap(p.snap, previous.snap);
  if ("anchor" in p) {
    const a = p.anchor;
    if (a !== null && (!a || !["left", "right"].includes(a.horizontal) || !["top", "bottom"].includes(a.vertical) || [a.x, a.y].some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e5))) throw new Error("\u4F4D\u7F6E\u951A\u70B9\u65E0\u6548");
    next.anchor = a ? { horizontal: a.horizontal, vertical: a.vertical, x: a.x, y: a.y } : null;
  }
  return next;
}
function parseSnap(value, previous = DEFAULT_SETTINGS.snap) {
  const s = value;
  if (!s || typeof s.enabled !== "boolean" || !["px", "percent"].includes(s.unit)) throw new Error("\u5438\u9644\u8BBE\u7F6E\u65E0\u6548");
  const next = structuredClone(previous);
  next.enabled = s.enabled;
  next.unit = s.unit;
  const legacy = "top" in s, profiles = legacy ? [s.unit] : ["px", "percent"];
  for (const unit of profiles) {
    const profile = legacy ? s : s[unit];
    if (!profile) throw new Error("\u5438\u9644\u914D\u7F6E\u7F3A\u5931");
    for (const side of ["top", "right", "bottom", "left", "flip"]) {
      if (legacy && side === "flip") continue;
      const n = profile[side];
      if (side === "flip" && unit === "px" && n === null) {
        next[unit].flip = null;
        continue;
      }
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > (unit === "px" ? 1e5 : 100)) throw new Error("\u5438\u9644\u6570\u503C\u65E0\u6548");
      next[unit][side] = n;
    }
  }
  return next;
}
function emptyV2Fields() {
  return { bubbles: defaultBubbles(), bookPreferences: {}, notifications: [], notificationSeq: 0, alertState: {}, dismissed: [] };
}

// src/accounting.ts
function units(value) {
  const match = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match || !(match[2] || match[3])) throw new Error("\u91D1\u989D\u683C\u5F0F\u65E0\u6548");
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1e3) throw new Error("\u91D1\u989D\u8D85\u51FA\u8303\u56F4");
  const fraction = match[3] ?? "";
  const digits = BigInt((match[2] || "0") + fraction);
  const shift = 8 + exponent - fraction.length;
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n;
  const n = shift < 0 ? (digits + divisor / 2n) / divisor : digits * 10n ** BigInt(shift);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("\u91D1\u989D\u8D85\u51FA\u8303\u56F4");
  return Number(match[1] ? -n : n);
}
function dayKey(at = Date.now()) {
  return new Date(at + 8 * 36e5).toISOString().slice(0, 10);
}
function emptyState() {
  return { version: 3, settings: structuredClone(DEFAULT_SETTINGS), books: {}, calls: [], completions: [], completionSeq: 0, seen: {}, turnScopes: {}, ...emptyV2Fields(), soundPlayed: [] };
}
function bookKey(source, scope, currency) {
  return [source, scope, currency].join(":");
}
function observe(state, source, scope, currency, total, at) {
  const book = state.books[bookKey(source, scope, currency)] ??= { source, scope, currency, days: {} };
  const day = dayKey(at);
  if (at <= Math.max(0, ...Object.values(book.days).map((r) => r.lastAt))) return;
  const row = book.days[day];
  if (!row) book.days[day] = { day, firstAt: at, lastAt: at, opening: total, last: total, debit: 0, credit: 0 };
  else {
    const delta = row.last - total;
    row.debit += Math.max(delta, 0);
    row.credit += Math.max(-delta, 0);
    row.last = total;
    row.lastAt = at;
  }
}
function estimate(model, usage) {
  const flash = ["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"].includes(model);
  if (!flash && model !== "deepseek-v4-pro") return null;
  const rates = flash ? { CNY: ["0.02", "1", "4"], USD: ["0.003", "0.15", "0.6"] } : { CNY: ["0.15", "4.5", "13.5"], USD: ["0.022", "0.66", "1.98"] };
  const result = {};
  for (const currency of ["CNY", "USD"]) {
    const [hit, miss, output] = rates[currency].map(units);
    const numerator = BigInt(usage.cacheReadTokens) * BigInt(hit) + BigInt(usage.inputTokens + usage.cacheWriteTokens) * BigInt(miss) + BigInt(usage.outputTokens) * BigInt(output);
    const low = Number((numerator + 500000n) / 1000000n);
    const high = Number((numerator * 2n + 500000n) / 1000000n);
    if (!Number.isSafeInteger(high)) return null;
    result[currency] = { low, high };
  }
  return result;
}
function validUsage(value) {
  if (!value || typeof value !== "object") return null;
  const raw = value;
  const usage = {};
  for (const key of ["inputTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens"]) {
    const n = raw[key] ?? 0;
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) return null;
    usage[key] = n;
  }
  return usage;
}
function totals(calls, currency) {
  return calls.reduce((r, c) => ({
    tokens: r.tokens + Object.values(c.usage).reduce((a, b) => a + b, 0),
    low: r.low + (c.costs?.[currency].low ?? 0),
    high: r.high + (c.costs?.[currency].high ?? 0),
    unknown: r.unknown + Number(c.costs === null)
  }), { tokens: 0, low: 0, high: 0, unknown: 0 });
}
function history(state, source, scope) {
  const records = Object.values(state.books).filter((b) => (!source || b.source === source) && (!scope || b.scope === scope)).flatMap((b) => Object.values(b.days).map((row) => ({
    ...row,
    source: b.source,
    scope: b.scope,
    currency: b.currency,
    observed: true,
    amount: correctedAmount(row),
    needsReview: row.credit > (row.correction?.credit ?? 0),
    revision: revision(b.source, b.scope, b.currency, row),
    estimate: totals([], b.currency)
  })));
  const key = (s, id, c, day) => bookKey(s, id, c) + ":" + day;
  const index = new Map(records.map((r) => [key(r.source, r.scope, r.currency, r.day), r]));
  for (const call of state.calls) {
    if (source && call.source !== source || scope && call.scope !== scope) continue;
    for (const currency of ["CNY", "USD"]) {
      const day = dayKey(call.at);
      const id = key(call.source, call.scope, currency, day);
      let row = index.get(id);
      if (!row) {
        row = { day, source: call.source, scope: call.scope, currency, observed: false, firstAt: call.at, lastAt: call.at, opening: 0, last: 0, debit: 0, credit: 0, amount: 0, needsReview: false, revision: "", estimate: totals([], currency) };
        index.set(id, row);
        records.push(row);
      }
      const sum = totals([call], currency);
      row.estimate.tokens += sum.tokens;
      row.estimate.low += sum.low;
      row.estimate.high += sum.high;
      row.estimate.unknown += sum.unknown;
    }
  }
  return records.sort((a, b) => b.day.localeCompare(a.day) || b.lastAt - a.lastAt);
}
function prune(state, now = Date.now()) {
  const cut = now - 90 * 864e5;
  state.completions = state.completions.filter((c) => c.at >= cut).slice(-200);
  state.seen = Object.fromEntries(Object.entries(state.seen).slice(-2e4));
  state.turnScopes = Object.fromEntries(Object.entries(state.turnScopes).slice(-1e3));
  state.notifications = state.notifications.filter((n) => n.pending || n.at >= now - 7 * 864e5).slice(-1e3);
  state.dismissed = state.dismissed.slice(-2e4);
  state.soundPlayed = state.soundPlayed.slice(-2e4);
}
function correctedAmount(row) {
  return row.correction ? row.correction.amount + row.debit - row.correction.debit : row.debit;
}
function revision(source, scope, currency, row) {
  return [source, scope, currency, row.day, row.firstAt, row.last, row.debit, row.credit, row.revision ?? 0].join(":");
}
function reconcile(state, input, now = Date.now()) {
  const row = state.books[bookKey(input.source, input.scope, input.currency)]?.days[input.day];
  if (!row) throw new Error("\u8FD9\u4E00\u5929\u6CA1\u6709\u4F59\u989D\u89C2\u6D4B\u8BB0\u5F55");
  if (input.revision !== revision(input.source, input.scope, input.currency, row)) throw Object.assign(new Error("\u4F59\u989D\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6838\u5BF9"), { status: 409 });
  const amount = (v) => {
    if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(v)) throw new Error("\u91D1\u989D\u987B\u4E3A\u975E\u8D1F\u6570\uFF0C\u6700\u591A 8 \u4F4D\u5C0F\u6570");
    return units(v);
  };
  if (!input.reset && !input.confirmed) throw new Error("\u8BF7\u786E\u8BA4\u5DF2\u6838\u5BF9\u5168\u90E8\u4F59\u989D\u8C03\u6574");
  const credits = input.reset ? 0 : amount(input.credits), otherDebits = input.reset ? 0 : amount(input.otherDebits);
  const corrected = row.opening + credits - otherDebits - row.last;
  if (!input.reset && (!Number.isSafeInteger(corrected) || corrected < 0)) throw new Error("\u6821\u6B63\u6D88\u8D39\u4E3A\u8D1F\u6216\u8D85\u51FA\u8303\u56F4");
  const previous = row.correction ?? null, next = input.reset ? null : { at: now, credits, otherDebits, amount: corrected, debit: row.debit, credit: row.credit };
  row.correctionLog = [...row.correctionLog ?? [], { at: now, previous, next }].slice(-50);
  row.correction = next;
  row.revision = (row.revision ?? 0) + 1;
  return history(state, input.source, input.scope).find((r) => r.currency === input.currency && r.day === input.day);
}

// src/sources.ts
import { createHash } from "node:crypto";
function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
function officialEndpoint(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "api.deepseek.com" && !u.port && !u.username && !u.password && !u.search && !u.hash;
  } catch {
    return false;
  }
}
function providerConfig(ctx, source) {
  const provider = source === "account" ? "deepseek-account" : "deepseek-official";
  const llm = ctx.get("llm");
  const settings = ctx.get("settings");
  const entry = llm.listConfigurableProviders().find((p) => p.provider === provider);
  if (!entry) return { ref: "DEEPSEEK_API_KEY", official: false };
  const descriptor = settings.describe({ redactSecrets: true }).find((d) => d.ns === entry.settingsNs);
  if (!descriptor) return { ref: "DEEPSEEK_API_KEY", official: false };
  let raw = descriptor.value;
  for (const key of entry.settingsPath) raw = object(raw)[key];
  const config = object(raw);
  return { ref: String(config.apiKeyEnv ?? "DEEPSEEK_API_KEY"), official: officialEndpoint(String(config.baseURL ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/anthropic")) };
}
var Sources = class {
  ctx;
  client;
  constructor(ctx) {
    this.ctx = ctx;
    this.client = { version: process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || "0.2.0-rc.2", locale: "zh-CN", timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60 };
  }
  async identity(source) {
    if (!providerConfig(this.ctx, source).official) return null;
    if (source === "api-key") {
      const hit = await this.ctx.get("credentials").resolve(providerConfig(this.ctx, source).ref);
      return hit?.value ? fingerprint("key:" + hit.value) : null;
    }
    const account = this.ctx.get("deepseekAccount");
    const session = await account?.getPlatformSession();
    return session ? fingerprint("account:" + session.origin + ":" + (session.userId ?? session.token)) : null;
  }
  async fetch(source) {
    let timer;
    try {
      return await Promise.race([this.fetchSource(source), new Promise((resolve) => {
        timer = setTimeout(() => resolve({ source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", failure: "temporary", message: "\u4F59\u989D\u67E5\u8BE2\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0", wallets: [], scope: null, updatedAt: null }), 2e4);
      })]);
    } catch {
      return { source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", failure: "temporary", message: "\u6765\u6E90\u914D\u7F6E\u6216\u4F59\u989D\u67E5\u8BE2\u5931\u8D25", wallets: [], scope: null, updatedAt: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async fetchSource(source) {
    const config = providerConfig(this.ctx, source);
    const view = { source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : config.ref, status: "unavailable", message: "\u5B98\u65B9\u6A21\u578B\u6765\u6E90\u672A\u542F\u7528\u6216\u4F7F\u7528\u4E86\u4EE3\u7406", updatedAt: null, scope: null, wallets: [] };
    if (!config.official) return { ...view, failure: "configuration" };
    try {
      if (source === "api-key") {
        const credentials = this.ctx.get("credentials");
        const hit = await credentials.resolve(config.ref);
        if (!hit?.value) return { ...view, status: "missing-key", failure: "credentials", message: "\u5C1A\u672A\u914D\u7F6E API Key" };
        if (!/^\S+$/.test(hit.value)) return { ...view, status: "failed", failure: "credentials", message: "API Key \u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u5728 DSH \u6A21\u578B\u8BBE\u7F6E\u4E2D\u66F4\u65B0" };
        const scope2 = fingerprint("key:" + hit.value);
        const res = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: "Bearer " + hit.value }, signal: AbortSignal.timeout(15e3), redirect: "error" });
        if (!res.ok) return { ...view, status: "failed", failure: res.status === 401 || res.status === 403 ? "credentials" : "temporary", message: res.status === 401 || res.status === 403 ? "API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F" : "\u4F59\u989D\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF08HTTP " + res.status + "\uFF09" };
        const data = object(await res.json());
        const infos = data.balance_infos;
        if (typeof data.is_available !== "boolean" || !Array.isArray(infos) || !infos.length) throw new Error("invalid");
        const wallets = infos.map((raw) => {
          const w = object(raw);
          const currency = String(w.currency);
          if (currency !== "CNY" && currency !== "USD") throw new Error("invalid");
          return { currency, total: units(String(w.total_balance)), recharge: units(String(w.topped_up_balance)), bonus: units(String(w.granted_balance)) };
        });
        if (await this.identity(source) !== scope2) return { ...view, status: "failed", failure: "identity", message: "\u51ED\u636E\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u5237\u65B0" };
        return { ...view, status: "ready", message: data.is_available ? "" : "\u8D26\u6237\u5F53\u524D\u4E0D\u53EF\u8C03\u7528\u6A21\u578B", scope: scope2, wallets, updatedAt: Date.now() };
      }
      const account = this.ctx.get("deepseekAccount");
      if (!account) return { ...view, failure: "configuration", message: "\u5F53\u524D DSH \u6CA1\u6709\u8D26\u53F7\u670D\u52A1" };
      if ((await account.getState()).status === "signed-out") return { ...view, status: "signed-out", failure: "credentials", message: "\u5C1A\u672A\u767B\u5F55 DeepSeek \u8D26\u53F7" };
      const profile = await account.getProfile(this.client).catch(() => null);
      const scope = await this.identity(source);
      if (!scope) return { ...view, status: "signed-out", failure: "credentials", message: "\u8D26\u53F7\u767B\u5F55\u5DF2\u5931\u6548" };
      const result = await account.getBalance(this.client);
      if (!result) return { ...view, status: "signed-out", failure: "credentials", message: "\u8D26\u53F7\u767B\u5F55\u5DF2\u5931\u6548" };
      if (result.status !== "ready") return { ...view, status: "failed", failure: "temporary", message: "\u8D26\u53F7\u4F59\u989D\u67E5\u8BE2\u5931\u8D25" };
      if (await this.identity(source) !== scope) return { ...view, status: "failed", failure: "identity", message: "\u767B\u5F55\u8D26\u53F7\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u5237\u65B0" };
      const grouped = /* @__PURE__ */ new Map();
      for (const [rows, field] of [[result.value, "recharge"], [result.bonusWallets, "bonus"]]) {
        for (const raw of rows) {
          if (raw.currency !== "CNY" && raw.currency !== "USD") throw new Error("invalid");
          const wallet = grouped.get(raw.currency) ?? { currency: raw.currency, total: 0, recharge: 0, bonus: 0 };
          wallet[field] += units(raw.balance);
          wallet.total = wallet.recharge + wallet.bonus;
          if (!Number.isSafeInteger(wallet.total)) throw new Error("invalid");
          grouped.set(raw.currency, wallet);
        }
      }
      if (!grouped.size) return { ...view, status: "failed", failure: "configuration", message: "\u8D26\u53F7\u5C1A\u65E0\u4F59\u989D\u94B1\u5305" };
      return { ...view, label: profile?.status === "ready" && profile.value.name ? profile.value.name : "DeepSeek \u8D26\u53F7", status: "ready", message: "", scope, wallets: [...grouped.values()], updatedAt: Date.now() };
    } catch {
      return { ...view, status: "failed", failure: "temporary", message: "\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0" };
    }
  }
};

// src/persistence.ts
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync, constants, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  writeFileSync(path + ".tmp", JSON.stringify(value), { mode: 384 });
  renameSync(path + ".tmp", path);
}
function loadState(path) {
  if (!existsSync(path)) return emptyState();
  const p = JSON.parse(readFileSync(path, "utf8"));
  if (!p || ![1, 2, 3].includes(p.version) || !p.books || !Array.isArray(p.calls) || !p.settings || !p.seen) throw new Error("\u8D26\u672C\u7ED3\u6784\u5F02\u5E38\uFF0C\u5DF2\u505C\u6B62\u5199\u5165\u4EE5\u4FDD\u62A4\u539F\u8BB0\u5F55");
  if (p.version < 3) {
    const backup = path + ".v" + p.version + ".bak";
    if (!existsSync(backup)) copyFileSync(path, backup, constants.COPYFILE_EXCL);
    const old = p.settings;
    p.settings = { ...structuredClone(DEFAULT_SETTINGS), ...old, snap: parseSnap(old.snap ?? DEFAULT_SETTINGS.snap) };
    if (p.version === 1) Object.assign(p, emptyV2Fields());
    const patch = { ...old, events: void 0 };
    if (patch.displayMode === null) delete patch.displayMode;
    const characters = CHARACTERS.map((c) => c.id);
    if (/^user-[a-f\d-]{36}$/.test(old.character)) characters.push(old.character);
    p.settings = parseSettings(patch, p.settings, characters);
    if (!p.bubbles || !p.bookPreferences || !Array.isArray(p.notifications)) throw new Error("\u8D26\u672C v2 \u7ED3\u6784\u5F02\u5E38\uFF0C\u5DF2\u505C\u6B62\u8FC1\u79FB");
    p.bubbles = parseBubbles(p.bubbles);
    for (const e of Object.values(p.settings.events)) e.content = parseDefinition(e.content);
    p.soundPlayed = [];
    p.version = 3;
    atomicJson(path, p);
  }
  if (!p.bubbles || !p.bookPreferences || !Array.isArray(p.notifications)) throw new Error("\u8D26\u672C v2 \u7ED3\u6784\u5F02\u5E38\uFF0C\u5DF2\u505C\u6B62\u5199\u5165");
  if (!Array.isArray(p.soundPlayed)) throw new Error("\u901A\u77E5\u53BB\u91CD\u8BB0\u5F55\u5F02\u5E38\uFF0C\u5DF2\u505C\u6B62\u5199\u5165");
  p.settings = { ...structuredClone(DEFAULT_SETTINGS), ...p.settings, snap: parseSnap(p.settings.snap) };
  p.bubbles = parseBubbles(p.bubbles);
  for (const e of Object.values(p.settings.events)) e.content = parseDefinition(e.content);
  return p;
}
function archive(path) {
  if (!existsSync(path)) return { version: 1, calls: [], books: {} };
  const a = JSON.parse(readFileSync(path, "utf8"));
  if (a.version !== 1 || !Array.isArray(a.calls) || !a.books) throw new Error("\u5F52\u6863\u683C\u5F0F\u5F02\u5E38");
  return a;
}
function saveState(path, state, now = Date.now()) {
  const cut = now - 90 * 864e5, kept = state.calls.filter((c) => c.at >= cut).slice(-2e4), ids = new Set(kept.map((c) => c.id)), groups = /* @__PURE__ */ new Map();
  const group = (month) => {
    let a = groups.get(month);
    if (!a) {
      a = archive(join(dirname(path), "archive", month + ".json"));
      groups.set(month, a);
    }
    return a;
  };
  for (const c of state.calls) if (!ids.has(c.id)) group(new Date(c.at + 8 * 36e5).toISOString().slice(0, 7)).calls.push(c);
  const oldDays = [];
  for (const [key, book] of Object.entries(state.books)) for (const [day, row] of Object.entries(book.days)) if (row.lastAt < now - 365 * 864e5) {
    const a = group(day.slice(0, 7));
    const target = a.books[key] ??= { ...book, days: {} };
    target.days[day] = row;
    oldDays.push({ key, day });
  }
  for (const [month, a] of groups) {
    a.calls = [...new Map(a.calls.map((c) => [c.id, c])).values()];
    atomicJson(join(dirname(path), "archive", month + ".json"), a);
  }
  state.calls = kept;
  for (const { key, day } of oldDays) delete state.books[key].days[day];
  prune(state, now);
  atomicJson(path, state);
}
function archivedState(path, active, minDay) {
  const dir = join(dirname(path), "archive");
  if (!existsSync(dir)) return active;
  const result = structuredClone(active);
  for (const file of readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f) && (!minDay || f.slice(0, 7) >= minDay.slice(0, 7)))) {
    const a = archive(join(dir, file));
    result.calls.push(...a.calls);
    for (const [key, b] of Object.entries(a.books)) {
      const book = result.books[key] ??= { ...b, days: {} };
      book.days = { ...b.days, ...book.days };
    }
  }
  result.calls = [...new Map(result.calls.map((c) => [c.id, c])).values()];
  return result;
}

// src/resources.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, existsSync as existsSync2, unlinkSync } from "node:fs";
import { join as join2 } from "node:path";
import { randomUUID } from "node:crypto";
var MIME = { png: "image/png", apng: "image/png", gif: "image/gif", jpg: "image/jpeg", webp: "image/webp", wav: "audio/wav", ogg: "audio/ogg" };
function sniff(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let at = 8;
    while (at + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(at), type = bytes.toString("ascii", at + 4, at + 8);
      if (type === "acTL") return "apng";
      if (type === "IDAT") break;
      if (size > bytes.length - at - 12) break;
      at += size + 12;
    }
    return "png";
  }
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "gif";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE" && bytes.length >= 44) return "wav";
  return null;
}
var ResourceStore = class {
  dir;
  path;
  custom;
  constructor(home) {
    this.dir = join2(home, "deepseek-whale-lite", "resources");
    this.path = join2(this.dir, "index.json");
    this.custom = existsSync2(this.path) ? JSON.parse(readFileSync2(this.path, "utf8")) : { assets: [], groups: [] };
    if (!Array.isArray(this.custom.assets) || !Array.isArray(this.custom.groups)) throw new Error("\u8D44\u6E90\u7D22\u5F15\u5F02\u5E38");
  }
  catalog() {
    const assets = [...CHARACTERS.map((c) => ({ id: c.id, kind: "role", name: c.name, format: "png", mime: MIME.png, builtin: true, pinned: false, createdAt: 0, url: PREFIX + "/characters/" + c.id + ".png" })), ...["press", "release", "complete", "alert"].map((id, index) => ({ id, kind: "audio", name: ["Kenney \xB7 \u6309\u4E0B", "Kenney \xB7 \u677E\u5F00", "Kenney \xB7 \u5B8C\u6210", "Kenney \xB7 \u63D0\u9192"][index], format: "ogg", mime: MIME.ogg, builtin: true, pinned: false, createdAt: 0, url: PREFIX + "/sounds/" + id + ".ogg" })), ...this.custom.assets];
    const groups = [{ id: "group-default", name: "Kenney \xB7 \u9ED8\u8BA4\u97F3\u6548\u7EC4", press: "press", release: "release", builtin: true, pinned: false }, ...this.custom.groups];
    return { assets: assets.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt), groups: groups.sort((a, b) => Number(b.pinned) - Number(a.pinned)) };
  }
  asset(id) {
    return this.catalog().assets.find((a) => a.id === id);
  }
  binary(id) {
    const a = this.asset(id);
    if (!a) throw Object.assign(new Error("\u627E\u4E0D\u5230\u7D20\u6750"), { status: 404 });
    const path = a.builtin ? new URL("../assets/" + (a.kind === "role" ? "characters/" : "sounds/") + a.id + "." + a.format, import.meta.url) : join2(this.dir, a.id + "." + a.format);
    return { bytes: readFileSync2(path), mime: a.mime };
  }
  mutate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("\u8D44\u6E90\u53C2\u6570\u65E0\u6548");
    const v = input, id = String(v.id ?? "");
    if (v.action === "import") {
      const kind = v.kind;
      if (!["role", "image", "audio"].includes(kind)) throw new Error("\u8D44\u6E90\u7C7B\u578B\u65E0\u6548");
      const data = String(v.data ?? ""), m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);
      if (!m) throw new Error("\u8D44\u6E90\u7F16\u7801\u65E0\u6548");
      const bytes = Buffer.from(m[2], "base64"), format = sniff(bytes), max = (kind === "role" ? 20 : 8) * 1024 * 1024;
      if (!format || !bytes.length || bytes.length > max || MIME[format] !== m[1] || kind === "audio" !== (format === "wav")) throw new Error("\u8D44\u6E90\u683C\u5F0F\u6216\u5927\u5C0F\u65E0\u6548\uFF1B\u89D2\u8272\u6700\u591A 20MB\uFF0C\u6C14\u6CE1\u56FE\u7247\uFF0FWAV \u7247\u6BB5\u6700\u591A 8MB");
      const id2 = "user-" + randomUUID();
      mkdirSync2(this.dir, { recursive: true, mode: 448 });
      const path = join2(this.dir, id2 + "." + format);
      writeFileSync2(path, bytes, { mode: 384 });
      const a2 = { id: id2, kind, name: String(v.name ?? "\u672A\u547D\u540D\u7D20\u6750").slice(0, 80) || "\u672A\u547D\u540D\u7D20\u6750", format, mime: MIME[format], builtin: false, pinned: false, createdAt: Date.now(), url: PREFIX + "/asset?id=" + id2 };
      this.custom.assets.push(a2);
      try {
        atomicJson(this.path, this.custom);
      } catch (error) {
        this.custom.assets.pop();
        unlinkSync(path);
        throw error;
      }
      return this.catalog();
    }
    const before = structuredClone(this.custom), a = this.custom.assets.find((a2) => a2.id === id), g = this.custom.groups.find((g2) => g2.id === id);
    if (v.action === "pin") {
      if (!a && !g) throw new Error("\u53EA\u80FD\u7F6E\u9876\u81EA\u5B9A\u4E49\u7D20\u6750");
      if (typeof v.pinned !== "boolean") throw new Error("\u7F6E\u9876\u53C2\u6570\u65E0\u6548");
      (a ?? g).pinned = v.pinned;
    } else if (v.action === "delete") {
      if (!a && !g) throw new Error("\u4E0D\u80FD\u5220\u9664\u5185\u7F6E\u7D20\u6750");
      if (a) {
        this.custom.assets = this.custom.assets.filter((x) => x.id !== id);
        for (const group of this.custom.groups) {
          if (group.press === id) group.press = "";
          if (group.release === id) group.release = "";
        }
      }
      if (g) this.custom.groups = this.custom.groups.filter((x) => x.id !== id);
    } else if (v.action === "group") {
      const press = String(v.press ?? ""), release = String(v.release ?? "");
      for (const ref of [press, release]) if (ref && this.asset(ref)?.kind !== "audio") throw new Error("\u97F3\u6548\u7247\u6BB5\u4E0D\u5B58\u5728");
      const name2 = String(v.name ?? "\u81EA\u5B9A\u4E49\u97F3\u6548\u7EC4").slice(0, 80) || "\u81EA\u5B9A\u4E49\u97F3\u6548\u7EC4";
      if (g) {
        g.name = name2;
        g.press = press;
        g.release = release;
      } else {
        if (id) throw new Error("\u97F3\u6548\u7EC4\u4E0D\u5B58\u5728");
        this.custom.groups.push({ id: "group-" + randomUUID(), name: name2, press, release, builtin: false, pinned: false });
      }
    } else throw new Error("\u672A\u77E5\u8D44\u6E90\u64CD\u4F5C");
    try {
      atomicJson(this.path, this.custom);
    } catch (error) {
      this.custom = before;
      throw error;
    }
    if (v.action === "delete" && a) {
      const path = join2(this.dir, a.id + "." + a.format);
      if (existsSync2(path)) unlinkSync(path);
    }
    return this.catalog();
  }
};

// src/notifications.ts
var EVENT_LABELS = { complete: "\u6BCF\u8F6E\u5B8C\u6210", low: "\u4F4E\u4F59\u989D\u63D0\u9192", budget: "\u4ECA\u65E5\u9884\u7B97", question: "\u7B49\u5F85\u63D0\u95EE", approval: "\u7B49\u5F85\u6388\u6743" };
function parseEvents(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("\u63D0\u9192\u8BBE\u7F6E\u65E0\u6548");
  const result = structuredClone(DEFAULT_SETTINGS.events);
  for (const kind of Object.keys(EVENT_LABELS)) {
    const v = value[kind];
    if (!v || ["enabled", "bubble", "sound"].some((k) => typeof v[k] !== "boolean") || typeof v.closeSeconds !== "number" || !Number.isInteger(v.closeSeconds) || v.closeSeconds < 0 || v.closeSeconds > 86400 || !(v.volume === null || typeof v.volume === "number" && v.volume >= 0 && v.volume <= 1) || typeof v.audio !== "string" || v.audio.length > 100) throw new Error("\u63D0\u9192\u8BBE\u7F6E\u65E0\u6548");
    result[kind] = { ...v, content: parseDefinition(v.content) };
  }
  return result;
}

// src/pricing.ts
var ranges = [["01-01", "01-03"], ["02-15", "02-23"], ["04-04", "04-06"], ["05-01", "05-05"], ["06-19", "06-21"], ["09-25", "09-27"], ["10-01", "10-07"]];
var HOLIDAYS = ranges.flatMap(([start, end]) => {
  const days = [];
  for (let n = Date.parse("2026-" + start + "T00:00:00Z"); n <= Date.parse("2026-" + end + "T00:00:00Z"); n += 864e5) days.push(new Date(n).toISOString().slice(0, 10));
  return days;
});
function period(at) {
  const d = new Date(at + 8 * 36e5), day = d.toISOString().slice(0, 10), h = d.getUTCHours();
  if ([0, 6].includes(d.getUTCDay()) || !(h >= 9 && h < 12 || h >= 14 && h < 18)) return "off-peak";
  if (d.getUTCFullYear() !== 2026) return "unknown";
  return HOLIDAYS.includes(day) ? "off-peak" : "peak";
}
function pricingSnapshot(at = Date.now()) {
  const status = period(at);
  let nextAt = null;
  if (status !== "unknown") for (let n = Math.floor(at / 36e5) * 36e5 + 36e5; n <= at + 8 * 864e5; n += 36e5) {
    if (period(n) !== status) {
      nextAt = n;
      break;
    }
  }
  return { status, nextAt, calendarYear: 2026, holidays: HOLIDAYS };
}

// src/engine.ts
var Engine = class {
  state;
  sources;
  resources;
  path;
  closed = false;
  balances;
  flights = {};
  queue = Promise.resolve();
  titles = /* @__PURE__ */ new Map();
  providers = /* @__PURE__ */ new Map();
  constructor(ctx, home) {
    this.sources = new Sources(ctx);
    this.path = join3(home, "deepseek-whale-lite", "state.json");
    this.state = loadState(this.path);
    this.resources = new ResourceStore(home);
    const pending = (source) => ({ source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", message: "\u7B49\u5F85\u5237\u65B0", wallets: [], updatedAt: null, scope: null });
    this.balances = { account: pending("account"), "api-key": pending("api-key") };
  }
  save() {
    if (!this.closed) saveState(this.path, this.state);
  }
  refresh(source) {
    const running = this.flights[source];
    if (running) return running;
    const previous = this.balances[source];
    const promise = this.sources.fetch(source).then(async (view) => {
      if (this.closed) return view;
      if (view.failure === "temporary" && previous.scope && previous.updatedAt && previous.wallets.length) {
        const identity = await this.sources.identity(source).catch(() => null);
        if (identity === previous.scope) view = { ...previous, status: "failed", failure: "temporary", stale: true, message: "\u7F13\u5B58\u4F59\u989D \xB7 \u5237\u65B0\u5931\u8D25\uFF1A" + view.message };
      }
      if (this.closed) return view;
      this.balances[source] = view;
      if (view.status === "ready" && view.scope && view.updatedAt) for (const w of view.wallets) {
        observe(this.state, source, view.scope, w.currency, w.total, view.updatedAt);
        this.checkAlerts(source, view.scope, w.currency, w.total, view.updatedAt);
      }
      this.save();
      return view;
    }).catch(() => {
      const view = { source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", message: "\u4F59\u989D\u6216\u8D26\u672C\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", scope: null, updatedAt: null, wallets: [] };
      if (!this.closed) this.balances[source] = view;
      return view;
    }).finally(() => {
      delete this.flights[source];
    });
    this.flights[source] = promise;
    return promise;
  }
  async initialize() {
    await Promise.all(SOURCES.map((s) => this.refresh(s)));
    if (this.state.settings.displayMode === null) {
      this.state.settings.displayMode = initialMode(this.balances);
      this.save();
    }
  }
  snapshot() {
    return { settings: this.state.settings, balances: this.balances, completionSeq: this.state.completionSeq, pricing: pricingSnapshot(), title: [...this.titles.values()].at(-1) ?? "\u5F53\u524D\u5BF9\u8BDD" };
  }
  settings(input) {
    const patch = object(input), events = "events" in patch ? parseEvents(patch.events) : this.state.settings.events;
    const next = parseSettings(input, this.state.settings, this.resources.catalog().assets.filter((a) => a.kind === "role").map((a) => a.id));
    next.events = events;
    if (!this.resources.catalog().groups.some((g) => g.id === next.pressGroup)) throw new Error("\u6309\u538B\u97F3\u6548\u7EC4\u4E0D\u5B58\u5728");
    for (const e of Object.values(events)) if (e.audio && this.resources.asset(e.audio)?.kind !== "audio" && !this.resources.catalog().groups.some((g) => g.id === e.audio)) throw new Error("\u63D0\u9192\u97F3\u6548\u4E0D\u5B58\u5728");
    this.state.settings = next;
    for (const source of SOURCES) {
      const v = this.balances[source];
      if (v.status === "ready" && v.scope) for (const w of v.wallets) this.checkAlerts(source, v.scope, w.currency, w.total, v.updatedAt ?? Date.now());
    }
    this.save();
  }
  bubbles(input) {
    const next = parseBubbles(input);
    if (next.revision !== this.state.bubbles.revision) throw Object.assign(new Error("\u6C14\u6CE1\u914D\u7F6E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u7F16\u8F91\u5668"), { status: 409 });
    next.revision++;
    this.state.bubbles = next;
    this.save();
  }
  rows(all = false) {
    return history(all ? archivedState(this.path, this.state) : this.state);
  }
  records(all = false) {
    return (all ? archivedState(this.path, this.state) : this.state).calls;
  }
  preferences(source, scope, currency) {
    return this.state.bookPreferences[bookKey(source, scope, currency)] ?? { low: this.state.settings.lowBalance[currency], budget: 0, budgetOn: false };
  }
  setPreferences(input) {
    const v = object(input), source = v.source, currency = v.currency, scope = String(v.scope), key = bookKey(source, scope, currency);
    if (!this.state.books[key] || typeof v.budgetOn !== "boolean" || [v.low, v.budget].some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1e6)) throw new Error("\u8D26\u672C\u63D0\u9192\u8BBE\u7F6E\u65E0\u6548");
    this.state.bookPreferences[key] = { low: v.low, budget: v.budget, budgetOn: v.budgetOn };
    const balance = this.balances[source];
    if (balance.scope === scope) {
      const wallet = balance.wallets.find((w) => w.currency === currency);
      if (wallet) this.checkAlerts(source, scope, currency, wallet.total, balance.updatedAt ?? Date.now());
    }
    this.save();
  }
  checkAlerts(source, scope, currency, balance, at) {
    const key = bookKey(source, scope, currency), prefs = this.preferences(source, scope, currency), row = this.state.books[key]?.days[dayKey(at)];
    for (const [kind, active, amount, id] of [["low", balance < units(prefs.low), balance, "low:" + key], ["budget", prefs.budgetOn && prefs.budget > 0 && !!row && correctedAmount(row) >= units(prefs.budget), row ? correctedAmount(row) : 0, "budget:" + key + ":" + dayKey(at)]]) {
      const on = active && this.state.settings.events[kind].enabled;
      if (on && !this.state.alertState[id]) this.notify({ id: id + ":" + at, kind, at, session: "", title: "", source, scope, currency, amount, pending: false });
      this.state.alertState[id] = on;
    }
  }
  notify(value) {
    if (this.state.notifications.some((n) => n.id === value.id)) return;
    this.state.notifications.push({ ...value, seq: ++this.state.notificationSeq });
  }
  dismiss(id) {
    if (!this.state.notifications.some((n) => n.id === id)) return;
    if (!this.state.dismissed.includes(id)) this.state.dismissed.push(id);
    this.save();
  }
  claimSound(id) {
    const n = this.state.notifications.find((n2) => n2.id === id);
    if (!n || this.state.soundPlayed.includes(id) || this.state.dismissed.includes(id)) return false;
    this.state.soundPlayed.push(id);
    this.save();
    const cfg = this.state.settings.events[n.kind];
    return this.state.settings.sound && cfg.enabled && cfg.sound && !!cfg.audio && (!["question", "approval"].includes(n.kind) || n.pending);
  }
  notifications(after) {
    return { seq: this.state.notificationSeq, items: this.state.notifications.filter((n) => n.seq > after && !this.state.dismissed.includes(n.id)), pending: this.state.notifications.filter((n) => n.pending && !this.state.dismissed.includes(n.id)) };
  }
  async adjust(input) {
    const v = object(input), source = v.source, currency = v.currency, scope = String(v.scope), day = String(v.day);
    if (!SOURCES.includes(source) || !["CNY", "USD"].includes(currency) || !this.state.books[bookKey(source, scope, currency)] || typeof v.revision !== "string") throw new Error("\u6821\u6B63\u8D26\u672C\u65E0\u6548");
    const book = this.state.books[bookKey(source, scope, currency)];
    if (!book.days[day]) {
      const old = archivedState(this.path, this.state).books[bookKey(source, scope, currency)]?.days[day];
      if (old) book.days[day] = old;
    }
    if (day === dayKey()) {
      const fresh = await this.refresh(source);
      if (fresh.status !== "ready") throw Object.assign(new Error("\u6682\u65F6\u65E0\u6CD5\u5237\u65B0\u4F59\u989D\uFF0C\u8BF7\u7A0D\u540E\u4FDD\u5B58"), { status: 503 });
      if (fresh.scope !== scope || !fresh.wallets.some((w) => w.currency === currency)) throw Object.assign(new Error("\u5F53\u524D\u6765\u6E90\u8EAB\u4EFD\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u6838\u5BF9"), { status: 409 });
    }
    const row = reconcile(this.state, { source, scope, currency, day, revision: v.revision, credits: String(v.credits ?? ""), otherDebits: String(v.otherDebits ?? "0"), confirmed: v.confirmed === true, reset: v.reset === true });
    if (day === dayKey()) {
      const wallet = this.balances[source].wallets.find((w) => w.currency === currency);
      if (wallet) this.checkAlerts(source, scope, currency, wallet.total, Date.now());
    }
    this.save();
    return row;
  }
  event(session, event) {
    this.queue = this.queue.then(() => this.handle(session, event)).catch(() => {
      console.warn("[deepseek-whale-lite] \u4F1A\u8BDD\u7EDF\u8BA1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u672C\u5730\u6570\u636E\u76EE\u5F55");
    });
    return this.queue;
  }
  async handle(session, event) {
    if (this.closed || !Number.isSafeInteger(event.seq) || event.seq < 0 || session.isOwnSeq && !session.isOwnSeq(event.seq)) return;
    const data = object(event.data), turn = data.turn, step = data.step, sid = session.id;
    if (event.type === "session/title") {
      if (typeof data.title === "string") this.titles.set(sid, data.title.slice(0, 120));
      return;
    }
    if ((this.state.seen[sid] ?? -1) >= event.seq) return;
    try {
      const service = this.sources.ctx.get("sessionTitle");
      const raw = service?.get?.(session), title = typeof raw === "string" ? raw : object(raw).title ?? object(raw).text;
      if (typeof title === "string") this.titles.set(sid, title.slice(0, 120));
    } catch {
    }
    const message = object(data.message), content = Array.isArray(message.content) ? message.content.map(object) : [], part = content.find((c) => c.toolCallId || c.tool_call_id);
    const cid = String(message.callId ?? message.toolCallId ?? message.tool_call_id ?? part?.toolCallId ?? part?.tool_call_id ?? data.callId ?? data.call_id ?? data.toolCallId ?? data.id ?? "");
    if (event.type === "tool/result") {
      for (const n of this.state.notifications) if (n.pending && n.session === sid && n.kind === "question" && (!cid || n.id === "question:" + sid + ":" + cid)) n.pending = false;
      this.save();
      return;
    }
    if (event.type.startsWith("approval/") && event.type !== "approval/asked") {
      for (const n of this.state.notifications) if (n.pending && n.session === sid && n.kind === "approval" && (!cid || n.id === "approval:" + sid + ":" + cid)) n.pending = false;
      this.save();
      return;
    }
    if (event.type === "turn/start") {
      for (const n of this.state.notifications) if (n.pending && n.session === sid) n.pending = false;
      this.providers.delete(sid);
      this.save();
      return;
    }
    if (event.type === "tool/call" && String(data.name ?? data.toolName) === "ask_user_question" || event.type === "approval/asked") {
      const source = this.providers.get(sid);
      if (!source || !cid) return;
      const kind = event.type === "approval/asked" ? "approval" : "question";
      this.notify({ id: kind + ":" + sid + ":" + cid, kind, at: event.time, session: sid, title: this.titles.get(sid) ?? "\u5F53\u524D\u5BF9\u8BDD", source, pending: true });
      this.save();
      return;
    }
    if (!Number.isSafeInteger(turn)) return;
    const key = sid + ":" + String(turn);
    if (event.type === "step/start") {
      const scopes = {};
      await Promise.all(SOURCES.map(async (s) => {
        try {
          const id = await this.sources.identity(s);
          if (id) scopes[s] = id;
        } catch {
        }
      }));
      this.state.turnScopes[key + ":" + String(step)] = scopes;
      return;
    }
    if (event.type === "assistant/message") {
      const id = sid + ":" + event.seq;
      if ((this.state.seen[sid] ?? -1) >= event.seq || this.state.calls.some((c) => c.id === id)) return;
      const src = object(object(data.message).source), source = src.provider === "deepseek-account" ? "account" : src.provider === "deepseek-official" ? "api-key" : null;
      const official = source && providerConfig(this.sources.ctx, source).official;
      this.providers.set(sid, official ? source : null);
      const usage = validUsage(data.usage);
      if (!source || !official || !usage || typeof src.model !== "string") return;
      const scope = this.state.turnScopes[key + ":" + String(step)]?.[source] ?? await this.sources.identity(source);
      if (!scope) return;
      this.state.calls.push({ id, session: sid, turn, at: event.time, source, scope, model: src.model, usage, costs: estimate(src.model, usage) });
      this.save();
    }
    if (event.type === "turn/end") {
      if ((this.state.seen[sid] ?? -1) >= event.seq) return;
      const calls = this.state.calls.filter((c) => c.session === sid && c.turn === turn);
      if (calls.length) {
        const completion = { seq: ++this.state.completionSeq, session: sid, turn, at: event.time, reason: String(object(data.reason).kind ?? "completed"), calls };
        this.state.completions.push(completion);
        this.notify({ id: "complete:" + key, kind: "complete", at: event.time, session: sid, title: this.titles.get(sid) ?? "\u5F53\u524D\u5BF9\u8BDD", completion, pending: false });
      }
      for (const n of this.state.notifications) if (n.pending && n.session === sid) n.pending = false;
      this.providers.delete(sid);
      this.state.seen[sid] = event.seq;
      for (const k of Object.keys(this.state.turnScopes)) if (k.startsWith(key + ":")) delete this.state.turnScopes[k];
      this.save();
      for (const source of new Set(calls.map((c) => c.source))) void this.refresh(source);
    }
  }
  disposeSession(id) {
    this.titles.delete(id);
    this.providers.delete(id);
    for (const n of this.state.notifications) if (n.session === id) n.pending = false;
    for (const k of Object.keys(this.state.turnScopes)) if (k.startsWith(id + ":")) delete this.state.turnScopes[k];
    this.save();
  }
};

// src/ledger-stats.ts
function modelLabel(model) {
  if (model === "deepseek-flash") return "DeepSeek V4.1 Flash";
  if (["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"].includes(model)) return model + "\uFF08\u65E7\u540D \xB7 \u540C V4.1 Flash\uFF09";
  if (model === "deepseek-v4-pro") return "DeepSeek V4 Pro";
  return model;
}
function modelMatches(model, query) {
  return model.toLowerCase().includes(query.toLowerCase()) || modelLabel(model).toLowerCase().includes(query.toLowerCase());
}
function modelStats(records, currency) {
  const result = /* @__PURE__ */ new Map();
  for (const call of records) for (const c of currency ? [currency] : ["CNY", "USD"]) {
    const key = [call.source, call.scope, c, call.model].join(":"), m = result.get(key) ?? { source: call.source, scope: call.scope, currency: c, model: call.model, count: 0, tokens: 0, low: 0, high: 0, unknown: 0 };
    m.count++;
    m.tokens += Object.values(call.usage).reduce((a, b) => a + b, 0);
    m.low += call.costs?.[c].low ?? 0;
    m.high += call.costs?.[c].high ?? 0;
    m.unknown += Number(call.costs === null);
    result.set(key, m);
  }
  return [...result.values()];
}

// src/index.ts
var name = "deepseek-whale-lite";
var loader = '(function(){try{if(!window.dshDesktop||location.protocol!=="dsh-app:")return;var s=document.createElement("script");s.src="' + PREFIX + '/widget.js";s.onerror=function(){};(document.body||document.head).appendChild(s)}catch(e){}})()';
async function body(req, max = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk);
    size += b.length;
    if (size > max) throw new Error("\u8BF7\u6C42\u8FC7\u5927");
    chunks.push(b);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
function apply(root) {
  root.on("webserver/index-inject", (raw) => {
    const rows = raw;
    if (!rows.some((row) => row.text?.includes(PREFIX + "/widget.js"))) rows.push({ kind: "script", placement: "body", text: loader });
  });
  root.inject(["webServer", "credentials", "connection", "llm", "settings", "profileContext"], (ctx) => {
    const profile = ctx.get("profileContext");
    if (profile.name !== "desktop") return;
    const engine = new Engine(ctx, profile.home);
    const web = ctx.get("webServer");
    const connection = ctx.get("connection");
    function register(path, handler) {
      const dispose = web.register({ kind: "exact", path: PREFIX + path, handler: async (req, res) => {
        let rejection;
        try {
          rejection = connection.requestRejection(req);
        } catch {
          rejection = 403;
        }
        if (rejection !== void 0) {
          json(res, { error: "\u8BF7\u6C42\u672A\u901A\u8FC7\u5BBF\u4E3B\u8EAB\u4EFD\u6821\u9A8C" }, rejection);
          return;
        }
        try {
          await handler(req, res);
        } catch (error) {
          const e = error;
          json(res, { error: e.code ? "\u672C\u5730\u8BFB\u5199\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6570\u636E\u76EE\u5F55\u6743\u9650" : e.message?.slice(0, 160) || "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, e.status ?? 400);
        }
      } });
      ctx.effect(() => dispose);
    }
    function get(req, res) {
      if (req.method === "GET") return true;
      json(res, { error: "\u4E0D\u652F\u6301\u8BE5\u8BF7\u6C42\u65B9\u6CD5" }, 405);
      return false;
    }
    register("/state", (req, res) => {
      if (get(req, res)) json(res, engine.snapshot());
    });
    register("/balance", async (req, res) => {
      if (!get(req, res)) return;
      const source = new URL(req.url || "/", "http://localhost").searchParams.get("source");
      if (source !== "account" && source !== "api-key") throw new Error("source");
      json(res, await engine.refresh(source));
    });
    register("/settings", async (req, res) => {
      if (req.method !== "PUT") {
        json(res, { error: "\u4E0D\u652F\u6301\u8BE5\u8BF7\u6C42\u65B9\u6CD5" }, 405);
        return;
      }
      engine.settings(await body(req, 512 * 1024));
      json(res, engine.state.settings);
    });
    register("/history", (req, res) => {
      if (!get(req, res)) return;
      const q = new URL(req.url || "/", "http://localhost").searchParams, range = q.get("range") ?? "today", source = q.get("source"), currency = q.get("currency"), scope = q.get("scope"), model = q.get("model") ?? "", day = q.get("day");
      if (!["today", "week", "month", "all"].includes(range) || source && !SOURCES.includes(source) || currency && !["CNY", "USD"].includes(currency)) throw new Error("\u8BB0\u5F55\u7B5B\u9009\u65E0\u6548");
      const offset = Number(q.get("offset") ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("\u5206\u9875\u53C2\u6570\u65E0\u6548");
      const cut = dayKey(Date.now() - (range === "week" ? 6 : range === "month" ? 29 : 0) * 864e5), s = archivedState(engine.path, engine.state, range === "all" ? void 0 : cut);
      const matches = (r) => (!source || r.source === source) && (!scope || r.scope === scope) && (!currency || !r.currency || r.currency === currency) && (!day || r.day === day) && (range === "all" || r.day >= cut);
      const rows = history(s).filter(matches);
      const records = s.calls.filter((c) => matches({ ...c, day: dayKey(c.at) }) && modelMatches(c.model, model)).sort((a, b) => b.at - a.at);
      json(res, { rows, records: records.slice(offset, offset + 50), models: modelStats(records, currency ?? void 0), total: records.length, more: offset + 50 < records.length });
    });
    register("/bubbles", async (req, res) => {
      if (req.method === "PUT") {
        engine.bubbles(await body(req, 512 * 1024));
        json(res, engine.state.bubbles);
      } else if (get(req, res)) json(res, engine.state.bubbles);
    });
    register("/resources", async (req, res) => {
      if (req.method === "POST") {
        const input = await body(req, 30 * 1024 * 1024), before = new Set(engine.resources.catalog().assets.map((a) => a.id)), catalog = engine.resources.mutate(input);
        const imported = catalog.assets.find((a) => !before.has(a.id) && a.kind === "role");
        if (imported) engine.state.settings.character = imported.id;
        if (!catalog.assets.some((a) => a.id === engine.state.settings.character)) engine.state.settings.character = "deepseek-smile";
        if (!catalog.groups.some((g) => g.id === engine.state.settings.pressGroup)) engine.state.settings.pressGroup = "group-default";
        for (const [kind, e] of Object.entries(engine.state.settings.events)) if (e.audio && !catalog.assets.some((a) => a.id === e.audio) && !catalog.groups.some((g) => g.id === e.audio)) e.audio = kind === "complete" ? "complete" : "alert";
        engine.save();
        json(res, catalog);
      } else if (get(req, res)) json(res, engine.resources.catalog());
    });
    register("/asset", (req, res) => {
      if (!get(req, res)) return;
      const id = new URL(req.url || "/", "http://localhost").searchParams.get("id") ?? "";
      const asset = engine.resources.binary(id);
      res.writeHead(200, { "Content-Type": asset.mime, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
      res.end(asset.bytes);
    });
    register("/notifications", async (req, res) => {
      if (req.method === "PUT") {
        const v = await body(req);
        if (typeof v.id !== "string") throw new Error("\u901A\u77E5 ID \u65E0\u6548");
        if (v.action === "claim-sound") {
          json(res, { play: engine.claimSound(v.id) });
          return;
        }
        if (v.action && v.action !== "dismiss") throw new Error("\u901A\u77E5\u64CD\u4F5C\u65E0\u6548");
        engine.dismiss(v.id);
        json(res, { ok: true });
      } else if (get(req, res)) {
        const after = Number(new URL(req.url || "/", "http://localhost").searchParams.get("after") ?? 0);
        if (!Number.isSafeInteger(after) || after < 0) throw new Error("\u901A\u77E5\u6E38\u6807\u65E0\u6548");
        json(res, engine.notifications(after));
      }
    });
    register("/book-preferences", async (req, res) => {
      if (req.method === "PUT") {
        engine.setPreferences(await body(req));
        json(res, engine.state.bookPreferences);
      } else if (get(req, res)) json(res, engine.state.bookPreferences);
    });
    register("/adjustments", async (req, res) => {
      if (req.method === "PUT") {
        json(res, await engine.adjust(await body(req)));
        return;
      }
      if (!get(req, res)) return;
      const q = new URL(req.url || "/", "http://localhost").searchParams, source = q.get("source"), scope = q.get("scope"), currency = q.get("currency");
      if (!SOURCES.includes(source) || !scope || !["CNY", "USD"].includes(currency ?? "")) throw new Error("\u6821\u6B63\u6765\u6E90\u65E0\u6548");
      await engine.refresh(source);
      json(res, { rows: engine.rows(true).filter((r) => r.source === source && r.scope === scope && r.currency === currency && r.observed) });
    });
    register("/completions", (req, res) => {
      if (!get(req, res)) return;
      const after = Number(new URL(req.url || "/", "http://localhost").searchParams.get("after") || 0);
      json(res, { seq: engine.state.completionSeq, items: engine.state.completions.filter((c) => c.seq > after) });
    });
    const files = new Map([
      ["/widget.js", { url: new URL("./widget.js", import.meta.url), type: "text/javascript; charset=utf-8" }],
      ...CHARACTERS.map((c) => ["/characters/" + c.id + ".png", { url: new URL("../assets/characters/" + c.id + ".png", import.meta.url), type: "image/png" }]),
      ...["press", "release", "complete", "alert"].map((s) => ["/sounds/" + s + ".ogg", { url: new URL("../assets/sounds/" + s + ".ogg", import.meta.url), type: "audio/ogg" }])
    ]);
    for (const [path, asset] of files) register(path, async (req, res) => {
      if (!get(req, res)) return;
      const bytes = await readFile(asset.url);
      res.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-cache" });
      res.end(bytes);
    });
    ctx.on("session/event", (session, event) => {
      void engine.event(session, event);
    });
    ctx.on("session/disposed", (session) => engine.disposeSession(session.id));
    void engine.initialize().catch(() => {
      console.warn("[deepseek-whale-lite] \u521D\u59CB\u5316\u5931\u8D25");
    });
    let refreshedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - refreshedAt < engine.state.settings.refreshSeconds * 1e3) return;
      refreshedAt = Date.now();
      for (const source of SOURCES) void engine.refresh(source);
    }, 1e3);
    ctx.effect(() => () => {
      clearInterval(timer);
      engine.save();
      engine.closed = true;
    });
  });
}
var index_default = { name, apply };
export {
  apply,
  index_default as default,
  name
};
