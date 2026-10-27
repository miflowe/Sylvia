// Host stub: just enough of ESP-IDF v5.4 for a syntax/type check of the drivers. NOT a real build.
#pragma once
#include <stdint.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_TIMEOUT 0x107
#define ESP_ERR_NOT_FOUND 0x105
#define ESP_ERR_NOT_SUPPORTED 0x106
#define ESP_ERR_INVALID_STATE 0x103
#define ESP_ERR_INVALID_CRC 0x109
const char *esp_err_to_name(esp_err_t code);
