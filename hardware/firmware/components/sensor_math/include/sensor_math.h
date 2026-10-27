// Pure conversions for the Node's sensors (host-testable): SEN66 frames, CO from the LMP91000 + ADS1115.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// ---- SEN66 (datasheet v1.0, sec. 4.8.7, command 0x0300) ----
#define SEN66_ADDR 0x6B
#define SEN66_CMD_START 0x0021       // 50 ms
#define SEN66_CMD_STOP 0x0104        // 1400 ms
#define SEN66_CMD_DATA_READY 0x0202  // 20 ms, 3 bytes
#define SEN66_CMD_READ_VALUES 0x0300 // 20 ms, 27 bytes
#define SEN66_CMD_DEVICE_STATUS 0xD206
#define SEN66_CMD_FAN_CLEANING 0x5607
#define SEN66_CMD_SET_PRESSURE 0x6720
#define SEN66_FRAME_LEN 27

typedef struct {
    float pm1, pm25, pm4, pm10;  // ug/m3
    float rh, temp_c;            // SEN66's own (self-heating compensated) RH/T
    float voc_index, nox_index;
    float co2;                   // ppm
} sen66_values_t;

// Parses a 27-byte frame (9 words + CRC). Unknown values become NAN. Returns false on any CRC error.
bool sen66_parse(const uint8_t frame[SEN66_FRAME_LEN], sen66_values_t *out);

// ---- LMP91000 (datasheet sec. 7.6) ----
#define LMP91000_ADDR 0x48
#define LMP91000_REG_STATUS 0x00
#define LMP91000_REG_LOCK 0x01
#define LMP91000_REG_TIACN 0x10
#define LMP91000_REG_REFCN 0x11
#define LMP91000_REG_MODECN 0x12
// TIACN: TIA_GAIN[4:2] = 111 (350 k), RLOAD[1:0] = 00 (10 ohm)
#define LMP91000_TIACN_350K_10R ((7u << 2) | 0u)
// REFCN: REF_SOURCE[7] = 1 external, INT_Z[6:5] = 00 (20 %), BIAS_SIGN[4] = 0, BIAS[3:0] = 0 (0 %)
#define LMP91000_REFCN_EXT_20PCT_0BIAS (1u << 7)
#define LMP91000_MODECN_3LEAD 0x03
#define LMP91000_RTIA_OHM 350000.0f
#define LMP91000_INT_Z 0.20f

// ---- ADS1115 ----
#define ADS1115_ADDR 0x49  // ADDR pin tied to VDD
// Single-shot config: OS=1, MUX single-ended AINx, PGA ±4.096 V, MODE single, 8 SPS, comparator off.
uint16_t ads1115_config_single(uint8_t ain, uint8_t data_rate_code);
float ads1115_volts(int16_t raw);  // at PGA ±4.096 V

// CO in ppm from the TIA output and its reference (ratiometric). sens_na_per_ppm comes from the
// sensor's label (SPEC: 4.75 +/- 2.75 nA/ppm, individually calibrated). zero_offset_v is the clean-air
// offset measured at commissioning (default 0). Temperature compensation of span per SPEC datasheet:
// 0.3 %/C above 10 C, 0.9 %/C below.
float co_ppm(float v_out, float v_ref, float sens_na_per_ppm, float zero_offset_v, float temp_c);

#ifdef __cplusplus
}
#endif
