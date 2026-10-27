# Sylvia Node Tier B: block diagram

Rails: **VBAT** (1S2P LiFePO4, 2.5–3.65 V) → **3V3** (always on) → **3V3_SEN** (switched, SEN66) and
**3V3_ALT → 5V_ALT** (switched + DNP boost, only for the PMSA003I / ZE07-CO alternates).
Two I2C buses, both at 100 kHz (LMP91000 and SEN66 limits): **I2C0** on-board, always powered; **I2C1** to the SEN66 cable,
with its pull-ups on 3V3_SEN so a powered-down sensor is never back-fed through SDA/SCL.

```mermaid
flowchart LR
  subgraph PWR[Power]
    PV[6 V 2 W solar<br/>JST PH] --> TVS[SMF12A TVS<br/>+ B5819W] -->|IN2| OR[TPS2121<br/>power mux, USB priority]
    USB[USB-C 5 V<br/>TYPE-C-31-M-12] --> ESD[USBLC6-2SC6] -->|IN1| OR
    OR --> CHG[BQ24650<br/>sync buck charger<br/>MPPSET 4.44 V<br/>float 3.60 V, 400 mA]
    NTC[10k NTC on cells] --> CHG
    CHG --> FUSE[2 A fuse] --> BAT[(2× LiFePO4 18650<br/>1S2P ~3000 mAh)]
    BAT --> FG[MAX17048<br/>fuel gauge 0x36]
    BAT --> SUP[TPS3840PL27<br/>UVLO 2.7 V]
    SUP -->|EN| BB[TPS63020<br/>buck-boost 3.3 V]
    BAT --> BB
    BB --> V33[3V3 always-on]
    V33 --> LS1[TPS22918<br/>LS1] --> V33S[3V3_SEN]
    V33 --> LS2[TPS22918<br/>LS2] --> V33A[3V3_ALT] --> BST[TPS61023 5 V<br/>DNP] --> V5A[5V_ALT]
  end

  subgraph CORE[Core]
    MCU[ESP32-S3-WROOM-1-N8R8<br/>Wi-Fi + BLE, PCB antenna]
    LORA[RAK3172-9-SM-I<br/>LoRaWAN US915<br/>IPEX → SMA bulkhead]
  end

  subgraph SENS[Sensors]
    BME[BME688 0x76<br/>gas, T, RH, P]
    AFE[LMP91000 0x48<br/>potentiostat] --- CO[SPEC 110-102<br/>CO cell, hand-soldered]
    ADC[ADS1115 0x49<br/>16-bit ADC]
    SEN[SEN66 0x6B<br/>off-board, JST GH 6]
    PMA[PMSA003I 0x12<br/>alt footprint, DNP]
    ZE[ZE07-CO<br/>alt pads, DNP]
  end

  V33 --> MCU & LORA & BME & AFE & ADC
  V33S --> SEN
  V5A --> PMA & ZE
  MCU <-->|I2C0 100 kHz| BME & AFE & ADC & FG
  AFE -->|VOUT| ADC
  MCU <-->|I2C1 100 kHz| SEN & PMA
  MCU <-->|UART1 + RST/BOOT0| LORA
  MCU <-->|UART2 + analog| ZE
  MCU -->|USB D+/D-| USB
  CHG -->|STAT1, STAT2| MCU
  FG -->|ALRT wake| MCU
  MCU -->|EN| LS1 & LS2
  MCU --> UI[LED · buzzer pads · BOOT/RESET · tamper pads]
  MCU --- DBG[UART0 header · test points]
  LORA --- SWD[SWD header]
```

## Why it looks like this
- **Always-on CO front end.** The electrochemical cell needs continuous bias: LMP91000 + ADS1115 together draw
  ~10 µA, so gating them saves nothing and would cost minutes of re-stabilisation per wake. The plan's "load switch
  for the CO front end" is used for the **CO alternate rail** (ZE07-CO) instead; a fitted 0 Ω jumper still isolates
  the LMP91000/ADS1115 for bring-up.
- **Cheap sensors trigger the expensive one.** CO and BME688 run every 60 s for microwatts; the SEN66 (~90 mA,
  30 s start-up) is sampled every 5/15 min and runs continuously only when CO or gas resistance moves (detector burst).
- **Wi-Fi first, LoRaWAN second.** Wi-Fi MQTT carries full JSON; the RAK3172 only sends the 11-byte payload when
  Wi-Fi or home power is down.
- **No 5 V on the default build.** Everything runs at 3.3 V; the 5 V boost exists only for the alternates.
