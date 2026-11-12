"""Session sensors for FRM."""
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import UnitOfPower, UnitOfTime
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .factory import FactoryEntity, factory_entities, percentage
from .power import FrmPowerEntity, discover_circuits, number


async def async_setup_entry(hass, entry, async_add_entities):
    """Add the session sensors."""
    if "getSessionInfo" in entry.options.get("read_endpoints", ("getSessionInfo",)):
        async_add_entities(
            FrmSensor(entry, key, name, value_type)
            for key, name, value_type in (
                ("SessionName", "Session name", str),
                ("PassedDays", "Days elapsed", int),
                ("TotalPlayDuration", "Play duration", int),
            )
        )


    async_add_entities(factory_entities(entry, FrmFactorySensor, None, binary=False))
    discover_circuits(entry, async_add_entities, power_sensors)


class FrmSensor(CoordinatorEntity, SensorEntity):
    """Expose a field from the shared session response."""

    _attr_has_entity_name = True

    def __init__(self, entry, key, name, value_type):
        super().__init__(entry.runtime_data)
        self._key = key
        self._value_type = value_type
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = self.coordinator.device_info
        if key == "TotalPlayDuration":
            self._attr_device_class = SensorDeviceClass.DURATION
            self._attr_native_unit_of_measurement = UnitOfTime.SECONDS

    @property
    def native_value(self):
        value = self.coordinator.data.get(self._key)
        return value if type(value) is self._value_type else None


POWER_FIELDS = (
    ("PowerProduction", "Power production"),
    ("PowerConsumed", "Power consumed"),
    ("PowerMaxConsumed", "Power max consumed"),
    ("PowerCapacity", "Power capacity"),
    ("CircuitLoad", "Circuit load"),
    ("SpareCapacity", "Spare capacity"),
    ("BatteryPercent", "Battery charge"),
)


def power_sensors(entry, group_id):
    """Create power sensors for a circuit group."""
    return [FrmPowerSensor(entry, group_id, key, name) for key, name in POWER_FIELDS]


class FrmPowerSensor(FrmPowerEntity, SensorEntity):
    """Expose FRM power and battery readings."""

    def __init__(self, entry, group_id, key, name):
        super().__init__(entry, group_id, key, name)
        if key in ("BatteryPercent", "CircuitLoad"):
            self._attr_native_unit_of_measurement = "%"
        else:
            self._attr_device_class = SensorDeviceClass.POWER
            self._attr_native_unit_of_measurement = UnitOfPower.MEGA_WATT

    @property
    def native_value(self):
        row = self.circuit
        if self.key == "CircuitLoad":
            return percentage(number(row.get("PowerConsumed")), number(row.get("PowerCapacity")))
        if self.key == "SpareCapacity":
            capacity = number(row.get("PowerCapacity"))
            consumed = number(row.get("PowerConsumed"))
            if capacity is not None and consumed is not None:
                return capacity - consumed
            return None
        if self.key == "BatteryPercent" and number(row.get("BatteryCapacity")) == 0:
            return None
        return number(row.get(self.key))


class FrmFactorySensor(FactoryEntity, SensorEntity):
    @property
    def native_value(self):
        return self.value()
