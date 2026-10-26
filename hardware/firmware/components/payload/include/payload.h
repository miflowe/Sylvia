// Telemetry encodings. Pure C, host-testable.
//
// LoRaWAN fallback: 11 bytes on FPort 1, the largest payload US915 allows at DR0 (SF10/125 kHz),
// so one uplink always fits at the worst data rate.
//
//  byte 0    [7:6] version (1)  [5:4] level 0-2  [3:2] cause 0-3  [1] charging  [0] sen66 valid
//  byte 1-2  PM2.5 x10, uint16 big-endian (0xFFFF = n/a, saturates at 6553.4)
//  byte 3-4  CO2 ppm, uint16 BE (0xFFFF = n/a)
//  byte 5-6  CO ppm x10, uint16 BE (0xFFFF = n/a)
//  byte 7    temperature, int8 in 0.5 C steps (-64.0..+63.0; -128 = n/a)
//  byte 8    RH %, uint8 0-100 (0xFF = n/a)
//  byte 9    battery SoC %, uint8 0-100 (0xFF = n/a)
//  byte 10   PM2.5 slope, int8 ug/m3/min clamped to +/-127 (-128 = n/a)
//
// The same struct is serialised to JSON for MQTT (Wi-Fi), with full precision.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define PAYLOAD_LORA_LEN 11
#define PAYLOAD_LORA_FPORT 1
#define PAYLOAD_VERSION 1

typedef struct {
    uint8_t level;  // det_level_t
    uint8_t cause;  // det_cause_t
    bool charging;
    bool sen66_valid;
    float pm1, pm25, pm4, pm10;  // ug/m3, NAN = n/a
    float co2;                   // ppm
    float voc_index, nox_index;  // SEN66 indices
    float co;                    // ppm
    float temp_c, rh, pressure_hpa;
    float gas_kohm;
    float soc_pct, vbat;
    float pm_slope;              // ug/m3/min
    uint32_t uptime_s;
    uint16_t seq;
} telemetry_t;

// Writes PAYLOAD_LORA_LEN bytes.
void payload_lora_encode(const telemetry_t *t, uint8_t out[PAYLOAD_LORA_LEN]);
// Fills the fields carried in the compact payload; others become NAN / 0.
bool payload_lora_decode(const uint8_t *in, size_t len, telemetry_t *t);
// JSON for Azure IoT Hub. Returns bytes written (excluding NUL) or -1 if buf is too small.
int payload_json(const telemetry_t *t, const char *fw_version, char *buf, size_t len);

// Sensirion CRC-8 (poly 0x31, init 0xFF), used by SEN66/SCD4x/SGP4x/SHT4x words.
uint8_t sensirion_crc8(const uint8_t *data, size_t len);

#ifdef __cplusplus
}
#endif
