// src/index.ts
import { readFile } from "node:fs/promises";

// src/engine.ts
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";

// src/host.ts
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
  lowBalance: { CNY: 5, USD: 1 }
};
function initialMode(balances) {
  const account = !["signed-out", "unavailable"].includes(balances.account.status);
  const key = !["missing-key", "unavailable"].includes(balances["api-key"].status);
  return account && key ? "both" : account ? "account" : "api-key";
}
function parseSettings(input, previous) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("\u8BBE\u7F6E\u683C\u5F0F\u65E0\u6548");
  const p = input;
  const next = structuredClone(previous);
  if (Object.keys(p).some((key) => !(key in DEFAULT_SETTINGS))) throw new Error("\u672A\u77E5\u8BBE\u7F6E\u5B57\u6BB5");
  if ("displayMode" in p) {
    if (!["account", "api-key", "both"].includes(String(p.displayMode))) throw new Error("\u663E\u793A\u6A21\u5F0F\u65E0\u6548");
    next.displayMode = p.displayMode;
  }
  if ("character" in p) {
    if (!CHARACTERS.some((c) => c.id === p.character)) throw new Error("\u89D2\u8272\u65E0\u6548");
    next.character = String(p.character);
  }
  for (const key of ["sound", "flip"]) {
    if (!(key in p)) continue;
    if (typeof p[key] !== "boolean") throw new Error("\u5F00\u5173\u65E0\u6548");
    next[key] = p[key];
  }
  for (const [key, min, max] of [["scale", 0.6, 1.5], ["volume", 0, 1], ["refreshSeconds", 15, 600]]) {
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
  return next;
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
  return { version: 1, settings: structuredClone(DEFAULT_SETTINGS), books: {}, calls: [], completions: [], completionSeq: 0, seen: {}, turnScopes: {} };
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
        row = { day, source: call.source, scope: call.scope, currency, observed: false, firstAt: call.at, lastAt: call.at, opening: 0, last: 0, debit: 0, credit: 0, estimate: totals([], currency) };
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
  const cut = now - 30 * 864e5;
  state.calls = state.calls.filter((c) => c.at >= cut).slice(-2e4);
  state.completions = state.completions.filter((c) => c.at >= cut).slice(-200);
  state.seen = Object.fromEntries(Object.entries(state.seen).slice(-2e4));
  state.turnScopes = Object.fromEntries(Object.entries(state.turnScopes).slice(-1e3));
  for (const [key, book] of Object.entries(state.books)) {
    for (const [day, row] of Object.entries(book.days)) if (row.lastAt < cut) delete book.days[day];
    if (!Object.keys(book.days).length) delete state.books[key];
  }
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
        timer = setTimeout(() => resolve({ source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", message: "\u4F59\u989D\u67E5\u8BE2\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0", wallets: [], scope: null, updatedAt: null }), 2e4);
      })]);
    } catch {
      return { source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", message: "\u6765\u6E90\u914D\u7F6E\u6216\u4F59\u989D\u67E5\u8BE2\u5931\u8D25", wallets: [], scope: null, updatedAt: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async fetchSource(source) {
    const config = providerConfig(this.ctx, source);
    const view = { source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : config.ref, status: "unavailable", message: "\u5B98\u65B9\u6A21\u578B\u6765\u6E90\u672A\u542F\u7528\u6216\u4F7F\u7528\u4E86\u4EE3\u7406", updatedAt: null, scope: null, wallets: [] };
    if (!config.official) return view;
    try {
      if (source === "api-key") {
        const credentials = this.ctx.get("credentials");
        const hit = await credentials.resolve(config.ref);
        if (!hit?.value) return { ...view, status: "missing-key", message: "\u5C1A\u672A\u914D\u7F6E API Key" };
        if (!/^\S+$/.test(hit.value)) return { ...view, status: "failed", message: "API Key \u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u5728 DSH \u6A21\u578B\u8BBE\u7F6E\u4E2D\u66F4\u65B0" };
        const scope2 = fingerprint("key:" + hit.value);
        const res = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: "Bearer " + hit.value }, signal: AbortSignal.timeout(15e3), redirect: "error" });
        if (!res.ok) return { ...view, status: "failed", message: res.status === 401 || res.status === 403 ? "API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F" : "\u4F59\u989D\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF08HTTP " + res.status + "\uFF09" };
        const data = object(await res.json());
        const infos = data.balance_infos;
        if (typeof data.is_available !== "boolean" || !Array.isArray(infos) || !infos.length) throw new Error("invalid");
        const wallets = infos.map((raw) => {
          const w = object(raw);
          const currency = String(w.currency);
          if (currency !== "CNY" && currency !== "USD") throw new Error("invalid");
          return { currency, total: units(String(w.total_balance)), recharge: units(String(w.topped_up_balance)), bonus: units(String(w.granted_balance)) };
        });
        if (await this.identity(source) !== scope2) return { ...view, status: "failed", message: "\u51ED\u636E\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u5237\u65B0" };
        return { ...view, status: "ready", message: data.is_available ? "" : "\u8D26\u6237\u5F53\u524D\u4E0D\u53EF\u8C03\u7528\u6A21\u578B", scope: scope2, wallets, updatedAt: Date.now() };
      }
      const account = this.ctx.get("deepseekAccount");
      if (!account) return { ...view, message: "\u5F53\u524D DSH \u6CA1\u6709\u8D26\u53F7\u670D\u52A1" };
      if ((await account.getState()).status === "signed-out") return { ...view, status: "signed-out", message: "\u5C1A\u672A\u767B\u5F55 DeepSeek \u8D26\u53F7" };
      const profile = await account.getProfile(this.client).catch(() => null);
      const scope = await this.identity(source);
      if (!scope) return { ...view, status: "signed-out", message: "\u8D26\u53F7\u767B\u5F55\u5DF2\u5931\u6548" };
      const result = await account.getBalance(this.client);
      if (!result) return { ...view, status: "signed-out", message: "\u8D26\u53F7\u767B\u5F55\u5DF2\u5931\u6548" };
      if (result.status !== "ready") return { ...view, status: "failed", message: "\u8D26\u53F7\u4F59\u989D\u67E5\u8BE2\u5931\u8D25" };
      if (await this.identity(source) !== scope) return { ...view, status: "failed", message: "\u767B\u5F55\u8D26\u53F7\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u5237\u65B0" };
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
      if (!grouped.size) return { ...view, status: "failed", message: "\u8D26\u53F7\u5C1A\u65E0\u4F59\u989D\u94B1\u5305" };
      return { ...view, label: profile?.status === "ready" && profile.value.name ? profile.value.name : "DeepSeek \u8D26\u53F7", status: "ready", message: "", scope, wallets: [...grouped.values()], updatedAt: Date.now() };
    } catch {
      return { ...view, status: "failed", message: "\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\u6216\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0" };
    }
  }
};

// src/engine.ts
var Engine = class {
  state;
  sources;
  path;
  closed = false;
  balances;
  flights = {};
  queue = Promise.resolve();
  constructor(ctx, home) {
    this.sources = new Sources(ctx);
    this.path = join(home, "deepseek-whale-lite", "state.json");
    this.state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")) : emptyState();
    if (this.state.version !== 1 || !this.state.books || !Array.isArray(this.state.calls)) throw new Error("Whale Lite \u6570\u636E\u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u4FDD\u7559 state.json \u540E\u6392\u67E5");
    const pending = (source) => ({ source, label: source === "account" ? "DeepSeek \u8D26\u53F7" : "API Key", status: "failed", message: "\u7B49\u5F85\u5237\u65B0", wallets: [], updatedAt: null, scope: null });
    this.balances = { account: pending("account"), "api-key": pending("api-key") };
  }
  save() {
    if (this.closed) return;
    prune(this.state);
    mkdirSync(join(this.path, ".."), { recursive: true, mode: 448 });
    writeFileSync(this.path + ".tmp", JSON.stringify(this.state), { mode: 384 });
    renameSync(this.path + ".tmp", this.path);
  }
  refresh(source) {
    const running = this.flights[source];
    if (running) return running;
    const promise = this.sources.fetch(source).then((view) => {
      if (this.closed) return view;
      this.balances[source] = view;
      if (view.status === "ready" && view.scope && view.updatedAt) {
        for (const w of view.wallets) observe(this.state, source, view.scope, w.currency, w.total, view.updatedAt);
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
    return { settings: this.state.settings, balances: this.balances, completionSeq: this.state.completionSeq };
  }
  settings(input) {
    this.state.settings = parseSettings(input, this.state.settings);
    this.save();
  }
  rows() {
    return history(this.state);
  }
  event(session, event) {
    this.queue = this.queue.then(() => this.handle(session, event)).catch(() => {
      console.warn("[deepseek-whale-lite] \u4F1A\u8BDD\u7EDF\u8BA1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u672C\u5730\u6570\u636E\u76EE\u5F55");
    });
    return this.queue;
  }
  async handle(session, event) {
    if (this.closed || !Number.isSafeInteger(event.seq) || event.seq < 0 || session.isOwnSeq && !session.isOwnSeq(event.seq)) return;
    const data = object(event.data);
    const turn = data.turn;
    const step = data.step;
    if (!Number.isSafeInteger(turn)) return;
    const key = session.id + ":" + String(turn);
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
      const id = session.id + ":" + event.seq;
      if ((this.state.seen[session.id] ?? -1) >= event.seq) return;
      if (this.state.calls.some((c) => c.id === id)) return;
      const src = object(object(data.message).source);
      const source = src.provider === "deepseek-account" ? "account" : src.provider === "deepseek-official" ? "api-key" : null;
      const usage = validUsage(data.usage);
      if (!source || !usage || typeof src.model !== "string" || !providerConfig(this.sources.ctx, source).official) return;
      const scope = this.state.turnScopes[key + ":" + String(step)]?.[source] ?? await this.sources.identity(source);
      if (!scope) return;
      this.state.calls.push({ id, session: session.id, turn, at: event.time, source, scope, model: src.model, usage, costs: estimate(src.model, usage) });
      this.save();
    }
    if (event.type === "turn/end") {
      if ((this.state.seen[session.id] ?? -1) >= event.seq) return;
      const calls = this.state.calls.filter((c) => c.session === session.id && c.turn === turn);
      if (calls.length) this.state.completions.push({ seq: ++this.state.completionSeq, session: session.id, turn, at: event.time, reason: String(object(data.reason).kind ?? "completed"), calls });
      this.state.seen[session.id] = event.seq;
      for (const k of Object.keys(this.state.turnScopes)) if (k.startsWith(key + ":")) delete this.state.turnScopes[k];
      this.save();
      for (const source of new Set(calls.map((c) => c.source))) void this.refresh(source);
    }
  }
};

// src/index.ts
var name = "deepseek-whale-lite";
var loader = '(function(){try{if(!window.dshDesktop||location.protocol!=="dsh-app:")return;var s=document.createElement("script");s.src="' + PREFIX + '/widget.js";s.onerror=function(){};(document.body||document.head).appendChild(s)}catch(e){}})()';
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += String(chunk);
    if (Buffer.byteLength(text) > 8192) throw new Error("\u8BF7\u6C42\u8FC7\u5927");
  }
  return JSON.parse(text);
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
        } catch {
          json(res, { error: "\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u53C2\u6570\u6216\u7A0D\u540E\u91CD\u8BD5" }, 400);
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
      engine.settings(await body(req));
      json(res, engine.state.settings);
    });
    register("/history", (req, res) => {
      if (get(req, res)) json(res, { rows: engine.rows() });
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
