"""Regression tests for changing an existing FRM connection."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from custom_components.satisfactory_remote_monitoring import config_flow


@pytest.mark.asyncio
@pytest.mark.parametrize("scenario", ["unreachable", "duplicate", "valid"])
async def test_connection_edit(monkeypatch, scenario):
    entry = SimpleNamespace(
        entry_id="existing",
        unique_id="http://old.example:8080",
        data={"host": "old.example", "port": 8080},
        options={"read_endpoints": ["getPower"], "low_headroom": 15},
    )
    entries = [entry]
    if scenario == "duplicate":
        entries.append(SimpleNamespace(entry_id="other", unique_id="http://new.example:8080"))
    manager = Mock()
    manager.async_entries.return_value = entries
    flow = config_flow.FrmOptionsFlow()
    flow.hass = SimpleNamespace(config_entries=manager)
    monkeypatch.setattr(type(flow), "config_entry", property(lambda self: entry))
    probe = AsyncMock(side_effect=ValueError("Invalid response") if scenario == "unreachable" else None)
    monkeypatch.setattr(config_flow, "fetch_session", probe)

    result = await flow.async_step_connection({"host": " NEW.example. ", "port": 8080})

    if scenario == "valid":
        manager.async_update_entry.assert_called_once_with(
            entry, data={"host": "new.example", "port": 8080},
            unique_id="http://new.example:8080",
        )
        assert result["data"] == entry.options
    else:
        manager.async_update_entry.assert_not_called()
        assert result["errors"]["base"] == {
            "unreachable": "cannot_connect", "duplicate": "already_configured",
        }[scenario]
    assert probe.await_count == (0 if scenario == "duplicate" else 1)
