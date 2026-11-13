# Satisfactory Remote Monitoring for Home Assistant

<img src="custom_components/satisfactory_remote_monitoring/brand/icon.png" alt="Satisfactory Remote Monitoring" width="128" height="128">

Bring Satisfactory into Home Assistant with live updates on power usage, fuse trips, production, inventory and players.

[Home Assistant](https://www.home-assistant.io/) is an open-source platform that brings devices, dashboards and automations together, with an emphasis on local control and privacy.

[Ficsit Remote Monitoring (FRM)](https://ficsit.app/mod/FicsitRemoteMonitoring#top) is a Satisfactory mod that exposes factory and game telemetry through an HTTP API.

This is an independent community integration maintained by Gert Bezuidenhout, not an official Satisfactory, FRM or Home Assistant product. It reads the FRM API directly; no MQTT broker is required.

## What it does

- Supplies session details and player status.
- Monitors circuit power capacity, consumption and fuse trips.
- Offers optional factory, inventory, production and logistics monitoring.
- Provides UI configuration for server settings, endpoints, record selections and alert thresholds.
- Supports separate integration entries for different servers.

The integration supplies sensors and binary sensors for dashboards and automations. It does not send game-control commands.

## Before you install

1. Install [Satisfactory Mod Manager](https://ficsit.app/smm).
2. Install the [Ficsit Remote Monitoring mod](https://ficsit.app/mod/FicsitRemoteMonitoring#top) on the Satisfactory instance you want to monitor.
3. Start the FRM HTTP API and make sure Home Assistant can reach it. Follow the [FRM documentation](https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html) for your mod version.

Use the server's LAN address. The address `127.0.0.1` points to Home Assistant itself when entered in the integration; it does not reach a separate Satisfactory server.

## Install with HACS

This integration has not yet been accepted into the default HACS Marketplace catalogue. Install it as a custom repository:

1. Install and configure [HACS](https://www.hacs.xyz/docs/use/) in Home Assistant if needed.
2. Open HACS, open its menu and select **Custom repositories**.
3. Add `https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring` with type **Integration**.
4. Find **Satisfactory Remote Monitoring**, download it and restart Home Assistant.
5. Open **Settings > Devices & services > Add integration** and select **Satisfactory Remote Monitoring**.

If your Marketplace interface provides **Add from a GitHub link**, use the same repository URL there. Downloading the integration and adding it under Devices & services are separate steps. No configuration.yaml changes are required.

## Configure the server

Enter the server IP address or hostname without a scheme, path or port. Enter the FRM HTTP port separately; the default is **8080**. Setup checks `/getSessionInfo` before creating the entry.

Open the integration's **Configure** gear to access:

- **Server connection:** change the address or port. The new connection is checked before saving, and monitoring options are retained.
- **Monitoring settings:** choose endpoints, records and alert thresholds. After enabling new endpoints, save, wait for a refresh and reopen Configure to select newly discovered records.
- **Endpoint guide:** read descriptions of the available endpoints.

Existing entity IDs are retained for records still available at the new address. A different factory can expose different identifiers.

## Understanding the data

| Data group | Meaning |
| --- | --- |
| Session | Session details read from FRM; session polling runs every 10 seconds. |
| Circuits | Power capacity, usage and fuse information supplied by the power endpoint. |
| Factory and inventory | Values from enabled endpoints and selected records. |
| Players and logistics | Available telemetry supplied by the selected endpoints. |
| Alerts | Binary sensors using the available telemetry and configured thresholds. |

Available records depend on the server, mod version and enabled endpoints. An empty `/getPower` response supplies no circuits. The integration cannot create telemetry that FRM does not return.

## Troubleshooting and privacy

- **Cannot connect:** check the FRM API is running, confirm the LAN address and port, and verify Home Assistant can reach `/getSessionInfo`.
- **No power entities:** check whether `/getPower` returns circuit data and whether that endpoint is enabled.
- **Missing optional data:** enable the relevant endpoints, wait for a refresh and reopen Monitoring settings to select records.
- **Integration not listed:** restart Home Assistant after downloading it and check the Home Assistant logs.

The integration uses local HTTP. Keep the API on a trusted network. Redact server addresses, player names and other private data from logs or screenshots before sharing them.

## Updates and removal

Download updates through HACS/Marketplace and restart Home Assistant. Keep the existing integration entries when updating. See [MIGRATION.md](MIGRATION.md) for upgrade guidance.

To uninstall, remove the integration entries under Devices & services, remove its download in HACS/Marketplace and restart Home Assistant. Review dashboards and automations that use its entities.

## Support and project files

Report problems through [GitHub Issues](https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring/issues), including Home Assistant, integration and FRM versions, steps to reproduce and redacted logs.

See the [repository file guide](docs/FILES.md), [release notes](docs/releases/) and [Marketplace preparation checklist](docs/HACS_SUBMISSION.md).

## Licence

Original project code is licensed under the [MIT licence](LICENSE), copyright Gert Bezuidenhout. Third-party code, artwork and trademarks remain subject to their respective terms; this project does not imply their endorsement.
