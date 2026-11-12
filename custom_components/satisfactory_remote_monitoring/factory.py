"""Optional factory telemetry from FRM."""
import asyncio
from datetime import timedelta
import logging

from aiohttp import ClientError
from homeassistant.helpers.update_coordinator import CoordinatorEntity, DataUpdateCoordinator

from .coordinator import fetch_json
from .endpoints import READ_ENDPOINTS
from .power import number

LOGGER = logging.getLogger(__name__)
ENDPOINTS = {
    "production": ("getProdStats", "ClassName"),
    "world": ("getWorldInv", "ClassName"),
    "depot": ("getCloudInv", "ClassName"),
    "storage": ("getStorageInv", "ID"),
    "machines": ("getFactory", "ID"),
    "buildings": ("getPowerUsage", "ID"),
    "players": ("getPlayer", "ID"),
    "switches": ("getSwitches", "ID"),
    "sink": ("getResourceSink", None),
    "trains": ("getTrains", None),
    "stations": ("getTrainStation", None),
}
CORE_ENDPOINTS = {"getSessionInfo", "getPower"}
DEFAULT_ENDPOINTS = ("getPlayer", "getPower", "getSessionInfo")
SELECTABLE = ("production", "world", "depot", "storage", "machines", "buildings", "players")


class FactoryCoordinator(DataUpdateCoordinator):
    """Refresh factory telemetry independently of session and fuse polling."""

    def __init__(self, hass, entry):
        super().__init__(
            hass, LOGGER, config_entry=entry, name=f"{entry.title} factory telemetry",
            update_interval=timedelta(seconds=60),
        )

    async def _async_update_data(self):
        selected = set(self.config_entry.options.get("read_endpoints", DEFAULT_ENDPOINTS))
        specialized = {endpoint: (key, identifier)
                       for key, (endpoint, identifier) in ENDPOINTS.items()}
        limit = asyncio.Semaphore(4)

        async def read(endpoint):
            async with limit:
                if endpoint in specialized:
                    key, identifier = specialized[endpoint]
                    return await self._read(key, endpoint, identifier)
                try:
                    payload = await fetch_json(self.hass, self.config_entry.data, endpoint)
                    return endpoint, len(payload) if isinstance(payload, list) else (
                        1 if isinstance(payload, dict) else number(payload)
                    )
                except (ClientError, asyncio.TimeoutError, ValueError) as err:
                    LOGGER.debug("FRM %s unavailable: %s", endpoint, err)
                    return endpoint, None

        return dict(await asyncio.gather(*(
            read(endpoint) for endpoint in READ_ENDPOINTS
            if endpoint in selected and endpoint not in CORE_ENDPOINTS
        )))

    async def _read(self, key, endpoint, identifier):
        try:
            rows = await fetch_json(self.hass, self.config_entry.data, endpoint)
            if key == "sink" and isinstance(rows, dict):
                rows = [rows]
            if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
                raise ValueError("Expected a list of records")
            if identifier is None:
                return key, rows
            return key, {
                row[identifier]: row for row in rows
                if isinstance(row.get(identifier), str) and row[identifier]
            }
        except (ClientError, asyncio.TimeoutError, ValueError) as err:
            LOGGER.debug("FRM %s unavailable: %s", endpoint, err)
            return key, None


class FactoryEntity(CoordinatorEntity):
    """A factory measurement or status derived from a single endpoint."""

    _attr_has_entity_name = True

    def __init__(self, entry, source, key, metric, name, read, unit=None, attributes=None):
        super().__init__(entry.runtime_data.factory)
        self.source = source
        self.key = key
        self.read = read
        self.attributes = attributes or {}
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_factory_{source}_{key}_{metric}"
        self._attr_device_info = entry.runtime_data.device_info
        self._attr_native_unit_of_measurement = unit

    @property
    def record(self):
        records = (self.coordinator.data or {}).get(self.source)
        if self.key is None or records is None:
            return records
        return records.get(self.key)

    @property
    def available(self):
        return super().available and self.record is not None

    @property
    def extra_state_attributes(self):
        row = self.record
        if not isinstance(row, dict):
            return {}
        attributes = {name: row[field] for name, field in self.attributes.items() if field in row}
        if self.source == "buildings" and isinstance(row.get("PowerInfo"), dict):
            attributes["circuit_group"] = row["PowerInfo"].get("CircuitGroupID")
        return attributes

    def value(self):
        row = self.record
        return self.read(row) if row is not None else None


def numeric(field):
    return lambda row: number(row.get(field))


def boolean(field):
    return lambda row: row[field] if isinstance(row.get(field), bool) else None


def percentage(amount, limit):
    if amount is None or limit is None or limit <= 0:
        return None
    return round(amount / limit * 100, 2)


def net_production(row):
    produced = number(row.get("CurrentProd"))
    consumed = number(row.get("CurrentConsumed"))
    return produced - consumed if produced is not None and consumed is not None else None


def primary_output(row, field):
    products = row.get("production")
    if isinstance(products, list) and products and isinstance(products[0], dict):
        return number(products[0].get(field))
    return None


def storage_amount(row, item):
    inventory = row.get("Inventory")
    if not isinstance(inventory, list):
        return None
    amounts = [
        number(stack.get("Amount")) for stack in inventory
        if isinstance(stack, dict) and stack.get("ClassName") == item
    ]
    return sum(amounts) if all(amount is not None for amount in amounts) else None


def below_threshold(read, threshold):
    def is_low(row):
        value = read(row)
        return value < threshold if value is not None else None
    return is_low


def sink_value(rows, field):
    return number(rows[0].get(field)) if rows else None




def factory_entities(entry, sensor_type, binary_type, *, binary):
    """Create aggregate and selected factory entities."""
    entities = []
    data = entry.runtime_data.factory.data or {}
    options = entry.options

    def add(source, key, metric, title, reader, unit=None, attrs=None, *, status=False):
        if status == binary:
            cls = binary_type if status else sensor_type
            entities.append(cls(entry, source, key, metric, title, reader, unit, attrs))

    def stock(source, key, title, read, metric="stock"):
        add(source, key, metric, title, read)
        add(source, key, metric + "_low", title + " low stock",
            below_threshold(read, options.get("low_stock", 100)), status=True)

    for key in options.get("production", []):
        row = (data.get("production") or {}).get(key, {})
        name = row.get("Name") or key
        unit = "mÃ‚Â³/min" if row.get("Type") == "Pipe" else "items/min"
        for field, title, read, suffix in (
            ("output", "production", numeric("CurrentProd"), unit),
            ("input", "consumption", numeric("CurrentConsumed"), unit),
            ("net", "net production", net_production, unit),
            ("efficiency", "production efficiency", numeric("ProdPercent"), "%"),
        ):
            add("production", key, field, f"{name} {title}", read, suffix)

    item_names = {}
    for source in ("production", "world", "depot"):
        item_names.update({key: row.get("Name") or key for key, row in
                           (data.get(source) or {}).items()})
    for source, label in (("world", "world stock"), ("depot", "depot stock")):
        for key in options.get(source, []):
            name = item_names.get(key, key)
            stock(source, key, f"{name} {label}", numeric("Amount"))
            if source == "depot":
                add(source, key, "capacity", f"{name} depot capacity", numeric("Limit"))
                add(source, key, "fill", f"{name} depot fill",
                    lambda row: percentage(number(row.get("Amount")), number(row.get("Limit"))), "%")

    for key in options.get("storage", []):
        row = (data.get("storage") or {}).get(key, {})
        name = row.get("Name") or key
        for item in options.get("storage_items", []):
            stock("storage", key, f"{name} {item_names.get(item, item)} stock",
                  lambda row, item=item: storage_amount(row, item), f"stock_{item}")

    for key in options.get("machines", []):
        row = (data.get("machines") or {}).get(key, {})
        name = row.get("Name") or key
        for field, label, unit in (("CurrentProd", "output", "per min"),
                                    ("ProdPercent", "efficiency", "%")):
            add("machines", key, field, f"{name} primary product {label}",
                lambda row, field=field: primary_output(row, field),
                unit, {"recipe": "Recipe"})

    for key in options.get("buildings", []):
        row = (data.get("buildings") or {}).get(key, {})
        name = row.get("Name") or key
        for field, label in (("PowerConsumed", "power draw"),
                              ("MaxPowerConsumed", "maximum power draw")):
            add("buildings", key, field, f"{name} {label}",
                lambda row, field=field: number((row.get("PowerInfo") or {}).get(field)), "MW")

    for key in options.get("players", []):
        row = (data.get("players") or {}).get(key, {})
        name = row.get("Name") or key
        add("players", key, "health", f"{name} health", numeric("PlayerHP"), "HP")
        add("players", key, "online", f"{name} online", boolean("Online"), status=True)
        add("players", key, "dead", f"{name} dead", boolean("Dead"), status=True)

    add("players", None, "online", "Players online",
        lambda rows: sum(row.get("Online") is True for row in rows.values()))
    add("trains", None, "count", "Train count", len)
    add("stations", None, "count", "Train station count", len)
    for field, name in (("NumCoupon", "Sink coupons"), ("PointsToCoupon", "Sink points to coupon"),
                        ("TotalPoints", "Sink total points")):
        add("sink", None, field, name, lambda rows, field=field: sink_value(rows, field))

    if not binary:
        specialized = {endpoint for endpoint, _ in ENDPOINTS.values()}
        for endpoint in options.get("read_endpoints", DEFAULT_ENDPOINTS):
            if endpoint in READ_ENDPOINTS and endpoint not in specialized | CORE_ENDPOINTS:
                add(endpoint, None, "records", f"{endpoint} response records", lambda value: value)
    return entities + switch_entities(entry, binary_type) if binary else entities


def switch_entities(entry, binary_type):
    data = entry.runtime_data.factory.data or {}
    entities = []
    for key, row in (data.get("switches") or {}).items():
        name = row.get("SwitchTag") or row.get("Name") or key
        entities.append(binary_type(entry, "switches", key, "on", f"{name} switch on",
                                    boolean("IsOn"), attributes={
                                        "priority": "Priority", "circuit_a": "Primary",
                                        "circuit_b": "Secondary",
                                    }))
    return entities

