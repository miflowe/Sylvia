// MAX17048 ModelGauge (0x36). VCELL 78.125 uV/LSB, SOC 1/256 % per LSB.
// LiFePO4 note: the default model targets Li-ion; ModelGauge voltage-based SoC is coarse on LiFePO4's flat
// curve. The power policy also uses charge state and time without charge, not SoC alone.
#include "drivers.h"
#include "board.h"

#define ADDR 0x36
#define REG_VCELL 0x02
#define REG_SOC 0x04
#define REG_CONFIG 0x0C
#define TIMEOUT_MS 50

static i2c_master_dev_handle_t dev;

static esp_err_t rd16(uint8_t reg, uint16_t *v)
{
    uint8_t r[2];
    esp_err_t err = i2c_master_transmit_receive(dev, &reg, 1, r, 2, TIMEOUT_MS);
    *v = (uint16_t)((r[0] << 8) | r[1]);
    return err;
}

esp_err_t max17048_init(i2c_master_bus_handle_t bus, uint8_t alert_soc_pct)
{
    if (!dev) {
        i2c_device_config_t cfg = {.dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = ADDR,
                                   .scl_speed_hz = I2C_FREQ_HZ};
        esp_err_t err = i2c_master_bus_add_device(bus, &cfg, &dev);
        if (err != ESP_OK) return err;
    }
    uint16_t c;
    esp_err_t err = rd16(REG_CONFIG, &c);
    if (err != ESP_OK) return err;
    // CONFIG low byte: ALRT[5] cleared, ATHD[4:0] = 32 - threshold %.
    uint8_t athd = (uint8_t)(32 - (alert_soc_pct > 32 ? 32 : alert_soc_pct)) & 0x1F;
    c = (uint16_t)((c & 0xFF00) | athd);
    uint8_t w[3] = {REG_CONFIG, (uint8_t)(c >> 8), (uint8_t)c};
    return i2c_master_transmit(dev, w, 3, TIMEOUT_MS);
}

esp_err_t max17048_read(i2c_master_bus_handle_t bus, float *vcell, float *soc_pct)
{
    (void)bus;
    uint16_t v, s;
    esp_err_t err = rd16(REG_VCELL, &v);
    if (err == ESP_OK) err = rd16(REG_SOC, &s);
    if (err != ESP_OK) return err;
    *vcell = v * 78.125e-6f;
    *soc_pct = s / 256.0f;
    return ESP_OK;
}
