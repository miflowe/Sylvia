// OTA over HTTPS (image URL + sha256 come from the IoT Hub device twin, desired.fw).
// The new image boots in "pending verify" state; main.c marks it valid after its first good uplink,
// otherwise the bootloader rolls back to the previous slot (CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE).
#include <string.h>

#include "esp_crt_bundle.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "net.h"

static const char *TAG = "ota";

static void hex(const uint8_t *in, size_t n, char *out)
{
    for (size_t i = 0; i < n; i++) sprintf(out + 2 * i, "%02x", in[i]);
}

esp_err_t ota_apply(const char *url, const char *sha256_hex)
{
    esp_http_client_config_t http = {.url = url, .crt_bundle_attach = esp_crt_bundle_attach, .timeout_ms = 15000};
    esp_https_ota_config_t cfg = {.http_config = &http};
    esp_https_ota_handle_t h;
    esp_err_t err = esp_https_ota_begin(&cfg, &h);
    if (err != ESP_OK) return err;
    while ((err = esp_https_ota_perform(h)) == ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
    }
    if (err != ESP_OK || !esp_https_ota_is_complete_data_received(h)) {
        esp_https_ota_abort(h);
        return err != ESP_OK ? err : ESP_FAIL;
    }
    // Compare the written image's sha256 with the twin's value before switching slots.
    const esp_partition_t *next = esp_ota_get_next_update_partition(NULL);
    uint8_t sha[32];
    char sha_hex[65];
    esp_partition_get_sha256(next, sha);
    hex(sha, 32, sha_hex);
    if (sha256_hex && sha256_hex[0] && strcasecmp(sha_hex, sha256_hex) != 0) {
        ESP_LOGE(TAG, "sha256 mismatch: got %s", sha_hex);
        esp_https_ota_abort(h);
        return ESP_ERR_INVALID_CRC;
    }
    return esp_https_ota_finish(h);  // caller restarts
}

void ota_mark_valid_if_pending(void)
{
    esp_ota_img_states_t st;
    if (esp_ota_get_state_partition(esp_ota_get_running_partition(), &st) == ESP_OK && st == ESP_OTA_IMG_PENDING_VERIFY) {
        esp_ota_mark_app_valid_cancel_rollback();
        ESP_LOGI(TAG, "new firmware confirmed");
    }
}
