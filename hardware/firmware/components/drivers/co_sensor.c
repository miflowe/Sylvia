// CO channel: SPEC 110-102 on an LMP91000 (3-lead amperometric, 350 kOhm TIA, external VREF, 20 % zero),
// read by an ADS1115: AIN0 = TIA output, AIN1 = VREF (ratiometric).
#include "board.h"
#include "drivers.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define TIMEOUT_MS 50

static i2c_master_dev_handle_t lmp, adc;

static esp_err_t add(i2c_master_bus_handle_t bus, uint8_t addr, i2c_master_dev_handle_t *dev)
{
    if (*dev) return ESP_OK;
    i2c_device_config_t cfg = {.dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = addr,
                               .scl_speed_hz = I2C_FREQ_HZ};
    return i2c_master_bus_add_device(bus, &cfg, dev);
}

static esp_err_t lmp_write(uint8_t reg, uint8_t val)
{
    uint8_t b[2] = {reg, val};
    return i2c_master_transmit(lmp, b, 2, TIMEOUT_MS);
}

esp_err_t co_init(i2c_master_bus_handle_t bus)
{
    esp_err_t err = add(bus, LMP91000_ADDR, &lmp);
    if (err == ESP_OK) err = add(bus, ADS1115_ADDR, &adc);
    if (err != ESP_OK) return err;
    // Wait for STATUS = ready, then unlock TIACN/REFCN, configure, lock again.
    for (int i = 0; i < 20; i++) {
        uint8_t reg = LMP91000_REG_STATUS, st = 0;
        if (i2c_master_transmit_receive(lmp, &reg, 1, &st, 1, TIMEOUT_MS) == ESP_OK && (st & 1)) break;
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    if ((err = lmp_write(LMP91000_REG_LOCK, 0x00)) != ESP_OK) return err;
    if ((err = lmp_write(LMP91000_REG_TIACN, LMP91000_TIACN_350K_10R)) != ESP_OK) return err;
    if ((err = lmp_write(LMP91000_REG_REFCN, LMP91000_REFCN_EXT_20PCT_0BIAS)) != ESP_OK) return err;
    if ((err = lmp_write(LMP91000_REG_MODECN, LMP91000_MODECN_3LEAD)) != ESP_OK) return err;
    return lmp_write(LMP91000_REG_LOCK, 0x01);
}

static esp_err_t ads_single(uint8_t ain, float *volts)
{
    uint16_t cfg = ads1115_config_single(ain, 0);  // 8 SPS: best noise, 125 ms conversion
    uint8_t w[3] = {0x01, (uint8_t)(cfg >> 8), (uint8_t)cfg};
    esp_err_t err = i2c_master_transmit(adc, w, 3, TIMEOUT_MS);
    if (err != ESP_OK) return err;
    vTaskDelay(pdMS_TO_TICKS(130));
    uint8_t reg = 0x00, r[2];
    err = i2c_master_transmit_receive(adc, &reg, 1, r, 2, TIMEOUT_MS);
    if (err == ESP_OK) *volts = ads1115_volts((int16_t)((r[0] << 8) | r[1]));
    return err;
}

esp_err_t co_read(i2c_master_bus_handle_t bus, const co_cal_t *cal, float temp_c, float *ppm, float *v_out)
{
    (void)bus;
    float vout, vref;
    esp_err_t err = ads_single(0, &vout);
    if (err == ESP_OK) err = ads_single(1, &vref);
    if (err != ESP_OK) return err;
    *v_out = vout;
    *ppm = co_ppm(vout, vref, cal->sens_na_per_ppm, cal->zero_offset_v, temp_c);
    return ESP_OK;
}
