// RAK3172 (RUI3 firmware) over UART1, AT commands. Class A, OTAA, US915 sub-band 2 (channels 8-15 + 65).
// RAK keeps keys and the join session in its own flash; AT+SEND payloads are hex.
#include <stdio.h>
#include <string.h>

#include "board.h"
#include "driver/uart.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "net.h"

static const char *TAG = "lorawan";
static bool uart_ready;

static esp_err_t at(const char *cmd, const char *expect, char *resp, size_t rlen, uint32_t timeout_ms)
{
    char line[256];
    uart_flush_input(LORA_UART_NUM);
    uart_write_bytes(LORA_UART_NUM, cmd, strlen(cmd));
    uart_write_bytes(LORA_UART_NUM, "\r\n", 2);
    size_t used = 0;
    TickType_t end = xTaskGetTickCount() + pdMS_TO_TICKS(timeout_ms);
    while (xTaskGetTickCount() < end && used < sizeof line - 1) {
        int n = uart_read_bytes(LORA_UART_NUM, (uint8_t *)line + used, sizeof line - 1 - used, pdMS_TO_TICKS(50));
        if (n > 0) {
            used += n;
            line[used] = 0;
            if (strstr(line, expect)) {
                if (resp) snprintf(resp, rlen, "%s", line);
                return ESP_OK;
            }
            if (strstr(line, "AT_ERROR") || strstr(line, "AT_PARAM_ERROR") || strstr(line, "AT_BUSY_ERROR")) break;
        }
    }
    ESP_LOGW(TAG, "%s -> %s", cmd, used ? line : "(no reply)");
    return ESP_FAIL;
}

static void uart_init(void)
{
    if (uart_ready) return;
    uart_config_t cfg = {.baud_rate = LORA_UART_BAUD, .data_bits = UART_DATA_8_BITS, .parity = UART_PARITY_DISABLE,
                         .stop_bits = UART_STOP_BITS_1, .flow_ctrl = UART_HW_FLOWCTRL_DISABLE};
    uart_driver_install(LORA_UART_NUM, 1024, 0, 0, NULL, 0);
    uart_param_config(LORA_UART_NUM, &cfg);
    uart_set_pin(LORA_UART_NUM, PIN_LORA_TX, PIN_LORA_RX, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);
    gpio_set_direction(PIN_LORA_BOOT0, GPIO_MODE_OUTPUT);
    gpio_set_level(PIN_LORA_BOOT0, 0);
    uart_ready = true;
}

esp_err_t lorawan_init(const node_creds_t *c)
{
    uart_init();
    char cmd[80];
    if (at("AT", "OK", NULL, 0, 500) != ESP_OK) return ESP_ERR_NOT_FOUND;
    at("AT+NWM=1", "OK", NULL, 0, 1000);   // LoRaWAN mode
    at("AT+NJM=1", "OK", NULL, 0, 500);    // OTAA
    at("AT+CLASS=A", "OK", NULL, 0, 500);
    at("AT+BAND=5", "OK", NULL, 0, 500);   // US915
    at("AT+MASK=0002", "OK", NULL, 0, 500);  // sub-band 2 (TTN / Helium US915)
    at("AT+ADR=1", "OK", NULL, 0, 500);
    snprintf(cmd, sizeof cmd, "AT+DEVEUI=%s", c->lora_deveui);
    at(cmd, "OK", NULL, 0, 500);
    snprintf(cmd, sizeof cmd, "AT+APPEUI=%s", c->lora_joineui);
    at(cmd, "OK", NULL, 0, 500);
    snprintf(cmd, sizeof cmd, "AT+APPKEY=%s", c->lora_appkey);
    return at(cmd, "OK", NULL, 0, 500);
}

static esp_err_t ensure_joined(void)
{
    char resp[64];
    if (at("AT+NJS=?", "OK", resp, sizeof resp, 500) == ESP_OK && strstr(resp, "1")) return ESP_OK;
    if (at("AT+JOIN=1:0:10:8", "OK", NULL, 0, 1000) != ESP_OK) return ESP_FAIL;
    // RUI3 reports "+EVT:JOINED" asynchronously; give it up to ~30 s (several join attempts).
    char line[128] = {0};
    TickType_t end = xTaskGetTickCount() + pdMS_TO_TICKS(30000);
    while (xTaskGetTickCount() < end) {
        int n = uart_read_bytes(LORA_UART_NUM, (uint8_t *)line, sizeof line - 1, pdMS_TO_TICKS(500));
        if (n > 0) {
            line[n] = 0;
            if (strstr(line, "JOINED")) return ESP_OK;
        }
    }
    return ESP_ERR_TIMEOUT;
}

esp_err_t lorawan_send(uint8_t fport, const uint8_t *data, size_t len, uint32_t timeout_ms)
{
    uart_init();
    if (ensure_joined() != ESP_OK) return ESP_ERR_INVALID_STATE;
    char cmd[16 + 2 * 64];
    int n = snprintf(cmd, sizeof cmd, "AT+SEND=%u:", fport);
    for (size_t i = 0; i < len && n < (int)sizeof cmd - 3; i++) n += snprintf(cmd + n, sizeof cmd - n, "%02X", data[i]);
    return at(cmd, "+EVT:TX_DONE", NULL, 0, timeout_ms);
}

esp_err_t lorawan_sleep(void)
{
    // RUI3 sleeps automatically between commands (~1.7 uA); nothing to do but keep UART idle.
    return ESP_OK;
}
