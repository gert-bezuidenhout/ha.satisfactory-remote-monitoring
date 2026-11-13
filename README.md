# Satisfactory Remote Monitoring

Monitor your Satisfactory factory from Home Assistant. This community integration reads the Ficsit Remote Monitoring (FRM) HTTP API directly and exposes game data for dashboards and automations. It does not require MQTT.

[Home Assistant](https://www.home-assistant.io/) is an open-source home automation platform. It lets you bring devices and services into one dashboard and automate actions based on their states.

## Before you install

- Install [Satisfactory Mod Manager](https://ficsit.app/smm).
- Use it to install the [Ficsit Remote Monitoring mod](https://ficsit.app/mod/FicsitRemoteMonitoring#top) on the Satisfactory instance you want to monitor.
- Start the FRM HTTP API and make sure Home Assistant can reach it. See the [FRM documentation](https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html) for setup.

## Install from Home Assistant Marketplace

1. In Home Assistant, open **Marketplace** and choose **Add from a GitHub link**.
2. Paste `https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring` and select **Add**.
3. Open **Satisfactory Remote Monitoring**, select **Install**, and restart Home Assistant if prompted.
4. Go to **Settings → Devices & services → Add integration**, then select **Satisfactory Remote Monitoring**.
5. Enter your FRM server address and HTTP port.

## What you can monitor

- Session details and player status.
- Circuit power capacity, consumption, and fuse trips.
- Optional factory, inventory, production, and logistics data. Open **Configure → Monitoring settings** to enable additional endpoints and choose what to monitor where supported.

## Troubleshooting

If setup cannot connect, check that the FRM HTTP API is running and that Home Assistant can reach the configured address and port. When reporting an integration problem, include the Home Assistant, integration, and FRM versions along with the relevant log entry. [Report an issue](https://github.com/gert-bezuidenhout/ha.satisfactory-remote-monitoring/issues).

Maintained by Gert Bezuidenhout.
