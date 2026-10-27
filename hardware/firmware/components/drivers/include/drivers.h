// Sylvia Node sensor and power drivers (ESP-IDF v5.4+ i2c_master API).
// Pure conversions live in components/sensor_math (host-tested); this layer only moves bytes.
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "driver/i2c_master.h"
#include "esp_err.h"
#include "sensor_math.h"

typedef struct {
    i2c_master_bus_handle_t bus0;  // on-board
    i2c_master_bus_handle_t bus1;  // SEN66 cable
} node_i2c_t;

esp_err_t i2c_bus_init(node_i2c_t *buses);
esp_err_t i2c_bus_release_bus1(node_i2c_t *buses);  // before LS1 off: pins become inputs, no back-feed

// ---- SEN66 on I2C1 (power via LS1) ----
void sen66_detach(void);                         // before deleting bus 1
esp_err_t sen66_power(bool on);                  // drives PIN_EN_SEN + gpio hold for deep sleep
esp_err_t sen66_start(i2c_master_bus_handle_t bus);
esp_err_t sen66_stop(i2c_master_bus_handle_t bus);
esp_err_t sen66_data_ready(i2c_master_bus_handle_t bus, bool *ready);
esp_err_t sen66_read(i2c_master_bus_handle_t bus, sen66_values_t *out);
esp_err_t sen66_set_pressure(i2c_master_bus_handle_t bus, float hpa);  // improves CO2 accuracy

// ---- CO: LMP91000 + ADS1115 on I2C0 ----
typedef struct {
    float sens_na_per_ppm;  // from the sensor label (factory NVS "co_sens"), default 4.75
    float zero_offset_v;    // clean-air offset from commissioning (NVS "co_zero"), default 0
} co_cal_t;
esp_err_t co_init(i2c_master_bus_handle_t bus);  // LMP91000: unlock, 350k/10R, ext ref 20 %, 3-lead
esp_err_t co_read(i2c_master_bus_handle_t bus, const co_cal_t *cal, float temp_c, float *ppm, float *v_out);

// ---- MAX17048 fuel gauge on I2C0 ----
esp_err_t max17048_init(i2c_master_bus_handle_t bus, uint8_t alert_soc_pct);
esp_err_t max17048_read(i2c_master_bus_handle_t bus, float *vcell, float *soc_pct);

// ---- BME688 on I2C0 (Bosch BME68x SensorAPI, BSD-3-Clause, vendored into components/bme68x) ----
typedef struct {
    float temp_c, rh, pressure_hpa, gas_kohm;
    bool gas_valid;
} bme688_reading_t;
esp_err_t bme688_init(i2c_master_bus_handle_t bus);
esp_err_t bme688_forced(bme688_reading_t *out);  // one forced-mode cycle, heater 320 C / 150 ms

// ---- Charger GPIOs ----
typedef enum { CHG_OFF = 0, CHG_CHARGING, CHG_DONE, CHG_FAULT } chg_state_t;
void charger_init(void);
chg_state_t charger_state(void);
void charger_inhibit(bool inhibit);
bool usb_present(void);
