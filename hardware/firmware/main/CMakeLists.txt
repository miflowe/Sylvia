idf_component_register(SRCS "main.c"
                       INCLUDE_DIRS "."
                       REQUIRES board detect power_policy payload sensor_math drivers net esp_timer)
