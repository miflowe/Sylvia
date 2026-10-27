// Host tests for the Node's pure-C logic: detection, power policy, payloads, CRC.
// Build + run: python -I hardware/firmware/test/host/run_tests.py
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "detect.h"
#include "payload.h"
#include "power_policy.h"
#include "sensor_math.h"

static int g_checks, g_fail;
#define CHECK(cond)                                                       \
    do {                                                                  \
        g_checks++;                                                       \
        if (!(cond)) {                                                    \
            g_fail++;                                                     \
            printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);      \
        }                                                                 \
    } while (0)
#define NEAR(a, b, eps) (fabs((double)(a) - (double)(b)) <= (eps))

static const char *g_fixtures = "fixtures";

// ---------------------------------------------------------------- unit tests

static void test_crc(void)
{
    // Sensirion datasheets' worked example: 0xBEEF -> 0x92.
    const uint8_t w[2] = {0xBE, 0xEF};
    CHECK(sensirion_crc8(w, 2) == 0x92);
}

static void test_slope(void)
{
    uint32_t t[4] = {0, 60, 120, 180};
    float v[4] = {10, 12, 14, 16};
    CHECK(NEAR(det_slope_per_min(t, v, 4), 2.0, 1e-4));
    CHECK(isnan(det_slope_per_min(t, v, 2)));       // too few points
    uint32_t t2[3] = {0, 30, 60};
    CHECK(isnan(det_slope_per_min(t2, v, 3)));      // span < 120 s
}

static void test_payload(void)
{
    telemetry_t t = {.level = 2, .cause = 1, .charging = true, .sen66_valid = true, .pm25 = 123.4f,
                     .co2 = 512, .co = 17.3f, .temp_c = -12.5f, .rh = 87, .soc_pct = 64, .pm_slope = 9.4f};
    uint8_t b[PAYLOAD_LORA_LEN];
    payload_lora_encode(&t, b);
    telemetry_t d;
    CHECK(payload_lora_decode(b, sizeof b, &d));
    CHECK(d.level == 2 && d.cause == 1 && d.charging && d.sen66_valid);
    CHECK(NEAR(d.pm25, 123.4, 0.05));
    CHECK(NEAR(d.co2, 512, 0.5));
    CHECK(NEAR(d.co, 17.3, 0.05));
    CHECK(NEAR(d.temp_c, -12.5, 0.01));
    CHECK(NEAR(d.rh, 87, 0.5) && NEAR(d.soc_pct, 64, 0.5));
    CHECK(NEAR(d.pm_slope, 9, 0.01));
    CHECK(b[0] >> 6 == PAYLOAD_VERSION);

    // n/a and saturation
    telemetry_t n = {.pm25 = NAN, .co2 = NAN, .co = 99999, .temp_c = NAN, .rh = NAN, .soc_pct = 150,
                     .pm_slope = -500};
    payload_lora_encode(&n, b);
    CHECK(payload_lora_decode(b, sizeof b, &d));
    CHECK(isnan(d.pm25) && isnan(d.co2) && isnan(d.temp_c) && isnan(d.rh));
    CHECK(NEAR(d.co, 6553.4, 0.01));
    CHECK(NEAR(d.soc_pct, 100, 0.01));
    CHECK(NEAR(d.pm_slope, -127, 0.01));
    CHECK(!payload_lora_decode(b, 10, &d));  // wrong length

    char js[512];
    int len = payload_json(&t, "0.1.0", js, sizeof js);
    CHECK(len > 0 && js[0] == '{' && js[len - 1] == '}');
    CHECK(strstr(js, "\"pm25\":123.4") != NULL);
    CHECK(strstr(js, "\"pm1\":0.0") != NULL);
    CHECK(payload_json(&t, "0.1.0", js, 20) == -1);  // too small
}

static void put_word(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)(v >> 8);
    p[1] = (uint8_t)v;
    p[2] = sensirion_crc8(p, 2);
}

static void test_sensor_math(void)
{
    // SEN66 frame: PM1 12.3, PM2.5 45.6, PM4 50.0, PM10 60.1, RH 55.25 %, T -5.5 C, VOC 101.0, NOx unknown, CO2 612
    uint8_t f[SEN66_FRAME_LEN];
    const uint16_t w[9] = {123, 456, 500, 601, 5525, (uint16_t)(int16_t)-1100, 1010, 0x7FFF, 612};
    for (int i = 0; i < 9; i++) put_word(f + 3 * i, w[i]);
    sen66_values_t v;
    CHECK(sen66_parse(f, &v));
    CHECK(NEAR(v.pm1, 12.3, 1e-4) && NEAR(v.pm25, 45.6, 1e-4) && NEAR(v.pm10, 60.1, 1e-4));
    CHECK(NEAR(v.rh, 55.25, 1e-4) && NEAR(v.temp_c, -5.5, 1e-4) && NEAR(v.voc_index, 101.0, 1e-4));
    CHECK(isnan(v.nox_index) && NEAR(v.co2, 612, 1e-4));
    put_word(f + 24, 0xFFFF);  // CO2 unknown during the first 6 s
    CHECK(sen66_parse(f, &v) && isnan(v.co2));
    f[5] ^= 0x01;  // corrupt PM2.5's CRC
    CHECK(!sen66_parse(f, &v));

    CHECK(ads1115_config_single(0, 0) == 0xC303);  // AIN0, ±4.096 V, single-shot, 8 SPS, comparator off
    CHECK(ads1115_config_single(1, 4) == 0xD383);
    CHECK(NEAR(ads1115_volts(32767), 4.096, 1e-3) && NEAR(ads1115_volts(-32768), -4.096, 1e-6));

    // 10 ppm at 4.75 nA/ppm through 350 kOhm = 16.625 mV above the 20 % zero (0.66 V at VREF 3.3 V)
    CHECK(NEAR(co_ppm(0.66f + 0.016625f, 3.3f, 4.75f, 0.0f, 20.0f), 10.0, 1e-3));
    CHECK(NEAR(co_ppm(0.66f, 3.3f, 4.75f, 0.0f, 20.0f), 0.0, 1e-4));
    CHECK(co_ppm(0.66f + 0.016625f, 3.3f, 4.75f, 0.0f, 0.0f) > 10.0f);  // lower span in the cold reads higher ppm
    CHECK(isnan(co_ppm(NAN, 3.3f, 4.75f, 0.0f, 20.0f)));
    CHECK(LMP91000_TIACN_350K_10R == 0x1C && LMP91000_REFCN_EXT_20PCT_0BIAS == 0x80);
}

static void test_policy(void)
{
    pwr_input_t in = {.soc_pct = 80, .charging = true, .temp_c = 20, .rh = 50};
    pwr_output_t o = pwr_decide(&in);
    CHECK(o.mode == PWR_NORMAL && o.sen66_period_s == 300 && o.uplink_period_s == 300);

    in.charging = false;
    in.s_since_charge = 25 * 3600;
    CHECK(pwr_decide(&in).mode == PWR_SAVER);

    in.soc_pct = 30;
    in.s_since_charge = 0;
    CHECK(pwr_decide(&in).mode == PWR_SAVER);

    in.soc_pct = 5;
    o = pwr_decide(&in);
    CHECK(o.mode == PWR_CRITICAL && o.sen66_period_s == PWR_SEN66_OFF && o.uplink_period_s == 3600);
    in.alert_active = true;
    CHECK(pwr_decide(&in).uplink_period_s == 300);  // advisories still go out
    in.alert_active = false;

    in.soc_pct = 60;
    in.burst_requested = true;
    o = pwr_decide(&in);
    CHECK(o.mode == PWR_BURST && o.sen66_period_s == 0);
    in.burst_used_s = PWR_BURST_CAP_S;
    CHECK(pwr_decide(&in).mode != PWR_BURST);  // capped per hour
    in.burst_used_s = 0;
    in.soc_pct = 12;
    CHECK(pwr_decide(&in).mode != PWR_BURST);  // too little battery

    pwr_input_t cold = {.soc_pct = 80, .charging = true, .temp_c = -15, .rh = 50};
    o = pwr_decide(&cold);
    CHECK(!o.sen66_allowed && o.sen66_period_s == PWR_SEN66_OFF);
    cold.temp_c = 0;
    o = pwr_decide(&cold);
    CHECK(o.sen66_allowed && o.sen66_degraded);
    cold.temp_c = 20;
    cold.rh = 97;
    CHECK(!pwr_decide(&cold).sen66_allowed);  // condensation risk
}

// ---------------------------------------------------------------- scenarios

typedef struct {
    det_level_t max_level;
    det_cause_t cause_at_end, cause_at_max;
    long first_watch_s, first_alert_s;
    int bursts, fog, sen66_samples, rows;
    int ever_smoulder, ever_flaming;
} sim_t;

static float field(const char *s)
{
    return (*s == '\0' || *s == '\n' || *s == '\r') ? NAN : strtof(s, NULL);
}

// Splits a CSV line in place, keeping empty fields.
static int split(char *line, char **out, int max)
{
    int n = 0;
    out[n++] = line;
    for (char *p = line; *p && n < max; p++) {
        if (*p == ',') {
            *p = '\0';
            out[n++] = p + 1;
        }
    }
    return n;
}

static sim_t simulate(const char *name, bool sensitive, float soc)
{
    char path[512];
    snprintf(path, sizeof path, "%s/%s.csv", g_fixtures, name);
    FILE *f = fopen(path, "r");
    sim_t r = {.first_watch_s = -1, .first_alert_s = -1};
    if (!f) {
        printf("  cannot open %s\n", path);
        g_fail++;
        return r;
    }
    det_config_t cfg = det_config_default(sensitive);
    det_state_t st;
    det_init(&st, &cfg);
    det_result_t d = {0};
    long last_sen = -100000;
    uint32_t burst_used = 0, hour = 0;
    char line[256];
    fgets(line, sizeof line, f);  // header
    while (fgets(line, sizeof line, f)) {
        char *c[8];
        if (split(line, c, 8) < 7) continue;
        det_sample_t x = {.t_s = (uint32_t)strtoul(c[0], NULL, 10), .pm25 = NAN, .co2 = NAN, .co = field(c[3]),
                          .gas_kohm = field(c[4]), .temp_c = field(c[5]), .rh = field(c[6])};
        if (x.t_s / 3600 != hour) {
            hour = x.t_s / 3600;
            burst_used = 0;
        }
        // Same order as the firmware: BME688 first, then decide whether the SEN66 may run.
        pwr_input_t pin = {.soc_pct = soc, .charging = true, .temp_c = x.temp_c, .rh = x.rh,
                           .burst_requested = d.request_burst, .burst_used_s = burst_used,
                           .alert_active = d.level >= DET_LEVEL_WATCH};
        pwr_output_t pol = pwr_decide(&pin);
        if (pol.mode == PWR_BURST) burst_used += 60;
        bool sample = pol.sen66_period_s != PWR_SEN66_OFF &&
                      (pol.sen66_period_s == 0 || (long)x.t_s - last_sen >= (long)pol.sen66_period_s);
        if (sample) {
            x.pm25 = field(c[1]);
            x.co2 = field(c[2]);
            last_sen = (long)x.t_s;
            r.sen66_samples++;
        }
        d = det_update(&st, &x);
        r.rows++;
        if (d.request_burst) r.bursts++;
        if (d.fog_suspect) r.fog++;
        if (d.cause == DET_CAUSE_SMOULDER) r.ever_smoulder = 1;
        if (d.cause == DET_CAUSE_FLAMING) r.ever_flaming = 1;
        if (d.level >= DET_LEVEL_WATCH && r.first_watch_s < 0) r.first_watch_s = (long)x.t_s;
        if (d.level >= DET_LEVEL_ALERT && r.first_alert_s < 0) r.first_alert_s = (long)x.t_s;
        if (d.level > r.max_level) r.max_level = d.level;
        if (d.level == r.max_level && d.cause != DET_CAUSE_UNKNOWN) r.cause_at_max = d.cause;
        r.cause_at_end = d.cause;
    }
    fclose(f);
    printf("  %-14s %s max=%-5s cause@max=%-8s watch@%5lds alert@%5lds bursts=%d fog=%d sen66=%d/%d\n", name,
           sensitive ? "sens" : "    ", det_level_name(r.max_level), det_cause_name(r.cause_at_max), r.first_watch_s,
           r.first_alert_s, r.bursts, r.fog, r.sen66_samples, r.rows);
    return r;
}

static void test_scenarios(void)
{
    sim_t s = simulate("clean", false, 80);
    CHECK(s.rows == 480);
    CHECK(s.max_level == DET_LEVEL_NONE);
    CHECK(s.bursts <= 2);
    CHECK(s.sen66_samples >= 90 && s.sen66_samples <= 100);  // every 5 min

    s = simulate("regional", false, 80);
    CHECK(s.max_level == DET_LEVEL_ALERT);
    CHECK(s.first_watch_s > 2 * 3600 && s.first_watch_s < s.first_alert_s);
    CHECK(s.cause_at_end == DET_CAUSE_REGIONAL);
    CHECK(!s.ever_smoulder && !s.ever_flaming);
    long regional_alert = s.first_alert_s;

    s = simulate("regional", true, 80);
    CHECK(s.max_level == DET_LEVEL_ALERT);
    CHECK(s.first_alert_s > 0 && s.first_alert_s < regional_alert);  // sensitive toggle alerts earlier

    s = simulate("smoulder", false, 80);
    CHECK(s.max_level == DET_LEVEL_ALERT);
    CHECK(s.first_watch_s >= 7200);                    // nothing before the onset at 2 h
    CHECK(s.first_alert_s >= 7200 && s.first_alert_s - 7200 <= 1200);  // within 20 min
    CHECK(s.cause_at_max == DET_CAUSE_SMOULDER);
    CHECK(s.bursts > 0);

    s = simulate("bbq_propane", false, 80);
    CHECK(s.max_level <= DET_LEVEL_WATCH);             // a propane barbecue must not raise an alert
    CHECK(s.max_level == DET_LEVEL_NONE || s.cause_at_max == DET_CAUSE_FLAMING);
    CHECK(!s.ever_smoulder);

    s = simulate("fog", false, 80);
    CHECK(s.max_level == DET_LEVEL_NONE);
    CHECK(s.fog > 0);

    s = simulate("dropouts", false, 80);
    CHECK(s.max_level == DET_LEVEL_NONE);

    s = simulate("smoulder_cold", false, 80);          // -20 C: SEN66 gated off, CO alone must alert
    CHECK(s.sen66_samples == 0);
    CHECK(s.max_level == DET_LEVEL_ALERT);
    CHECK(s.first_alert_s >= 7200 && s.first_alert_s - 7200 <= 1200);

    s = simulate("smoulder", false, 12);               // low battery: no bursts, still alerts on CO
    CHECK(s.max_level == DET_LEVEL_ALERT);
}

int main(int argc, char **argv)
{
    if (argc > 1) g_fixtures = argv[1];
    printf("crc\n");
    test_crc();
    printf("slope\n");
    test_slope();
    printf("payload\n");
    test_payload();
    printf("sensor math\n");
    test_sensor_math();
    printf("power policy\n");
    test_policy();
    printf("scenarios\n");
    test_scenarios();
    printf("\n%d checks, %d failed\n", g_checks, g_fail);
    return g_fail ? 1 : 0;
}
