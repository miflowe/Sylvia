// BQ24650 status pins (open-drain, 10 k pull-ups) and the MPPSET charge-inhibit FET.
#include "board.h"
#include "drivers.h"

void charger_init(void)
{
    gpio_config_t in = {.pin_bit_mask = (1ULL << PIN_CHG_STAT1) | (1ULL << PIN_CHG_STAT2) | (1ULL << PIN_VBUS_DET),
                        .mode = GPIO_MODE_INPUT};
    gpio_config(&in);
    gpio_set_direction(PIN_CHG_INHIBIT, GPIO_MODE_OUTPUT);
    gpio_set_level(PIN_CHG_INHIBIT, 0);
}

chg_state_t charger_state(void)
{
    int s1 = gpio_get_level(PIN_CHG_STAT1), s2 = gpio_get_level(PIN_CHG_STAT2);
    if (!s1 && s2) return CHG_CHARGING;
    if (s1 && !s2) return CHG_DONE;
    if (!s1 && !s2) return CHG_FAULT;  // not a valid BQ24650 combination: treat as a fault to log
    return CHG_OFF;                    // both high: no input, sleep, or fault (datasheet table)
}

void charger_inhibit(bool inhibit)
{
    gpio_set_level(PIN_CHG_INHIBIT, inhibit);
}

bool usb_present(void)
{
    return gpio_get_level(PIN_VBUS_DET);
}
