// Azure IoT Hub over MQTT 3.1.1 / TLS (port 8883) with X.509 client-certificate auth.
//   username: <hub>.azure-devices.net/<device_id>/?api-version=2021-04-12
//   client id: <device_id>, telemetry topic: devices/<device_id>/messages/events/
//   twin: $iothub/twin/GET/?$rid=1 -> $iothub/twin/res/200/?$rid=1
#include <stdio.h>
#include <string.h>

#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "mqtt_client.h"
#include "net.h"

static const char *TAG = "wifi_mqtt";
#define BIT_IP BIT0
#define BIT_MQTT BIT1
#define BIT_PUBACK BIT2
#define BIT_TWIN BIT3

static EventGroupHandle_t ev;
static esp_mqtt_client_handle_t mqtt;
static bool wifi_started;
static char twin_buf[1024];

static void on_wifi(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg;
    (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) esp_wifi_connect();
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) xEventGroupSetBits(ev, BIT_IP);
}

static void on_mqtt(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg;
    (void)base;
    esp_mqtt_event_handle_t e = data;
    if (id == MQTT_EVENT_CONNECTED) xEventGroupSetBits(ev, BIT_MQTT);
    if (id == MQTT_EVENT_PUBLISHED) xEventGroupSetBits(ev, BIT_PUBACK);
    if (id == MQTT_EVENT_DATA && e->topic_len > 16 && strncmp(e->topic, "$iothub/twin/res", 16) == 0) {
        int n = e->data_len < (int)sizeof(twin_buf) - 1 ? e->data_len : (int)sizeof(twin_buf) - 1;
        memcpy(twin_buf, e->data, n);
        twin_buf[n] = 0;
        xEventGroupSetBits(ev, BIT_TWIN);
    }
}

static esp_err_t connect(const node_creds_t *c, uint32_t timeout_ms)
{
    if (!ev) ev = xEventGroupCreate();
    if (!wifi_started) {
        esp_netif_init();
        esp_event_loop_create_default();
        esp_netif_create_default_wifi_sta();
        wifi_init_config_t wcfg = WIFI_INIT_CONFIG_DEFAULT();
        esp_wifi_init(&wcfg);
        esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_wifi, NULL);
        esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_wifi, NULL);
        wifi_config_t sta = {0};
        strncpy((char *)sta.sta.ssid, c->wifi_ssid, sizeof sta.sta.ssid);
        strncpy((char *)sta.sta.password, c->wifi_pass, sizeof sta.sta.password);
        esp_wifi_set_mode(WIFI_MODE_STA);
        esp_wifi_set_config(WIFI_IF_STA, &sta);
        esp_wifi_start();
        wifi_started = true;
    }
    if (!(xEventGroupWaitBits(ev, BIT_IP, pdFALSE, pdTRUE, pdMS_TO_TICKS(timeout_ms)) & BIT_IP)) {
        return ESP_ERR_TIMEOUT;
    }
    if (!mqtt) {
        static char uri[128], user[192];
        snprintf(uri, sizeof uri, "mqtts://%s:8883", c->hub_host);
        snprintf(user, sizeof user, "%s/%s/?api-version=2021-04-12", c->hub_host, c->device_id);
        esp_mqtt_client_config_t cfg = {
            .broker.address.uri = uri,
            .broker.verification.crt_bundle_attach = esp_crt_bundle_attach,
            .credentials.username = user,
            .credentials.client_id = c->device_id,
            .credentials.authentication.certificate = c->client_cert,
            .credentials.authentication.key = c->client_key,
            .session.keepalive = 60,
        };
        mqtt = esp_mqtt_client_init(&cfg);
        esp_mqtt_client_register_event(mqtt, ESP_EVENT_ANY_ID, on_mqtt, NULL);
        esp_mqtt_client_start(mqtt);
    }
    EventBits_t b = xEventGroupWaitBits(ev, BIT_MQTT, pdFALSE, pdTRUE, pdMS_TO_TICKS(timeout_ms));
    return (b & BIT_MQTT) ? ESP_OK : ESP_ERR_TIMEOUT;
}

esp_err_t wifi_mqtt_publish(const node_creds_t *c, const char *json, uint32_t timeout_ms)
{
    esp_err_t err = connect(c, timeout_ms);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "connect failed: %s", esp_err_to_name(err));
        return err;
    }
    char topic[128];
    snprintf(topic, sizeof topic, "devices/%s/messages/events/", c->device_id);
    xEventGroupClearBits(ev, BIT_PUBACK);
    if (esp_mqtt_client_publish(mqtt, topic, json, 0, 1, 0) < 0) return ESP_FAIL;
    EventBits_t b = xEventGroupWaitBits(ev, BIT_PUBACK, pdTRUE, pdTRUE, pdMS_TO_TICKS(timeout_ms));
    return (b & BIT_PUBACK) ? ESP_OK : ESP_ERR_TIMEOUT;
}

esp_err_t wifi_mqtt_get_fw_target(char *version, size_t vlen, char *url, size_t ulen, char *sha, size_t slen)
{
    version[0] = url[0] = sha[0] = 0;
    if (!mqtt) return ESP_ERR_INVALID_STATE;
    esp_mqtt_client_subscribe(mqtt, "$iothub/twin/res/#", 1);
    xEventGroupClearBits(ev, BIT_TWIN);
    esp_mqtt_client_publish(mqtt, "$iothub/twin/GET/?$rid=1", "", 0, 0, 0);
    if (!(xEventGroupWaitBits(ev, BIT_TWIN, pdTRUE, pdTRUE, pdMS_TO_TICKS(5000)) & BIT_TWIN)) return ESP_ERR_TIMEOUT;
    // Minimal extraction of desired.fw.{version,url,sha256}; a JSON parser (cJSON) is the next step.
    const char *fw = strstr(twin_buf, "\"fw\"");
    if (!fw) return ESP_OK;
    struct { const char *key; char *out; size_t len; } f[] = {{"\"version\":\"", version, vlen},
                                                             {"\"url\":\"", url, ulen},
                                                             {"\"sha256\":\"", sha, slen}};
    for (size_t i = 0; i < 3; i++) {
        const char *p = strstr(fw, f[i].key);
        if (!p) continue;
        p += strlen(f[i].key);
        size_t n = strcspn(p, "\"");
        if (n >= f[i].len) n = f[i].len - 1;
        memcpy(f[i].out, p, n);
        f[i].out[n] = 0;
    }
    return ESP_OK;
}

void wifi_mqtt_stop(void)
{
    if (mqtt) {
        esp_mqtt_client_stop(mqtt);
        esp_mqtt_client_destroy(mqtt);
        mqtt = NULL;
    }
    if (wifi_started) {
        esp_wifi_stop();
        wifi_started = false;
    }
}
