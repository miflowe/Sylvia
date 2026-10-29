# Sylvia Node cloud test

Run 2026-10-28 with `node scripts/node-sim.mjs iot-6x6suo5lxjc5o rg-sylvia-dev <web url> 3`.

**Result: passed.** A simulated Node sent 3 readings through Azure IoT Hub; the last one was on Sylvia's live map
about **14 seconds** after it was sent, with every field intact and the simulated label set.

## What was tested

1. **Device identity.** `sylvia-sim-01` registered in IoT Hub `iot-6x6suo5lxjc5o` (free tier). The `sylvia-sim-` prefix
   marks it simulated; real Nodes get `sylvia-node-NNNN` ids and X.509 certificates from
   `hardware/firmware/tools/provision.py`.
2. **Location without the device sending it.** The device twin carries `loc` ("43.66,-79.38", TMU, rounded to about
   1 km) and `name` tags. IoT Hub message enrichments stamp them onto every message.
3. **Telemetry format.** The exact JSON the firmware's `payload_json()` writes (PM1–10, CO2, VOC, NOx, CO, temperature,
   humidity, battery, PM slope, detection level and cause), sent to the device telemetry endpoint. The simulator
   uses HTTPS; real Nodes use MQTT to the same endpoint.
4. **Ingestion.** The `nodeTelemetry` Azure Function reads IoT Hub's built-in Event Hub endpoint, turns each message into a
   map reading (`nodeObservation()` in `packages/core/src/nodes.ts`, unit-tested) and stores it in Cosmos DB. Readings
   expire after 6 hours of silence.
5. **Display.** The map's new "Sylvia Nodes" layer showed the reading; its card says "Simulated test data, not a real
   reading".

## Last reading as the map served it

```json
{
  "kind": "node",
  "value": 9.3,
  "name": "TMU test node",
  "observedAt": "2026-10-29T03:45:26.838Z",
  "deviceId": "sylvia-sim-01",
  "simulated": true,
  "level": 0,
  "cause": "None",
  "co2": 467,
  "co": 0.45,
  "t": 9.5,
  "rh": 71,
  "soc": 93,
  "pmSlope": 0.12
}
```

## Not covered yet

- A real board over MQTT with an X.509 certificate (needs the firmware built with ESP-IDF and a provisioned Node).
- The LoRaWAN backup path (needs a gateway and a network server such as The Things Network forwarding to IoT Hub).
