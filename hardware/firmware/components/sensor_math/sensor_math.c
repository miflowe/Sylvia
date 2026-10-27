#include "sensor_math.h"

#include <math.h>

#include "payload.h"  // sensirion_crc8

static bool word(const uint8_t *p, uint16_t *v)
{
    if (sensirion_crc8(p, 2) != p[2]) {
        return false;
    }
    *v = (uint16_t)((p[0] << 8) | p[1]);
    return true;
}

static float u16_or_nan(uint16_t v, float scale)
{
    return v == 0xFFFF ? NAN : (float)v / scale;
}

static float i16_or_nan(uint16_t v, float scale)
{
    return v == 0x7FFF ? NAN : (float)(int16_t)v / scale;
}

bool sen66_parse(const uint8_t frame[SEN66_FRAME_LEN], sen66_values_t *out)
{
    uint16_t w[9];
    for (int i = 0; i < 9; i++) {
        if (!word(frame + 3 * i, &w[i])) {
            return false;
        }
    }
    out->pm1 = u16_or_nan(w[0], 10.0f);
    out->pm25 = u16_or_nan(w[1], 10.0f);
    out->pm4 = u16_or_nan(w[2], 10.0f);
    out->pm10 = u16_or_nan(w[3], 10.0f);
    out->rh = i16_or_nan(w[4], 100.0f);
    out->temp_c = i16_or_nan(w[5], 200.0f);
    out->voc_index = i16_or_nan(w[6], 10.0f);
    out->nox_index = i16_or_nan(w[7], 10.0f);
    out->co2 = u16_or_nan(w[8], 1.0f);
    return true;
}

uint16_t ads1115_config_single(uint8_t ain, uint8_t data_rate_code)
{
    // OS[15]=1 start, MUX[14:12]=100+ain (AINx vs GND), PGA[11:9]=001 (±4.096 V), MODE[8]=1 single-shot,
    // DR[7:5], COMP_QUE[1:0]=11 (comparator disabled).
    return (uint16_t)((1u << 15) | ((4u + (ain & 3u)) << 12) | (1u << 9) | (1u << 8) | ((data_rate_code & 7u) << 5) | 3u);
}

float ads1115_volts(int16_t raw)
{
    return (float)raw * 4.096f / 32768.0f;
}

float co_ppm(float v_out, float v_ref, float sens_na_per_ppm, float zero_offset_v, float temp_c)
{
    if (isnan(v_out) || isnan(v_ref) || sens_na_per_ppm <= 0) {
        return NAN;
    }
    float v_zero = LMP91000_INT_Z * v_ref + zero_offset_v;
    float i_na = (v_out - v_zero) / LMP91000_RTIA_OHM * 1e9f;
    float span = 1.0f;
    if (!isnan(temp_c)) {
        // SPEC 110-102 span temperature coefficient, referenced to 20 C.
        span = temp_c >= 10.0f ? 1.0f + 0.003f * (temp_c - 20.0f)
                               : (1.0f - 0.003f * 10.0f) + 0.009f * (temp_c - 10.0f);
    }
    if (span < 0.3f) span = 0.3f;
    return i_na / (sens_na_per_ppm * span);
}
