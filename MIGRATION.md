# Updating an existing installation

## From 0.4.12 to 0.4.13

Update through HACS/Marketplace and restart Home Assistant. Keep your existing integration entries. This release updates documentation and the publishing process; it does not change runtime behaviour, entity IDs, endpoint selections or alert thresholds.

Release tags now use MAJOR.MINOR.PATCH without a leading v. Previous releases remain available under their original tags.

## Changing the server address

Open **Settings > Devices & services > Satisfactory Remote Monitoring > Configure > Server connection**. Enter the hostname or IP address without a scheme, path or port; enter the FRM HTTP port separately. The integration checks the new connection before saving it and retains your monitoring options.

Entities for records still available at the new address retain their IDs. A different factory may expose different record identifiers.

## Older or manual installations

Back up your Home Assistant configuration before changing installation methods. The integration folder is `custom_components/satisfactory_remote_monitoring/`. Keep the same domain and existing configuration entry. Check your dashboards and automations after updating.

For an older installation using another domain, stop before deleting its entry and report the installed version and domain through GitHub Issues so migration can be assessed.
