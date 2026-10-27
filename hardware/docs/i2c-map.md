# I2C address map and pull-ups

Two buses on the ESP32-S3's two I2C controllers. **Both run at 100 kHz**: the LMP91000 (I2C0) and the SEN66
(I2C1) are both limited to 100 kHz standard mode.

## I2C0: on-board, always powered (IO4 SDA, IO5 SCL)
Pull-ups: R31/R32 4.7 kΩ to 3V3. Test points TP on SDA/SCL.
| 7-bit addr | Device | Ref | Set by | Notes |
|---|---|---|---|---|
| **0x36** | MAX17048 fuel gauge | U7 | fixed | Powered from VBAT (2.5–4.5 V); I2C pins tolerate 3V3 pull-ups |
| **0x48** | LMP91000 CO front end | U4 | fixed (MENB = GND) | 100 kHz max. Writes need LOCK (0x01) = 0 first |
| **0x49** | ADS1115 16-bit ADC | U5 | ADDR → VDD | **Moved off 0x48** to avoid the LMP91000 |
| **0x76** | BME688 | U3 | SDO → GND | 0x77 if SDO is tied high |

## I2C1: SEN66 cable, switched rail (IO6 SDA, IO7 SCL)
Pull-ups: R29/R30 4.7 kΩ to **3V3_SEN** (load switch LS1). Off when the sensor is off, so a powered-down SEN66 is
never back-fed through SDA/SCL. ESD diodes D4/D5 at the connector.
| 7-bit addr | Device | Ref | Notes |
|---|---|---|---|
| **0x6B** | SEN66 | J2 (off-board) | No clock stretching: it NACKs while busy; wait the command's execution time |
| **0x12** | PMSA003I (alternate, DNP) | J4 | Needs LS1 **and** LS2 on (pull-ups on 3V3_SEN, sensor on 5V_ALT) |

## Pull-up sizing
100 kHz standard mode allows rise time ≤ 1 µs: R ≤ 1 µs / (0.8473 × C_bus).
- I2C0: 4 devices + ~3 cm traces ≈ 40 pF → R ≤ 29 kΩ; 4.7 kΩ gives ~0.16 µs. Static current only while a line is low.
- I2C1: 10 cm cable (~50 pF/m) + SEN66 + connector ≈ 30 pF → R ≤ 39 kΩ; 4.7 kΩ is a good margin for EMI on
  the cable (Sensirion suggests 10 kΩ as a typical value).

## Tier C additions (not on this board)
SCD41 0x62 · SGP41 0x59 · SHT45 0x44 · MLX90614 0x5A (SMBus, keep ≤100 kHz) · SPS30 0x69: no conflicts with Tier B.
