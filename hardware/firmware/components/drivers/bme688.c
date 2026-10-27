// BME688 via Bosch's BME68x SensorAPI (BSD-3-Clause). Vendor it into components/bme68x/ (bme68x.c,
// bme68x.h, bme68x_defs.h + a CMakeLists) from github.com/boschsensortec/BME68x_SensorAPI: that download
// is listed as batch 2 in parts/download-batch-1.md and needs approval. Until then this builds as a stub.
#include "board.h"
#include "drivers.h"

#if __has_include("bme68x.h")
#include "bme68x.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static i2c_master_dev_handle_t dev;
static struct bme68x_dev bme;

static BME68X_INTF_RET_TYPE rd(uint8_t reg, uint8_t *data, uint32_t len, void *intf)
{
    (void)intf;
    return i2c_master_transmit_receive(dev, &reg, 1, data, len, 50) == ESP_OK ? 0 : -1;
}

static BME68X_INTF_RET_TYPE wr(uint8_t reg, const uint8_t *data, uint32_t len, void *intf)
{
    (void)intf;
    uint8_t buf[32];
    if (len + 1 > sizeof buf) return -1;
    buf[0] = reg;
    for (uint32_t i = 0; i < len; i++) buf[i + 1] = data[i];
    return i2c_master_transmit(dev, buf, len + 1, 50) == ESP_OK ? 0 : -1;
}

static void delay_us(uint32_t us, void *intf)
{
    (void)intf;
    vTaskDelay(pdMS_TO_TICKS((us + 999) / 1000));
}

esp_err_t bme688_init(i2c_master_bus_handle_t bus)
{
    i2c_device_config_t cfg = {.dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = 0x76,
                               .scl_speed_hz = I2C_FREQ_HZ};
    if (i2c_master_bus_add_device(bus, &cfg, &dev) != ESP_OK) return ESP_FAIL;
    bme.intf = BME68X_I2C_INTF;
    bme.read = rd;
    bme.write = wr;
    bme.delay_us = delay_us;
    bme.amb_temp = 20;
    if (bme68x_init(&bme) != BME68X_OK) return ESP_FAIL;
    struct bme68x_conf conf = {.os_hum = BME68X_OS_1X, .os_pres = BME68X_OS_4X, .os_temp = BME68X_OS_2X,
                               .filter = BME68X_FILTER_OFF, .odr = BME68X_ODR_NONE};
    struct bme68x_heatr_conf heat = {.enable = BME68X_ENABLE, .heatr_temp = 320, .heatr_dur = 150};
    if (bme68x_set_conf(&conf, &bme) != BME68X_OK) return ESP_FAIL;
    return bme68x_set_heatr_conf(BME68X_FORCED_MODE, &heat, &bme) == BME68X_OK ? ESP_OK : ESP_FAIL;
}

esp_err_t bme688_forced(bme688_reading_t *out)
{
    struct bme68x_data d;
    uint8_t n = 0;
    if (bme68x_set_op_mode(BME68X_FORCED_MODE, &bme) != BME68X_OK) return ESP_FAIL;
    struct bme68x_conf conf;
    bme68x_get_conf(&conf, &bme);
    uint32_t wait_us = bme68x_get_meas_dur(BME68X_FORCED_MODE, &conf, &bme) + 150 * 1000;
    delay_us(wait_us, NULL);
    if (bme68x_get_data(BME68X_FORCED_MODE, &d, &n, &bme) != BME68X_OK || n == 0) return ESP_FAIL;
    out->temp_c = d.temperature;
    out->rh = d.humidity;
    out->pressure_hpa = d.pressure / 100.0f;
    out->gas_kohm = d.gas_resistance / 1000.0f;
    out->gas_valid = (d.status & BME68X_GASM_VALID_MSK) && (d.status & BME68X_HEAT_STAB_MSK);
    return ESP_OK;
}

#else  // Bosch API not vendored yet

esp_err_t bme688_init(i2c_master_bus_handle_t bus)
{
    (void)bus;
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t bme688_forced(bme688_reading_t *out)
{
    (void)out;
    return ESP_ERR_NOT_SUPPORTED;
}

#endif
