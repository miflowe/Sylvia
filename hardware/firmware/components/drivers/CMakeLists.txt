idf_component_register(SRCS "i2c_bus.c" "sen66.c" "co_sensor.c" "max17048.c" "bme688.c" "charger.c"
                       INCLUDE_DIRS "include"
                       REQUIRES driver esp_timer board sensor_math payload bme68x)
