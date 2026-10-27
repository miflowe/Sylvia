// Sylvia Node Tier B: one wake cycle per boot, then deep sleep (normally 60 s).
//
//  1. read BME688 (T/RH/P/gas), CO (LMP91000 + ADS1115), fuel gauge, charger status
//  2. power policy decides whether the SEN66 may run and how often to uplink
//  3. SEN66 state machine across wakes: power on -> 35 s -> read -> off (or stay on in a burst)
//  4. local detection (PM slope + CO/CO2 ratio), Level 1-2 "unverified" advisories only
//  5. uplink when due or when the advisory changes: Wi-Fi MQTT first, LoRaWAN 11-byte fallback
//  6. once a day on Wi-Fi: check the device twin for OTA
//
// Everything that must survive deep sleep lives in RTC memory (rtc_state). Logic that can be unit-tested
// (detect, power_policy, payload, sensor_math) is pure C and tested on the host: test/host/.
#include <math.h>
#include <string.h>

#include "board.h"
#include "detect.h"
#include "drivers.h"
#include "esp_log.h"
#include "esp_sleep.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "net.h"
#include "payload.h"
#include "power_policy.h"

#define FW_VERSION "0.1.0"
#define WAKE_PERIOD_S 60
#define SEN66_WARMUP_S 35     // 30 s PM start-up (datasheet) + margin
#define OTA_CHECK_PERIOD_S (24 * 3600)
#define UPLINK_TIMEOUT_MS 10000

static const char *TAG = "node";

typedef enum { SEN_OFF = 0, SEN_WARMING, SEN_CONTINUOUS } sen_state_t;

typedef struct {
    uint32_t magic;
    uint32_t t_s;                // monotonic seconds across deep sleeps
    det_state_t det;
    det_level_t last_reported_level;
    sen_state_t sen;
    uint32_t sen_started_s, sen_last_sample_s;
    uint32_t burst_used_s, burst_hour;
    uint32_t last_uplink_s, last_charge_s, last_ota_check_s;
    sen66_values_t sen_last;     // last good SEN66 reading (held between samples)
    bool sen_valid;
    uint16_t seq;
    bool lora_ready;
    bool burst_req;              // detector's request from the previous wake
} rtc_state_t;

RTC_DATA_ATTR static rtc_state_t rtc;
#define RTC_MAGIC 0x53594C56u  // "SYLV"

static node_i2c_t i2c;
static node_creds_t creds;
static bool sensitive_mode;   // pushed from the app via the twin (future); device default = off

static uint32_t elapsed_since_boot_s(void) { return (uint32_t)(esp_timer_get_time() / 1000000); }

static void first_boot(void)
{
    memset(&rtc, 0, sizeof rtc);
    rtc.magic = RTC_MAGIC;
    det_config_t cfg = det_config_default(sensitive_mode);
    det_init(&rtc.det, &cfg);
    co_init(i2c.bus0);
    max17048_init(i2c.bus0, 10);  // ALRT below 10 % SoC
}

static void sen66_step(const pwr_output_t *pol, det_sample_t *x)
{
    uint32_t now = rtc.t_s;
    bool due = pol->sen66_period_s == 0 ||
               (pol->sen66_period_s != PWR_SEN66_OFF && now - rtc.sen_last_sample_s >= pol->sen66_period_s);
    if (!pol->sen66_allowed && rtc.sen != SEN_OFF) {
        sen66_stop(i2c.bus1);
        i2c_bus_release_bus1(&i2c);
        sen66_power(false);
        rtc.sen = SEN_OFF;
        return;
    }
    switch (rtc.sen) {
    case SEN_OFF:
        if (due && pol->sen66_allowed) {
            sen66_power(true);
            sen66_start(i2c.bus1);
            rtc.sen = pol->sen66_period_s == 0 ? SEN_CONTINUOUS : SEN_WARMING;
            rtc.sen_started_s = now;
        }
        break;
    case SEN_WARMING:
    case SEN_CONTINUOUS:
        if (now - rtc.sen_started_s >= SEN66_WARMUP_S) {
            sen66_values_t v;
            if (sen66_read(i2c.bus1, &v) == ESP_OK && !isnan(v.pm25)) {
                rtc.sen_last = v;
                rtc.sen_valid = true;
                rtc.sen_last_sample_s = now;
                x->pm25 = v.pm25;
                x->co2 = v.co2;
            }
            if (pol->sen66_period_s != 0) {  // scheduled sample done: power down
                sen66_stop(i2c.bus1);
                i2c_bus_release_bus1(&i2c);
                sen66_power(false);
                rtc.sen = SEN_OFF;
            } else {
                rtc.sen = SEN_CONTINUOUS;
            }
        }
        break;
    }
}

static void uplink(const telemetry_t *t, bool urgent)
{
    char json[512];
    payload_json(t, FW_VERSION, json, sizeof json);
    if (creds.wifi_ssid[0] && wifi_mqtt_publish(&creds, json, UPLINK_TIMEOUT_MS) == ESP_OK) {
        ota_mark_valid_if_pending();
        if (rtc.t_s - rtc.last_ota_check_s >= OTA_CHECK_PERIOD_S) {
            char ver[24], url[256], sha[65];
            rtc.last_ota_check_s = rtc.t_s;
            if (wifi_mqtt_get_fw_target(ver, sizeof ver, url, sizeof url, sha, sizeof sha) == ESP_OK && url[0] &&
                strcmp(ver, FW_VERSION) != 0 && ota_apply(url, sha) == ESP_OK) {
                esp_restart();
            }
        }
        wifi_mqtt_stop();
        rtc.last_uplink_s = rtc.t_s;
        return;
    }
    wifi_mqtt_stop();
    // Fallback: LoRaWAN, compact payload.
    if (!rtc.lora_ready) rtc.lora_ready = lorawan_init(&creds) == ESP_OK;
    if (rtc.lora_ready) {
        uint8_t b[PAYLOAD_LORA_LEN];
        payload_lora_encode(t, b);
        if (lorawan_send(PAYLOAD_LORA_FPORT, b, sizeof b, urgent ? 20000 : 10000) == ESP_OK) {
            rtc.last_uplink_s = rtc.t_s;
        }
    }
}

void app_main(void)
{
    uint32_t awake_start = elapsed_since_boot_s();
    i2c_bus_init(&i2c);
    charger_init();
    if (creds_load(&creds) != ESP_OK) ESP_LOGW(TAG, "running without credentials: data stays local");
    if (rtc.magic != RTC_MAGIC) first_boot();
    bme688_init(i2c.bus0);
    gpio_set_direction(PIN_LED, GPIO_MODE_OUTPUT);

    // 1. cheap sensors
    det_sample_t x = {.t_s = rtc.t_s, .pm25 = NAN, .co2 = NAN, .co = NAN, .gas_kohm = NAN, .temp_c = NAN, .rh = NAN};
    bme688_reading_t env = {.temp_c = NAN, .rh = NAN, .pressure_hpa = NAN, .gas_kohm = NAN};
    if (bme688_forced(&env) == ESP_OK) {
        x.temp_c = env.temp_c;
        x.rh = env.rh;
        if (env.gas_valid) x.gas_kohm = env.gas_kohm;
    }
    co_cal_t cal = {.sens_na_per_ppm = creds.co_sens_na_per_ppm, .zero_offset_v = creds.co_zero_v};
    float co = NAN, v_co = NAN;
    if (co_read(i2c.bus0, &cal, x.temp_c, &co, &v_co) == ESP_OK) x.co = co;
    float vcell = NAN, soc = NAN;
    max17048_read(i2c.bus0, &vcell, &soc);
    chg_state_t chg = charger_state();
    if (chg == CHG_CHARGING || chg == CHG_DONE) rtc.last_charge_s = rtc.t_s;

    // 2. power policy (uses the previous wake's detector request)
    if (rtc.t_s / 3600 != rtc.burst_hour) {
        rtc.burst_hour = rtc.t_s / 3600;
        rtc.burst_used_s = 0;
    }
    pwr_input_t pin = {.soc_pct = isnan(soc) ? 50.0f : soc, .charging = chg == CHG_CHARGING,
                       .s_since_charge = rtc.t_s - rtc.last_charge_s, .temp_c = x.temp_c, .rh = x.rh,
                       .burst_requested = rtc.burst_req,
                       .burst_used_s = rtc.burst_used_s, .alert_active = rtc.det.level >= DET_LEVEL_WATCH};
    pwr_output_t pol = pwr_decide(&pin);
    if (pol.mode == PWR_BURST) rtc.burst_used_s += WAKE_PERIOD_S;

    // 3. SEN66
    if (!isnan(env.pressure_hpa) && rtc.sen != SEN_OFF) sen66_set_pressure(i2c.bus1, env.pressure_hpa);
    sen66_step(&pol, &x);

    // 4. detection
    det_result_t d = det_update(&rtc.det, &x);
    rtc.burst_req = d.request_burst;

    // 5. uplink
    telemetry_t t = {.level = d.level, .cause = d.cause, .charging = chg == CHG_CHARGING,
                     .sen66_valid = rtc.sen_valid, .pm1 = NAN, .pm25 = NAN, .pm4 = NAN, .pm10 = NAN, .co2 = NAN,
                     .voc_index = NAN, .nox_index = NAN, .co = x.co, .temp_c = x.temp_c, .rh = x.rh,
                     .pressure_hpa = env.pressure_hpa, .gas_kohm = x.gas_kohm, .soc_pct = soc, .vbat = vcell,
                     .pm_slope = d.pm_slope, .uptime_s = rtc.t_s, .seq = rtc.seq++};
    if (rtc.sen_valid) {
        t.pm1 = rtc.sen_last.pm1;
        t.pm25 = rtc.sen_last.pm25;
        t.pm4 = rtc.sen_last.pm4;
        t.pm10 = rtc.sen_last.pm10;
        t.co2 = rtc.sen_last.co2;
        t.voc_index = rtc.sen_last.voc_index;
        t.nox_index = rtc.sen_last.nox_index;
    }
    bool level_changed = d.level != rtc.last_reported_level;
    if (level_changed || rtc.t_s - rtc.last_uplink_s >= pol.uplink_period_s) {
        uplink(&t, level_changed);
        rtc.last_reported_level = d.level;
    }
    gpio_set_level(PIN_LED, d.level >= DET_LEVEL_ALERT);

    // 6. sleep: shorter while the SEN66 is warming so the reading lands at ~35 s
    uint32_t sleep_s = WAKE_PERIOD_S;
    if (rtc.sen == SEN_WARMING) sleep_s = SEN66_WARMUP_S;
    uint32_t awake = elapsed_since_boot_s() - awake_start;
    rtc.t_s += sleep_s + awake;
    ESP_LOGI(TAG, "mode=%s level=%s cause=%s co=%.2f pm25=%.1f soc=%.0f%% sleep=%lus", pwr_mode_name(pol.mode),
             det_level_name(d.level), det_cause_name(d.cause), x.co, t.pm25, soc, (unsigned long)sleep_s);
    esp_sleep_enable_timer_wakeup((uint64_t)sleep_s * 1000000ULL);
    esp_sleep_enable_ext1_wakeup_io((1ULL << PIN_FG_ALRT) | (1ULL << PIN_TAMPER), ESP_EXT1_WAKEUP_ANY_LOW);
    esp_deep_sleep_start();
}
