"use strict";
(() => {
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

  // src/accounting.ts
  var SCALE = 1e8;
  function dayKey(at = Date.now()) {
    return new Date(at + 8 * 36e5).toISOString().slice(0, 10);
  }
  function totals(calls, currency) {
    return calls.reduce((r, c) => ({
      tokens: r.tokens + Object.values(c.usage).reduce((a, b) => a + b, 0),
      low: r.low + (c.costs?.[currency].low ?? 0),
      high: r.high + (c.costs?.[currency].high ?? 0),
      unknown: r.unknown + Number(c.costs === null)
    }), { tokens: 0, low: 0, high: 0, unknown: 0 });
  }

  // src/widget.ts
  async function mount() {
    if (!window.dshDesktop || location.protocol !== "dsh-app:" || location.hostname !== "app" || window.__deepseekWhaleLite) return;
    const lifecycle = new AbortController();
    let stopped = false;
    let poll;
    let cursor = 0;
    let settings = structuredClone(DEFAULT_SETTINGS);
    let snapshot;
    let rows = [];
    let last = null;
    let historyOpen = false;
    let settingsOpen = false;
    let initialized = false;
    const alerts = /* @__PURE__ */ new Set();
    const audio = /* @__PURE__ */ new Map();
    const host = document.createElement("div");
    host.id = "deepseek-whale-lite";
    host.style.cssText = "position:fixed;z-index:2147483000;width:290px;transform-origin:top left;";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
    :host{font:12px/1.45 system-ui,sans-serif;color:#18344a;--bg:#f7fbff;--line:#d6e7f2;--muted:#647d90;--accent:#207eb4;--card:#fff}
    *{box-sizing:border-box}button,input,select{font:inherit}button,select,input{border:1px solid var(--line);border-radius:8px;color:inherit;background:var(--card);padding:5px 7px}button{cursor:pointer}button:hover{border-color:var(--accent)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .panel{border:1px solid var(--line);border-radius:16px;padding:11px;background:var(--bg);box-shadow:0 6px 24px #09294125;max-height:var(--panel-height,650px);overflow:auto}.title{display:flex;align-items:center;gap:6px;cursor:grab;user-select:none}.title strong{flex:1;font-size:13px}.title button{padding:2px 6px}.card{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}.label{display:flex;align-items:center;gap:6px}.label strong{flex:1}.label button{font-size:11px}.sub{font-size:11px;color:var(--muted);overflow-wrap:anywhere}.money{font-size:20px;font-weight:750;margin:2px 0}.low{color:#b34421}.failure{color:#9d5a30;margin:7px 0}.toolbar{display:flex;gap:6px;margin-top:8px}.toolbar select{flex:1;min-width:0}.figure{display:block;width:156px;height:156px;margin:0 auto;padding:0;border:0;background:transparent;touch-action:none;cursor:grab}.figure img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}.figure.pressed img{translate:0 3px;scale:.96}.figure.flipped img{transform:scaleX(-1)}
    .bubble{border-radius:12px;padding:8px 10px;margin-bottom:7px;background:var(--card);border:1px solid var(--line);white-space:pre-line;max-height:130px;overflow:auto}.form{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.form label{display:flex;flex-direction:column;gap:3px}.form input,.form select{width:100%}.form .wide{grid-column:span 2}.history{max-height:230px;overflow:auto;margin-top:8px}.history article{border-top:1px solid var(--line);padding:7px 0}.note{color:var(--muted);margin-top:6px;font-size:10px}[hidden]{display:none!important}
    @media(prefers-color-scheme:dark){:host{color:#d6eaf8;--bg:#182a38;--card:#213746;--line:#3b5465;--muted:#a8becd;--accent:#65bce8}.low{color:#ffc39d}.failure{color:#ffcdab}}
  `;
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("aria-label", "DeepSeek \u4F59\u989D\u6302\u4EF6");
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.hidden = true;
    bubble.setAttribute("aria-live", "polite");
    const title = document.createElement("div");
    title.className = "title";
    const heading = document.createElement("strong");
    heading.textContent = "DeepSeek Whale Lite";
    const historyButton = button("\u5386\u53F2", () => {
      historyOpen = !historyOpen;
      renderExtras();
    });
    const settingsButton = button("\u8BBE\u7F6E", () => {
      settingsOpen = !settingsOpen;
      renderExtras();
    });
    title.append(heading, historyButton, settingsButton);
    const cards = document.createElement("div");
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const mode = document.createElement("select");
    mode.setAttribute("aria-label", "\u4F59\u989D\u663E\u793A\u6A21\u5F0F");
    for (const [value, text] of [["both", "\u4E24\u4E2A\u4F59\u989D\u540C\u65F6\u663E\u793A"], ["account", "\u4EC5\u8D26\u53F7\u767B\u5F55"], ["api-key", "\u4EC5 API Key"]]) mode.add(new Option(text, value));
    mode.addEventListener("change", () => {
      void update({ displayMode: mode.value });
    }, { signal: lifecycle.signal });
    toolbar.append(mode, button("\u5237\u65B0", () => {
      for (const source of visible()) void refresh(source);
    }));
    const extras = document.createElement("div");
    panel.append(bubble, title, cards, toolbar, extras);
    const figure = document.createElement("button");
    figure.className = "figure";
    figure.setAttribute("aria-label", "\u62D6\u52A8\u89D2\u8272\uFF1B\u70B9\u51FB\u663E\u793A\u6700\u8FD1\u4E00\u8F6E\u6D88\u8017");
    const image = document.createElement("img");
    image.alt = "DeepSeek Q \u7248\u89D2\u8272";
    image.draggable = false;
    figure.append(image);
    shadow.append(style, panel, figure);
    document.body.append(host);
    function cleanup() {
      stopped = true;
      clearTimeout(poll);
      lifecycle.abort();
      host.remove();
      for (const sound2 of audio.values()) {
        sound2.pause();
        sound2.src = "";
      }
      delete window.__deepseekWhaleLite;
    }
    window.__deepseekWhaleLite = cleanup;
    function button(label, fn) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = fn;
      return b;
    }
    function say(text) {
      bubble.textContent = text;
      bubble.hidden = false;
      if (!drag) place();
    }
    function sound(name) {
      if (!settings.sound) return;
      let a = audio.get(name);
      if (!a) {
        a = new Audio(PREFIX + "/sounds/" + name + ".ogg");
        audio.set(name, a);
      }
      a.volume = settings.volume;
      a.currentTime = 0;
      void a.play().catch(() => {
      });
    }
    async function api(path, init) {
      const res = await fetch(PREFIX + path, { ...init, signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(25e3)]) });
      if (res.status === 404) cleanup();
      if (!res.ok) throw new Error("\u5BBF\u4E3B\u8BF7\u6C42\u5931\u8D25");
      return res.json();
    }
    function visible() {
      return settings.displayMode === "both" ? SOURCES : [settings.displayMode ?? "api-key"];
    }
    function money(n, currency, digits = 2) {
      return (currency === "CNY" ? "\xA5" : "$") + (n / SCALE).toFixed(digits);
    }
    function cost(total, currency) {
      return (total.unknown ? "\u542B " + total.unknown + " \u6B21\u8D39\u7528\u672A\u77E5\uFF1B\u5DF2\u77E5\u90E8\u5206 " : "") + money(total.low, currency, 6) + "\u2013" + money(total.high, currency, 6);
    }
    function render(forceExtras = false) {
      if (drag) return;
      const lowMessages = [];
      cards.replaceChildren();
      mode.value = settings.displayMode ?? "both";
      image.src = PREFIX + "/characters/" + settings.character + ".png";
      figure.classList.toggle("flipped", settings.flip);
      host.style.transform = "scale(" + settings.scale + ")";
      for (const source of visible()) {
        const view = snapshot.balances[source];
        const card = document.createElement("article");
        card.className = "card";
        card.dataset.source = source;
        const label = document.createElement("div");
        label.className = "label";
        const name = document.createElement("strong");
        name.textContent = source === "account" ? "\u8D26\u53F7\u767B\u5F55" : "API Key";
        label.append(name, button("\u5237\u65B0", () => {
          void refresh(source);
        }));
        card.append(label);
        line(card, view.label, "sub");
        if (view.status !== "ready") line(card, view.message, "failure");
        else for (const wallet of view.wallets) {
          const low = wallet.total < settings.lowBalance[wallet.currency] * SCALE;
          line(card, money(wallet.total, wallet.currency) + " " + wallet.currency, low ? "money low" : "money");
          line(card, "\u5145\u503C " + money(wallet.recharge, wallet.currency) + " \xB7 \u8D60\u9001 " + money(wallet.bonus, wallet.currency), "sub");
          const row = rows.find((r) => r.day === dayKey() && r.source === source && r.scope === view.scope && r.currency === wallet.currency);
          line(card, row?.observed ? "\u4ECA\u65E5\u89C2\u6D4B\u4E0B\u964D " + money(row.debit, wallet.currency, 4) + (row.credit ? " \xB7 \u6709\u4F59\u989D\u589E\u52A0\uFF0C\u5F85\u6838\u5BF9" : "") : "\u4ECA\u65E5\u5C1A\u65E0\u4F59\u989D\u89C2\u6D4B", "sub");
          if (row) line(card, "\u672C\u673A\u4F30\u7B97 " + cost(row.estimate, wallet.currency) + " \xB7 " + row.estimate.tokens + " tokens", "sub");
          const alertId = source + ":" + view.scope + ":" + wallet.currency;
          if (low && !alerts.has(alertId)) {
            alerts.add(alertId);
            lowMessages.push((source === "account" ? "\u8D26\u53F7\u767B\u5F55" : "API Key") + " \u4F59\u989D\u504F\u4F4E\uFF1A" + money(wallet.total, wallet.currency));
          }
          if (!low) alerts.delete(alertId);
        }
        if (view.message && view.status === "ready") line(card, view.message, "sub");
        if (view.updatedAt) line(card, "\u66F4\u65B0\u4E8E " + new Date(view.updatedAt).toLocaleTimeString(), "sub");
        cards.append(card);
      }
      if (lowMessages.length) {
        say(lowMessages.join("\n"));
        sound("alert");
      }
      renderExtras(forceExtras);
      place();
    }
    function line(parent, text, className = "") {
      const d = document.createElement("div");
      d.className = className;
      d.textContent = text;
      parent.append(d);
    }
    function renderExtras(force = true) {
      if (!force && settingsOpen && extras.querySelector(".form")) return;
      extras.replaceChildren();
      if (settingsOpen) {
        let field2 = function(label, input) {
          const l = document.createElement("label");
          l.append(document.createTextNode(label), input);
          form.append(l);
        };
        var field = field2;
        const form = document.createElement("div");
        form.className = "form";
        const chars = document.createElement("select");
        for (const c of CHARACTERS) chars.add(new Option(c.name, c.id));
        chars.value = settings.character;
        chars.onchange = () => {
          void update({ character: chars.value });
        };
        field2("\u5185\u7F6E\u89D2\u8272", chars);
        const flip = document.createElement("input");
        flip.type = "checkbox";
        flip.checked = settings.flip;
        flip.onchange = () => {
          void update({ flip: flip.checked });
        };
        field2("\u955C\u50CF\u89D2\u8272", flip);
        for (const [key, label, min, max, step] of [["scale", "\u5927\u5C0F", 0.6, 1.5, 0.1], ["volume", "\u97F3\u91CF", 0, 1, 0.1], ["refreshSeconds", "\u5237\u65B0\u95F4\u9694\uFF08\u79D2\uFF09", 15, 600, 15]]) {
          const input = document.createElement("input");
          input.type = "number";
          input.min = String(min);
          input.max = String(max);
          input.step = String(step);
          input.value = String(settings[key]);
          input.onchange = () => {
            void update({ [key]: Number(input.value) });
          };
          field2(label, input);
        }
        const enabled = document.createElement("input");
        enabled.type = "checkbox";
        enabled.checked = settings.sound;
        enabled.onchange = () => {
          void update({ sound: enabled.checked }).then(() => sound("complete"));
        };
        field2("\u542F\u7528\u97F3\u6548", enabled);
        for (const currency of ["CNY", "USD"]) {
          const threshold = document.createElement("input");
          threshold.type = "number";
          threshold.min = "0";
          threshold.step = "0.1";
          threshold.value = String(settings.lowBalance[currency]);
          threshold.onchange = () => {
            void update({ lowBalance: { ...settings.lowBalance, [currency]: Number(threshold.value) } });
          };
          field2(currency + " \u4F4E\u4F59\u989D\u9608\u503C", threshold);
        }
        form.append(button("\u8BD5\u542C\u5B8C\u6210\u97F3", () => sound("complete")), button("\u91CD\u7F6E\u4F4D\u7F6E", () => {
          void update({ x: null, y: null });
        }));
        extras.append(form);
      }
      if (historyOpen) {
        const history = document.createElement("div");
        history.className = "history";
        for (const row of rows.slice(0, 90)) {
          const item = document.createElement("article");
          line(item, row.day + " \xB7 " + (row.source === "account" ? "\u8D26\u53F7\u767B\u5F55" : "API Key") + " \xB7 " + row.currency);
          line(item, "\u8D26\u672C " + row.scope.slice(0, 8) + (row.observed ? " \xB7 \u89C2\u6D4B\u4E0B\u964D " + money(row.debit, row.currency, 4) : " \xB7 \u65E0\u4F59\u989D\u89C2\u6D4B"), "sub");
          line(item, "\u672C\u673A\u4F30\u7B97 " + cost(row.estimate, row.currency), "sub");
          if (row.observed) line(item, "\u89C2\u6D4B\u4ECE " + new Date(row.firstAt).toLocaleTimeString() + " \u5F00\u59CB\uFF1B\u4F59\u989D\u589E\u52A0 " + money(row.credit, row.currency), "sub");
          history.append(item);
        }
        if (!rows.length) line(history, "\u5C1A\u65E0\u5386\u53F2\u8BB0\u5F55", "sub");
        extras.append(history);
      }
      if (settingsOpen || historyOpen) line(extras, "\u5317\u4EAC\u65F6\u95F4\u65E5\u754C\uFF1B\u89C2\u6D4B\u4EC5\u8986\u76D6\u63D2\u4EF6\u8FD0\u884C\u671F\u95F4\u3002\u8D39\u7528\u4E3A\u5CF0\u8C37\u8D39\u7387\u533A\u95F4\uFF0C\u5E76\u975E\u8D26\u5355\u3002", "note");
      place();
    }
    function place(x = settings.x, y = settings.y) {
      host.style.setProperty("--panel-height", Math.max(80, innerHeight / settings.scale - 172) + "px");
      const rect = host.getBoundingClientRect();
      const maxX = Math.max(0, innerWidth - rect.width - 8);
      const maxY = Math.max(0, innerHeight - rect.height - 8);
      host.style.left = Math.max(0, Math.min(x ?? maxX, maxX)) + "px";
      host.style.top = Math.max(0, Math.min(y ?? maxY, maxY)) + "px";
    }
    async function update(patch) {
      try {
        settings = await api("/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        render(true);
      } catch {
        say("\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8F93\u5165");
      }
    }
    async function refresh(source) {
      try {
        snapshot.balances[source] = await api("/balance?source=" + source);
        rows = (await api("/history")).rows;
        render();
      } catch {
        say((source === "account" ? "\u8D26\u53F7\u767B\u5F55" : "API Key") + "\u5237\u65B0\u5931\u8D25\uFF0C\u7A0D\u540E\u91CD\u8BD5");
      }
    }
    function completion(item) {
      const lines = [item.reason === "completed" ? "\u8FD9\u4E00\u8F6E\u5B8C\u6210\u5566\uFF01" : "\u8FD9\u4E00\u8F6E\u5DF2\u7ED3\u675F\uFF08\u4E2D\u65AD\u6216\u5931\u8D25\uFF09"];
      for (const source of SOURCES) {
        const calls = item.calls.filter((c) => c.source === source);
        if (!calls.length) continue;
        for (const scope of new Set(calls.map((c) => c.scope))) {
          const own = calls.filter((c) => c.scope === scope);
          const view = snapshot.balances[source];
          const currency = view.scope === scope ? view.wallets[0]?.currency ?? "CNY" : "CNY";
          const sum = totals(own, currency);
          lines.push((source === "account" ? "\u8D26\u53F7\u767B\u5F55" : "API Key") + " [" + scope.slice(0, 6) + "] " + sum.tokens + " tokens\n\u4F30\u7B97 " + cost(sum, currency));
        }
      }
      return lines.join("\n");
    }
    let drag = null;
    function down(e) {
      if (e.button !== 0 || e.target instanceof Element && e.target.closest("button,input,select") && !figure.contains(e.target)) return;
      const r = host.getBoundingClientRect();
      drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: r.x, y: r.y, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      figure.classList.add("pressed");
      sound("press");
    }
    function move(e) {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved) place(drag.x + dx, drag.y + dy);
    }
    function up(e) {
      if (!drag || drag.id !== e.pointerId) return;
      const moved = drag.moved;
      drag = null;
      figure.classList.remove("pressed");
      sound("release");
      if (moved) {
        const r = host.getBoundingClientRect();
        let x = r.x, y = r.y;
        if (x < 35) x = 8;
        if (innerWidth - r.right < 35) x = innerWidth - r.width - 8;
        if (y < 35) y = 8;
        if (innerHeight - r.bottom < 35) y = innerHeight - r.height - 8;
        void update({ x: Math.max(0, x), y: Math.max(0, y) });
      } else if (figure.contains(e.target)) say(last ? completion(last) : "\u4F60\u597D\u5440\uFF01\u6211\u4F1A\u5206\u522B\u770B\u597D\u4E24\u4E2A\u8D26\u6237\u7684\u4F59\u989D\u3002");
    }
    for (const target of [title, figure]) {
      target.addEventListener("pointerdown", down, { signal: lifecycle.signal });
      target.addEventListener("pointermove", move, { signal: lifecycle.signal });
      target.addEventListener("pointerup", up, { signal: lifecycle.signal });
      target.addEventListener("pointercancel", () => {
        drag = null;
        figure.classList.remove("pressed");
      }, { signal: lifecycle.signal });
    }
    figure.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        say(last ? completion(last) : "\u4E24\u4E2A\u6765\u6E90\uFF0C\u5206\u522B\u8BB0\u8D26\u3002");
      }
    }, { signal: lifecycle.signal });
    window.addEventListener("resize", () => place(), { signal: lifecycle.signal });
    window.addEventListener("pagehide", cleanup, { signal: lifecycle.signal });
    async function tick() {
      try {
        snapshot = await api("/state");
        settings = snapshot.settings;
        const history = await api("/history");
        rows = history.rows;
        if (!initialized) {
          cursor = snapshot.completionSeq;
          initialized = true;
        }
        const completions = await api("/completions?after=" + cursor);
        if (completions.items.length) {
          last = completions.items.at(-1) ?? null;
          say(completions.items.map(completion).join("\n\n"));
          if (completions.items.some((item) => item.reason === "completed")) sound("complete");
        }
        cursor = completions.seq;
        render();
      } catch {
        if (!stopped) say("\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5 DSH\uFF1B\u7A0D\u540E\u81EA\u52A8\u91CD\u8BD5");
      }
      if (!stopped) poll = setTimeout(tick, 3e3);
    }
    await tick();
  }
  void mount();
})();
