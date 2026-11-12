# Satisfactory Remote Monitoring

Monitor your Satisfactory factory in Home Assistant using the Ficsit Remote Monitoring (FRM) mod. The integration connects directly to the FRM API without MQTT.

## Features

- Monitor players, session status, power usage, and tripped circuit fuses.
- Enable additional FRM endpoints from the integration's settings.
- Select which items, players, and machines to monitor where supported.

## Installation

1. Install Ficsit Remote Monitoring on your Satisfactory server and make sure Home Assistant can reach its API.
2. Copy `custom_components/satisfactory_remote_monitoring` into your Home Assistant `custom_components` directory.
3. Restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration** and select **Satisfactory Remote Monitoring**.
5. Enter your FRM server address and port. Open **Configure → Monitoring settings** to enable more endpoints.
