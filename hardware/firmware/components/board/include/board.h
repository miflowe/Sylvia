// Sylvia Node Tier B pin map. Names match the schematic nets (kicad/sylvia_node.py);
// tools/pin_map.py fails if this file and the netlist disagree.
#pragma once

#include "driver/gpio.h"

#define PIN_I2C0_SDA GPIO_NUM_4     // on-board bus: BME688 0x76, LMP91000 0x48, ADS1115 0x49, MAX17048 0x36
#define PIN_I2C0_SCL GPIO_NUM_5
#define PIN_I2C1_SDA GPIO_NUM_6     // SEN66 cable bus (pull-ups on the switched 3V3_SEN rail)
#define PIN_I2C1_SCL GPIO_NUM_7
#define I2C_FREQ_HZ 100000          // LMP91000 and SEN66 are both 100 kHz parts

#define PIN_EN_SEN GPIO_NUM_8       // load switch LS1: SEN66 rail (RTC GPIO: held through deep sleep)
#define PIN_EN_ALT GPIO_NUM_9       // load switch LS2: alternates rail (5 V boost)
#define PIN_CHG_INHIBIT GPIO_NUM_10 // high = BQ24650 charging disabled
#define PIN_FG_ALRT GPIO_NUM_11     // MAX17048 ALRT, active low, ext1 wake
#define PIN_CHG_STAT1 GPIO_NUM_12   // low = charging
#define PIN_CHG_STAT2 GPIO_NUM_13   // low = charge done
#define PIN_LED GPIO_NUM_14
#define PIN_BUZZER GPIO_NUM_15      // DNP on the default build
#define PIN_LORA_RST GPIO_NUM_16    // RAK3172 NRST, drive open-drain
#define PIN_LORA_TX GPIO_NUM_17     // ESP32 TX -> RAK3172 UART2 RX
#define PIN_LORA_RX GPIO_NUM_18     // ESP32 RX <- RAK3172 UART2 TX
#define PIN_TAMPER GPIO_NUM_21      // closed lid switch = low, ext1 wake
#define PIN_VBUS_DET GPIO_NUM_38
#define PIN_LORA_BOOT0 GPIO_NUM_39
#define PIN_PM_SET GPIO_NUM_40      // PMSA003I alternate
#define PIN_ALT_UART_RX GPIO_NUM_41 // ZE07-CO alternate
#define PIN_ALT_UART_TX GPIO_NUM_42
#define PIN_ADC_RDY GPIO_NUM_47     // ADS1115 ALERT/RDY
#define PIN_CO_ADC_ESP GPIO_NUM_1   // backup: CO_VOUT on ADC1_CH0

#define LORA_UART_NUM UART_NUM_1
#define LORA_UART_BAUD 115200

// Never use GPIO26-37 (flash + octal PSRAM) or the strapping pins GPIO3/45/46.
