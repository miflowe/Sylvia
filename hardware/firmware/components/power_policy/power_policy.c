#include "power_policy.h"

#include <math.h>

// SEN66 datasheet (v1.0, Oct 2026): recommended 10..40 C, short-term -10..50 C, never condensing.
#define SEN66_T_MIN -10.0f
#define SEN66_T_MAX 50.0f
#define SEN66_T_REC_MIN 10.0f
#define SEN66_T_REC_MAX 40.0f
#define SEN66_RH_MAX 95.0f

#define SOC_CRITICAL 10.0f
#define SOC_SAVER 40.0f
#define SOC_BURST_MIN 15.0f

pwr_output_t pwr_decide(const pwr_input_t *in)
{
    pwr_output_t o = {0};

    bool t_known = !isnan(in->temp_c);
    o.sen66_allowed = !t_known || (in->temp_c >= SEN66_T_MIN && in->temp_c <= SEN66_T_MAX);
    if (!isnan(in->rh) && in->rh >= SEN66_RH_MAX) {
        o.sen66_allowed = false;  // condensation risk
    }
    o.sen66_degraded = o.sen66_allowed && t_known && (in->temp_c < SEN66_T_REC_MIN || in->temp_c > SEN66_T_REC_MAX);

    if (in->soc_pct < SOC_CRITICAL && !in->charging) {
        o.mode = PWR_CRITICAL;
        o.sen66_period_s = PWR_SEN66_OFF;
        o.uplink_period_s = 3600;
    } else if (in->burst_requested && o.sen66_allowed && in->soc_pct >= SOC_BURST_MIN &&
               in->burst_used_s < PWR_BURST_CAP_S) {
        o.mode = PWR_BURST;
        o.sen66_period_s = 0;
        o.uplink_period_s = 60;
    } else if (in->soc_pct < SOC_SAVER || (!in->charging && in->s_since_charge >= PWR_SAVER_AFTER_S)) {
        o.mode = PWR_SAVER;
        o.sen66_period_s = 900;
        o.uplink_period_s = 900;
    } else {
        o.mode = PWR_NORMAL;
        o.sen66_period_s = 300;
        o.uplink_period_s = 300;
    }

    if (!o.sen66_allowed) {
        o.sen66_period_s = PWR_SEN66_OFF;
    }
    // An active advisory is always reported promptly, even in CRITICAL (a few uplinks are cheap).
    if (in->alert_active && o.uplink_period_s > 300) {
        o.uplink_period_s = 300;
    }
    o.uplink_now = in->alert_active && in->burst_requested;
    return o;
}

const char *pwr_mode_name(pwr_mode_t m)
{
    switch (m) {
    case PWR_SAVER: return "saver";
    case PWR_CRITICAL: return "critical";
    case PWR_BURST: return "burst";
    default: return "normal";
    }
}
