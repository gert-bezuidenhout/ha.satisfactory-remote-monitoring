"""Shared circuit discovery and entity behavior."""
import math

from homeassistant.core import callback
from homeassistant.helpers.update_coordinator import CoordinatorEntity


def number(value):
    """Accept finite numbers while excluding JSON booleans."""
    if type(value) is int or (type(value) is float and math.isfinite(value)):
        return value
    return None


def discover_circuits(entry, async_add_entities, factory):
    """Create each circuit group's entities when it first appears."""
    coordinator = entry.runtime_data
    known = set()

    @callback
    def discover():
        if not coordinator.last_update_success:
            return
        new_groups = coordinator.data["circuits"].keys() - known
        if new_groups:
            known.update(new_groups)
            async_add_entities([
                entity
                for group_id in sorted(new_groups)
                for entity in factory(entry, group_id)
            ])

    entry.async_on_unload(coordinator.async_add_listener(discover))
    discover()


class FrmPowerEntity(CoordinatorEntity):
    """Represent a metric for a single FRM circuit group."""

    _attr_has_entity_name = True

    def __init__(self, entry, group_id, key, name):
        super().__init__(entry.runtime_data)
        self.group_id = group_id
        self.key = key
        self._attr_name = f"Circuit group {group_id} {name.lower()}"
        self._attr_unique_id = f"{entry.entry_id}_power_{group_id}_{key}"
        self._attr_device_info = self.coordinator.device_info

    @property
    def circuit(self):
        return self.coordinator.data["circuits"].get(self.group_id, {})

    @property
    def available(self):
        return super().available and self.group_id in self.coordinator.data["circuits"]
