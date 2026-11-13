# Satisfactory Remote Monitoring for Home Assistant

![Satisfactory Remote Monitoring](custom_components/satisfactory_remote_monitoring/brand/icon.png)

Monitor your Satisfactory factory from Home Assistant. This community integration reads the Ficsit Remote Monitoring (FRM) HTTP API directly and exposes game data for dashboards and automations. It does not require MQTT.

[Home Assistant](https://www.home-assistant.io/) is an open-source home automation platform. It lets you bring devices and services into one dashboard and automate actions based on their states.

Ficsit Remote Monitoring is a Satisfactory mod that exposes factory and game telemetry over HTTP.

## Before you install

- Install [Satisfactory Mod Manager](https://ficsit.app/smm).
- Use it to install the [Ficsit Remote Monitoring mod](https://ficsit.app/mod/FicsitRemoteMonitoring#top) on the Satisfactory instance you want to monitor.
- Start the FRM HTTP API and make sure Home Assistant can reach it. See the [FRM documentation](https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html) for setup.

## Install from Home Assistant Marketplace

Install this community integration using its GitHub URL as a custom repository. Default catalogue listing is a separate process.

1. In Home Assistant, open **Marketplace** and choose **Add from a GitHub link**.
2. Paste `https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring` and select **Add**.
3. Open **Satisfactory Remote Monitoring**, select **Install**, and restart Home Assistant if prompted.
4. Go to **Settings → Devices & services → Add integration**, then select **Satisfactory Remote Monitoring**.
5. Enter your FRM server address and HTTP port.

## What you can monitor

- Session details and player status.
- Circuit power capacity, consumption, and fuse trips.
- Optional factory, inventory, production, and logistics data. Open **Configure → Monitoring settings** to enable additional endpoints and choose what to monitor where supported.

## Configuration

Open the integration's **Configure** gear to change the server connection, enable telemetry endpoints, or adjust record selections and alert thresholds. The integration checks `/getSessionInfo` before saving a new connection. Existing entity IDs are retained for records that are still available on the new server.

## Entities and automations

Use the integration's sensors and binary sensors in dashboards and automations. They report session, player and circuit data, with optional telemetry for enabled endpoints. The integration reads FRM data and provides no game-control actions.

## Update or remove

Install updates from the integration's Marketplace page and restart Home Assistant when prompted. To remove it, delete its entries in **Settings → Devices & services**, then uninstall it from Marketplace and restart when prompted. Review any dashboards and automations that refer to its entities.

## Repository files

| Path | Purpose |
| --- | --- |
| `custom_components/satisfactory_remote_monitoring/` | Integration code, manifest, translations, and brand assets |
| `hacs.json` | Marketplace package metadata |
| `.github/workflows/` | Repository validation |
| `docs/releases/` | Release notes |

## Troubleshooting

If setup cannot connect, check that the FRM HTTP API is running and that Home Assistant can reach the configured address and port. When reporting an integration problem, include the Home Assistant, integration, and FRM versions along with the relevant log entry. [Report an issue](https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring/issues).

Maintained by Gert Bezuidenhout.

## License

Original integration code by Gert Bezuidenhout is available under the [MIT License](LICENSE). Third-party code, artwork, and trademarks remain subject to their respective terms.
