#pragma once
#include <stdint.h>
#include "esp_err.h"
typedef enum { GPIO_NUM_0 = 0, GPIO_NUM_1, GPIO_NUM_2, GPIO_NUM_3, GPIO_NUM_4, GPIO_NUM_5, GPIO_NUM_6, GPIO_NUM_7,
  GPIO_NUM_8, GPIO_NUM_9, GPIO_NUM_10, GPIO_NUM_11, GPIO_NUM_12, GPIO_NUM_13, GPIO_NUM_14, GPIO_NUM_15, GPIO_NUM_16,
  GPIO_NUM_17, GPIO_NUM_18, GPIO_NUM_19, GPIO_NUM_20, GPIO_NUM_21, GPIO_NUM_38 = 38, GPIO_NUM_39, GPIO_NUM_40,
  GPIO_NUM_41, GPIO_NUM_42, GPIO_NUM_47 = 47, GPIO_NUM_48 } gpio_num_t;
typedef enum { GPIO_MODE_INPUT = 1, GPIO_MODE_OUTPUT = 2 } gpio_mode_t;
typedef struct { uint64_t pin_bit_mask; gpio_mode_t mode; int pull_up_en; int pull_down_en; int intr_type; } gpio_config_t;
esp_err_t gpio_config(const gpio_config_t *cfg);
esp_err_t gpio_set_direction(gpio_num_t n, gpio_mode_t m);
esp_err_t gpio_set_level(gpio_num_t n, uint32_t level);
int gpio_get_level(gpio_num_t n);
esp_err_t gpio_reset_pin(gpio_num_t n);
esp_err_t gpio_hold_en(gpio_num_t n);
esp_err_t gpio_hold_dis(gpio_num_t n);
