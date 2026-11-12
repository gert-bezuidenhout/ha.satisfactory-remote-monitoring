"""Configure an FRM server from the Home Assistant UI."""
import asyncio

from aiohttp import ClientError
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.helpers.selector import SelectSelector

from .coordinator import DOMAIN, endpoint, fetch_session
from .endpoints import ENDPOINT_DESCRIPTIONS, READ_ENDPOINTS
from .factory import DEFAULT_ENDPOINTS, SELECTABLE


class FrmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Validate and add a server."""

    VERSION = 1

    @staticmethod
    def async_get_options_flow(config_entry):
        return FrmOptionsFlow()


    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip().strip("[]").lower().rstrip(".")
            data = {CONF_HOST: host, CONF_PORT: user_input[CONF_PORT]}
            try:
                if not host or any(c.isspace() or c in "/?#@" for c in host):
                    raise ValueError("Invalid host")
                url = endpoint(data)
            except ValueError:
                errors[CONF_HOST] = "invalid_host"
            else:
                await self.async_set_unique_id(str(url))
                self._abort_if_unique_id_configured()
                try:
                    await fetch_session(self.hass, data)
                except (ClientError, asyncio.TimeoutError, ValueError):
                    errors["base"] = "cannot_connect"
                else:
                    return self.async_create_entry(
                        title=f"Satisfactory ({url.authority})", data=data
                    )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST, default=(user_input or {}).get(CONF_HOST, "")): str,
                vol.Required(CONF_PORT, default=(user_input or {}).get(CONF_PORT, 8080)):
                    vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
            }),
            errors=errors,
        )

class FrmOptionsFlow(config_entries.OptionsFlow):
    """Choose telemetry records and alert thresholds for this server."""

    async def async_step_init(self, user_input=None):
        return self.async_show_menu(
            step_id="init", menu_options=["settings", "endpoint_guide"]
        )

    async def async_step_endpoint_guide(self, user_input=None):
        if user_input is not None:
            return await self.async_step_init()
        descriptions = "\n".join(
            f"- `{name}` — {ENDPOINT_DESCRIPTIONS[name]}" for name in READ_ENDPOINTS
        )
        return self.async_show_form(
            step_id="endpoint_guide", data_schema=vol.Schema({}),
            description_placeholders={"endpoint_descriptions": descriptions},
            last_step=False,
        )

    async def async_step_settings(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        coordinator = getattr(self.config_entry, "runtime_data", None)
        factory = getattr(coordinator, "factory", None)
        data = factory.data or {} if factory else {}
        options = self.config_entry.options
        fields = {
            vol.Required("read_endpoints", default=options.get("read_endpoints", DEFAULT_ENDPOINTS)):
                SelectSelector({
                    "options": list(READ_ENDPOINTS),
                    "multiple": True,
                })
        }
        item_rows = {}
        for source in ("production", "world", "depot"):
            item_rows.update(data.get(source) or {})
        for row in (data.get("storage") or {}).values():
            inventory = row.get("Inventory")
            if isinstance(inventory, list):
                item_rows.update({
                    item["ClassName"]: item for item in inventory
                    if isinstance(item, dict) and isinstance(item.get("ClassName"), str)
                })

        for key in (*SELECTABLE, "storage_items"):
            selected = options.get(key, [])
            rows = item_rows if key == "storage_items" else data.get(key) or {}
            choices = [
                {"value": identifier, "label": f"{row.get('Name') or identifier} ({identifier})"}
                for identifier, row in rows.items()
            ]
            choices.extend({"value": identifier, "label": identifier}
                           for identifier in selected if identifier not in rows)
            if not choices:
                continue
            fields[vol.Required(key, default=selected)] = SelectSelector({
                "options": sorted(choices, key=lambda choice: choice["label"].casefold()),
                "multiple": True,
            })

        fields[vol.Required("low_stock", default=options.get("low_stock", 100))] = vol.All(
            vol.Coerce(int), vol.Range(min=0)
        )
        fields[vol.Required("low_headroom", default=options.get("low_headroom", 10))] = vol.All(
            vol.Coerce(int), vol.Range(min=0, max=100)
        )
        return self.async_show_form(step_id="settings", data_schema=vol.Schema(fields))
