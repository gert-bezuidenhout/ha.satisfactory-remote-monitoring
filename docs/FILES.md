# Repository files

Only `custom_components/satisfactory_remote_monitoring/` is installed as integration runtime code. The remaining files support documentation, validation and releases.

| File or folder | Purpose |
| --- | --- |
| `custom_components/satisfactory_remote_monitoring/` | Integration loaded by Home Assistant. |
| `manifest.json` inside that folder | Identity, version, dependencies and support links. |
| `__init__.py` | Setup, reload and unload lifecycle. |
| `config_flow.py` | Connection setup and monitoring settings. |
| `coordinator.py` | Session and circuit polling through the FRM HTTP API. |
| `factory.py`, `power.py`, `endpoints.py` | Factory telemetry, power helpers and endpoint definitions. |
| `sensor.py`, `binary_sensor.py` | Entity definitions. |
| `strings.json`, `translations/en.json` | User-facing configuration text. |
| `brand/` | Integration icon and logo. |
| `hacs.json` | HACS repository metadata. |
| `README.md` | Installation, configuration, features and troubleshooting. |
| `MIGRATION.md` | Upgrade and connection-change guidance. |
| `LICENSE` | MIT licence for original project code. |
| `.gitignore` | Excludes local Python caches, environments and logs. |
| `tests/` | Regression checks for connection editing. |
| `.github/workflows/validate.yml` | Syntax, regression, Hassfest and HACS checks. |
| `.github/workflows/release.yml` | Runs validation before publishing a numbered GitHub release. |
| `docs/releases/` | Version-specific release notes. |
| `docs/HACS_SUBMISSION.md` | Checklist for later default-catalogue submission. |

## Release process

Increment the manifest version in the existing project sequence and add `docs/releases/<version>.md`. Merge the reviewed, validated change into `main`. The release workflow runs all validation jobs, then publishes that exact commit with a tag matching the manifest version, without a v prefix.

The publish job alone has `contents: write`; validation uses read-only permissions. Existing releases are not overwritten. A failed validation prevents publication. Default-catalogue submission is separate and remains deferred.
