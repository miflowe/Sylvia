idf_component_register(SRCS "creds.c" "wifi_mqtt.c" "lorawan.c" "ota.c"
                       INCLUDE_DIRS "include"
                       REQUIRES nvs_flash esp_wifi esp_netif esp_event mqtt mbedtls esp_https_ota esp_http_client app_update esp_partition driver board payload)
