"use strict";
(() => {
  // src/bubbles.ts
  var MODULE_LABELS = { text: "\u6587\u672C", link: "\u8D85\u94FE\u63A5", "random-text": "\u968F\u673A\u8BED\u53E5", image: "\u56FE\u7247\uFF0F\u52A8\u56FE", "random-image": "\u968F\u673A\u56FE\u7247", balance: "\u603B\u4F59\u989D", recharge: "\u5145\u503C\u4F59\u989D", bonus: "\u8D60\u91D1", today: "\u4ECA\u65E5\u6D88\u8D39", peak: "\u5CF0\u8C37\u65F6\u6BB5", session: "\u5BF9\u8BDD\u540D", cost: "\u672C\u8F6E\u8D39\u7528", effect: "\u5185\u7F6E\u52A8\u6548" };
  var DEFAULT_STYLE = { font: "system-ui", size: 14, bold: false, italic: false, underline: false, color: "#536ba9", background: "", gradient: "none" };
  function moduleOf(type, id = globalThis.crypto.randomUUID()) {
    return { id, type, source: "visible", style: { ...DEFAULT_STYLE }, text: type === "text" ? "\u4F60\u597D\u5440\uFF01" : "{value}", url: "https://www.deepseek.com", assetId: "", choices: [], length: 12, currency: "auto", effect: "pet" };
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
      return { value: text(c.value), weight: num(c.weight, 1, 1e4) };
    });
    const s = record(v.style);
    m.style = { font: text(s.font, 100), size: num(s.size, 6, 48), bold: s.bold === true, italic: s.italic === true, underline: s.underline === true, color: text(s.color, 32), background: text(s.background, 32), gradient: s.gradient };
    for (const c of [m.style.color, m.style.background]) if (c && !/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(c)) throw new Error("\u989C\u8272\u65E0\u6548");
    if (!["none", "rainbow", "macaron", "bamboo"].includes(m.style.gradient)) throw new Error("\u6E10\u53D8\u65E0\u6548");
    return m;
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
    const revision = num(v.revision, 0, Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(revision)) throw new Error("\u6C14\u6CE1\u7248\u672C\u65E0\u6548");
    return { revision, steps, library };
  }
  function weightedPick(items, weight, last = -1, random = Math.random) {
    if (!items.length) return -1;
    const candidates = items.map((item, index) => ({ item, index })).filter((x) => items.length === 1 || x.index !== last);
    let n = Math.max(0, Math.min(random(), 0.999999999)) * candidates.reduce((n2, x) => n2 + weight(x.item), 0);
    for (const x of candidates) {
      n -= weight(x.item);
      if (n < 0) return x.index;
    }
    return candidates.at(-1).index;
  }
  var ClickQueue = class {
    index = -1;
    next(config, random = Math.random) {
      this.index++;
      if (this.index >= config.steps.length) {
        this.index = -1;
        return null;
      }
      const step = config.steps[this.index];
      return step.options[weightedPick(step.options, (o) => o.weight, -1, random)].bubble;
    }
    start(config) {
      this.index = -1;
      return this.next(config);
    }
  };
  function moveModule(bubble, fromRow, fromCol, toRow, toCol, newRow = false) {
    const next = structuredClone(bubble), [m] = next.rows[fromRow]?.splice(fromCol, 1) ?? [];
    if (!m) throw new Error("\u627E\u4E0D\u5230\u6A21\u5757");
    if (newRow) next.rows.splice(toRow, 0, [m]);
    else {
      const row = next.rows[toRow];
      if (!row) throw new Error("\u627E\u4E0D\u5230\u76EE\u6807\u884C");
      if (fromRow === toRow && fromCol < toCol) toCol--;
      row.splice(toCol, 0, m);
    }
    next.rows = next.rows.filter((r) => r.length);
    return parseDefinition(next);
  }

  // src/shared.ts
  var PREFIX = "/deepseek-whale-lite";
  var SOURCES = ["account", "api-key"];
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
    snap: { enabled: true, unit: "px", top: 35, right: 35, bottom: 35, left: 35 },
    events: eventDefaults()
  };

  // src/notifications.ts
  var EVENT_LABELS = { complete: "\u6BCF\u8F6E\u5B8C\u6210", low: "\u4F4E\u4F59\u989D\u63D0\u9192", budget: "\u4ECA\u65E5\u9884\u7B97", question: "\u7B49\u5F85\u63D0\u95EE", approval: "\u7B49\u5F85\u6388\u6743" };
  var rank = (n) => ["question", "approval"].includes(n.kind) ? 0 : n.kind === "budget" ? 1 : n.kind === "low" ? 2 : 3;
  var NotificationQueue = class {
    current = null;
    items = [];
    seen = /* @__PURE__ */ new Set();
    push(n) {
      if (this.seen.has(n.id)) return false;
      this.seen.add(n.id);
      if (this.seen.size > 2e4) this.seen.delete(this.seen.values().next().value);
      if (this.current && rank(n) === 0 && rank(this.current) > 0) {
        this.items.push(this.current);
        this.current = n;
      } else this.items.push(n);
      this.items.sort((a, b) => rank(a) - rank(b) || a.seq - b.seq);
      if (!this.current) this.current = this.items.shift() ?? null;
      return true;
    }
    next() {
      this.current = this.items.shift() ?? null;
      return this.current;
    }
    resolved(pending) {
      this.items = this.items.filter((n) => !n.pending || pending.has(n.id));
      if (this.current?.pending && !pending.has(this.current.id)) {
        this.next();
        return true;
      }
      return false;
    }
  };

  // src/accounting.ts
  var SCALE = 1e8;
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
  function bookKey(source, scope, currency) {
    return [source, scope, currency].join(":");
  }
  function totals(calls, currency) {
    return calls.reduce((r, c) => ({
      tokens: r.tokens + Object.values(c.usage).reduce((a, b) => a + b, 0),
      low: r.low + (c.costs?.[currency].low ?? 0),
      high: r.high + (c.costs?.[currency].high ?? 0),
      unknown: r.unknown + Number(c.costs === null)
    }), { tokens: 0, low: 0, high: 0, unknown: 0 });
  }

  // src/ui.ts
  function el(tag, text2 = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text2;
    node.className = className;
    return node;
  }
  function button(text2, action) {
    const node = el("button", text2);
    node.type = "button";
    node.onclick = action;
    return node;
  }
  function input(value, type = "text") {
    const node = el("input");
    node.type = type;
    node.value = value;
    return node;
  }
  function select(options, value) {
    const node = el("select");
    for (const [id, name] of options) node.add(new Option(name, id));
    node.value = value;
    return node;
  }
  function field(label, node) {
    const row = el("label", label, "field");
    row.append(node);
    return row;
  }
  function check(text2, value, change) {
    const node = input("", "checkbox");
    node.checked = value;
    node.onchange = () => change(node.checked);
    return field(text2, node);
  }
  function dialog(root, title, onClose = () => {
  }) {
    const previous = root.activeElement, mask = el("div", "", "mask"), card = el("div", "", "dialog"), heading = el("div", "", "dialog-heading"), body = el("div", "", "dialog-body"), footer = el("div", "", "dialog-footer"), note = el("div", "", "note");
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      mask.remove();
      onClose();
      previous?.focus();
    };
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", title);
    heading.append(el("strong", title), button("\u5173\u95ED", close));
    card.append(heading, body, note, footer);
    mask.append(card);
    root.append(mask);
    mask.onclick = (e) => {
      if (e.target === mask) close();
    };
    mask.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const nodes = [...card.querySelectorAll("button,input,select,textarea,a[href]")].filter((n) => !n.hasAttribute("disabled") && n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && root.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && root.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    heading.querySelector("button")?.focus();
    return { mask, card, body, footer, note, close };
  }
  async function report(d, action) {
    d.note.textContent = "";
    try {
      await action();
    } catch (error) {
      d.note.textContent = error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25";
      d.note.classList.add("error");
    }
  }
  var UI_CSS = `
:host{font:13px/1.5 system-ui;color:#203170;--card:#fff;--line:#c7d0e5;--muted:#7182a7;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}button,input,select,textarea{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:5px 8px}button{cursor:pointer}button:hover{background:#edf1fa}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #7a9bef;outline-offset:2px}input[type=checkbox]{width:auto}input[type=range]{max-width:100%}textarea{resize:vertical;min-height:70px;width:100%}img{object-fit:contain;max-width:100%}
.mask{position:fixed;inset:0;pointer-events:auto;background:#0e143c55;display:flex;align-items:center;justify-content:center;padding:16px}.dialog{background:var(--card);border:1px solid var(--line);border-radius:12px;width:min(740px,94vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 40px #07133740}.dialog-heading{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);flex-shrink:0}.dialog-body{padding:12px 16px;overflow:auto;min-height:0}.dialog-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;flex-shrink:0;flex-wrap:wrap}.field{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}.field input:not([type=checkbox]),.field select{max-width:65%;min-width:0}.row,.tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.note{color:var(--muted);font-size:11px;padding:0 16px;white-space:pre-line}.error{color:#a13e29}.muted{color:var(--muted);font-size:11px}.section{border-bottom:1px solid var(--line);padding:10px 0}.section summary{cursor:pointer;font-weight:650;display:list-item}.menu{position:fixed;pointer-events:auto;width:235px;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 20px #07133733;max-height:80vh;overflow:auto}.menu button{width:100%;margin:3px 0;text-align:left}.menu .field{margin:4px 0}.preview{position:relative;width:300px;height:205px;margin:auto}.editor-row{display:flex;align-items:center;gap:6px;padding:6px;border:1px dashed var(--line);margin:5px 0;min-height:40px;flex-wrap:wrap}.chip{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected{border-color:#536ba9;background:#edf1ff}.asset{display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid var(--line)}.asset img{width:45px;height:45px}.asset strong{flex:1;min-width:0;overflow-wrap:anywhere}.asset .tools{flex-shrink:0}.wave{width:100%;height:110px;display:block;background:#eff3fc;touch-action:none}.crop{width:260px;height:260px;display:block;margin:auto;background:#eff3fc;touch-action:none}.model-bar{height:7px;background:#718ce0;border-radius:4px;margin:3px 0}.record{border-bottom:1px solid var(--line);padding:8px 0}
@media(prefers-color-scheme:dark){:host{color:#d8e0f5;--card:#1e273c;--line:#4d5c7d;--muted:#a0aed0;color-scheme:dark}.selected,button:hover{background:#36476d}.wave,.crop{background:#303d5b}.error{color:#ffb49b}}
`;

  // src/bubble-view.ts
  function money(value, currency, digits = 2) {
    return (currency === "CNY" ? "\xA5" : "$") + (value / SCALE).toFixed(digits);
  }
  function sourceName(source) {
    return source === "account" ? "\u8D26\u53F7" : "Key";
  }
  function costText(calls, currency) {
    const sum = totals(calls, currency);
    return (sum.unknown ? "\u542B " + sum.unknown + " \u6B21\u8D39\u7528\u672A\u77E5\uFF1B\u5DF2\u77E5 " : "") + money(sum.low, currency, 6) + "\u2013" + money(sum.high, currency, 6);
  }
  function completionText(n, ctx) {
    if (!n.completion) return "";
    const lines = [];
    for (const source of SOURCES) for (const scope of new Set(n.completion.calls.filter((c) => c.source === source).map((c) => c.scope))) {
      const calls = n.completion.calls.filter((c) => c.source === source && c.scope === scope), view = ctx.snapshot.balances[source], currencies = view.scope === scope && view.wallets.length ? view.wallets.map((w) => w.currency) : ["CNY"];
      for (const currency of currencies) lines.push(sourceName(source) + " [" + scope.slice(0, 6) + "] " + costText(calls, currency) + " \xB7 " + totals(calls, currency).tokens + " tok");
    }
    return lines.join("\n");
  }
  function peakText(snapshot) {
    const p = snapshot.pricing, style = snapshot.settings.peakStyle;
    const label = p.status === "unknown" ? "\u65F6\u6BB5\u672A\u77E5\uFF08\u65E5\u5386\u5F85\u66F4\u65B0\uFF09" : p.status === "peak" ? style === "playful" ? "!?\u5F3A\u5F3A?!" : "\u9AD8\u5CF0\u65F6\u6BB5" : style === "playful" ? "\u6881\u6587\u5CF0\u8C37" : "\u8C37\u4EF7\u65F6\u6BB5";
    if (style !== "countdown" || !p.nextAt) return label;
    const seconds = Math.max(0, Math.ceil((p.nextAt - Date.now()) / 1e3)), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
    return label + " \xB7 " + hours + "\u65F6" + minutes + "\u5206" + seconds % 60 + "\u79D2\u540E\u5207\u6362";
  }
  var BUBBLE_SVG = `<svg viewBox="0 0 1026 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path class="shape" fill="#fff" stroke="#203170" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>
<ellipse class="dot1" cx="352" cy="561" rx="37.5" ry="26" fill="#fff" stroke="#203170" stroke-width="18"/>
<ellipse class="dot2" cx="442" cy="646" rx="24.5" ry="18" fill="#fff" stroke="#203170" stroke-width="18"/></svg>`;
  var BUBBLE_CSS = `
.speech{position:absolute;inset:0 auto auto 0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:2;background:transparent}
.speech svg{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}
.speech .shape,.speech .dot1,.speech .dot2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s,transform .2s}
.speech.open .shape,.speech.open .dot1,.speech.open .dot2{opacity:1;transform:none}
.speech.open .dot1{transition-delay:.13s}.speech.open .shape{transition-delay:.26s}
.speech:not(.open) .shape{transition-delay:.1s}.speech:not(.open) .dot1{transition-delay:.2s}.speech:not(.open) .dot2{transition-delay:.3s}
.speech.open .shape{pointer-events:visiblePainted;cursor:pointer}
.speech-content{position:absolute;left:44.25%;top:36%;width:66%;height:64%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#536ba9;line-height:1.2;opacity:0;overflow:hidden;pointer-events:none;padding:8px}
.speech.open .speech-content{opacity:1;transition:opacity .16s .36s;pointer-events:auto}
.speech-title{font-size:15px;font-weight:700;margin-bottom:7px}.speech-balance{font-size:17px;font-weight:800;margin:3px 0;overflow-wrap:anywhere}.speech-small{font-size:11px;color:#7a8bb5;margin-top:5px}
.left .speech,:host(.left) .speech{transform:scaleX(-1)}.left .speech-content,:host(.left) .speech-content{transform:translate(-50%,-50%) scaleX(-1)}
.speech-lines{max-width:100%;max-height:100%;overflow:auto;scrollbar-width:thin}.bubble-row{display:flex;justify-content:center;align-items:center;gap:4px;flex-shrink:0;margin:2px 0}.module{max-width:100%;white-space:pre-line;overflow-wrap:anywhere}.module img{max-width:170px;max-height:95px;object-fit:contain}.gradient{background-image:linear-gradient(90deg,#e665b5,#77a2ed,#71b6a1,#e665b5);background-size:250% 100%;background-clip:text;-webkit-background-clip:text;color:transparent!important;animation:gradient 5s linear infinite}.gradient.bamboo{background-image:linear-gradient(90deg,#57a165,#a6d09a,#57a165)}.gradient.macaron{background-image:linear-gradient(90deg,#e69aae,#9fafe7,#8ec6c3,#e69aae)}@keyframes gradient{to{background-position:250% 0}}
.pet-effect{position:relative;height:95px;width:110px}.pet-effect img{height:86px;animation:pet 1s ease-in-out infinite;transform-origin:bottom center}.pet-effect span{position:absolute;top:0;right:12px;font-size:30px;animation:hand 1s ease-in-out infinite}@keyframes pet{50%{transform:scale(1.08,.9)}}@keyframes hand{50%{translate:0 6px;rotate:-10deg}}.coin-effect{height:80px;display:flex;gap:6px;align-items:center}.coin-effect span{display:inline-grid;place-items:center;width:28px;height:28px;background:#f6c944;color:#967119;border:3px solid #dba230;border-radius:50%;animation:coin 1.2s ease-in-out infinite}.coin-effect span:nth-child(2){animation-delay:.2s}.coin-effect span:nth-child(3){animation-delay:.4s}@keyframes coin{50%{transform:translateY(-12px) rotateY(180deg)}}
@media(prefers-reduced-motion:reduce){.speech *{transition:none!important;animation:none!important}}
`;
  function speech() {
    const element = document.createElement("div");
    element.className = "speech open";
    element.innerHTML = BUBBLE_SVG;
    const content = document.createElement("div");
    content.className = "speech-content";
    element.append(content);
    return { element, content };
  }
  var BubbleRenderer = class {
    element;
    content;
    scene = "";
    picked = /* @__PURE__ */ new Map();
    last = /* @__PURE__ */ new Map();
    values = /* @__PURE__ */ new Map();
    frames = /* @__PURE__ */ new Set();
    constructor(initiallyOpen = true) {
      const view = speech();
      this.element = view.element;
      this.content = view.content;
      this.element.classList.toggle("open", initiallyOpen);
    }
    render(def, ctx, scene) {
      if (scene !== this.scene) {
        this.picked.clear();
        this.scene = scene;
      }
      for (const frame of this.frames) cancelAnimationFrame(frame);
      this.frames.clear();
      const lines = el("div", "", "speech-lines");
      for (const row of def.rows) {
        const r = el("div", "", "bubble-row");
        for (const m of row) r.append(this.module(m, ctx));
        lines.append(r);
      }
      this.content.replaceChildren(lines);
    }
    module(m, ctx) {
      const node = el(m.type === "link" ? "a" : "div", "", "module"), s = m.style;
      node.style.fontFamily = s.font;
      node.style.fontSize = s.size + "px";
      node.style.fontWeight = s.bold ? "700" : "400";
      node.style.fontStyle = s.italic ? "italic" : "normal";
      node.style.textDecoration = s.underline ? "underline" : "none";
      node.style.color = s.color;
      node.style.backgroundColor = s.background;
      if (s.gradient !== "none") node.classList.add("gradient", s.gradient);
      const n = ctx.notification, source = n?.source ? sourceName(n.source) : "", session = n?.title || ctx.snapshot.title;
      const replace = (text2, value = "") => text2.replace(/\{(value|cost|source|amount|session)\}/g, (_, key) => ({ value, cost: n ? completionText(n, ctx) : "\u6682\u65E0\u672C\u8F6E\u8BB0\u5F55", source, amount: n?.amount !== void 0 ? money(n.amount, n.currency ?? "CNY") : "\u2014", session })[key] ?? "");
      if (m.type === "image" || m.type === "random-image") {
        const id = m.type === "image" ? m.assetId : this.random(m), asset = ctx.catalog.assets.find((a) => a.id === id && a.kind !== "audio");
        if (asset) {
          const image = el("img");
          image.src = asset.url;
          image.alt = asset.name;
          image.onerror = () => {
            node.textContent = "\u7D20\u6750\u52A0\u8F7D\u5931\u8D25";
          };
          node.append(image);
        } else node.textContent = "\u7D20\u6750\u5DF2\u79FB\u9664";
        return node;
      }
      if (m.type === "effect") {
        node.classList.add(m.effect === "pet" ? "pet-effect" : "coin-effect");
        if (m.effect === "pet") {
          const image = el("img");
          image.src = ctx.catalog.assets.find((a) => a.id === ctx.snapshot.settings.character)?.url ?? "";
          image.alt = "\u62CD\u5934\u52A8\u6548";
          node.append(image, el("span", "\u270B"));
        } else for (let i = 0; i < 3; i++) node.append(el("span", "\u25C6"));
        return node;
      }
      if (["balance", "recharge", "bonus", "today"].includes(m.type)) {
        const sources = m.source === "visible" ? ctx.snapshot.settings.displayMode === "both" ? SOURCES : [ctx.snapshot.settings.displayMode ?? "api-key"] : [m.source];
        for (const source2 of sources) {
          const view = ctx.snapshot.balances[source2], line = el("div");
          const wallets = view.wallets.filter((w) => m.currency === "auto" || w.currency === m.currency);
          if (view.status !== "ready" || !wallets.length) line.textContent = sourceName(source2) + " " + (view.status === "ready" ? "\u2014" : view.message);
          else for (const [i, w] of wallets.entries()) {
            if (i) line.append(document.createTextNode(" / "));
            const day = ctx.rows.find((r) => r.day === dayKey() && r.source === source2 && r.scope === view.scope && r.currency === w.currency && r.observed);
            const amount = m.type === "today" ? day?.amount : m.type === "recharge" ? w.recharge : m.type === "bonus" ? w.bonus : w.total;
            const text2 = m.text.replaceAll("{source}", sourceName(source2)), parts = text2.split("{value}");
            for (const [partIndex, part] of parts.entries()) {
              line.append(document.createTextNode(replace(part)));
              if (partIndex < parts.length - 1) {
                const span = el("span");
                line.append(span);
                if (amount === void 0) span.textContent = "\u2014";
                else this.number(span, amount, w.currency, m.id + ":" + source2 + ":" + view.scope + ":" + w.currency);
              }
            }
            if (m.currency !== "auto" || wallets.length > 1) line.append(document.createTextNode(" " + w.currency));
          }
          node.append(line);
        }
        return node;
      }
      if (m.type === "peak") node.textContent = peakText(ctx.snapshot);
      else if (m.type === "session") node.textContent = m.length > 0 && session.length > m.length ? session.slice(0, m.length) + "\u2026" : session;
      else if (m.type === "cost") node.textContent = n ? completionText(n, ctx) : "\u6682\u65E0\u672C\u8F6E\u8BB0\u5F55";
      else node.textContent = replace(m.type === "random-text" ? this.random(m) : m.text);
      if (m.type === "link") {
        const link = node;
        link.href = m.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.onclick = (e) => e.stopPropagation();
      }
      return node;
    }
    random(m) {
      if (!this.picked.has(m.id)) {
        const unique = /* @__PURE__ */ new Map();
        for (const c of m.choices) unique.set(c.value, (unique.get(c.value) ?? 0) + c.weight);
        const choices = [...unique].map(([value2, weight]) => ({ value: value2, weight })), index = weightedPick(choices, (c) => c.weight, choices.findIndex((c) => c.value === this.last.get(m.id))), value = choices[index]?.value ?? "\u5C1A\u672A\u8BBE\u7F6E\u968F\u673A\u5185\u5BB9";
        this.picked.set(m.id, value);
        this.last.set(m.id, value);
      }
      return this.picked.get(m.id);
    }
    number(span, target, currency, key) {
      const previous = this.values.get(key) ?? target;
      this.values.set(key, target);
      if (previous === target || matchMedia("(prefers-reduced-motion:reduce)").matches) {
        span.textContent = money(target, currency);
        return;
      }
      const start = performance.now();
      let frame = 0;
      const tick = (now) => {
        this.frames.delete(frame);
        const progress = Math.min(1, (now - start) / 350);
        span.textContent = money(Math.round(previous + (target - previous) * (1 - (1 - progress) ** 3)), currency);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          this.frames.add(frame);
        }
      };
      frame = requestAnimationFrame(tick);
      this.frames.add(frame);
    }
    close() {
      for (const frame of this.frames) cancelAnimationFrame(frame);
      this.frames.clear();
    }
  };

  // src/bubble-editor.ts
  function editDefinition(root, client, original, save, library = []) {
    let draft = structuredClone(original), drag = null;
    const draftLibrary = structuredClone(library);
    const renderer = new BubbleRenderer(), d = dialog(root, "\u7F16\u8F91\u6C14\u6CE1\u6392\u7248", () => renderer.close()), preview = el("div", "", "preview"), rows = el("div"), tools = el("div", "", "tools");
    preview.append(renderer.element);
    d.body.append(preview, el("p", "\u62D6\u52A8\u6A21\u5757\u5230\u53E6\u4E00\u884C\u53EF\u5408\u5E76\uFF1B\u62D6\u5230\u201C\u5206\u884C\u201D\u533A\u57DF\u53EF\u62C6\u5F00\u3002\u6700\u591A\u516D\u884C\uFF0C\u6BCF\u884C\u516D\u4E2A\u6A21\u5757\uFF0C\u4E00\u5F20\u56FE\u7247\u72EC\u5360\u4E00\u884C\u3002", "muted"), rows, tools);
    const fail = (error) => {
      d.note.textContent = error instanceof Error ? error.message : "\u6392\u7248\u65E0\u6548";
      d.note.classList.add("error");
    };
    const update = (next) => {
      try {
        draft = parseDefinition(next);
        d.note.textContent = "";
        render();
      } catch (error) {
        fail(error);
      }
    };
    const add = (m) => {
      const next = structuredClone(draft);
      next.rows.push([m]);
      update(next);
    };
    const type = select(Object.entries(MODULE_LABELS), "text");
    tools.append(type, button("\u6DFB\u52A0\u6A21\u5757", () => editModule(root, client, moduleOf(type.value), (m) => add(m))));
    const lib = select([["", "\u9009\u62E9\u6A21\u5757\u5E93"], ...draftLibrary.map((l) => [l.id, l.name])], "");
    tools.append(lib, button("\u4ECE\u5E93\u6DFB\u52A0", () => {
      const m = draftLibrary.find((l) => l.id === lib.value)?.module;
      if (m) add({ ...structuredClone(m), id: crypto.randomUUID() });
    }));
    function render() {
      renderer.render(draft, client.context(), "editor");
      rows.replaceChildren();
      draft.rows.forEach((row, ri) => {
        const split = el("div", "\u2193 \u62D6\u5230\u8FD9\u91CC\u5206\u884C", "editor-row muted");
        split.ondragover = (e) => e.preventDefault();
        split.ondrop = (e) => {
          e.preventDefault();
          if (drag) try {
            update(moveModule(draft, drag.row, drag.col, ri, 0, true));
          } catch (error) {
            fail(error);
          }
        };
        rows.append(split);
        const line = el("div", "", "editor-row");
        line.append(el("span", "\u7B2C " + (ri + 1) + " \u884C"));
        line.ondragover = (e) => e.preventDefault();
        line.ondrop = (e) => {
          e.preventDefault();
          if (drag) try {
            update(moveModule(draft, drag.row, drag.col, ri, row.length));
          } catch (error) {
            fail(error);
          }
        };
        row.forEach((m, ci) => {
          const chip = button(MODULE_LABELS[m.type] + " \xB7 " + (m.text || m.assetId), () => editModule(root, client, m, (next) => {
            const copy = structuredClone(draft);
            copy.rows[ri][ci] = next;
            update(copy);
          }, (saved) => {
            draftLibrary.push({ id: crypto.randomUUID(), name: MODULE_LABELS[saved.type] + " \xB7 " + (saved.text || saved.assetId).slice(0, 25), module: structuredClone(saved) });
            lib.add(new Option(draftLibrary.at(-1).name, draftLibrary.at(-1).id));
            d.note.textContent = "\u5DF2\u52A0\u5165\u5F53\u524D\u6392\u7248\u8349\u7A3F\u7684\u6A21\u5757\u5E93";
          }));
          chip.className = "chip";
          chip.draggable = true;
          chip.ondragstart = () => {
            drag = { row: ri, col: ci };
          };
          chip.ondragend = () => {
            drag = null;
          };
          chip.ondrop = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (drag) try {
              update(moveModule(draft, drag.row, drag.col, ri, ci));
            } catch (error) {
              fail(error);
            }
          };
          line.append(chip, button("\xD7", () => {
            const copy = structuredClone(draft);
            copy.rows[ri].splice(ci, 1);
            copy.rows = copy.rows.filter((r) => r.length);
            update(copy);
          }));
        });
        line.append(button("\u2191", () => {
          if (ri) {
            const copy = structuredClone(draft);
            [copy.rows[ri - 1], copy.rows[ri]] = [copy.rows[ri], copy.rows[ri - 1]];
            update(copy);
          }
        }), button("\u2193", () => {
          if (ri < draft.rows.length - 1) {
            const copy = structuredClone(draft);
            [copy.rows[ri + 1], copy.rows[ri]] = [copy.rows[ri], copy.rows[ri + 1]];
            update(copy);
          }
        }));
        rows.append(line);
      });
      const end = el("div", "\u2193 \u65B0\u7684\u4E00\u884C", "editor-row muted");
      end.ondragover = (e) => e.preventDefault();
      end.ondrop = (e) => {
        e.preventDefault();
        if (drag) try {
          update(moveModule(draft, drag.row, drag.col, draft.rows.length, 0, true));
        } catch (error) {
          fail(error);
        }
      };
      rows.append(end);
    }
    d.footer.append(button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u6392\u7248", () => {
      try {
        const parsed = parseDefinition(draft);
        library.splice(0, library.length, ...draftLibrary);
        save(parsed);
        d.close();
      } catch (error) {
        fail(error);
      }
    }));
    render();
  }
  function editModule(root, client, original, save, toLibrary) {
    const m = structuredClone(original), d = dialog(root, "\u7F16\u8F91\u6A21\u5757 \xB7 " + MODULE_LABELS[m.type]), body = d.body;
    const text2 = el("textarea");
    text2.value = m.text;
    text2.oninput = () => m.text = text2.value;
    if (["text", "link", "random-text", "balance", "recharge", "bonus", "today"].includes(m.type)) {
      body.append(field("\u6587\u5B57\uFF08\u53EF\u7528 {value} / {source} / {session} / {amount} / {cost}\uFF09", text2));
    }
    if (m.type === "link") {
      const url = input(m.url);
      url.oninput = () => m.url = url.value;
      body.append(field("\u94FE\u63A5", url));
    }
    if (["balance", "recharge", "bonus", "today"].includes(m.type)) {
      const source = select([["visible", "\u5F53\u524D\u663E\u793A\u6765\u6E90"], ["account", "\u767B\u5F55\u8D26\u53F7"], ["api-key", "API Key"]], m.source), currency = select([["auto", "\u5404\u81EA\u5E01\u79CD"], ["CNY", "CNY"], ["USD", "USD"]], m.currency);
      source.onchange = () => m.source = source.value;
      currency.onchange = () => m.currency = currency.value;
      body.append(field("\u4F59\u989D\u6765\u6E90", source), field("\u5E01\u79CD", currency));
    }
    const pictures = client.context().catalog.assets.filter((a) => a.kind !== "audio");
    if (m.type === "image") {
      const image = select([["", "\u9009\u62E9\u56FE\u7247"], ...pictures.map((a) => [a.id, a.name])], m.assetId);
      image.onchange = () => m.assetId = image.value;
      body.append(field("\u56FE\u7247\uFF0F\u52A8\u56FE", image));
    }
    if (m.type === "random-text" || m.type === "random-image") {
      let drawChoices2 = function() {
        list.replaceChildren();
        m.choices.forEach((c, i) => {
          const row = el("div", "", "row"), value = m.type === "random-image" ? select(pictures.map((a) => [a.id, a.name]), c.value) : input(c.value), weight = input(String(c.weight), "number");
          weight.min = "1";
          weight.max = "10000";
          value.onchange = () => c.value = value.value;
          weight.onchange = () => c.weight = Number(weight.value);
          row.append(value, field("\u6743\u91CD", weight), button("\u5220\u9664", () => {
            m.choices.splice(i, 1);
            drawChoices2();
          }));
          list.append(row);
        });
      };
      var drawChoices = drawChoices2;
      const list = el("div");
      body.append(el("p", "\u6743\u91CD\u8D8A\u5927\u8D8A\u5E38\u51FA\u73B0\uFF1B\u540C\u4E00\u968F\u673A\u6A21\u5757\u8FDE\u7EED\u4E24\u6B21\u4E0D\u91CD\u590D\u3002", "muted"), list, button("\u6DFB\u52A0\u968F\u673A\u9879", () => {
        m.choices.push({ value: m.type === "random-image" ? pictures[0]?.id ?? "" : "\u65B0\u8BED\u53E5", weight: 1 });
        drawChoices2();
      }));
      drawChoices2();
    }
    if (m.type === "session") {
      const length = input(String(m.length), "number");
      length.onchange = () => m.length = Number(length.value);
      body.append(field("\u5BF9\u8BDD\u540D\u6700\u957F\u5B57\u6570\uFF080 \u4E0D\u622A\u65AD\uFF09", length));
    }
    if (m.type === "effect") {
      const effect = select([["pet", "\u62CD\u5934\uFF08\u4EE3\u7801\u52A8\u753B\uFF09"], ["coins", "\u91D1\u5E01\uFF08\u4EE3\u7801\u52A8\u753B\uFF09"]], m.effect);
      effect.onchange = () => m.effect = effect.value;
      body.append(field("\u52A8\u753B", effect));
    }
    const font = input(m.style.font), size = input(String(m.style.size), "number");
    font.oninput = () => m.style.font = font.value;
    size.min = "6";
    size.max = "48";
    size.onchange = () => m.style.size = Number(size.value);
    body.append(field("\u5B57\u4F53", font), field("\u5B57\u53F7", size));
    const fontList = el("datalist");
    fontList.id = "fonts-" + m.id;
    for (const name of ["system-ui", "sans-serif", "serif", "monospace", "PingFang SC", "Microsoft YaHei", "Arial"]) {
      const option = el("option");
      option.value = name;
      fontList.append(option);
    }
    font.setAttribute("list", fontList.id);
    body.append(fontList);
    body.append(button("\u8BFB\u53D6\u7CFB\u7EDF\u5B57\u4F53", () => {
      void report(d, async () => {
        const win = window;
        if (!win.queryLocalFonts) throw new Error("\u5F53\u524D\u5BBF\u4E3B\u4E0D\u652F\u6301\u5B57\u4F53\u5217\u8868\uFF0C\u53EF\u76F4\u63A5\u586B\u5199\u7CFB\u7EDF\u5B57\u4F53\u540D");
        for (const family of new Set((await win.queryLocalFonts()).map((f) => f.family))) {
          const option = el("option");
          option.value = family;
          fontList.append(option);
        }
        d.note.textContent = "\u7CFB\u7EDF\u5B57\u4F53\u5DF2\u52A0\u8F7D";
      });
    }));
    for (const [key, label] of [["bold", "\u7C97\u4F53"], ["italic", "\u659C\u4F53"], ["underline", "\u4E0B\u5212\u7EBF"]]) body.append(check(label, m.style[key], (v) => m.style[key] = v));
    for (const [key, label] of [["color", "\u6587\u5B57\u989C\u8272"], ["background", "\u5E95\u8272\uFF08\u7559\u7A7A\u4E3A\u900F\u660E\uFF09"]]) {
      const color = input(m.style[key]);
      color.placeholder = "#536ba9";
      color.oninput = () => m.style[key] = color.value;
      body.append(field(label, color));
    }
    const gradient = select([["none", "\u65E0"], ["rainbow", "\u5F69\u8679"], ["macaron", "\u9A6C\u5361\u9F99"], ["bamboo", "\u7AF9\u7EFF"]], m.style.gradient);
    gradient.onchange = () => m.style.gradient = gradient.value;
    body.append(field("\u6E10\u53D8", gradient));
    if (toLibrary) d.footer.append(button("\u52A0\u5165\u6A21\u5757\u5E93", () => {
      try {
        toLibrary(parseModule(m));
        d.close();
      } catch (error) {
        d.note.textContent = error.message;
      }
    }));
    d.footer.append(button("\u53D6\u6D88", d.close), button("\u5E94\u7528\u5230\u8349\u7A3F", () => {
      try {
        save(parseModule(m));
        d.close();
      } catch (error) {
        d.note.textContent = error.message;
      }
    }));
  }
  async function openBubbleEditor(root, client) {
    let draft = await client.api("/bubbles"), selected = 0;
    const d = dialog(root, "\u70B9\u51FB\u6C14\u6CE1\u4E0E\u6A21\u5757\u5E93"), list = el("div"), detail = el("div"), library = el("details", "", "section");
    library.append(el("summary", "\u6A21\u5757\u5E93"));
    d.body.append(el("p", "\u7B2C\u4E00\u9879\u4E3A\u9996\u6B21\u70B9\u51FB\u4E0E\u5E38\u9A7B\u4F59\u989D\uFF1B\u4E4B\u540E\u6309\u961F\u5217\u64AD\u653E\u3002\u5E76\u5217 A/B \u6309\u6743\u91CD\u9009\u62E9\uFF1B\u6A21\u5757\u4E2D\u7684\u968F\u673A\u8BED\u53E5\u548C\u968F\u673A\u56FE\u7247\u8FDE\u7EED\u4E24\u6B21\u4E0D\u91CD\u590D\u3002", "muted"), list, detail, library);
    function draw() {
      list.replaceChildren();
      draft.steps.forEach((step2, i) => {
        const row = el("div", "", "row"), choose = button((i === 0 ? "\u9996\u6B21\u70B9\u51FB" : "\u961F\u5217 " + i) + " \xB7 " + step2.options.length + " \u4E2A\u9009\u9879", () => {
          selected = i;
          draw();
        });
        choose.classList.toggle("selected", selected === i);
        row.append(choose, button("\u2191", () => {
          if (i) {
            [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]];
            selected = i - 1;
            draw();
          }
        }), button("\u2193", () => {
          if (i < draft.steps.length - 1) {
            [draft.steps[i + 1], draft.steps[i]] = [draft.steps[i], draft.steps[i + 1]];
            selected = i + 1;
            draw();
          }
        }), button("\u5220\u9664", () => {
          if (draft.steps.length > 1) {
            draft.steps.splice(i, 1);
            selected = Math.min(selected, draft.steps.length - 1);
            draw();
          }
        }));
        list.append(row);
      });
      list.append(button("\u6DFB\u52A0\u961F\u5217\u9879", () => {
        const id = crypto.randomUUID();
        draft.steps.push({ id, options: [{ id: crypto.randomUUID(), weight: 1, bubble: definition("\u65B0\u6C14\u6CE1") }] });
        selected = draft.steps.length - 1;
        draw();
      }));
      detail.replaceChildren();
      const step = draft.steps[selected];
      step.options.forEach((o, i) => {
        const row = el("div", "", "section"), weight = input(String(o.weight), "number");
        weight.onchange = () => o.weight = Number(weight.value);
        row.append(el("strong", "\u9009\u9879 " + String.fromCharCode(65 + i)), field("\u6743\u91CD", weight), button("\u7F16\u8F91\u6392\u7248\u4E0E\u6837\u5F0F", () => editDefinition(root, client, o.bubble, (next) => {
          o.bubble = next;
          draw();
        }, draft.library)), button("\u5220\u9664\u9009\u9879", () => {
          if (step.options.length > 1) {
            step.options.splice(i, 1);
            draw();
          }
        }));
        detail.append(row);
      });
      detail.append(button("\u6DFB\u52A0\u5E76\u5217\u9009\u9879", () => {
        step.options.push({ id: crypto.randomUUID(), weight: 1, bubble: definition("\u65B0\u9009\u9879") });
        draw();
      }));
      while (library.children.length > 1) library.lastElementChild.remove();
      for (const [i, l] of draft.library.entries()) {
        const row = el("div", "", "row"), name = input(l.name);
        name.onchange = () => l.name = name.value;
        row.append(name, button("\u7F16\u8F91", () => editModule(root, client, l.module, (m) => {
          l.module = m;
          draw();
        })), button("\u5220\u9664", () => {
          draft.library.splice(i, 1);
          draw();
        }));
        library.append(row);
      }
    }
    d.footer.append(button("\u6062\u590D\u9ED8\u8BA4\u8349\u7A3F", () => {
      draft = { ...defaultBubbles(), revision: draft.revision };
      selected = 0;
      draw();
    }), button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u6C14\u6CE1\u8BBE\u7F6E", () => {
      void report(d, async () => {
        await client.api("/bubbles", parseBubbles(draft), "PUT");
        await client.reload();
        d.close();
      });
    }));
    draw();
  }

  // src/asset-manager.ts
  function dataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("\u8BFB\u53D6\u7D20\u6750\u5931\u8D25"));
      r.readAsDataURL(blob);
    });
  }
  function animatedImage(bytes) {
    if (new TextDecoder().decode(bytes.subarray(0, 6)).startsWith("GIF8")) return true;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 8;
    if (bytes[0] === 137) while (at + 12 <= bytes.length) {
      const type = new TextDecoder().decode(bytes.subarray(at + 4, at + 8));
      if (type === "acTL") return true;
      if (type === "IDAT") break;
      const size = view.getUint32(at);
      if (size > bytes.length - at - 12) break;
      at += size + 12;
    }
    return false;
  }
  function waveBlob(buffer, start, end) {
    const channels = Math.min(2, buffer.numberOfChannels), from = Math.floor(start * buffer.sampleRate), length = Math.max(0, Math.min(buffer.length, Math.floor(end * buffer.sampleRate)) - from);
    if (!length || from < 0) throw new Error("\u97F3\u9891\u7247\u6BB5\u533A\u95F4\u65E0\u6548");
    if (length * channels * 2 + 44 > 8 * 1024 * 1024) throw new Error("\u7247\u6BB5\u8D85\u8FC7 8MB\uFF0C\u8BF7\u7F29\u77ED\u533A\u95F4");
    const bytes = new ArrayBuffer(44 + length * channels * 2), view = new DataView(bytes), str = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    str(0, "RIFF");
    view.setUint32(4, bytes.byteLength - 8, true);
    str(8, "WAVE");
    str(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    str(36, "data");
    view.setUint32(40, length * channels * 2, true);
    const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
    let at = 44;
    for (let i = from; i < from + length; i++) for (const channel of data) {
      const value = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(at, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      at += 2;
    }
    return new Blob([bytes], { type: "audio/wav" });
  }
  async function cropImage(root, file, save) {
    const url = URL.createObjectURL(file), image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("\u56FE\u7247\u65E0\u6CD5\u89E3\u7801");
    }
    if (!root.host.isConnected) {
      URL.revokeObjectURL(url);
      return;
    }
    let zoom = 1, x = 0, y = 0, flip = false, drag = null;
    const d = dialog(root, "\u9759\u6001\u56FE\u7247\u88C1\u526A", () => URL.revokeObjectURL(url)), canvas = el("canvas", "", "crop");
    canvas.width = canvas.height = 520;
    const context = canvas.getContext("2d");
    const range = input("1", "range");
    range.min = ".2";
    range.max = "4";
    range.step = ".01";
    range.oninput = () => {
      zoom = Number(range.value);
      draw();
    };
    function draw() {
      context.clearRect(0, 0, 520, 520);
      const size = 520 / Math.max(image.width, image.height) * zoom;
      context.save();
      context.translate(260 + x, 260 + y);
      context.scale(flip ? -1 : 1, 1);
      context.drawImage(image, -image.width * size / 2, -image.height * size / 2, image.width * size, image.height * size);
      context.restore();
    }
    canvas.onpointerdown = (e) => {
      drag = { x: e.clientX, y: e.clientY, fromX: x, fromY: y };
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = (e) => {
      if (drag) {
        const scale = 520 / canvas.getBoundingClientRect().width;
        x = drag.fromX + (e.clientX - drag.x) * scale;
        y = drag.fromY + (e.clientY - drag.y) * scale;
        draw();
      }
    };
    canvas.onpointerup = canvas.onpointercancel = () => drag = null;
    d.body.append(canvas, field("\u7F29\u653E\uFF1B\u62D6\u52A8\u56FE\u7247\u5B9A\u4F4D", range), check("\u6C34\u5E73\u955C\u50CF", flip, (v) => {
      flip = v;
      draw();
    }), el("p", "\u900F\u660E\u533A\u57DF\u4F1A\u4FDD\u7559\uFF1B\u8F93\u51FA\u4E3A PNG\u3002", "muted"));
    d.footer.append(button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u88C1\u526A", () => {
      void report(d, async () => {
        const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("\u88C1\u526A\u5931\u8D25")), "image/png"));
        await save(blob);
        d.close();
      });
    }));
    draw();
  }
  async function cropAudio(root, file, save) {
    if (file.size > 50 * 1024 * 1024) throw new Error("\u539F\u97F3\u9891\u6700\u591A 50MB");
    const context = new AudioContext();
    let buffer;
    try {
      buffer = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      await context.close();
      throw new Error("\u5F53\u524D\u5BBF\u4E3B\u65E0\u6CD5\u89E3\u7801\u6B64\u97F3\u9891");
    }
    if (!root.host.isConnected) {
      await context.close();
      return;
    }
    let start = 0, end = Math.min(buffer.duration, 5), source = null, dragging = false;
    const stop = () => {
      source?.stop();
      source = null;
    }, d = dialog(root, "\u6CE2\u5F62\u4E0E\u97F3\u6548\u7247\u6BB5", () => {
      stop();
      void context.close();
    }), canvas = el("canvas", "", "wave");
    canvas.width = 700;
    canvas.height = 110;
    const paint = canvas.getContext("2d");
    const a = input("0", "number"), b = input(end.toFixed(3), "number");
    for (const n of [a, b]) {
      n.min = "0";
      n.max = String(buffer.duration);
      n.step = ".01";
    }
    function draw() {
      a.value = start.toFixed(3);
      b.value = end.toFixed(3);
      paint.clearRect(0, 0, 700, 110);
      paint.fillStyle = "#9bb7ec55";
      paint.fillRect(start / buffer.duration * 700, 0, (end - start) / buffer.duration * 700, 110);
      paint.strokeStyle = "#536ba9";
      paint.beginPath();
      const samples = buffer.getChannelData(0), stride = Math.max(1, Math.floor(samples.length / 700));
      for (let x = 0; x < 700; x++) {
        let min = 0, max = 0;
        for (let i = x * stride; i < Math.min(samples.length, (x + 1) * stride); i++) {
          min = Math.min(min, samples[i]);
          max = Math.max(max, samples[i]);
        }
        paint.moveTo(x, 55 + min * 48);
        paint.lineTo(x, 55 + max * 48);
      }
      paint.stroke();
    }
    a.onchange = () => {
      start = Math.max(0, Math.min(Number(a.value), end - 1e-3));
      draw();
    };
    b.onchange = () => {
      end = Math.min(buffer.duration, Math.max(Number(b.value), start + 1e-3));
      draw();
    };
    canvas.onpointerdown = (e) => {
      const r = canvas.getBoundingClientRect();
      start = Math.max(0, Math.min(buffer.duration - 1e-3, (e.clientX - r.left) / r.width * buffer.duration));
      end = Math.min(buffer.duration, start + 1e-3);
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      draw();
    };
    canvas.onpointermove = (e) => {
      if (dragging) {
        const r = canvas.getBoundingClientRect();
        end = Math.min(buffer.duration, Math.max(start + 1e-3, (e.clientX - r.left) / r.width * buffer.duration));
        draw();
      }
    };
    canvas.onpointerup = canvas.onpointercancel = () => dragging = false;
    d.body.append(canvas, field("\u5F00\u59CB\uFF08\u79D2\uFF09", a), field("\u7ED3\u675F\uFF08\u79D2\uFF09", b), el("p", "\u62D6\u9009\u6CE2\u5F62\u6216\u586B\u5199\u533A\u95F4\uFF1B\u7247\u6BB5\u4FDD\u5B58\u4E3A WAV\uFF0C\u6700\u591A 8MB\u3002", "muted"), button("\u8BD5\u542C\u7247\u6BB5", () => {
      void report(d, async () => {
        stop();
        await context.resume();
        source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0, start, end - start);
      });
    }), button("\u505C\u6B62", stop));
    d.footer.append(button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u97F3\u6548\u7247\u6BB5", () => {
      void report(d, async () => {
        await save(waveBlob(buffer, start, end));
        d.close();
      });
    }));
    draw();
  }
  async function openAssets(root, client) {
    let catalog = await client.api("/resources"), kind = "role";
    const d = dialog(root, "\u672C\u673A\u7D20\u6750\u4E0E\u97F3\u6548\u7EC4"), tabs = select([["role", "\u89D2\u8272"], ["image", "\u6C14\u6CE1\u56FE\u7247\uFF0F\u52A8\u56FE"], ["audio", "\u97F3\u6548\u7247\u6BB5"]], kind), list = el("div"), groups = el("div"), file = input("", "file"), crop = input("", "checkbox"), name = input("");
    file.accept = "image/png,image/gif,image/jpeg,image/webp";
    file.setAttribute("aria-label", "\u5BFC\u5165\u7D20\u6750");
    name.placeholder = "\u7D20\u6750\u540D\u79F0\uFF08\u53EF\u9009\uFF09";
    crop.checked = true;
    tabs.onchange = () => {
      kind = tabs.value;
      file.accept = kind === "audio" ? "audio/*" : "image/png,image/gif,image/jpeg,image/webp";
      draw();
    };
    async function mutate(body) {
      catalog = await client.api("/resources", body, "POST");
      await client.reload();
      draw();
    }
    file.onchange = () => {
      const selected = file.files?.[0], importKind = kind;
      if (!selected) return;
      file.value = "";
      void report(d, async () => {
        const max = importKind === "role" ? 20 : 8;
        if (importKind !== "audio" && selected.size > max * 1024 * 1024) throw new Error("\u56FE\u7247\u8D85\u8FC7 " + max + "MB");
        const importFile = async (blob) => {
          await mutate({ action: "import", kind: importKind, name: name.value || selected.name, data: await dataURL(blob) });
        };
        if (importKind === "audio") {
          await cropAudio(root, selected, importFile);
          return;
        }
        const animated = animatedImage(new Uint8Array(await selected.arrayBuffer()));
        if (crop.checked && !animated) await cropImage(root, selected, importFile);
        else {
          if (animated) d.note.textContent = "\u52A8\u56FE\u5C06\u539F\u6837\u4FDD\u7559\u52A8\u753B";
          await importFile(selected);
        }
      });
    };
    const cropLabel = field("\u9759\u6001\u56FE\u7247\u5BFC\u5165\u65F6\u88C1\u526A", crop);
    d.body.append(field("\u8D44\u6E90\u5206\u7C7B", tabs), field("\u540D\u79F0", name), cropLabel, file, el("p", "\u5BFC\u5165\u53EA\u4FDD\u5B58\u5728\u672C\u673A\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\u3002\u8BF7\u786E\u8BA4\u4F60\u6709\u4F7F\u7528\u8BB8\u53EF\uFF1BGIF\uFF0FAPNG \u4FDD\u7559\u539F\u52A8\u753B\u3002\u5220\u9664\u53EA\u9488\u5BF9\u81EA\u5B9A\u4E49\u7D20\u6750\u3002", "muted"), list, groups);
    function editGroup(g) {
      const modal = dialog(root, g ? "\u7F16\u8F91\u97F3\u6548\u7EC4" : "\u65B0\u5EFA\u97F3\u6548\u7EC4"), title = input(g?.name ?? "\u6211\u7684\u97F3\u6548\u7EC4"), options = [["", "\u65E0\u58F0\u97F3"], ...catalog.assets.filter((a) => a.kind === "audio").map((a) => [a.id, a.name])], press = select(options, g?.press ?? "press"), release = select(options, g?.release ?? "release");
      modal.body.append(field("\u7EC4\u540D", title), field("\u6309\u4E0B", press), button("\u8BD5\u542C\u6309\u4E0B", () => client.previewAudio(press.value)), field("\u91CA\u653E", release), button("\u8BD5\u542C\u91CA\u653E", () => client.previewAudio(release.value)));
      modal.footer.append(button("\u53D6\u6D88", modal.close), button("\u4FDD\u5B58\u97F3\u6548\u7EC4", () => {
        void report(modal, async () => {
          await mutate({ action: "group", id: g?.id, name: title.value, press: press.value, release: release.value });
          modal.close();
        });
      }));
    }
    function draw() {
      cropLabel.hidden = kind === "audio";
      list.replaceChildren();
      groups.replaceChildren();
      for (const asset of catalog.assets.filter((a) => a.kind === kind)) {
        const row = el("div", "", "asset"), tools = el("div", "", "tools");
        if (kind !== "audio") {
          const picture = el("img");
          picture.src = asset.url;
          picture.alt = asset.name;
          row.append(picture);
        }
        row.append(el("strong", (asset.pinned ? "\u2605 " : "") + asset.name), el("span", asset.format.toUpperCase(), "muted"));
        const recrop = () => {
          void report(d, async () => {
            const response = await fetch(asset.url);
            if (!response.ok) throw new Error("\u7D20\u6750\u8BFB\u53D6\u5931\u8D25");
            const file2 = new File([await response.blob()], asset.name, { type: asset.mime }), save = async (blob) => {
              await mutate({ action: "import", kind: asset.kind, name: asset.name + " \xB7 \u88C1\u526A", data: await dataURL(blob) });
            };
            if (asset.kind === "audio") await cropAudio(root, file2, save);
            else await cropImage(root, file2, save);
          });
        };
        if (kind === "audio") tools.append(button("\u8BD5\u542C", () => client.previewAudio(asset.id)), button("\u88C1\u526A\u4E3A\u65B0\u7247\u6BB5", recrop));
        else tools.append(button("\u9884\u89C8", () => {
          const modal = dialog(root, asset.name), image = el("img");
          image.src = asset.url;
          image.alt = asset.name;
          image.style.maxHeight = "55vh";
          modal.body.append(image);
        }));
        if (kind !== "audio" && !["gif", "apng"].includes(asset.format)) tools.append(button("\u88C1\u526A\u4E3A\u65B0\u7D20\u6750", recrop));
        if (kind === "role") tools.append(button("\u4F7F\u7528", () => {
          void report(d, async () => {
            await client.api("/settings", { character: asset.id }, "PUT");
            await client.reload();
          });
        }));
        if (!asset.builtin) {
          tools.append(button(asset.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876", () => {
            void report(d, () => mutate({ action: "pin", id: asset.id, pinned: !asset.pinned }));
          }), button("\u5220\u9664", () => confirmDelete(d, asset.name, () => mutate({ action: "delete", id: asset.id }))));
        }
        row.append(tools);
        list.append(row);
      }
      if (kind === "audio") {
        groups.append(el("h3", "\u6309\u538B\u97F3\u6548\u7EC4"), button("\u65B0\u5EFA\u97F3\u6548\u7EC4", () => editGroup()));
        for (const g of catalog.groups) {
          const row = el("div", "", "asset");
          row.append(el("strong", (g.pinned ? "\u2605 " : "") + g.name), button("\u8BD5\u542C", () => client.previewAudio(g.id)));
          if (!g.builtin) row.append(button("\u7F16\u8F91", () => editGroup(g)), button(g.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876", () => {
            void report(d, () => mutate({ action: "pin", id: g.id, pinned: !g.pinned }));
          }), button("\u5220\u9664", () => confirmDelete(d, g.name, () => mutate({ action: "delete", id: g.id }))));
          groups.append(row);
        }
      }
    }
    d.footer.append(button("\u5173\u95ED", d.close));
    draw();
  }
  function confirmDelete(d, name, remove) {
    d.note.textContent = "\u5220\u9664\u201C" + name + "\u201D\uFF1F";
    d.footer.replaceChildren(button("\u53D6\u6D88\u5220\u9664", () => {
      d.note.textContent = "";
      d.footer.replaceChildren(button("\u5173\u95ED", d.close));
    }), button("\u786E\u8BA4\u5220\u9664", () => {
      void report(d, async () => {
        await remove();
        d.note.textContent = "";
        d.footer.replaceChildren(button("\u5173\u95ED", d.close));
      });
    }));
  }

  // src/ledger-view.ts
  function bookPreferences(root, client, row) {
    const d = dialog(root, sourceName(row.source) + " \xB7 " + row.scope.slice(0, 8) + " \xB7 " + row.currency + " \u63D0\u9192\u8BBE\u7F6E");
    void report(d, async () => {
      const all = await client.api("/book-preferences"), p = all[bookKey(row.source, row.scope, row.currency)] ?? { low: client.context().snapshot.settings.lowBalance[row.currency], budget: 0, budgetOn: false };
      const low = input(String(p.low), "number"), budget = input(String(p.budget), "number");
      for (const n of [low, budget]) {
        n.min = "0";
        n.step = ".01";
      }
      d.body.append(field("\u4F4E\u4F59\u989D\u9608\u503C\uFF08" + row.currency + "\uFF09", low), field("\u4ECA\u65E5\u6D88\u8D39\u9884\u7B97\uFF08" + row.currency + "\uFF09", budget), check("\u542F\u7528\u8FD9\u4E2A\u8D26\u672C\u7684\u9884\u7B97\u63D0\u9192", p.budgetOn, (v) => p.budgetOn = v), el("p", "\u6B64\u914D\u7F6E\u53EA\u5C5E\u4E8E\u8BE5\u6765\u6E90\u3001\u8D26\u6237\u4F5C\u7528\u57DF\u548C\u5E01\u79CD\u3002\u9884\u7B97\u63D0\u793A\u540C\u65F6\u9700\u8981\u5728\u201C\u63D0\u9192\u4E0E\u97F3\u6548\u201D\u91CC\u5F00\u542F\uFF1B\u6D88\u8D39\u6309\u4F59\u989D\u89C2\u6D4B\u6216\u6821\u6B63\u503C\u5224\u65AD\u3002", "muted"));
      d.footer.append(button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u8D26\u672C\u63D0\u9192", () => {
        void report(d, async () => {
          await client.api("/book-preferences", { source: row.source, scope: row.scope, currency: row.currency, low: Number(low.value), budget: Number(budget.value), budgetOn: p.budgetOn }, "PUT");
          await client.reload();
          d.close();
        });
      }));
    });
  }
  function correction(root, client, initial, updated) {
    let row = initial, confirmed = false;
    const d = dialog(root, "\u6821\u6B63 \xB7 " + initial.day + " \xB7 " + sourceName(initial.source) + " \xB7 " + initial.currency), numbers = el("div"), credits = input("0"), other = input("0"), result = el("div"), confirm = check("\u5DF2\u6838\u5BF9\u672C\u533A\u95F4\u5168\u90E8\u5230\u8D26\u548C\u975E\u8C03\u7528\u6263\u51CF", false, (v) => confirmed = v);
    const draw = () => {
      numbers.replaceChildren(el("p", "\u8D26\u6237\u4F5C\u7528\u57DF\uFF1A" + row.scope.slice(0, 12)), el("p", "\u89C2\u6D4B\u533A\u95F4\uFF1A" + new Date(row.firstAt).toLocaleString() + " \u81F3 " + new Date(row.lastAt).toLocaleString()), el("p", "\u671F\u521D " + money(row.opening, row.currency, 8) + " \xB7 \u671F\u672B " + money(row.last, row.currency, 8)), el("p", "\u539F\u59CB\u4E0B\u964D " + money(row.debit, row.currency, 8) + " \xB7 \u539F\u59CB\u589E\u52A0 " + money(row.credit, row.currency, 8)), el("p", "\u5F53\u524D\u6D88\u8D39 " + money(row.amount, row.currency, 8) + (row.correction ? "\uFF08\u5DF2\u6821\u6B63\uFF09" : "")));
      preview();
    };
    const preview = () => {
      try {
        result.textContent = "\u6821\u6B63\u6D88\u8D39 = \u671F\u521D + \u7D2F\u8BA1\u5230\u8D26 \u2212 \u975E\u8C03\u7528\u6263\u51CF \u2212 \u671F\u672B = " + money(row.opening + units(credits.value) - units(other.value) - row.last, row.currency, 8);
      } catch {
        result.textContent = "\u8BF7\u8F93\u5165\u975E\u8D1F\u91D1\u989D\uFF0C\u6700\u591A 8 \u4F4D\u5C0F\u6570";
      }
    };
    async function refresh() {
      const data = await client.api("/adjustments?" + new URLSearchParams({ source: row.source, scope: row.scope, currency: row.currency })), fresh = data.rows.find((r) => r.day === row.day);
      if (!fresh) throw new Error("\u627E\u4E0D\u5230\u8FD9\u4E00\u5929\u7684\u89C2\u6D4B\u8BB0\u5F55");
      row = fresh;
      credits.value = String((row.correction?.credits ?? row.credit) / SCALE);
      other.value = String((row.correction?.otherDebits ?? 0) / SCALE);
      draw();
    }
    credits.oninput = other.oninput = preview;
    d.body.append(numbers, field("\u7EDF\u8BA1\u533A\u95F4\u7D2F\u8BA1\u5230\u8D26\uFF08\u5145\u503C\u3001\u8D60\u91D1\u3001\u9000\u6B3E\u7B49\uFF09", credits), field("\u975E\u8C03\u7528\u6263\u51CF", other), result, confirm, el("p", "\u4FDD\u5B58\u5F53\u65E5\u6821\u6B63\u4F1A\u72EC\u7ACB\u5237\u65B0\u5BF9\u5E94\u6765\u6E90\uFF1B\u4F59\u989D\u53D1\u751F\u6539\u53D8\u65F6\u8981\u6C42\u91CD\u65B0\u6838\u5BF9\u3002\u4FDD\u7559\u539F\u59CB\u89C2\u6D4B\u4E0E\u6821\u6B63\u5386\u53F2\uFF1B\u64A4\u9500\u6062\u590D\u539F\u59CB\u4E0B\u964D\u7EDF\u8BA1\u3002", "muted"), button("\u5237\u65B0\u5E76\u91CD\u65B0\u6838\u5BF9", () => {
      void report(d, refresh);
    }));
    async function apply(reset = false) {
      await client.api("/adjustments", { source: row.source, scope: row.scope, currency: row.currency, day: row.day, revision: row.revision, credits: credits.value, otherDebits: other.value, confirmed, reset }, "PUT");
      await client.reload();
      await updated();
      d.close();
    }
    d.footer.append(button("\u53D6\u6D88", d.close), button("\u64A4\u9500\u6821\u6B63", () => {
      void report(d, () => apply(true));
    }), button("\u4FDD\u5B58\u6821\u6B63", () => {
      void report(d, () => apply());
    }));
    draw();
    void report(d, refresh);
  }
  async function openLedger(root, client) {
    let generation = 0, offset = 0, result = { rows: [], records: [], models: [], total: 0, more: false };
    const d = dialog(root, "\u4F59\u989D\u8D26\u672C\u4E0E\u672C\u673A\u8C03\u7528"), tools = el("div", "", "tools"), days = el("div"), models = el("div"), records = el("div"), more = button("\u52A0\u8F7D\u66F4\u591A\u8C03\u7528", () => {
      offset += 50;
      void report(d, () => load(true));
    });
    const range = select([["today", "\u4ECA\u65E5"], ["week", "\u8FD1\u4E03\u5929"], ["all", "\u5168\u90E8\uFF08\u542B\u5F52\u6863\uFF09"]], "today"), source = select([["", "\u4E24\u79CD\u6765\u6E90"], ["account", "\u767B\u5F55\u8D26\u53F7"], ["api-key", "API Key"]], ""), currency = select([["CNY", "CNY"], ["USD", "USD"]], "CNY"), scope = select([["", "\u5168\u90E8\u4F5C\u7528\u57DF"]], ""), search = input("");
    search.placeholder = "\u641C\u7D22\u6A21\u578B";
    search.setAttribute("aria-label", "\u641C\u7D22\u6A21\u578B");
    const selectedDay = input("", "date");
    selectedDay.setAttribute("aria-label", "\u6309\u65E5\u671F\u7B5B\u9009");
    tools.append(range, source, currency, scope, search, selectedDay, button("\u6E05\u9664\u65E5\u671F", () => {
      selectedDay.value = "";
      void report(d, () => load());
    }));
    d.body.append(tools, el("p", "\u4F59\u989D\u53D8\u5316\u4E0E\u672C\u673A\u8C03\u7528\u4F30\u7B97\u5206\u5F00\u663E\u793A\uFF1B\u4E0D\u540C\u6765\u6E90\u3001\u4F5C\u7528\u57DF\u548C\u5E01\u79CD\u5206\u522B\u8BB0\u8D26\u3002\u8D39\u7528\u662F\u5DF2\u6838\u5B9E\u5CF0\u8C37\u8D39\u7387\u7684\u4F30\u7B97\u533A\u95F4\uFF0C\u672A\u77E5\u6A21\u578B\u4E0D\u731C\u4EF7\u683C\u3002", "muted"), days, models, records, more);
    for (const control of [range, source, currency, scope, search, selectedDay]) control.onchange = () => {
      void report(d, () => load());
    };
    async function load(append = false) {
      const own = ++generation;
      if (!append) offset = 0;
      const q = new URLSearchParams({ range: range.value, source: source.value, currency: currency.value, scope: scope.value, model: search.value, day: selectedDay.value, offset: String(offset) }), data = await client.api("/history?" + q);
      if (own !== generation || !d.mask.isConnected) return;
      result = { ...data, records: append ? [...result.records, ...data.records] : data.records };
      draw();
    }
    function draw() {
      const current = scope.value, scopes = new Set(result.rows.map((r) => r.scope));
      scope.replaceChildren(new Option("\u5168\u90E8\u4F5C\u7528\u57DF", ""));
      for (const s of scopes) scope.add(new Option(s.slice(0, 12), s));
      if (scopes.has(current)) scope.value = current;
      days.replaceChildren();
      for (const row of result.rows) {
        const item = el("details", "", "section"), summary = el("summary", row.day + " \xB7 " + sourceName(row.source) + " [" + row.scope.slice(0, 8) + "] \xB7 " + row.currency + " \xB7 " + (row.observed ? money(row.amount, row.currency, 4) : "\u65E0\u4F59\u989D\u89C2\u6D4B"));
        item.append(summary, el("p", "\u672C\u673A\u4F30\u7B97 " + money(row.estimate.low, row.currency, 6) + "\u2013" + money(row.estimate.high, row.currency, 6) + " \xB7 " + row.estimate.tokens + " tokens" + (row.estimate.unknown ? " \xB7 " + row.estimate.unknown + " \u6B21\u8D39\u7528\u672A\u77E5" : "")));
        if (row.observed) {
          item.append(el("p", "\u539F\u59CB\u4F59\u989D\u4E0B\u964D " + money(row.debit, row.currency, 4) + " \xB7 \u4F59\u989D\u589E\u52A0 " + money(row.credit, row.currency, 4) + (row.needsReview ? " \xB7 \u6709\u4F59\u989D\u589E\u52A0\u5F85\u6838\u5BF9" : "")), el("p", "\u89C2\u6D4B\u4ECE " + new Date(row.firstAt).toLocaleString() + " \u5F00\u59CB\uFF0C\u6700\u8FD1 " + new Date(row.lastAt).toLocaleString(), "muted"), button("\u6821\u6B63\uFF0F\u64A4\u9500", () => correction(root, client, row, () => load())), button("\u8D26\u672C\u63D0\u9192", () => bookPreferences(root, client, row)));
          for (const log of row.correctionLog ?? []) item.append(el("p", new Date(log.at).toLocaleString() + " \xB7 " + (log.next ? "\u6821\u6B63 " + money(log.next.amount, row.currency, 8) : "\u64A4\u9500\u6821\u6B63"), "muted"));
        }
        item.append(button("\u67E5\u770B\u8FD9\u4E00\u5929\u7684\u8C03\u7528", () => {
          selectedDay.value = row.day;
          source.value = row.source;
          currency.value = row.currency;
          scope.value = row.scope;
          void report(d, () => load());
        }));
        days.append(item);
      }
      if (!result.rows.length) days.append(el("p", "\u6B64\u7B5B\u9009\u4E0B\u8FD8\u6CA1\u6709\u4F59\u989D\u89C2\u6D4B\u6216\u8C03\u7528\u8BB0\u5F55\u3002"));
      models.replaceChildren(el("h3", "\u6A21\u578B\u5360\u6BD4\uFF08\u6B64\u7B5B\u9009\u5168\u90E8\u8C03\u7528\u7684 token \u6570\uFF09"));
      const counts = /* @__PURE__ */ new Map();
      for (const model of result.models) {
        const key = sourceName(model.source) + " [" + model.scope.slice(0, 8) + "] \xB7 " + model.model;
        counts.set(key, model.tokens);
      }
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
        const bar = el("div", "", "model-bar");
        bar.style.width = (total ? count / total * 100 : 0) + "%";
        models.append(el("div", key + " \xB7 " + (total ? count / total * 100 : 0).toFixed(1) + "%"), bar);
      }
      records.replaceChildren(el("h3", "\u9010\u8F6E\u8C03\u7528 \xB7 " + result.total + " \u6761"));
      for (const call of result.records) {
        const item = el("div", "", "record");
        item.append(el("strong", sourceName(call.source) + " [" + call.scope.slice(0, 8) + "] \xB7 " + call.model), el("div", new Date(call.at).toLocaleString() + " \xB7 \u7B2C " + call.turn + " \u8F6E \xB7 \u4F1A\u8BDD " + call.session.slice(0, 8), "muted"), el("div", costText([call], currency.value)), el("div", "\u8F93\u5165 " + call.usage.inputTokens + " \xB7 \u7F13\u5B58\u547D\u4E2D " + call.usage.cacheReadTokens + " \xB7 \u7F13\u5B58\u5199\u5165 " + call.usage.cacheWriteTokens + " \xB7 \u8F93\u51FA " + call.usage.outputTokens, "muted"));
        records.append(item);
      }
      more.hidden = !result.more;
    }
    d.footer.append(button("\u5173\u95ED", d.close));
    await report(d, () => load());
  }

  // src/settings-view.ts
  function openSettings(root, client) {
    let draft = structuredClone(client.context().snapshot.settings);
    const d = dialog(root, "\u5916\u89C2\u3001\u6C14\u6CE1\u4E0E\u63D0\u9192\u8BBE\u7F6E");
    function draw() {
      d.body.replaceChildren();
      const mode = select([["account", "\u4EC5\u767B\u5F55\u8D26\u53F7"], ["api-key", "\u4EC5 API Key"], ["both", "\u4E24\u8005\u540C\u65F6"]], draft.displayMode ?? "api-key"), role = select(client.context().catalog.assets.filter((a) => a.kind === "role").map((a) => [a.id, a.name]), draft.character);
      mode.onchange = () => draft.displayMode = mode.value;
      role.onchange = () => draft.character = role.value;
      d.body.append(field("\u4F59\u989D\u663E\u793A\u6A21\u5F0F", mode), field("\u89D2\u8272", role));
      for (const [key, label, min, max, step] of [["scale", "\u7F29\u653E", 0.6, 1.5, 0.05], ["refreshSeconds", "\u81EA\u52A8\u5237\u65B0\u95F4\u9694\uFF08\u79D2\uFF09", 15, 600, 1], ["volume", "\u5168\u5C40\u97F3\u91CF", 0, 1, 0.05], ["scrollGap", "\u53F3\u4FA7\u6EDA\u52A8\u6761\u907F\u8BA9\uFF08\u50CF\u7D20\uFF09", 0, 100, 1]]) {
        const value = input(String(draft[key]), "number");
        value.min = String(min);
        value.max = String(max);
        value.step = String(step);
        value.onchange = () => draft[key] = Number(value.value);
        d.body.append(field(label, value));
      }
      for (const [key, label] of [["bubbleOn", "\u542F\u7528\u6C14\u6CE1"], ["stickyBalance", "\u5E38\u9A7B\u4F59\u989D\uFF08\u961F\u5217\u4E0E\u63D0\u793A\u7ED3\u675F\u540E\u6062\u590D\uFF09"], ["tapAdvance", "\u70B9\u51FB\u89D2\u8272\u63A8\u8FDB\u6C14\u6CE1\u961F\u5217"], ["menuButtonHide", "\u9690\u85CF\u60AC\u505C\u83DC\u5355\u6309\u94AE\uFF08\u53F3\u952E\u4ECD\u53EF\u6253\u5F00\uFF09"], ["autoFlip", "\u8D34\u5DE6\u8FB9\u81EA\u52A8\u955C\u50CF"], ["flip", "\u624B\u52A8\u955C\u50CF"], ["sound", "\u542F\u7528\u97F3\u6548"]]) d.body.append(check(label, draft[key], (v) => draft[key] = v));
      const peak = select([["simple", "\u7B80\u6D01\u5CF0\u8C37"], ["countdown", "\u5CF0\u8C37\u5012\u8BA1\u65F6"], ["playful", "\u4E0A\u6E38\u8DA3\u5473\u6837\u5F0F"]], draft.peakStyle);
      peak.onchange = () => draft.peakStyle = peak.value;
      d.body.append(field("\u5CF0\u8C37\u663E\u793A\u6837\u5F0F", peak));
      const group = select(client.context().catalog.groups.map((g) => [g.id, g.name]), draft.pressGroup);
      group.onchange = () => draft.pressGroup = group.value;
      d.body.append(field("\u89D2\u8272\u6309\u538B\u97F3\u6548\u7EC4", group), button("\u8BD5\u542C\u97F3\u6548\u7EC4", () => client.previewAudio(group.value, draft.volume)));
      const snap = el("details", "", "section");
      snap.open = true;
      snap.append(el("summary", "\u56DB\u8FB9\u5438\u9644"), check("\u542F\u7528\u5438\u9644", draft.snap.enabled, (v) => draft.snap.enabled = v));
      const unit = select([["px", "\u50CF\u7D20"], ["percent", "\u7A97\u53E3\u767E\u5206\u6BD4"]], draft.snap.unit);
      unit.onchange = () => {
        draft.snap.unit = unit.value;
        for (const side of ["top", "right", "bottom", "left"]) draft.snap[side] = Math.min(draft.snap[side], draft.snap.unit === "px" ? 500 : 50);
        draw();
      };
      snap.append(field("\u5438\u9644\u8DDD\u79BB\u5355\u4F4D", unit));
      for (const [side, label] of [["top", "\u4E0A"], ["right", "\u53F3"], ["bottom", "\u4E0B"], ["left", "\u5DE6"]]) {
        const value = input(String(draft.snap[side]), "number");
        value.min = "0";
        value.max = draft.snap.unit === "px" ? "500" : "50";
        value.onchange = () => draft.snap[side] = Number(value.value);
        snap.append(field(label, value));
      }
      d.body.append(snap);
      const events = el("details", "", "section");
      events.open = true;
      events.append(el("summary", "\u63D0\u9192\u4E0E\u97F3\u6548"));
      for (const [kind, label] of Object.entries(EVENT_LABELS)) {
        const cfg = draft.events[kind], section = el("details", "", "section");
        section.append(el("summary", label), check("\u542F\u7528\u6B64\u63D0\u9192", cfg.enabled, (v) => cfg.enabled = v), check("\u663E\u793A\u5728\u6C14\u6CE1\u4E2D\uFF08\u5173\u95ED\u65F6\u4F7F\u7528\u901A\u77E5\u5361\u7247\uFF09", cfg.bubble, (v) => cfg.bubble = v), check("\u64AD\u653E\u63D0\u9192\u58F0\u97F3", cfg.sound, (v) => cfg.sound = v));
        const audio = select([["", "\u65E0\u97F3\u6548"], ...client.context().catalog.assets.filter((a) => a.kind === "audio").map((a) => [a.id, a.name]), ...client.context().catalog.groups.map((g) => [g.id, g.name])], cfg.audio);
        audio.onchange = () => cfg.audio = audio.value;
        const volume = input(cfg.volume === null ? "" : String(cfg.volume), "number");
        volume.min = "0";
        volume.max = "1";
        volume.step = ".05";
        volume.placeholder = "\u8DDF\u968F\u5168\u5C40";
        volume.onchange = () => cfg.volume = volume.value === "" ? null : Number(volume.value);
        const ttl = input(String(cfg.closeSeconds), "number");
        ttl.min = "0";
        ttl.max = "86400";
        ttl.onchange = () => cfg.closeSeconds = Number(ttl.value);
        section.append(field("\u97F3\u6548\uFF0F\u97F3\u6548\u7EC4", audio), field("\u97F3\u91CF\uFF08\u7559\u7A7A\u8DDF\u968F\u5168\u5C40\uFF09", volume), field("\u5173\u95ED\u65F6\u95F4\uFF08\u79D2\uFF1B0 \u4E3A\u624B\u52A8\uFF09", ttl), button("\u8BD5\u542C\u63D0\u9192\u58F0\u97F3", () => client.previewAudio(audio.value, cfg.volume ?? draft.volume)), button("\u7F16\u8F91\u63D0\u9192\u5185\u5BB9", () => editDefinition(root, client, cfg.content, (next) => cfg.content = next)));
        events.append(section);
      }
      d.body.append(events, el("p", "\u7B49\u5F85\u63D0\u95EE\u548C\u6388\u6743\u4F18\u5148\uFF1B\u5176\u4ED6\u63D0\u9192\u6392\u961F\u3002\u65B0\u9884\u7B97\u3001\u63D0\u95EE\u3001\u6388\u6743\u63D0\u793A\u9ED8\u8BA4\u5173\u95ED\u3002\u6765\u6E90\u4E0E\u5E01\u79CD\u7684\u9608\u503C\u5728\u8D26\u672C\u91CC\u5206\u522B\u8BBE\u7F6E\u3002", "muted"));
    }
    d.footer.append(button("\u91CD\u7F6E\u4F4D\u7F6E\u8349\u7A3F", () => {
      draft.x = draft.y = null;
      d.note.textContent = "\u4FDD\u5B58\u540E\u91CD\u7F6E\u4F4D\u7F6E";
    }), button("\u6062\u590D\u9ED8\u8BA4\u8349\u7A3F", () => {
      draft = { ...structuredClone(DEFAULT_SETTINGS), displayMode: draft.displayMode };
      draw();
    }), button("\u53D6\u6D88", d.close), button("\u4FDD\u5B58\u8BBE\u7F6E", () => {
      void report(d, async () => {
        await client.api("/settings", draft, "PUT");
        await client.reload();
        d.close();
      });
    }));
    draw();
  }

  // src/widget.ts
  async function mount(desktopOnly = true) {
    if (desktopOnly && (!window.dshDesktop || location.protocol !== "dsh-app:" || location.hostname !== "app") || window.__deepseekWhaleLite) return;
    const lifecycle = new AbortController(), host = el("div"), portal = el("div"), shadow = host.attachShadow({ mode: "open" }), panels = portal.attachShadow({ mode: "open" });
    host.id = "deepseek-whale-lite";
    host.style.cssText = "position:fixed;z-index:2147483000;width:300px;height:300px;transform-origin:top left;pointer-events:none;background:transparent";
    portal.id = "deepseek-whale-lite-panels";
    portal.style.cssText = "position:fixed;inset:0;z-index:2147483001;pointer-events:none";
    const style = el("style");
    style.textContent = UI_CSS + BUBBLE_CSS + `
  .figure{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:center bottom}.figure img{display:block;width:100%;height:100%;pointer-events:none;user-select:none;transform-origin:bottom center;transition:transform .35s cubic-bezier(.3,1.8,.6,1)}.figure.pressed img{transform:scale(1.08,.86)}:host(.left) .figure{right:auto;left:0;scale:-1 1}.menu-toggle{position:absolute;right:3px;bottom:125px;z-index:3;pointer-events:auto;opacity:0;transition:opacity .2s}.menu-toggle:focus-visible,:host(:hover) .menu-toggle{opacity:1}:host(.left) .menu-toggle{right:auto;left:3px}.speech-content{cursor:pointer}
  `;
    const panelStyle = el("style");
    panelStyle.textContent = UI_CSS + BUBBLE_CSS + `
  .toast{position:fixed;left:18px;bottom:18px;width:min(380px,90vw);pointer-events:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 8px 25px #07133744}.toast button{float:right}`;
    shadow.append(style);
    panels.append(panelStyle);
    const renderer = new BubbleRenderer(false), figure = button("", () => {
    }), image = el("img"), menuButton = button("\u2630", showMenu);
    figure.className = "figure";
    figure.setAttribute("aria-label", "DeepSeek \u89D2\u8272\uFF1A\u6309\u538B\u3001\u62D6\u52A8\uFF1B\u53F3\u952E\u6253\u5F00\u83DC\u5355");
    image.alt = "DeepSeek Whale Lite \u89D2\u8272";
    image.draggable = false;
    figure.append(image);
    menuButton.className = "menu-toggle";
    menuButton.setAttribute("aria-label", "DeepSeek \u6302\u4EF6\u83DC\u5355");
    renderer.element.setAttribute("aria-live", "polite");
    shadow.append(renderer.element, figure, menuButton);
    document.body.append(host, portal);
    let stopped = false, settings = structuredClone(DEFAULT_SETTINGS), snapshot, rows = [], catalog = { assets: [], groups: [] }, bubbles, cursor = 0, initialized = false, poll, ttl, menu = null, toast = null, toastRenderer = null;
    let manual = null, manualScene = 0, lastNotice = "", drag = null, viewport = { width: innerWidth, height: innerHeight };
    const queue = new ClickQueue(), notifications = new NotificationQueue(), audio = /* @__PURE__ */ new Set(), played = /* @__PURE__ */ new Set();
    const context = () => ({ snapshot, rows, catalog, notification: notifications.current ?? void 0 });
    async function api(path, body, method = body === void 0 ? "GET" : "PUT") {
      const response = await fetch(PREFIX + path, { method, signal: lifecycle.signal, headers: body === void 0 ? void 0 : { "Content-Type": "application/json" }, body: body === void 0 ? void 0 : JSON.stringify(body) });
      if (response.status === 404 && path === "/state") {
        cleanup();
        throw new Error("\u63D2\u4EF6\u5DF2\u7981\u7528");
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "\u8BF7\u6C42\u5931\u8D25");
      return data;
    }
    const client = { api, context, reload, previewAudio: (id, volume) => play(id, volume ?? settings.volume) };
    function cleanup() {
      if (stopped) return;
      stopped = true;
      lifecycle.abort();
      if (poll) clearTimeout(poll);
      if (ttl) clearTimeout(ttl);
      renderer.close();
      toastRenderer?.close();
      for (const a of audio) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
      audio.clear();
      for (const close of panels.querySelectorAll(".dialog-heading button")) close.click();
      host.remove();
      portal.remove();
      delete window.__deepseekWhaleLite;
    }
    window.__deepseekWhaleLite = cleanup;
    function play(id, volume, release = false) {
      const group = catalog.groups.find((g) => g.id === id);
      if (group) id = release ? group.release : group.press;
      const asset = catalog.assets.find((a2) => a2.id === id && a2.kind === "audio");
      if (!asset) return;
      const a = new Audio(asset.url);
      a.volume = Math.max(0, Math.min(1, volume));
      audio.add(a);
      const done = () => audio.delete(a);
      a.onended = a.onerror = done;
      void a.play().catch(done);
    }
    function position(x = settings.x, y = settings.y) {
      const size = 300 * settings.scale, top = 44, maxX = Math.max(0, innerWidth - size - settings.scrollGap - 8), maxY = Math.max(top, innerHeight - size - 8);
      host.style.transform = "scale(" + settings.scale + ")";
      host.style.left = Math.max(0, Math.min(x ?? maxX, maxX)) + "px";
      host.style.top = Math.max(top, Math.min(y ?? maxY, maxY)) + "px";
      host.classList.toggle("left", settings.flip || settings.autoFlip && Number.parseFloat(host.style.left) < Math.max(20, innerWidth * 0.15));
      menuButton.hidden = settings.menuButtonHide;
    }
    function draw() {
      if (!snapshot || !bubbles) return;
      if (!drag) position();
      const asset = catalog.assets.find((a) => a.id === settings.character && a.kind === "role");
      if (asset && image.getAttribute("src") !== asset.url) {
        figure.style.clipPath = "";
        image.hidden = false;
        image.src = asset.url;
      }
      const n = notifications.current, cfg = n ? settings.events[n.kind] : null;
      if (lastNotice && !n) {
        manual = null;
        queue.index = -1;
      }
      const def = n && cfg?.enabled ? cfg.content : manual ?? (settings.stickyBalance ? bubbles.steps[0].options[0].bubble : null), visible = settings.bubbleOn && !!def && (!n || !!cfg?.bubble);
      renderer.element.classList.toggle("open", visible);
      if (def) renderer.render(def, context(), n?.id ?? (manual ? "manual:" + manualScene : "balance"));
      const notice = n?.id ?? "";
      if (lastNotice !== notice) {
        lastNotice = notice;
        if (ttl) clearTimeout(ttl);
        toast?.remove();
        toast = null;
        toastRenderer?.close();
        toastRenderer = null;
        if (n && cfg?.enabled) {
          if (!played.has(n.id)) {
            played.add(n.id);
            if (played.size > 2e4) played.delete(played.values().next().value);
            if (settings.sound && cfg.sound) play(cfg.audio, cfg.volume ?? settings.volume);
          }
          if (cfg.closeSeconds > 0) ttl = setTimeout(advance, cfg.closeSeconds * 1e3);
        }
      }
      if (n && cfg?.enabled && !visible && !toast) {
        toast = el("div", "", "toast");
        toast.setAttribute("role", "status");
        toast.append(button("\u5173\u95ED", advance), el("strong", EVENT_LABELS[n.kind]));
        const preview = el("div", "", "preview");
        toastRenderer = new BubbleRenderer();
        preview.append(toastRenderer.element);
        toast.append(preview);
        panels.append(toast);
      }
      if (toastRenderer && n && cfg) toastRenderer.render(cfg.content, context(), n.id);
      if ((!n || visible) && toast) {
        toast.remove();
        toast = null;
        toastRenderer?.close();
        toastRenderer = null;
      }
    }
    function advance() {
      const current = notifications.current;
      if (current) {
        void api("/notifications", { id: current.id }).catch(() => {
        });
        notifications.next();
      } else {
        manual = queue.next(bubbles);
        manualScene++;
      }
      draw();
    }
    renderer.element.onclick = (e) => {
      if (!(e.target instanceof HTMLAnchorElement)) advance();
    };
    renderer.element.oncontextmenu = (e) => {
      e.preventDefault();
      showMenu();
    };
    async function reload() {
      const [state, history, resources, config] = await Promise.all([api("/state"), api("/history"), api("/resources"), api("/bubbles")]);
      if (stopped) return;
      snapshot = state;
      settings = state.settings;
      rows = history.rows;
      catalog = resources;
      bubbles = config;
      draw();
    }
    function action(work) {
      void work().catch((error) => {
        if (stopped) return;
        const d = dialog(panels, "\u64CD\u4F5C\u672A\u5B8C\u6210");
        d.body.append(el("p", error instanceof Error ? error.message : "\u8BF7\u7A0D\u540E\u91CD\u8BD5"));
      });
    }
    function showMenu() {
      if (!snapshot) return;
      menu?.remove();
      menu = el("div", "", "menu");
      menu.setAttribute("aria-label", "DeepSeek \u6302\u4EF6\u83DC\u5355");
      const choices = select([["account", "\u4EC5\u767B\u5F55\u8D26\u53F7"], ["api-key", "\u4EC5 API Key"], ["both", "\u4E24\u8005\u540C\u65F6"]], settings.displayMode ?? "api-key");
      choices.onchange = () => action(async () => {
        await api("/settings", { displayMode: choices.value });
        await reload();
      });
      menu.append(field("\u4F59\u989D\u663E\u793A", choices));
      const close = () => {
        menu?.remove();
        menu = null;
      }, run = (work) => () => {
        close();
        work();
      };
      menu.append(button("\u4F59\u989D\u4E0E\u6765\u6E90\u8BE6\u60C5", run(details)), button("\u5206\u522B\u5237\u65B0\u4E24\u4E2A\u6765\u6E90", run(() => action(async () => {
        await Promise.all(SOURCES.map((s) => api("/balance?source=" + s)));
        await reload();
      }))), button("\u6C14\u6CE1\u4E0E\u6A21\u5757\u7F16\u8F91", run(() => action(() => openBubbleEditor(panels, client)))), button("\u4F59\u989D\u8D26\u672C\u4E0E\u6821\u6B63", run(() => action(() => openLedger(panels, client)))), button("\u89D2\u8272\u3001\u56FE\u7247\u4E0E\u97F3\u6548\u7D20\u6750", run(() => action(() => openAssets(panels, client)))), button("\u5916\u89C2\u3001\u6C14\u6CE1\u4E0E\u63D0\u9192\u8BBE\u7F6E", run(() => openSettings(panels, client))), button("\u5173\u95ED\u83DC\u5355", close));
      panels.append(menu);
      const r = figure.getBoundingClientRect(), width = 235, height = menu.getBoundingClientRect().height;
      menu.style.left = Math.max(8, Math.min(r.left - width - 5, innerWidth - width - 8)) + "px";
      menu.style.top = Math.max(44, Math.min(r.top, innerHeight - height - 8)) + "px";
      menu.querySelector("button")?.focus();
    }
    function details() {
      const d = dialog(panels, "\u4E24\u79CD\u5B98\u65B9\u6765\u6E90 \xB7 \u5206\u522B\u8BB0\u8D26");
      for (const source of SOURCES) {
        const card = el("div", "", "section"), v = snapshot.balances[source];
        card.append(el("strong", sourceName(source)), el("p", v.label), el("p", v.message || "\u4F59\u989D\u53EF\u7528"), el("p", v.updatedAt ? "\u66F4\u65B0\u4E8E " + new Date(v.updatedAt).toLocaleString() : "\u5C1A\u672A\u6210\u529F\u5237\u65B0", "muted"), button("\u5237\u65B0\u6B64\u6765\u6E90", () => {
          void report(d, async () => {
            await api("/balance?source=" + source);
            await reload();
            d.close();
            details();
          });
        }));
        for (const w of v.wallets) {
          card.append(el("p", money(w.total, w.currency, 4) + " " + w.currency + " \xB7 \u5145\u503C " + money(w.recharge, w.currency, 4) + " \xB7 \u8D60\u91D1 " + money(w.bonus, w.currency, 4)));
          const row = rows.find((r) => r.source === source && r.scope === v.scope && r.currency === w.currency && r.observed);
          if (row) card.append(button(w.currency + " \u8D26\u672C\u63D0\u9192", () => bookPreferences(panels, client, row)));
        }
        d.body.append(card);
      }
      d.footer.append(button("\u5173\u95ED", d.close));
    }
    figure.oncontextmenu = (e) => {
      e.preventDefault();
      showMenu();
    };
    figure.onpointerdown = (e) => {
      if (e.button !== 0) return;
      const r = host.getBoundingClientRect();
      drag = { id: e.pointerId, x: r.left, y: r.top, startX: e.clientX, startY: e.clientY, moved: false };
      figure.setPointerCapture(e.pointerId);
      figure.classList.add("pressed");
      if (settings.sound) play(settings.pressGroup, settings.volume);
    };
    figure.onpointermove = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved) position(drag.x + dx, drag.y + dy);
    };
    function finishDrag(cancelled = false) {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      figure.classList.remove("pressed");
      if (!cancelled && settings.sound) play(settings.pressGroup, settings.volume, true);
      if (moved) {
        const r = host.getBoundingClientRect(), snap = settings.snap, px = (side) => snap[side] * (snap.unit === "px" ? 1 : (side === "top" || side === "bottom" ? innerHeight : innerWidth) / 100);
        let x = r.x, y = r.y;
        if (snap.enabled) {
          if (x < px("left")) x = 0;
          else if (innerWidth - settings.scrollGap - r.right < px("right")) x = innerWidth - settings.scrollGap - r.width - 8;
          if (y - 44 < px("top")) y = 44;
          else if (innerHeight - r.bottom < px("bottom")) y = innerHeight - r.height - 8;
        }
        position(x, y);
        action(async () => {
          await api("/settings", { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) });
          await reload();
        });
      } else if (!cancelled) {
        if (settings.tapAdvance) advance();
        else {
          manual = queue.start(bubbles);
          manualScene++;
          draw();
        }
      }
    }
    figure.onpointerup = (e) => {
      if (drag?.id === e.pointerId) finishDrag();
    };
    figure.onpointercancel = figure.onlostpointercapture = () => finishDrag(true);
    window.addEventListener("pointerup", (e) => {
      if (drag?.id === e.pointerId) finishDrag();
    }, { signal: lifecycle.signal });
    window.addEventListener("blur", () => finishDrag(true), { signal: lifecycle.signal });
    figure.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (settings.tapAdvance) advance();
        else {
          manual = queue.start(bubbles);
          manualScene++;
          draw();
        }
      }
    };
    image.onload = () => {
      try {
        const c = el("canvas");
        c.width = c.height = 64;
        const ctx = c.getContext("2d");
        ctx.drawImage(image, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data, points = [];
        for (let y = 0; y < 64; y++) {
          let min = 64, max = -1;
          for (let x = 0; x < 64; x++) if (data[(y * 64 + x) * 4 + 3] > 32) {
            min = Math.min(min, x);
            max = x;
          }
          if (max >= 0) {
            points.push([min, y], [max + 1, y + 1]);
          }
        }
        points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), half = (ps) => {
          const h = [];
          for (const p of ps) {
            while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
            h.push(p);
          }
          return h.slice(0, -1);
        }, hull = [...half(points), ...half([...points].reverse())];
        if (hull.length > 2) figure.style.clipPath = "polygon(" + hull.map(([x, y]) => x / 64 * 100 + "% " + y / 64 * 100 + "%").join(",") + ")";
      } catch {
      }
    };
    image.onerror = () => {
      figure.style.clipPath = "";
      image.hidden = true;
      figure.setAttribute("aria-label", "\u89D2\u8272\u7D20\u6750\u6682\u4E0D\u53EF\u7528\uFF1B\u53F3\u952E\u6253\u5F00\u83DC\u5355");
    };
    window.addEventListener("resize", () => {
      if (!initialized || drag) {
        viewport = { width: innerWidth, height: innerHeight };
        return;
      }
      const r = host.getBoundingClientRect(), right = viewport.width - r.right, bottom = viewport.height - r.bottom, x = r.x < right ? r.x : innerWidth - r.width - right, y = r.y < bottom ? r.y : innerHeight - r.height - bottom;
      viewport = { width: innerWidth, height: innerHeight };
      settings.x = Math.max(0, x);
      settings.y = Math.max(44, y);
      position();
      action(async () => {
        await api("/settings", { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) });
      });
    }, { signal: lifecycle.signal });
    window.addEventListener("pagehide", cleanup, { signal: lifecycle.signal });
    document.addEventListener("pointerdown", (e) => {
      if (menu && e.composedPath().every((n) => n !== portal && n !== host)) {
        menu.remove();
        menu = null;
      }
    }, { signal: lifecycle.signal });
    async function tick() {
      try {
        if (!initialized) {
          await reload();
          const initial = await api("/notifications");
          cursor = initial.seq;
          for (const n of initial.pending) if (settings.events[n.kind].enabled) notifications.push(n);
          initialized = true;
        } else {
          const [state, h, n, cfg] = await Promise.all([api("/state"), api("/history"), api("/notifications?after=" + cursor), api("/bubbles")]);
          snapshot = state;
          settings = state.settings;
          rows = h.rows;
          if (cfg.revision !== bubbles.revision) {
            bubbles = cfg;
            manual = null;
            queue.index = -1;
          }
          notifications.resolved(new Set(n.pending.map((p) => p.id)));
          for (const item of n.items) if (settings.events[item.kind].enabled && (!["question", "approval"].includes(item.kind) || item.pending)) notifications.push(item);
          cursor = n.seq;
          while (notifications.current && !settings.events[notifications.current.kind].enabled) notifications.next();
        }
        draw();
      } catch {
        if (!stopped && !initialized) {
          renderer.render(definition("\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5 DSH\n\u7A0D\u540E\u81EA\u52A8\u91CD\u8BD5"), { snapshot: { settings, balances: { account: {}, "api-key": {} }, completionSeq: 0, title: "", pricing: { status: "unknown", nextAt: null, calendarYear: 2026, holidays: [] } }, rows: [], catalog }, "error");
        }
      }
      if (!stopped) poll = setTimeout(() => void tick(), 2e3);
    }
    await tick();
  }
  void mount();
})();
