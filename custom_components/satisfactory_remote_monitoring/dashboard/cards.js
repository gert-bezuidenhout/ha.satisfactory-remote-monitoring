const prefix = "sensor.satisfactory_192_168_8_50_8080_";
const isPlayer = id => id.startsWith(prefix) && id.endsWith("_health");
const playerName = state => (state.attributes.friendly_name || state.entity_id.slice(prefix.length, -7))
  .replace(/^Satisfactory\s*\([^)]*\)\s*/i, "").replace(/\s+health$/i, "");

class SatisfactoryPlayerCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("satisfactory-player-editor");
  }

  static getStubConfig(hass) {
    return { entity: Object.keys(hass?.states || {}).find(isPlayer) || "" };
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
        img { width:100%; height:250px; object-fit:contain; }
      </style>
      <ha-card>
        <header><strong></strong><span id="status"></span></header>
        <div id="bar" role="img">
          <ha-icon icon="mdi:heart-pulse" style="--mdc-icon-size:22px"></ha-icon>
          ${'<span class="slot"><i></i><b></b></span>'.repeat(10)}
        </div>
        <div id="hp"></div>
        <img alt="Satisfactory Pioneer">
      </ha-card>`;
  }

  setConfig(config) {
    this.config = config;
    this.shadowRoot.querySelector("img").src = config.image || new URL("./pioneer.png", import.meta.url).href;
    this.render();
  }

  set hass(hass) {
    this.currentHass = hass;
    this.render();
  }

  getCardSize() { return 5; }

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
    root.querySelector("strong").textContent = player ? playerName(player)
      : id ? "Player unavailable" : "Select a player";
    const status = root.getElementById("status");
    const presence = online === "on" ? "Online" : online === "off" ? "Offline" : "Status unavailable";
    status.textContent = dead ? `${presence} � Dead` : presence;
    status.style.color = dead ? "#ff4848" : online === "on" ? "#65d98a" : "var(--secondary-text-color)";
    root.querySelector("ha-icon").style.color = dead ? "#ff3131" : "#fff";
    root.getElementById("bar").setAttribute("aria-label", known ? `${hp} of 100 HP` : "Health unavailable");
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
    const players = Object.values(this.currentHass?.states || {})
      .filter(state => isPlayer(state.entity_id))
      .map(state => [state.entity_id, playerName(state)])
      .sort((a, b) => a[1].localeCompare(b[1]));
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
  description: "Show a player's Pioneer, health, and online status.",
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
        .ticket { background:linear-gradient(#f5a044 45%,#b65119 45%); color:white;
          border:2px solid #ffcc77; border-radius:12px; padding:14px; }
        strong { font-size:1.1rem; } output { display:block; font-size:2.4rem; font-weight:700; }
        ha-icon { color:#ffbf50; --mdc-icon-size:46px; }
        dl { margin:10px 0 0; } dt { font-weight:700; margin-top:8px; } dd { margin:2px 0; }
      </style>
      <ha-card>${coupon
        ? '<div class="ticket"><strong>FICSIT COUPON</strong><output></output>Printable Coupons</div>'
        : '<ha-icon icon="mdi:transmission-tower"></ha-icon><div><strong>Circuit Power</strong></div><dl></dl>'}</ha-card>`;
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
