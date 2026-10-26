#include "detect.h"

#include <math.h>
#include <string.h>

// Held SEN66 values count as current for this long (covers the 15 min saver period).
#define PM_HOLD_S 1200u
// Clean outdoor air: CO ~0.1-0.5 ppm, CO2 ~420 ppm. Clamping the baselines means a node that
// boots inside a smoke plume still sees the excess instead of learning the plume as "normal".
#define BASE_CO_MAX 2.0f
#define BASE_CO2_MAX 600.0f

det_config_t det_config_default(bool sensitive)
{
    det_config_t c = {
        .pm_watch = 35.0f,
        .pm_alert = 55.5f,
        .pm_slope_spike = 5.0f,
        .co_watch = 5.0f,
        .co_alert = 15.0f,
        .co_trigger = 3.0f,
        .co_slope_trigger = 0.5f,
        .gas_drop_trigger = 0.30f,
        .min_dco2 = 30.0f,
        .ratio_smoulder = 0.06f,
        .ratio_flaming = 0.03f,
        .fog_rh = 95.0f,
        .slope_window_s = 900,
        .baseline_tau_s = 6 * 3600,
        .confirm = 2,
        .clear = 5,
    };
    if (sensitive) {
        c.pm_watch *= 0.6f;
        c.pm_alert *= 0.6f;
        c.co_watch *= 0.6f;
        c.co_alert *= 0.6f;
    }
    return c;
}

void det_init(det_state_t *s, const det_config_t *cfg)
{
    memset(s, 0, sizeof(*s));
    s->cfg = *cfg;
    s->last_pm = NAN;
    s->last_co2 = NAN;
}

float det_slope_per_min(const uint32_t *t, const float *v, int n)
{
    if (n < 3) {
        return NAN;
    }
    uint32_t t0 = t[0], tmin = t[0], tmax = t[0];
    for (int i = 1; i < n; i++) {
        if (t[i] < tmin) tmin = t[i];
        if (t[i] > tmax) tmax = t[i];
    }
    if (tmax - tmin < 120) {
        return NAN;
    }
    double sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (int i = 0; i < n; i++) {
        double x = ((double)t[i] - (double)t0) / 60.0;
        sx += x;
        sy += v[i];
        sxx += x * x;
        sxy += x * v[i];
    }
    double den = n * sxx - sx * sx;
    if (fabs(den) < 1e-9) {
        return NAN;
    }
    return (float)((n * sxy - sx * sy) / den);
}

static float ema(float base, float x, uint32_t dt, uint32_t tau)
{
    if (dt == 0) dt = 1;
    float a = (float)dt / (float)(tau + dt);
    return base + a * (x - base);
}

// Collect the PM points inside the slope window, newest last.
static int pm_window(const det_state_t *s, uint32_t now, uint32_t *t, float *v)
{
    int n = 0;
    for (int i = 0; i < s->pm_n; i++) {
        int idx = (s->pm_head + DET_PM_HIST - s->pm_n + i) % DET_PM_HIST;
        if (now - s->pm_t[idx] <= s->cfg.slope_window_s) {
            t[n] = s->pm_t[idx];
            v[n] = s->pm_v[idx];
            n++;
        }
    }
    return n;
}

static float co_slope(const det_state_t *s)
{
    uint32_t t[DET_CO_HIST];
    float v[DET_CO_HIST];
    for (int i = 0; i < s->co_n; i++) {
        int idx = (s->co_head + DET_CO_HIST - s->co_n + i) % DET_CO_HIST;
        t[i] = s->co_t[idx];
        v[i] = s->co_v[idx];
    }
    return det_slope_per_min(t, v, s->co_n);
}

det_result_t det_update(det_state_t *s, const det_sample_t *x)
{
    const det_config_t *c = &s->cfg;
    det_result_t r = {.pm_slope = NAN, .co2_excess = NAN, .co_co2_ratio = NAN};
    uint32_t dt = s->have_base ? x->t_s - s->last_t : 0;

    bool fresh_pm = !isnan(x->pm25);
    bool fresh_co = !isnan(x->co);
    if (fresh_pm) {
        s->pm_t[s->pm_head] = x->t_s;
        s->pm_v[s->pm_head] = x->pm25;
        s->pm_head = (s->pm_head + 1) % DET_PM_HIST;
        if (s->pm_n < DET_PM_HIST) s->pm_n++;
        s->last_pm = x->pm25;
        s->last_pm_t = x->t_s;
    }
    if (!isnan(x->co2)) {
        s->last_co2 = x->co2;
    }
    if (fresh_co) {
        s->co_t[s->co_head] = x->t_s;
        s->co_v[s->co_head] = x->co;
        s->co_head = (s->co_head + 1) % DET_CO_HIST;
        if (s->co_n < DET_CO_HIST) s->co_n++;
    }

    // First valid values seed the baselines.
    if (!s->have_base && fresh_co) {
        s->base_co = fminf(x->co, BASE_CO_MAX);
        s->have_base = true;
    }
    if (!s->base_pm_ok && fresh_pm) {
        s->base_pm = x->pm25;
        s->base_pm_ok = true;
    }
    if (!s->base_co2_ok && !isnan(x->co2)) {
        s->base_co2 = fminf(x->co2, BASE_CO2_MAX);
        s->base_co2_ok = true;
    }
    if (!s->base_gas_ok && !isnan(x->gas_kohm) && x->gas_kohm > 0) {
        s->base_gas = x->gas_kohm;
        s->base_gas_ok = true;
    }

    bool pm_held = !isnan(s->last_pm) && (x->t_s - s->last_pm_t) <= PM_HOLD_S;
    float pm = pm_held ? s->last_pm : NAN;

    uint32_t wt[DET_PM_HIST];
    float wv[DET_PM_HIST];
    int wn = pm_window(s, x->t_s, wt, wv);
    r.pm_slope = det_slope_per_min(wt, wv, wn);

    r.co_excess = (fresh_co && s->have_base) ? x->co - s->base_co : 0.0f;
    float co_rate = co_slope(s);
    if (pm_held && s->base_co2_ok && !isnan(s->last_co2)) {
        r.co2_excess = s->last_co2 - s->base_co2;
    }
    float gas_drop = 0.0f;
    if (!isnan(x->gas_kohm) && s->base_gas_ok && s->base_gas > 0) {
        gas_drop = 1.0f - x->gas_kohm / s->base_gas;
    }

    // Fog/mist makes optical PM read high. Without CO or gas corroboration, PM-only rises at
    // very high humidity are not escalated.
    bool corroborated = r.co_excess >= c->co_trigger || gas_drop >= c->gas_drop_trigger;
    r.fog_suspect = !isnan(x->rh) && x->rh >= c->fog_rh && !corroborated;

    bool pm_spike = !isnan(r.pm_slope) && r.pm_slope >= c->pm_slope_spike && pm_held && pm >= c->pm_watch * 0.5f;
    bool pm_ok = pm_held && !r.fog_suspect;

    // Raw level from this evaluation, and whether fresh evidence supports it.
    det_level_t raw = DET_LEVEL_NONE;
    bool pm_watch = pm_ok && (pm >= c->pm_watch || pm_spike);
    bool pm_alert = pm_ok && pm >= c->pm_alert;
    bool co_watch = fresh_co && r.co_excess >= c->co_watch;
    bool co_alert = fresh_co && r.co_excess >= c->co_alert;
    if (pm_watch || co_watch) raw = DET_LEVEL_WATCH;
    if (pm_alert || co_alert) raw = DET_LEVEL_ALERT;
    // Two independent sensors agreeing is an alert on its own: a CO rise plus either a PM spike or a
    // BME688 gas-resistance drop (the second case still works when the SEN66 is parked in the cold).
    bool agree = co_watch && ((pm_ok && pm_spike) || gas_drop >= c->gas_drop_trigger);
    if (agree) raw = DET_LEVEL_ALERT;
    bool fresh_evidence = (fresh_pm && (pm_watch || pm_alert)) || (fresh_co && (co_watch || co_alert));

    if (raw > s->level) {
        s->quiet_count = 0;
        if (fresh_evidence) s->up_count++;
        if (agree || s->up_count >= c->confirm) {
            s->level = raw;
            s->up_count = 0;
        }
    } else if (raw < s->level) {
        s->up_count = 0;
        if (++s->quiet_count >= c->clear) {
            s->level = raw;
            s->quiet_count = 0;
            if (raw == DET_LEVEL_NONE) s->cause = DET_CAUSE_UNKNOWN;
        }
    } else {
        s->up_count = 0;
        s->quiet_count = 0;
    }

    // Cause hint from the excess CO / excess CO2 ratio (inverse of combustion efficiency).
    if (!isnan(r.co2_excess) && r.co2_excess >= c->min_dco2 && fresh_co && r.co_excess >= 0.5f) {
        r.co_co2_ratio = r.co_excess / r.co2_excess;
    }
    det_cause_t cause = DET_CAUSE_UNKNOWN;
    if (!isnan(r.co_co2_ratio)) {
        if (r.co_co2_ratio >= c->ratio_smoulder) cause = DET_CAUSE_SMOULDER;
        else if (r.co_co2_ratio <= c->ratio_flaming) cause = DET_CAUSE_FLAMING;
    } else if (pm_ok && s->base_pm_ok && pm - s->base_pm >= c->pm_watch * 0.5f &&
               (isnan(r.co2_excess) || r.co2_excess < c->min_dco2) && r.co_excess < c->co_watch &&
               !pm_spike) {
        cause = DET_CAUSE_REGIONAL;
    }
    if (s->level > DET_LEVEL_NONE && cause != DET_CAUSE_UNKNOWN) {
        // Local combustion evidence outranks the regional label once seen.
        if (!(cause == DET_CAUSE_REGIONAL && (s->cause == DET_CAUSE_SMOULDER || s->cause == DET_CAUSE_FLAMING))) {
            s->cause = cause;
        }
    }

    r.request_burst = r.co_excess >= c->co_trigger || (!isnan(co_rate) && co_rate >= c->co_slope_trigger) ||
                      gas_drop >= c->gas_drop_trigger || pm_spike;

    // Baselines learn only in quiet conditions.
    if (s->level == DET_LEVEL_NONE && !r.request_burst && raw == DET_LEVEL_NONE) {
        if (fresh_co && s->have_base) s->base_co = fminf(ema(s->base_co, x->co, dt, c->baseline_tau_s), BASE_CO_MAX);
        if (fresh_pm) s->base_pm = ema(s->base_pm, x->pm25, dt, c->baseline_tau_s);
        if (!isnan(x->co2)) s->base_co2 = fminf(ema(s->base_co2, x->co2, dt, c->baseline_tau_s), BASE_CO2_MAX);
        if (!isnan(x->gas_kohm) && x->gas_kohm > 0) s->base_gas = ema(s->base_gas, x->gas_kohm, dt, c->baseline_tau_s);
    }

    s->last_t = x->t_s;
    r.level = s->level;
    r.cause = s->level > DET_LEVEL_NONE ? s->cause : DET_CAUSE_UNKNOWN;
    return r;
}

const char *det_level_name(det_level_t l)
{
    switch (l) {
    case DET_LEVEL_WATCH: return "watch";
    case DET_LEVEL_ALERT: return "alert";
    default: return "none";
    }
}

const char *det_cause_name(det_cause_t c)
{
    switch (c) {
    case DET_CAUSE_SMOULDER: return "smoulder";
    case DET_CAUSE_FLAMING: return "flaming";
    case DET_CAUSE_REGIONAL: return "regional";
    default: return "unknown";
    }
}
