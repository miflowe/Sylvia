#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "net.h"
#include "nvs.h"
#include "nvs_flash.h"

static const char *TAG = "creds";

static esp_err_t get_str(nvs_handle_t h, const char *key, char *out, size_t len)
{
    size_t n = len;
    return nvs_get_str(h, key, out, &n);
}

static char *get_blob_str(nvs_handle_t h, const char *key)
{
    size_t n = 0;
    if (nvs_get_str(h, key, NULL, &n) != ESP_OK || n == 0) return NULL;
    char *s = malloc(n);
    if (s && nvs_get_str(h, key, s, &n) != ESP_OK) {
        free(s);
        return NULL;
    }
    return s;
}

esp_err_t creds_load(node_creds_t *c)
{
    memset(c, 0, sizeof(*c));
    c->co_sens_na_per_ppm = 4.75f;  // SPEC 110-102 nominal; the label value is better
    esp_err_t err = nvs_flash_init_partition("fctry");
    if (err != ESP_OK) return err;
    nvs_handle_t h;
    if ((err = nvs_open_from_partition("fctry", "node", NVS_READONLY, &h)) != ESP_OK) {
        ESP_LOGE(TAG, "no factory credentials: run tools/provision.py for this device");
        return err;
    }
    get_str(h, "device_id", c->device_id, sizeof c->device_id);
    get_str(h, "hub_host", c->hub_host, sizeof c->hub_host);
    get_str(h, "wifi_ssid", c->wifi_ssid, sizeof c->wifi_ssid);
    get_str(h, "wifi_pass", c->wifi_pass, sizeof c->wifi_pass);
    get_str(h, "lora_deveui", c->lora_deveui, sizeof c->lora_deveui);
    get_str(h, "lora_joineui", c->lora_joineui, sizeof c->lora_joineui);
    get_str(h, "lora_appkey", c->lora_appkey, sizeof c->lora_appkey);
    c->client_cert = get_blob_str(h, "client_cert");
    c->client_key = get_blob_str(h, "client_key");
    char num[16];
    if (get_str(h, "co_sens", num, sizeof num) == ESP_OK) c->co_sens_na_per_ppm = strtof(num, NULL);
    if (get_str(h, "co_zero", num, sizeof num) == ESP_OK) c->co_zero_v = strtof(num, NULL);
    nvs_close(h);
    ESP_LOGI(TAG, "device %s, hub %s, cert %s", c->device_id, c->hub_host, c->client_cert ? "yes" : "MISSING");
    return (c->device_id[0] && c->client_cert && c->client_key) ? ESP_OK : ESP_ERR_NOT_FOUND;
}
