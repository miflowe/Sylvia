// Local smoke / smoulder spike detection for the Sylvia Node.
//
// Pure C (no ESP-IDF), so it builds and runs on the host for tests (test/host).
// Called once per wake (60 s). PM2.5 and CO2 come from the SEN66, which is only sampled
// every few minutes (or continuously during a burst), so those fields are NAN when absent.
//
// The device only produces "unverified" Level 1-2 advisories. Level 3 (official orders)
// never comes from the device.
#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    DET_LEVEL_NONE = 0,
    DET_LEVEL_WATCH = 1,  // Level 1 advisory: elevated, keep an eye on it
    DET_LEVEL_ALERT = 2,  // Level 2 advisory: likely smoke nearby
} det_level_t;

typedef enum {
    DET_CAUSE_UNKNOWN = 0,
    DET_CAUSE_SMOULDER = 1,  // high dCO/dCO2: low combustion efficiency (smouldering vegetation)
    DET_CAUSE_FLAMING = 2,   // low dCO/dCO2: efficient combustion (propane BBQ, flaming fire)
    DET_CAUSE_REGIONAL = 3,  // PM up with no local CO2/CO signal: transported wildfire smoke
} det_cause_t;

typedef struct {
    uint32_t t_s;    // monotonic seconds
    float pm25;      // ug/m3, NAN if the SEN66 was not sampled this wake
    float co2;       // ppm, NAN if not sampled
    float co;        // ppm, NAN if invalid
    float gas_kohm;  // BME688 gas resistance, NAN if invalid
    float temp_c;    // NAN if invalid
    float rh;        // %RH, NAN if invalid
} det_sample_t;

typedef struct {
    float pm_watch;           // ug/m3 PM2.5 for WATCH
    float pm_alert;           // ug/m3 PM2.5 for ALERT
    float pm_slope_spike;     // ug/m3 per minute counted as a spike
    float co_watch;           // ppm above baseline for WATCH
    float co_alert;           // ppm above baseline for ALERT
    float co_trigger;         // ppm above baseline that requests a SEN66 burst
    float co_slope_trigger;   // ppm per minute that requests a burst
    float gas_drop_trigger;   // fractional BME688 resistance drop that requests a burst
    float min_dco2;           // ppm CO2 excess needed before the CO/CO2 ratio is trusted
    float ratio_smoulder;     // dCO/dCO2 at or above this -> SMOULDER
    float ratio_flaming;      // dCO/dCO2 at or below this -> FLAMING
    float fog_rh;             // %RH at or above which PM-only rises are treated as fog
    uint32_t slope_window_s;  // PM slope regression window
    uint32_t baseline_tau_s;  // baseline time constant (frozen during events)
    uint8_t confirm;          // consecutive evaluations needed for a single-sensor escalation
    uint8_t clear;            // consecutive quiet evaluations before de-escalating
} det_config_t;

#define DET_PM_HIST 32
#define DET_CO_HIST 8

typedef struct {
    det_config_t cfg;
    bool have_base;
    float base_pm, base_co, base_co2, base_gas;
    bool base_pm_ok, base_co2_ok, base_gas_ok;
    uint32_t last_t;
    // PM samples (t, value) for the slope
    uint32_t pm_t[DET_PM_HIST];
    float pm_v[DET_PM_HIST];
    uint8_t pm_n, pm_head;
    // CO samples for the CO slope
    uint32_t co_t[DET_CO_HIST];
    float co_v[DET_CO_HIST];
    uint8_t co_n, co_head;
    float last_pm, last_co2;  // most recent valid SEN66 values (held between samples)
    uint32_t last_pm_t;
    det_level_t level;
    det_cause_t cause;
    uint8_t up_count, quiet_count;
} det_state_t;

typedef struct {
    det_level_t level;
    det_cause_t cause;
    bool request_burst;  // ask the power policy for continuous SEN66 sampling
    bool fog_suspect;
    float pm_slope;      // ug/m3 per minute, NAN if not enough data
    float co_excess;     // ppm over baseline
    float co2_excess;    // ppm over baseline, NAN if unknown
    float co_co2_ratio;  // dCO/dCO2, NAN unless min_dco2 is met
} det_result_t;

// Defaults. sensitive = the app's opt-in "sensitive to smoke" toggle: lower thresholds.
det_config_t det_config_default(bool sensitive);
void det_init(det_state_t *s, const det_config_t *cfg);
det_result_t det_update(det_state_t *s, const det_sample_t *x);

// Least-squares slope of (t, v) in units per minute; NAN if fewer than 3 points or < 120 s span.
float det_slope_per_min(const uint32_t *t, const float *v, int n);

const char *det_level_name(det_level_t l);
const char *det_cause_name(det_cause_t c);

#ifdef __cplusplus
}
#endif
