// Connectivity: Wi-Fi MQTT to Azure IoT Hub (primary), LoRaWAN via RAK3172 (fallback), OTA.
// Per-device credentials come from the "fctry" NVS partition written by tools/provision.py:
// nothing secret is compiled in or committed.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

typedef struct {
    char device_id[64];   // IoT Hub device id, e.g. "sylvia-node-0001"
    char hub_host[96];    // "<hub>.azure-devices.net"
    char wifi_ssid[33];
    char wifi_pass[65];
    char *client_cert;    // PEM, X.509 (thumbprint-registered in IoT Hub)
    char *client_key;     // PEM, private key: never leaves the device
    char lora_deveui[17]; // hex
    char lora_joineui[17];
    char lora_appkey[33]; // hex, secret
    float co_sens_na_per_ppm;  // from the SPEC sensor label
    float co_zero_v;
} node_creds_t;

esp_err_t creds_load(node_creds_t *c);  // reads NVS partition "fctry", namespace "node"

// Wi-Fi + MQTT. Blocking with timeouts; returns ESP_OK only after the broker acknowledged (QoS 1).
esp_err_t wifi_mqtt_publish(const node_creds_t *c, const char *json, uint32_t timeout_ms);
void wifi_mqtt_stop(void);
// Reads the device twin's desired "fw" {version,url,sha256}; empty url if none.
esp_err_t wifi_mqtt_get_fw_target(char *version, size_t vlen, char *url, size_t ulen, char *sha256_hex, size_t slen);

// LoRaWAN (RAK3172 RUI3 AT commands over UART1). US915, sub-band 2 by default.
esp_err_t lorawan_init(const node_creds_t *c);           // keys + band; joins lazily (OTAA)
esp_err_t lorawan_send(uint8_t fport, const uint8_t *data, size_t len, uint32_t timeout_ms);
esp_err_t lorawan_sleep(void);

// OTA from an HTTPS URL; checks the image sha256 and marks the new slot pending verification.
esp_err_t ota_apply(const char *url, const char *sha256_hex);
void ota_mark_valid_if_pending(void);  // call after the first successful uplink on a new image
