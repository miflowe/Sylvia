// Sampling/radio schedule from battery state, sun and weather. Pure C, host-testable.
//
// Budget behind the numbers: docs/power-budget.md (1S2P LiFePO4, ~3000 mAh).
// NORMAL  SEN66 35 s burst every 5 min, Wi-Fi batch every 5 min   (~349 mAh/day)
// SAVER   every 15 min                                             (~124 mAh/day)
// CRITICAL SEN66 off, uplink hourly, CO + BME688 keep running      (~15 mAh/day)
// BURST   SEN66 continuous while the detector asks, capped per hour
#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    PWR_NORMAL = 0,
    PWR_SAVER = 1,
    PWR_CRITICAL = 2,
    PWR_BURST = 3,
} pwr_mode_t;

typedef struct {
    float soc_pct;            // MAX17048 state of charge
    bool charging;            // BQ24650 STAT says charging
    uint32_t s_since_charge;  // seconds since charging was last seen
    float temp_c;             // BME688 temperature, NAN if unknown
    float rh;                 // BME688 humidity, NAN if unknown
    bool burst_requested;     // detector wants continuous SEN66 sampling
    uint32_t burst_used_s;    // SEN66 burst seconds used in the current hour
    bool alert_active;        // detector level >= WATCH
} pwr_input_t;

typedef struct {
    pwr_mode_t mode;
    uint32_t sen66_period_s;  // 0 = continuous (burst); UINT32_MAX = off
    uint32_t uplink_period_s; // Wi-Fi/LoRa batch period
    bool sen66_allowed;       // temperature / humidity inside the SEN66 limits
    bool sen66_degraded;      // allowed, but outside the 10-40 C recommended range
    bool uplink_now;          // send immediately (alert started or changed)
} pwr_output_t;

#define PWR_SEN66_OFF UINT32_MAX
#define PWR_BURST_CAP_S 600u        // max SEN66 burst seconds per hour
#define PWR_SAVER_AFTER_S (24u * 3600u)

pwr_output_t pwr_decide(const pwr_input_t *in);
const char *pwr_mode_name(pwr_mode_t m);

#ifdef __cplusplus
}
#endif
