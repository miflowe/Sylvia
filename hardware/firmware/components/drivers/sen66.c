// SEN66 over I2C (datasheet v1.0 sec. 4). 16-bit command, then wait the execution time, then read.
// The sensor NACKs while busy (no clock stretching), so every command waits its full execution time.
#include "board.h"
#include "drivers.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "payload.h"

#define TIMEOUT_MS 50

static i2c_master_bus_handle_t cached_bus;
static i2c_master_dev_handle_t dev;

void sen66_detach(void)
{
    if (dev) i2c_master_bus_rm_device(dev);
    dev = NULL;
    cached_bus = NULL;
}

static i2c_master_dev_handle_t dev_for(i2c_master_bus_handle_t bus)
{
    if (bus != cached_bus) {
        i2c_device_config_t cfg = {.dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = SEN66_ADDR,
                                   .scl_speed_hz = I2C_FREQ_HZ};
        if (i2c_master_bus_add_device(bus, &cfg, &dev) != ESP_OK) return NULL;
        cached_bus = bus;
    }
    return dev;
}

static esp_err_t cmd(i2c_master_bus_handle_t bus, uint16_t c, const uint16_t *args, int nargs, int exec_ms)
{
    uint8_t buf[2 + 3 * 4];
    buf[0] = (uint8_t)(c >> 8);
    buf[1] = (uint8_t)c;
    int n = 2;
    for (int i = 0; i < nargs; i++) {
        buf[n] = (uint8_t)(args[i] >> 8);
        buf[n + 1] = (uint8_t)args[i];
        buf[n + 2] = sensirion_crc8(&buf[n], 2);
        n += 3;
    }
    esp_err_t err = i2c_master_transmit(dev_for(bus), buf, n, TIMEOUT_MS);
    vTaskDelay(pdMS_TO_TICKS(exec_ms));
    return err;
}

esp_err_t sen66_power(bool on)
{
    gpio_hold_dis(PIN_EN_SEN);
    gpio_set_direction(PIN_EN_SEN, GPIO_MODE_OUTPUT);
    gpio_set_level(PIN_EN_SEN, on);
    gpio_hold_en(PIN_EN_SEN);  // keeps the rail state through deep sleep (burst mode)
    if (on) vTaskDelay(pdMS_TO_TICKS(110));  // SEN6x communication start-up time 100 ms
    return ESP_OK;
}

esp_err_t sen66_start(i2c_master_bus_handle_t bus) { return cmd(bus, SEN66_CMD_START, NULL, 0, 50); }
esp_err_t sen66_stop(i2c_master_bus_handle_t bus) { return cmd(bus, SEN66_CMD_STOP, NULL, 0, 1400); }

esp_err_t sen66_set_pressure(i2c_master_bus_handle_t bus, float hpa)
{
    uint16_t v = (uint16_t)(hpa + 0.5f);
    return cmd(bus, SEN66_CMD_SET_PRESSURE, &v, 1, 20);
}

esp_err_t sen66_data_ready(i2c_master_bus_handle_t bus, bool *ready)
{
    uint8_t rx[3];
    esp_err_t err = cmd(bus, SEN66_CMD_DATA_READY, NULL, 0, 20);
    if (err == ESP_OK) err = i2c_master_receive(dev_for(bus), rx, sizeof rx, TIMEOUT_MS);
    if (err != ESP_OK) return err;
    if (sensirion_crc8(rx, 2) != rx[2]) return ESP_ERR_INVALID_CRC;
    *ready = rx[1] == 0x01;
    return ESP_OK;
}

esp_err_t sen66_read(i2c_master_bus_handle_t bus, sen66_values_t *out)
{
    uint8_t rx[SEN66_FRAME_LEN];
    esp_err_t err = cmd(bus, SEN66_CMD_READ_VALUES, NULL, 0, 20);
    if (err == ESP_OK) err = i2c_master_receive(dev_for(bus), rx, sizeof rx, TIMEOUT_MS);
    if (err != ESP_OK) return err;
    return sen66_parse(rx, out) ? ESP_OK : ESP_ERR_INVALID_CRC;
}
