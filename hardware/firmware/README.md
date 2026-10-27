# Sylvia Node firmware (ESP-IDF, ESP32-S3)

Status: **skeleton.** The pure-C logic (detection, power policy, payloads, sensor maths) is complete and tested on
the host. The ESP-IDF layer (drivers, Wi-Fi/MQTT, LoRaWAN, OTA, `main.c`) is written against the ESP-IDF v5.4
APIs but has **not been compiled yet**: ESP-IDF isn't installed on the design PC. First job at bring-up:
`idf.py build` and fix whatever the compiler finds.

## Layout
| Path | What | Tested |
|---|---|---|
| `components/detect` | PM-slope + CO/CO2-ratio spike detection, Level 1–2 advisories, fog suppression | host ✅ |
| `components/power_policy` | NORMAL / SAVER / CRITICAL / BURST schedule, SEN66 temperature + humidity gate | host ✅ |
| `components/payload` | 11-byte LoRaWAN payload, JSON for IoT Hub, Sensirion CRC | host ✅ |
| `components/sensor_math` | SEN66 frame parser, LMP91000 registers, ADS1115 config, CO ppm + temperature span | host ✅ |
| `components/board` | Pin map (`board.h`), checked against the schematic by `tools/pin_map.py` | script ✅ |
| `components/drivers` + `components/bme68x` | I2C buses, SEN66, CO front end, MAX17048, BME688 (Bosch API), charger GPIOs | compiles against ESP-IDF stub headers ✅ (not a real IDF build) |
| `components/net` | NVS credentials, Wi-Fi + MQTT/TLS to IoT Hub (X.509), RAK3172 AT LoRaWAN, HTTPS OTA | not compiled |
| `main/main.c` | 60 s wake cycle, RTC-memory state, deep sleep | not compiled |
| `test/host` | 73 checks incl. 7 closed-loop scenarios (clean, regional smoke, smoulder, propane BBQ, fog, dropouts, smoulder at −20 °C) | ✅ |
| `tools/provision.py` | Per-device X.509 key/cert, LoRa AppKey, factory NVS image | — |

## Run the logic tests (Windows, no ESP-IDF)
```bash
hardware/.venv/Scripts/python -I hardware/firmware/test/host/run_tests.py
```
Regenerate the scenario CSVs after changing them: `python -I hardware/firmware/test/host/gen_fixtures.py`.

## Build and flash (ESP-IDF v5.4+)
```bash
idf.py set-target esp32s3
idf.py build
idf.py -p COMx flash monitor
```
The board has no USB-UART chip: the ESP32-S3's native USB is the console. Hold BOOT, tap RESET for download mode.

### BME688
`drivers/bme688.c` uses Bosch's BME68x SensorAPI (BSD-3-Clause), vendored unmodified in `components/bme68x/`
(fetched 2026-10-26 from github.com/boschsensortec/BME68x_SensorAPI, `LICENSE` alongside). If that folder is
removed the driver falls back to a stub returning `ESP_ERR_NOT_SUPPORTED`.

## Per-device keys (never committed)
1. `python -I hardware/firmware/tools/provision.py --device-id sylvia-node-0001 --hub <hub>.azure-devices.net --wifi-ssid <ssid> --deveui <DevEUI> --co-sens <label nA/ppm>`
2. Run the printed `az iot hub device-identity create ... --am x509_thumbprint` yourself.
3. Flash `secrets/<id>/fctry.bin` to 0x12000. Register DevEUI + AppKey on TTN/Helium/ChirpStack.
`hardware/firmware/secrets/` is gitignored. For field units, enable flash encryption + NVS encryption
(`CONFIG_NVS_ENCRYPTION`): release-mode flash encryption is irreversible, so only on boards that are final.

## Data contract (for the app's ingestion Function)
- MQTT topic `devices/<id>/messages/events/`, JSON keys: `v, seq, up, pm1, pm25, pm4, pm10, co2, voc, nox, co, t, rh,
  p, gas, soc, vbat, pmSlope, chg, sen66, level (0-2), cause (0 unknown, 1 smoulder, 2 flaming, 3 regional), fw`.
- LoRaWAN FPort 1, 11 bytes: layout in `components/payload/include/payload.h`.
- Device advisories are **unverified Level 1–2** only. The app adds source + timestamp and never turns them into
  evacuation advice; Level 3 comes only from official orders.

## OTA
Set the device twin's `desired.fw = {"version": "0.2.0", "url": "https://.../sylvia_node.bin", "sha256": "..."}`.
The Node checks once a day after a Wi-Fi uplink, verifies the sha256, reboots into the new slot and confirms it
after its first good uplink. Otherwise the bootloader rolls back.
