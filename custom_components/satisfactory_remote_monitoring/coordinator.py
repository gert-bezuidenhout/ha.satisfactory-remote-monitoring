"""Read session data from FRM."""
import asyncio
from datetime import timedelta
import logging

from aiohttp import ClientError, ClientTimeout
from yarl import URL

from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

DOMAIN = "satisfactory_remote_monitoring"
_LOGGER = logging.getLogger(__name__)


def endpoint(data):
    """Build the FRM base URL."""
    return URL.build(scheme="http", host=data[CONF_HOST], port=data[CONF_PORT])


async def fetch_json(hass, data, path):
    """Fetch JSON from an FRM endpoint."""
    client = async_get_clientsession(hass)
    async with client.get(
        endpoint(data) / path,
        timeout=ClientTimeout(total=5),
        allow_redirects=False,
    ) as response:
        if response.status != 200:
            raise ValueError(f"Unexpected HTTP status {response.status}")
        return await response.json(content_type=None)


async def fetch_session(hass, data):
    """Fetch and validate the FRM session object."""
    payload = await fetch_json(hass, data, "getSessionInfo")
    if not isinstance(payload, dict) or not isinstance(payload.get("SessionName"), str):
        raise ValueError("Expected an FRM session object with SessionName")
    return payload


class FrmCoordinator(DataUpdateCoordinator):
    """Poll a single FRM server and share its data with all entities."""

    def __init__(self, hass, entry):
        super().__init__(
            hass, _LOGGER, config_entry=entry, name=entry.title,
            update_interval=timedelta(seconds=10),
        )
        self.device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Gert Bezuidenhout",
            model="Satisfactory Remote Monitoring",
            configuration_url=str(endpoint(entry.data)),
        )
        )

    async def _async_update_data(self):
        try:
            session = await fetch_session(self.hass, self.config_entry.data)
        except (ClientError, asyncio.TimeoutError, ValueError) as err:
            raise UpdateFailed(f"Could not read FRM session: {err}") from err

        selected = self.config_entry.options.get("read_endpoints")
        if selected is not None and "getPower" not in selected:
            return {**session, "circuits": {}}

        try:
            rows = await fetch_json(self.hass, self.config_entry.data, "getPower")
            if not isinstance(rows, list):
                raise ValueError("Expected a list of FRM circuit groups")
            circuits = {}
            for row in rows:
                if not isinstance(row, dict) or type(row.get("CircuitGroupID")) is not int:
                    raise ValueError("Invalid FRM circuit group")
                circuits[row["CircuitGroupID"]] = row
        except (ClientError, asyncio.TimeoutError, ValueError) as err:
            _LOGGER.debug("Could not read FRM power data: %s", err)
            circuits = {}

        return {**session, "circuits": circuits}

