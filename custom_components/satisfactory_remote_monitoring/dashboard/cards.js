// Wait for Home Assistant to initialize its custom element registry.
await customElements.whenDefined("home-assistant");

const playerName = state => (state.attributes.friendly_name || state.entity_id.split(".")[1])
  .replace(/^Satisfactory\s*\([^)]*\)\s*/i, "").replace(/(?:\s+|_)(?:health|online|dead)$/i, "");

function discoverPlayers(states = {}) {
  const players = new Map();
  for (const state of Object.values(states)) {
    const match = /^(sensor|binary_sensor)\.(satisfactory_.+)_(health|online|dead)$/.exec(state.entity_id);
    if (!match) continue;
    const [, domain, base, metric] = match;
    if ((metric === "health") !== (domain === "sensor")) continue;
    const id = `sensor.${base}_health`;
    if (metric === "health" || !players.has(id)) players.set(id, playerName(state));
  }
  return [...players].sort((a, b) => a[1].localeCompare(b[1]));
}

class SatisfactoryPlayerRow extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        ha-card { padding: 16px; display: grid; gap: 10px; }
        header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        strong { overflow-wrap:anywhere; }
        #status, #hp { font-size: 0.85rem; }
        #hp { text-align:right; color:var(--secondary-text-color); }
        #bar { display:grid; grid-template-columns:24px repeat(10,minmax(0,1fr));
          gap:4px; align-items:center; padding:7px; background:#191919; }
        .slot { display:grid; grid-template-rows:18px 2px; gap:3px; }
        .slot > i { background:linear-gradient(to right,#fff var(--fill),#656565 var(--fill)); }
        .slot > b { background:#f39a32; }

      </style>
      <ha-card>
        <header><strong></strong><span id="status"></span></header>
        <div id="bar" role="img">
          <ha-icon icon="mdi:heart-pulse" style="--mdc-icon-size:22px"></ha-icon>
          ${'<span class="slot"><i></i><b></b></span>'.repeat(10)}
        </div>
        <div id="hp"></div>

      </ha-card>`;
  }

  setConfig(config) {
    this.config = config;
    this.render();
  }

  set hass(hass) {
    this.currentHass = hass;
    this.render();
  }

  getCardSize() { return 2; }

  render() {
    if (!this.config || !this.currentHass) return;
    const root = this.shadowRoot;
    const id = this.config.entity || "";
    const states = this.currentHass.states;
    const player = states[id];
    const base = id.replace(/^sensor\./, "").replace(/_health$/, "");
    const online = states[`binary_sensor.${base}_online`]?.state;
    const dead = states[`binary_sensor.${base}_dead`]?.state === "on";
    const raw = player?.state;
    const known = Boolean(raw?.trim()) && Number.isFinite(Number(raw));
    const hp = known ? Math.max(0, Math.min(100, Number(raw))) : 0;
    const playerState = player || states[`binary_sensor.${base}_online`] || states[`binary_sensor.${base}_dead`];
    root.querySelector("strong").textContent = playerState ? playerName(playerState)
      : id ? "Player unavailable" : "Select a player";
    const status = root.getElementById("status");
    const presence = online === "on" ? "Online" : online === "off" ? "Offline" : "Status unavailable";
    status.textContent = dead ? `${presence} � Dead` : presence;
    status.style.color = dead ? "#ff4848" : online === "on" ? "#65d98a" : "var(--secondary-text-color)";
    root.querySelector("ha-icon").style.color = dead ? "#ff3131" : "#fff";
    root.getElementById("bar").setAttribute("aria-label", known ? `${Math.ceil(hp)} of 100 HP` : "Health unavailable");
    root.getElementById("hp").textContent = `${known ? Math.ceil(hp) : "-"} / 100 HP`;
    root.querySelectorAll(".slot").forEach((slot, index) => {
      const fill = Math.max(0, Math.min(10, hp - index * 10)) * 10;
      slot.style.setProperty("--fill", `${fill}%`);
    });
  }
}


function selectedPlayers(config) {
  const ids = Array.isArray(config?.entities) ? config.entities : [config?.entity];
  return [...new Set(ids.filter(id => typeof id === "string" && id))];
}

class SatisfactoryPlayerCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("satisfactory-player-editor");
  }

  static getStubConfig(hass) {
    return { entity: discoverPlayers(hass?.states)[0]?.[0] || "" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      '<style>:host{display:grid;gap:8px;min-width:0}</style><div id="rows" style="display:grid;gap:8px"></div>';
  }

  setConfig(config) {
    const ids = selectedPlayers(config);
    this.size = Math.max(1, ids.length);
    const rows = ids.length ? ids : [""];
    this.shadowRoot.getElementById("rows").replaceChildren(...rows.map(entity => {
      const row = document.createElement("satisfactory-player-row");
      row.setConfig({ entity });
      if (this.currentHass) row.hass = this.currentHass;
      return row;
    }));
  }

  set hass(hass) {
    this.currentHass = hass;
    for (const row of this.shadowRoot.getElementById("rows").children) row.hass = hass;
  }

  getCardSize() { return 2 * (this.size || 1); }
}

class SatisfactoryPlayerEditor extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        #choices { display:grid; gap:8px; margin:6px 0 8px; }
        .choice { display:flex; gap:8px; }
        select { flex:1; min-width:0; padding:10px; color:var(--primary-text-color);
          background:var(--card-background-color); border:1px solid var(--divider-color); }
        button { padding:8px; color:var(--primary-color); background:transparent;
          border:1px solid var(--divider-color); border-radius:4px; cursor:pointer; }
        button:disabled { opacity:.45; cursor:default; }
      </style>
      <div>Players</div><div id="choices"></div><button id="add" type="button">+ Add player</button>`;
    this.add = root.getElementById("add");
    this.add.addEventListener("click", () => {
      const ids = selectedPlayers(this.config);
      const next = discoverPlayers(this.currentHass?.states).find(([id]) => !ids.includes(id));
      if (next) this.save([...ids, next[0]]);
    });
  }

  setConfig(config) {
    this.config = config;
    this.refresh();
  }

  set hass(hass) {
    this.currentHass = hass;
    this.refresh();
  }

  save(ids) {
    const { entity, entities, ...config } = this.config || {};
    this.config = { ...config, entities: ids };
    this.refresh();
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this.config }, bubbles: true, composed: true,
    }));
  }

  refresh() {
    const ids = selectedPlayers(this.config);
    const players = discoverPlayers(this.currentHass?.states);
    const signature = JSON.stringify([ids, players]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.add.disabled = !players.some(([id]) => !ids.includes(id));
    const choices = this.shadowRoot.getElementById("choices");
    choices.replaceChildren();
    for (const [index, selected] of (ids.length ? ids : [""]).entries()) {
      const row = document.createElement("div");
      row.className = "choice";
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Player ${index + 1}`);
      if (!selected) select.add(new Option("Select a player", ""));
      for (const [id, name] of players)
        if (id === selected || !ids.includes(id)) select.add(new Option(name, id));
      if (selected && !players.some(([id]) => id === selected))
        select.add(new Option(`${selected} (unavailable)`, selected));
      select.value = selected;
      select.addEventListener("change", () => {
        const updated = [...ids];
        updated[index] = select.value;
        this.save(updated.filter(Boolean));
      });
      row.append(select);
      if (selected) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove player ${index + 1}`);
        remove.addEventListener("click", () => this.save(ids.filter(id => id !== selected)));
        row.append(remove);
      }
      choices.append(row);
    }
  }
}

if (!customElements.get("satisfactory-player-card")) {
customElements.define("satisfactory-player-row", SatisfactoryPlayerRow);
customElements.define("satisfactory-player-card", SatisfactoryPlayerCard);
customElements.define("satisfactory-player-editor", SatisfactoryPlayerEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "satisfactory-player-card",
  name: "Satisfactory Player Health (Selected)",
  description: "Choose one or more players to see their health bars and online status.",
  preview: true,
});
}

class SatisfactorySummaryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:"open"});
  }
  setConfig(config) { this.config = config; this.render(); }
  set hass(hass) { this.currentHass = hass; this.render(); }
  getCardSize() { return 3; }
  render() {
    if (!this.config || !this.currentHass) return;
    const coupon = this.localName === "satisfactory-coupons-card";
    const entity = this.currentHass.states[this.config.entity ||
      (coupon ? "sensor.satisfactory_192_168_8_50_8080_sink_coupons" : "sensor.satisfactory_circuit_power")];
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding:16px; text-align:center; }
        .ticket { position:relative; aspect-ratio:444/224; max-width:444px; margin:auto; container-type:inline-size; }
        .ticket img { display:block; width:100%; }
        .ticket output { position:absolute; top:59.5%; left:50%; transform:translate(-50%,-50%);
          color:white; font:700 clamp(14px,13cqw,57px)/1 Roboto,Arial,sans-serif; }
        .power { display:grid; grid-template-columns:clamp(42px,20%,84px) minmax(0,1fr);
          align-items:start; gap:12px; text-align:left; }
        .pylon { display:block; width:100%; max-height:96px; object-fit:contain; }
        .power dl { display:grid; gap:8px; overflow-wrap:anywhere; }
        .power .circuit { padding:10px; border:1px solid var(--divider-color);
          border-radius:8px; background:var(--secondary-background-color, transparent); }
        .power dt { margin:0; }
        .power .load { display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px;
          margin-top:6px; font-size:.85rem; }
        .power progress { flex:1 1 64px; min-width:0; height:7px; accent-color:#f39a32; }
        .tripped { color:var(--error-color, #ff5353); font-weight:700; }
        strong { font-size:1.1rem; } 
        ha-icon { color:#ffbf50; --mdc-icon-size:46px; }
        dl { margin:10px 0 0; } dt { font-weight:700; margin-top:8px; } dd { margin:2px 0; }
      </style>
      <ha-card>${coupon
        ? '<div class="ticket"><img alt="FICSIT Printable Coupons"><output></output></div>'
        : '<div class="power"><img class="pylon" alt=""><div><strong>Circuit Power</strong><dl></dl></div></div>'}</ha-card>`;
    const moduleUrl = new URL(import.meta.url);
    const imageUrl = new URL(coupon ? "./coupon-popup.png" : "./power-pylon.png", moduleUrl);
    imageUrl.search = moduleUrl.search;
    this.shadowRoot.querySelector("img").src = imageUrl.href;
    if (coupon) {
      const value = entity?.state;
      this.shadowRoot.querySelector("output").textContent =
        /^\d+(?:\.0+)?$/.test(value || "") ? value.split(".")[0] : "—";
      return;
    }
    const list = this.shadowRoot.querySelector("dl");
    const groups = new Map();
    const rows = entity?.attributes.display_rows;
    for (const row of typeof rows === "string" ? rows.split(";") : []) {
      const [group, capacity, max] = row.split("|").map(value => value.trim());
      if (!group || !capacity || !max) continue;
      groups.set(group.toUpperCase(), { reading: `${max} MAX / ${capacity} CAP` });
    }

    const registry = this.currentHass.entities;
    const device = registry?.[entity?.entity_id]?.device_id;
    for (const [id, state] of Object.entries(this.currentHass.states)) {
      const match = /^(binary_sensor|sensor)\.satisfactory_.+_circuit_group_(\d+)_(fuse_tripped|circuit_load)$/.exec(id);
      if (!match || (match[1] === "sensor") !== (match[3] === "circuit_load")) continue;
      if (device && registry?.[id]?.device_id !== device) continue;
      const group = `CIRCUIT GROUP ${match[2]}`;
      const data = groups.get(group);
      if (match[3] === "circuit_load") {
        const load = state.state.trim() ? Number(state.state) : NaN;
        groups.set(group, { ...data, load: Number.isFinite(load) && load >= 0 ? load : data?.load });
        continue;
      }
      groups.set(group, {
        ...data,
        tripped: data?.tripped || state.state === "on",
        fuseKnown: data?.fuseKnown || state.state === "on" || state.state === "off",
      });
    }

    const sortedGroups = [...groups].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }));
    for (const [group, data] of sortedGroups) {
      const title = document.createElement("dt");
      const value = document.createElement("dd");
      title.textContent = group;
      if (data.tripped) {
        title.className = "tripped";
        value.className = "tripped";
        value.textContent = data.reading ? `Tripped · ${data.reading}` : "Tripped";
      } else {
        value.textContent = data.reading || (data.fuseKnown ? "Power readings unavailable" : "Fuse status unavailable");
      }
      const row = document.createElement("div");
      row.className = data.tripped ? "circuit tripped" : "circuit";
      const load = document.createElement("dd");
      load.className = "load";
      const label = document.createElement("span");
      label.textContent = data.load == null ? "Load unavailable"
        : `Load ${data.load.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
      load.append(label);
      if (data.load != null) {
        const bar = document.createElement("progress");
        bar.max = 100;
        bar.value = Math.min(data.load, 100);
        bar.setAttribute("aria-label", `${group} load`);
        load.append(bar);
      }
      row.append(title, value, load);
      list.append(row);
    }
    if (!list.children.length) list.textContent = "No circuit data";
  }
}

for (const [type, name, description] of [
  ["satisfactory-coupons-card", "Satisfactory Printable Coupons",
    "Display the current printable coupon count on a FICSIT ticket."],
  ["satisfactory-power-card", "Satisfactory Power Circuit Overview",
    "See each circuit’s load, maximum consumption, capacity, and fuse status."],
]) {
  if (!customElements.get(type)) {
    customElements.define(type, class extends SatisfactorySummaryCard {
      static getStubConfig() { return {}; }
    });
    (window.customCards ||= []).push({ type, name, description, preview: true });
  }
}

class SatisfactoryPlayersCard extends HTMLElement {
  static getStubConfig() { return {}; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        ha-card { padding: 12px; }
        h2 { margin: 0 0 8px; font-size: 1rem; }
        #players { display: grid; gap: 8px; }
        p { margin: 0; color: var(--secondary-text-color); }
        p[hidden] { display: none; }
        satisfactory-player-card {
          display: block;
          --ha-card-border-width: 0px;
          --ha-card-box-shadow: none;
        }
      </style>
      <ha-card><h2>Satisfactory Players</h2><div id="players"></div>
        <p hidden>No Satisfactory players found.</p></ha-card>`;
  }

  setConfig() {}

  set hass(hass) {
    const players = discoverPlayers(hass.states);
    const list = this.shadowRoot.getElementById("players");
    const ids = players.map(([id]) => id);
    const signature = JSON.stringify(ids);
    if (signature !== this.playerSignature) {
      list.replaceChildren(...ids.map(entity => {
        const card = document.createElement("satisfactory-player-card");
        card.setConfig({ entity });
        return card;
      }));
      this.playerSignature = signature;
    }
    for (const card of list.children) card.hass = hass;
    this.shadowRoot.querySelector("p").hidden = ids.length > 0;
  }

  getCardSize() {
    return 1 + 2 * this.shadowRoot.getElementById("players").childElementCount;
  }
}

if (!customElements.get("satisfactory-players-card")) {
  customElements.define("satisfactory-players-card", SatisfactoryPlayersCard);
  (window.customCards ||= []).push({
    type: "satisfactory-players-card",
    name: "Satisfactory Player Health (All)",
    description: "Automatically show health bars and online status for all detected players.",
    preview: true,
  });
}

const stockSections = {
  "Alien materials": [
    [
      "stinger-remains",
      "Stinger Remains"
    ],
    [
      "spitter-remains",
      "Spitter Remains"
    ],
    [
      "hog-remains",
      "Hog Remains"
    ],
    [
      "hatcher-remains",
      "Hatcher Remains"
    ],
    [
      "alien-protein",
      "Alien Protein"
    ],
    [
      "alien-dna-capsule",
      "Alien DNA Capsule"
    ]
  ],
  "Crash sites": [
    [
      "drop-pod",
      "Drop Pods Reported",
      "getdroppod_response_records"
    ],
    [
      "hard-drive",
      "Hard Drive"
    ]
  ],
  "Alien artifacts": [
    [
      "somersloop",
      "Somersloop"
    ],
    [
      "mercer-sphere",
      "Mercer Sphere"
    ]
  ]
};

class SatisfactoryStockCard extends HTMLElement {
  static getStubConfig() { return {}; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        ha-card { padding:16px; }
        h2 { margin:0 0 14px; font-size:1.15rem; }
        h3 { margin:16px 0 8px; color:var(--secondary-text-color); font-size:.85rem; }
        ul { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));
          gap:8px; margin:0; padding:0; list-style:none; }
        li { display:grid; grid-template-columns:36px minmax(0,1fr); align-items:center;
          gap:9px; padding:8px; border:1px solid var(--divider-color); border-radius:8px; }
        img { width:36px; height:36px; object-fit:contain; }
        strong, span { display:block; overflow-wrap:anywhere; }
        span { color:var(--secondary-text-color); font-size:.8rem; }
        strong { font-variant-numeric:tabular-nums; }
      </style>
      <ha-card><h2>Satisfactory Stock Levels</h2><div></div></ha-card>`;
    this.items = new Map();
    const output = this.shadowRoot.querySelector("ha-card > div");
    for (const [title, items] of Object.entries(stockSections)) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = title;
      const list = document.createElement("ul");
      for (const [key, name, suffix] of items) {
        const tile = document.createElement("li");
        const icon = document.createElement("img");
        const url = new URL(`./stock/${key}.${key === "drop-pod" ? "jpeg" : "webp"}`, import.meta.url);
        url.search = new URL(import.meta.url).search;
        icon.src = url.href;
        icon.alt = "";
        const text = document.createElement("div");
        const label = document.createElement("span");
        label.textContent = name;
        const amount = document.createElement("strong");
        amount.textContent = "—";
        text.append(label, amount);
        tile.append(icon, text);
        list.append(tile);
        this.items.set(suffix || `${key.replaceAll("-", "_")}_world_stock`, amount);
      }
      section.append(heading, list);
      output.append(section);
    }
  }

  setConfig(config) {
    this.entityPrefix = config.entity_prefix;
    this.update();
  }

  set hass(hass) {
    this.currentHass = hass;
    this.update();
  }

  update() {
    if (!this.currentHass) return;
    const { states, language } = this.currentHass;
    let prefix = this.entityPrefix;
    if (!prefix) {
      const sensorIds = Object.keys(states).filter(id => id.startsWith("sensor.satisfactory_")).sort();
      for (const id of sensorIds) {
        const suffix = [...this.items.keys()].find(key => id.endsWith("_" + key));
        if (suffix) {
          prefix = id.slice(0, -suffix.length);
          break;
        }
      }
    }
    for (const [suffix, amount] of this.items) {
      const value = states[prefix + suffix]?.state;
      const number = value?.trim() ? Number(value) : NaN;
      amount.textContent = Number.isFinite(number)
        ? number.toLocaleString(language) : "—";
    }
  }

  getCardSize() { return 6; }
}

if (!customElements.get("satisfactory-stock-card")) {
  customElements.define("satisfactory-stock-card", SatisfactoryStockCard);
  (window.customCards ||= []).push({
    type: "satisfactory-stock-card",
    name: "Satisfactory Stock Levels",
    description: "Track alien materials, drop pods, hard drives, and alien artifacts.",
    preview: true,
  });
}
