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

class SatisfactoryPlayerCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("satisfactory-player-editor");
  }

  static getStubConfig(hass) {
    return { entity: discoverPlayers(hass?.states)[0]?.[0] || "" };
  }

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
    root.getElementById("hp").textContent = `${known ? hp : "-"} / 100 HP`;
    root.querySelectorAll(".slot").forEach((slot, index) => {
      const fill = Math.max(0, Math.min(10, hp - index * 10)) * 10;
      slot.style.setProperty("--fill", `${fill}%`);
    });
  }
}

class SatisfactoryPlayerEditor extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        label { display:grid; gap:6px; }
        select { width:100%; padding:10px; color:var(--primary-text-color);
          background:var(--card-background-color); border:1px solid var(--divider-color); }
      </style>
      <label>Player<select></select></label>`;
    this.select = root.querySelector("select");
    this.select.addEventListener("change", () => {
      this.config = { ...this.config, entity: this.select.value };
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: this.config }, bubbles: true, composed: true,
      }));
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

  refresh() {
    const selected = this.config?.entity || "";
    const players = discoverPlayers(this.currentHass?.states);
    const signature = JSON.stringify([selected, players]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.select.replaceChildren(new Option("Select a player", ""));
    for (const [id, name] of players) this.select.add(new Option(name, id));
    if (selected && !players.some(([id]) => id === selected))
      this.select.add(new Option(`${selected} (unavailable)`, selected));
    this.select.value = selected;
  }
}

if (!customElements.get("satisfactory-player-card")) {
customElements.define("satisfactory-player-card", SatisfactoryPlayerCard);
customElements.define("satisfactory-player-editor", SatisfactoryPlayerEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "satisfactory-player-card",
  name: "Satisfactory Player",
  description: "Show a player's health and online status.",
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
        .ticket output { position:absolute; top:61%; left:50%; transform:translate(-50%,-50%);
          color:white; font:700 clamp(14px,14cqw,60px)/1 Roboto,Arial,sans-serif; }
        .power { display:grid; grid-template-columns:clamp(42px,20%,84px) minmax(0,1fr);
          align-items:start; gap:12px; text-align:left; }
        .pylon { display:block; width:100%; max-height:96px; object-fit:contain; }
        .power dl { overflow-wrap:anywhere; }
        strong { font-size:1.1rem; } 
        ha-icon { color:#ffbf50; --mdc-icon-size:46px; }
        dl { margin:10px 0 0; } dt { font-weight:700; margin-top:8px; } dd { margin:2px 0; }
      </style>
      <ha-card>${coupon
        ? '<div class="ticket"><img alt="FICSIT Printable Coupons"><output></output></div>'
        : '<div class="power"><img class="pylon" alt=""><div><strong>Circuit Power</strong><dl></dl></div></div>'}</ha-card>`;
    this.shadowRoot.querySelector("img").src =
      new URL(coupon ? "./coupon-popup.png" : "./power-pylon.png", import.meta.url).href;
    if (coupon) {
      const value = entity?.state;
      this.shadowRoot.querySelector("output").textContent =
        /^\d+(?:\.0+)?$/.test(value || "") ? value.split(".")[0] : "—";
      return;
    }
    const list = this.shadowRoot.querySelector("dl");
    const rows = entity?.attributes.display_rows;
    for (const row of typeof rows === "string" ? rows.split(";") : []) {
      const [group, capacity, max] = row.split("|").map(value => value.trim());
      if (!group || !capacity || !max) continue;
      const title = document.createElement("dt");
      const value = document.createElement("dd");
      title.textContent = group;
      value.textContent = `${max} MAX / ${capacity} CAP`;
      list.append(title, value);
    }
    if (!list.children.length) list.textContent = "No circuit data";
  }
}

for (const [type, name] of [
  ["satisfactory-coupons-card", "Satisfactory Coupons"],
  ["satisfactory-power-card", "Satisfactory Circuit Power"],
]) {
  if (!customElements.get(type)) {
    customElements.define(type, class extends SatisfactorySummaryCard {
      static getStubConfig() { return {}; }
    });
    (window.customCards ||= []).push({ type, name });
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
    name: "Satisfactory Players",
    description: "Show all discovered Satisfactory players and their health.",
  });
}
