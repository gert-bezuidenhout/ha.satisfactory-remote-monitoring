"""Ficsit Remote Monitoring integration."""
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform

from .coordinator import FrmCoordinator
from .factory import FactoryCoordinator

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR]


async def async_setup(hass, config):
    """Serve the bundled dashboard cards once per Home Assistant startup."""
    assets = Path(__file__).parent / "dashboard"
    url = "/satisfactory_remote_monitoring/dashboard"
    await hass.http.async_register_static_paths([
        StaticPathConfig(url, str(assets), False),
    ])
    add_extra_js_url(hass, f"{url}/cards.js")
    return True


async def async_setup_entry(hass, entry):
    """Set up a configured FRM server."""
    coordinator = FrmCoordinator(hass, entry)
    entry.runtime_data = coordinator
    await coordinator.async_config_entry_first_refresh()
    coordinator.factory = FactoryCoordinator(hass, entry)
    await coordinator.factory.async_config_entry_first_refresh()
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass, entry):
    """Unload the FRM entities."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_reload_entry(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)
