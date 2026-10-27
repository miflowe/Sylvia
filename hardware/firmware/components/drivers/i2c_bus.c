#include "board.h"
#include "drivers.h"

static esp_err_t new_bus(i2c_port_num_t port, gpio_num_t sda, gpio_num_t scl, i2c_master_bus_handle_t *out)
{
    i2c_master_bus_config_t cfg = {
        .i2c_port = port,
        .sda_io_num = sda,
        .scl_io_num = scl,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = false,  // external 4.7 k on both buses
    };
    return i2c_new_master_bus(&cfg, out);
}

esp_err_t i2c_bus_init(node_i2c_t *b)
{
    esp_err_t err = new_bus(I2C_NUM_0, PIN_I2C0_SDA, PIN_I2C0_SCL, &b->bus0);
    if (err != ESP_OK) return err;
    return new_bus(I2C_NUM_1, PIN_I2C1_SDA, PIN_I2C1_SCL, &b->bus1);
}

esp_err_t i2c_bus_release_bus1(node_i2c_t *b)
{
    // The SEN66 pull-ups sit on the switched rail: with the rail off, SDA/SCL must not be driven.
    sen66_detach();  // the bus can only be deleted with no devices attached
    esp_err_t err = i2c_del_master_bus(b->bus1);
    b->bus1 = NULL;
    gpio_reset_pin(PIN_I2C1_SDA);
    gpio_reset_pin(PIN_I2C1_SCL);
    gpio_set_direction(PIN_I2C1_SDA, GPIO_MODE_INPUT);
    gpio_set_direction(PIN_I2C1_SCL, GPIO_MODE_INPUT);
    return err;
}
