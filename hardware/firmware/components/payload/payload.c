#include "payload.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

static uint16_t u16_scaled(float v, float scale)
{
    if (isnan(v)) return 0xFFFF;
    float s = roundf(v * scale);
    if (s < 0) s = 0;
    if (s > 65534.0f) s = 65534.0f;
    return (uint16_t)s;
}

static int8_t i8_scaled(float v, float scale)
{
    if (isnan(v)) return -128;
    float s = roundf(v * scale);
    if (s < -127.0f) s = -127.0f;
    if (s > 127.0f) s = 127.0f;
    return (int8_t)s;
}

static uint8_t u8_pct(float v)
{
    if (isnan(v)) return 0xFF;
    float s = roundf(v);
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    return (uint8_t)s;
}

static void put16(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)(v >> 8);
    p[1] = (uint8_t)v;
}

static uint16_t get16(const uint8_t *p)
{
    return (uint16_t)((p[0] << 8) | p[1]);
}

void payload_lora_encode(const telemetry_t *t, uint8_t out[PAYLOAD_LORA_LEN])
{
    out[0] = (uint8_t)((PAYLOAD_VERSION & 3) << 6 | (t->level & 3) << 4 | (t->cause & 3) << 2 |
                       (t->charging ? 2 : 0) | (t->sen66_valid ? 1 : 0));
    put16(out + 1, u16_scaled(t->pm25, 10.0f));
    put16(out + 3, u16_scaled(t->co2, 1.0f));
    put16(out + 5, u16_scaled(t->co, 10.0f));
    out[7] = (uint8_t)i8_scaled(t->temp_c, 2.0f);
    out[8] = u8_pct(t->rh);
    out[9] = u8_pct(t->soc_pct);
    out[10] = (uint8_t)i8_scaled(t->pm_slope, 1.0f);
}

static float from16(uint16_t v, float scale)
{
    return v == 0xFFFF ? NAN : (float)v / scale;
}

bool payload_lora_decode(const uint8_t *in, size_t len, telemetry_t *t)
{
    if (len != PAYLOAD_LORA_LEN || (in[0] >> 6) != PAYLOAD_VERSION) {
        return false;
    }
    memset(t, 0, sizeof(*t));
    t->pm1 = t->pm4 = t->pm10 = t->voc_index = t->nox_index = NAN;
    t->pressure_hpa = t->gas_kohm = t->vbat = NAN;
    t->level = (in[0] >> 4) & 3;
    t->cause = (in[0] >> 2) & 3;
    t->charging = (in[0] & 2) != 0;
    t->sen66_valid = (in[0] & 1) != 0;
    t->pm25 = from16(get16(in + 1), 10.0f);
    t->co2 = from16(get16(in + 3), 1.0f);
    t->co = from16(get16(in + 5), 10.0f);
    t->temp_c = (int8_t)in[7] == -128 ? NAN : (float)(int8_t)in[7] / 2.0f;
    t->rh = in[8] == 0xFF ? NAN : (float)in[8];
    t->soc_pct = in[9] == 0xFF ? NAN : (float)in[9];
    t->pm_slope = (int8_t)in[10] == -128 ? NAN : (float)(int8_t)in[10];
    return true;
}

// Appends "key":value, or "key":null for NAN.
static int jnum(char *b, size_t n, const char *k, float v, int dec)
{
    if (isnan(v)) return snprintf(b, n, "\"%s\":null,", k);
    return snprintf(b, n, "\"%s\":%.*f,", k, dec, (double)v);
}

int payload_json(const telemetry_t *t, const char *fw_version, char *buf, size_t len)
{
    size_t o = 0;
    int w;
#define PUT(expr)                                   \
    do {                                            \
        w = (expr);                                 \
        if (w < 0 || (size_t)w >= len - o) return -1; \
        o += (size_t)w;                             \
    } while (0)
    PUT(snprintf(buf + o, len - o, "{\"v\":%d,\"seq\":%u,\"up\":%lu,", PAYLOAD_VERSION, t->seq,
                 (unsigned long)t->uptime_s));
    PUT(jnum(buf + o, len - o, "pm1", t->pm1, 1));
    PUT(jnum(buf + o, len - o, "pm25", t->pm25, 1));
    PUT(jnum(buf + o, len - o, "pm4", t->pm4, 1));
    PUT(jnum(buf + o, len - o, "pm10", t->pm10, 1));
    PUT(jnum(buf + o, len - o, "co2", t->co2, 0));
    PUT(jnum(buf + o, len - o, "voc", t->voc_index, 0));
    PUT(jnum(buf + o, len - o, "nox", t->nox_index, 0));
    PUT(jnum(buf + o, len - o, "co", t->co, 2));
    PUT(jnum(buf + o, len - o, "t", t->temp_c, 2));
    PUT(jnum(buf + o, len - o, "rh", t->rh, 1));
    PUT(jnum(buf + o, len - o, "p", t->pressure_hpa, 1));
    PUT(jnum(buf + o, len - o, "gas", t->gas_kohm, 1));
    PUT(jnum(buf + o, len - o, "soc", t->soc_pct, 1));
    PUT(jnum(buf + o, len - o, "vbat", t->vbat, 3));
    PUT(jnum(buf + o, len - o, "pmSlope", t->pm_slope, 2));
    PUT(snprintf(buf + o, len - o, "\"chg\":%s,\"sen66\":%s,\"level\":%u,\"cause\":%u,\"fw\":\"%s\"}",
                 t->charging ? "true" : "false", t->sen66_valid ? "true" : "false", t->level, t->cause,
                 fw_version ? fw_version : ""));
#undef PUT
    return (int)o;
}

uint8_t sensirion_crc8(const uint8_t *data, size_t len)
{
    uint8_t crc = 0xFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int b = 0; b < 8; b++) {
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x31) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}
