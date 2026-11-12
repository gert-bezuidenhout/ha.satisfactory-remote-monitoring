"""Connection and session status for FRM."""
from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import callback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .factory import FactoryEntity, factory_entities, percentage, switch_entities
from .power import FrmPowerEntity, discover_circuits, number


async def async_setup_entry(hass, entry, async_add_entities):
    """Add FRM status entities."""
    async_add_entities([FrmStatus(entry, "connection", "API connection")])
    if "getSessionInfo" in entry.options.get("read_endpoints", ("getSessionInfo",)):
        async_add_entities([
            FrmStatus(entry, "IsPaused", "Paused"),
            FrmStatus(entry, "IsDay", "Daytime"),
        ])


    discover_circuits(entry, async_add_entities, fuse_sensors)
    factory = entry.runtime_data.factory
    known_switches = set()
    entities = factory_entities(entry, None, FrmFactoryStatus, binary=True)
    known_switches.update(entity.unique_id for entity in entities if entity.source == "switches")
    async_add_entities(entities)

    @callback
    def discover_switches():
        switches = switch_entities(entry, FrmFactoryStatus)
        new = [entity for entity in switches if entity.unique_id not in known_switches]
        if new:
            known_switches.update(entity.unique_id for entity in new)
            async_add_entities(new)

    entry.async_on_unload(factory.async_add_listener(discover_switches))


class FrmStatus(CoordinatorEntity, BinarySensorEntity):
    """Expose API connectivity or a boolean session field."""

    _attr_has_entity_name = True

    def __init__(self, entry, key, name):
        super().__init__(entry.runtime_data)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = self.coordinator.device_info
        if key == "connection":
            self._attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    @property
    def available(self):
        return self._key == "connection" or super().available

    @property
    def is_on(self):
        if self._key == "connection":
            return self.coordinator.last_update_success
        value = self.coordinator.data.get(self._key)
        return value if isinstance(value, bool) else None


def fuse_sensors(entry, group_id):
    """Create a fuse status entity for a circuit group."""
    return [
        FrmFuse(entry, group_id, "FuseTriggered", "Fuse tripped"),
        FrmHeadroom(entry, group_id, "LowHeadroom", "Low power headroom"),
    ]


class FrmFuse(FrmPowerEntity, BinarySensorEntity):
    """Expose whether the circuit group fuse has tripped."""

    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    @property
    def is_on(self):
        value = self.circuit.get(self.key)
        return value if isinstance(value, bool) else None


class FrmFactoryStatus(FactoryEntity, BinarySensorEntity):
    @property
    def is_on(self):
        return self.value()


class FrmHeadroom(FrmPowerEntity, BinarySensorEntity):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, entry, group_id, key, name):
        super().__init__(entry, group_id, key, name)
        self.threshold = entry.options.get("low_headroom", 10)

    @property
    def is_on(self):
        row = self.circuit
        load = percentage(number(row.get("PowerConsumed")), number(row.get("PowerCapacity")))
        return 100 - load < self.threshold if load is not None else None
