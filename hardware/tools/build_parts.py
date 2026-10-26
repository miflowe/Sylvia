"""Build hardware/parts/parts.csv from the master part list below.

Run:  python -I hardware/tools/build_parts.py [--offline]

For every part with an LCSC number it pulls a live JLCPCB snapshot (stock, qty-1 USD price,
basic/extended library). Parts LCSC does not carry use the manual price + source given here.
Datasheet sha256 values are read from hardware/datasheets/<MPN>.pdf when the file exists.
Every price is a snapshot: re-run this before ordering.
"""
import csv
import datetime as dt
import hashlib
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import jlc_api  # noqa: E402

HW = pathlib.Path(__file__).resolve().parents[1]
OUT = HW / "parts" / "parts.csv"
DATASHEETS = HW / "datasheets"

KICAD = "KiCad 9 official lib"
EASY = "easyeda2kicad (LCSC)"
OURS = "Sylvia (drawn from datasheet)"
MFR = "manufacturer CAD"
NONE = "n/a (off-board / generic)"
LIC_KICAD = "CC-BY-SA-4.0 + KiCad library exception"
LIC_EASY = "LCSC/EasyEDA library terms (free use; check before resale)"
LIC_OURS = "same as repo"
LIC_MFR = "manufacturer copyright: local only, not committed"

TI = "https://www.ti.com/lit/ds/symlink/{}.pdf"
SENS = "https://sensirion.com/media/documents/"

# key, mpn, manufacturer, lcsc, digikey, tiers, role, function, qty on Tier B board,
# manual price (USD, None = use LCSC snapshot), manual price source, datasheet URL,
# symbol source, footprint source, 3D source, licence, notes
PARTS = [
    # ---------------- MCU / radio ----------------
    ("U_MCU", "ESP32-S3-WROOM-1-N8R8", "Espressif", "C2913201", "verify", "B,C", "primary",
     "MCU + Wi-Fi/BLE, 8 MB flash, 8 MB octal PSRAM", 1, None, "",
     "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, "Octal PSRAM uses GPIO33-37: never route those."),
    ("U_MCU_1U", "ESP32-S3-WROOM-1U-N8R8", "Espressif", "C2980300", "verify", "C", "alternate",
     "Same MCU with u.FL for an external Wi-Fi antenna (metal/die-cast enclosure)", 0, None, "",
     "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("U_MCU_A", "ESP32-C6-WROOM-1-N8", "Espressif", "C5366877", "verify", "A", "primary",
     "Tier A MCU + Wi-Fi 6/BLE/802.15.4", 0, None, "",
     "https://www.espressif.com/sites/default/files/documentation/esp32-c6-wroom-1_wroom-1u_datasheet_en.pdf",
     EASY, EASY, EASY, LIC_EASY, "Not in KiCad 9 libs (only ESP32-C6-MINI-1)."),
    ("U_LORA", "RAK3172-9-SM-I", "RAKwireless", "C19723905", "verify", "B,C", "primary",
     "LoRaWAN module (STM32WLE5), US915 band group, IPEX antenna connector", 1, None, "",
     "https://docs.rakwireless.com/product-categories/wisduo/rak3172-module/datasheet/",
     KICAD, KICAD, EASY, LIC_KICAD, "-9 = US915/AU915; -I = IPEX. Base part rated -20..85 C. Also sold by store.rakwireless.com."),
    ("U_LORA_T", "RAK3172-T-9-SM-I", "RAKwireless", "C19723909", "verify", "B,C", "alternate",
     "Same with TCXO, rated -40..85 C (better for Canadian winters)", 0, None, "",
     "https://docs.rakwireless.com/product-categories/wisduo/rak3172-module/datasheet/",
     KICAD, KICAD, EASY, LIC_KICAD, "Same footprint as RAK3172-9-SM-I. LCSC stock was 0 at snapshot: buy from RAK store."),
    ("ANT_LORA", "915 MHz antenna + u.FL-to-SMA bulkhead pigtail", "generic (e.g. RAK 915 MHz fibreglass)", "", "", "B,C", "primary",
     "LoRa antenna through the enclosure wall", 1, 9.0, "est. ~$5 antenna + ~$4 pigtail (RAK store / Amazon), verify",
     "", NONE, NONE, NONE, "", "Off-board, plugs into the RAK3172 IPEX."),
    ("U_CELL", "nRF9151-LACA-R7", "Nordic Semiconductor", "C22397843", "verify", "C", "primary",
     "LTE-M/NB-IoT + GNSS SiP", 0, None, "",
     "https://docs.nordicsemi.com/bundle/ps_nrf9151/page/keyfeatures_html5.html",
     EASY, EASY, EASY, LIC_EASY, "Needs SIM, LTE antenna and carrier certification work."),
    ("U_CELL_ALT", "SIM7080G", "SIMCom", "C2943992", "verify", "C", "alternate",
     "LTE-M/NB-IoT module (cheaper, simpler AT interface)", 0, None, "",
     "", EASY, EASY, EASY, LIC_EASY, "Datasheet from LCSC (SIMCom needs a login)."),
    ("J_SIM", "SIM8060-6-0-14-00", "GCT", "", "verify", "C", "primary", "nano-SIM holder", 0, 1.2,
     "est., verify", "https://gct.co/files/drawings/sim8060.pdf", KICAD, KICAD, KICAD, LIC_KICAD, ""),

    # ---------------- Sensors ----------------
    ("S_PM", "SEN66-SIN-T", "Sensirion", "", "SEN66-SIN-T (DigiKey product 25700945)", "B", "primary",
     "PM1/2.5/4/10 + CO2 (photoacoustic) + VOC + NOx + RH/T, I2C 0x6B", 1, 58.53,
     "Mouser US qty 1, ~2,606 in stock (search snapshot 2026-10-25); DigiKey $62.03; Arrow $48.72",
     SENS + "FAFC548D/6AC50BC5/PS_DS_SEN6x.pdf", NONE, NONE, MFR, LIC_MFR,
     "Off-board on a JST GH 6-pin cable. Rated 10..40 C recommended, -10..50 C short term, non-condensing: firmware gates it."),
    ("J_SEN66", "SM06B-GHS-TB(LF)(SN)", "JST", "C133065", "verify", "B", "primary",
     "SEN66 connector (JST GH 6-pin, 1.25 mm)", 1, None, "", "https://www.jst-mfg.com/product/pdf/eng/eGH.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, "Cable: GHR-06V-S housing + SSHL-002T-P0.2 crimps, or a pre-crimped GH 6-pin cable (<10 cm)."),
    ("S_CO", "110-102", "SPEC Sensors (Interlink)", "", "verify", "B,C", "primary",
     "Electrochemical CO sensor 0-1000 ppm, 4.75 nA/ppm, zero bias", 1, 25.0,
     "est.: Maritex PLN 90.85 net (~$25) snapshot 2026-10-25; verify DigiKey",
     "https://www.interlinkelectronics.com/downloads/subsidiary-docs/spec-sensors/3SP_CO_1000-P-Package-110-102.pdf",
     OURS, OURS, OURS, LIC_OURS, "Hand-solder only, never reflow (>70 C damages it). Keep-out under the sensor. -30..55 C."),
    ("U_AFE", "LMP91000SDX/NOPB", "Texas Instruments", "C2651584", "verify", "B,C", "primary",
     "Potentiostat AFE for the CO cell, I2C 0x48", 1, None, "", TI.format("lmp91000"),
     EASY, EASY, EASY, LIC_EASY, "SD/SDE/SDX are the same die and WSON-14 package (reel size only)."),
    ("U_ADC", "ADS1115IDGSR", "Texas Instruments", "C37593", "verify", "B,C", "primary",
     "16-bit I2C ADC for the CO signal (ADDR=VDD -> 0x49, avoids LMP91000 0x48)", 1, None, "", TI.format("ads1115"),
     KICAD, KICAD, KICAD, LIC_KICAD, "ESP32 ADC is too noisy for sub-ppm CO."),
    ("S_GAS", "BME688", "Bosch Sensortec", "C3664478", "verify", "A,B,C", "primary",
     "Gas (VOC/H2 smoulder) + T/RH/P, I2C 0x76", 1, None, "",
     "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme688-ds000.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, "KiCad has BME680; BME688 is pin- and package-identical."),
    ("S_PM_A", "PMSA003I", "Plantower", "", "verify", "A", "primary/alternate",
     "Tier A PM sensor (I2C 0x12, 5 V fan); alternate footprint on Tier B", 0, 20.0,
     "est. $18-25 bare (AliExpress/Plantower); Adafruit breakout #4632 ~$45",
     "https://cdn-shop.adafruit.com/product-files/4632/4505_PMSA003I_series_data_manual_English_V2.6.pdf",
     OURS, OURS, OURS, LIC_OURS, "Needs 5 V: Tier B fits the DNP TPS61023 boost for it."),
    ("S_CO_A", "ZE07-CO", "Winsen", "C141345", "verify", "A", "primary/alternate",
     "Pre-calibrated electrochemical CO module (UART + analog); alternate pads on Tier B", 0, None, "",
     "", OURS, OURS, OURS, LIC_OURS, "LCSC stock 0 at snapshot: buy from Winsen/AliExpress. Datasheet via LCSC."),
    ("S_PM_C", "SPS30", "Sensirion", "C5900567", "verify", "C", "primary",
     "PM sensor, 5 V, 8-year life, -10..60 C", 0, None, "", SENS + "8600FF88/64A3B8D6/Sensirion_PM_Sensors_Datasheet_SPS30.pdf",
     NONE, KICAD, MFR, LIC_MFR, "Connects with JST ZHR-5 cable."),
    ("S_CO2_C", "SCD41-D-R2", "Sensirion", "C3659294", "verify", "C", "primary",
     "Photoacoustic CO2 with single-shot mode (good for duty cycling), I2C 0x62", 0, None, "",
     SENS + "48C4B7FB/67FE0194/CD_DS_SCD4x_Datasheet_D1.pdf", KICAD, KICAD, MFR, LIC_KICAD, ""),
    ("S_VOC_C", "SGP41-D-R4", "Sensirion", "C3659325", "verify", "C", "primary",
     "VOC + NOx index sensor, I2C 0x59", 0, None, "", SENS + "5FE8673C/61E96F50/Sensirion_Gas_Sensors_Datasheet_SGP41.pdf",
     EASY, EASY, MFR, LIC_EASY, ""),
    ("S_RHT_C", "SHT45-AD1B-R2", "Sensirion", "C5221601", "verify", "C", "primary",
     "High-accuracy T/RH, I2C 0x44", 0, None, "", SENS + "33FD6951/6A7C10A0/HT_DS_Datasheet_SHT4x_V7.3.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("S_IR_C", "MLX90614ESF-BAA-000-TU", "Melexis", "C490604", "verify", "C", "primary",
     "IR thermometer (radiant heat), SMBus 0x5A, 3 V version", 0, None, "",
     "https://www.melexis.com/-/media/files/documents/datasheets/mlx90614-datasheet-melexis.pdf",
     EASY, KICAD, KICAD, LIC_KICAD, "BAA = 3 V single-zone 90 deg FOV."),
    ("S_CO_C", "CO-B4", "Alphasense", "", "", "C", "alternate",
     "Industrial 4-electrode CO sensor (better baseline stability)", 0, None, "quote needed",
     "https://www.alphasense.com/products/carbon-monoxide-safety/", NONE, NONE, NONE, "", "Needs a 4-electrode AFE: not on the Tier B board."),

    # ---------------- Power ----------------
    ("U_CHG", "BQ24650RVAR", "Texas Instruments", "C53712", "verify", "B,C", "primary",
     "Synchronous buck solar charger, input-voltage (MPP) regulation, resistor-set float voltage (3.60 V LiFePO4)", 1,
     None, "", TI.format("bq24650"), KICAD, KICAD, KICAD, LIC_KICAD, "Chosen over CN3791 (fixed 4.2 V: unsafe for LiFePO4)."),
    ("U_CHG_REJ", "CN3791", "Consonance", "C154992", "", "-", "rejected",
     "MPPT Li-ion charger, fixed 4.2 V float", 0, None, "", "", EASY, EASY, EASY, LIC_EASY,
     "REJECTED for LiFePO4: float voltage fixed at 4.2 V would overcharge a 3.65 V cell."),
    ("U_CHG_ALT", "CN3722", "Consonance", "C77905", "", "B", "alternate",
     "Cheap MPPT charger with resistor-set float voltage (LiFePO4 capable)", 0, None, "", "", EASY, EASY, EASY, LIC_EASY,
     "Fallback if BQ24650 stock runs out; needs its own layout (TSSOP-16)."),
    ("Q_CHG", "AO3400A", "Alpha & Omega", "C20917", "verify", "B,C", "primary",
     "BQ24650 high- and low-side N-FETs (30 V, 5.7 A)", 2, None, "", "https://www.aosmd.com/res/datasheets/AO3400A.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, "JLCPCB basic part."),
    ("L_CHG", "SWPA6045S150MT", "Sunlord", "C83374", "", "B,C", "primary", "BQ24650 inductor 15 uH", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "6x6 mm, rated well above the 0.4 A charge current."),
    ("R_SNS", "0.1 ohm 1% 0805 current sense", "UNI-ROYAL (any)", "", "", "B,C", "primary",
     "BQ24650 charge-current sense: 40 mV / 0.1 ohm = 400 mA", 1, 0.02, "est. (JLCPCB basic family)", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "Pick an in-stock 0805 1% 0.1 ohm at order time."),
    ("U_FG", "MAX17048G+T10", "Analog Devices (Maxim)", "C2682616", "verify", "B,C", "primary",
     "Fuel gauge (ModelGauge), I2C 0x36", 1, None, "",
     "https://www.analog.com/media/en/technical-documentation/data-sheets/MAX17048-MAX17049.pdf",
     EASY, KICAD, KICAD, LIC_EASY, "LiFePO4's flat curve limits voltage-only gauging: firmware also tracks charge state + V."),
    ("U_FG_ALT", "MAX17260SETD+T", "Analog Devices (Maxim)", "C5280558", "verify", "B,C", "alternate",
     "Coulomb-counting fuel gauge (better on LiFePO4)", 0, None, "",
     "https://www.analog.com/media/en/technical-documentation/data-sheets/MAX17260.pdf", EASY, KICAD, KICAD, LIC_EASY, ""),
    ("U_REG", "TPS63020DSJR", "Texas Instruments", "C15483", "verify", "B,C", "primary",
     "3.3 V buck-boost, 4 A switch, 25 uA Iq, from 1S LiFePO4 (2.5-3.65 V) or USB", 1, None, "", TI.format("tps63020"),
     EASY, EASY, EASY, LIC_EASY, "KiCad has no TPS63020 symbol or DSJ footprint."),
    ("L_REG", "SWPA4020S1R5NT", "Sunlord", "C42099", "", "B,C", "primary", "TPS63020 inductor 1.5 uH", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "Check saturation current >= 3 A at order (datasheet)."),
    ("U_REG_ALT", "TPS63802DLAR", "Texas Instruments", "C2845237", "verify", "B,C", "alternate",
     "Smaller 2 A buck-boost, 11 uA Iq", 0, None, "", TI.format("tps63802"), EASY, EASY, EASY, LIC_EASY, ""),
    ("U_LS", "TPS22918DBVR", "Texas Instruments", "C131941", "verify", "B,C", "primary",
     "Load switches: SEN66/PM rail and CO front-end rail", 2, None, "", TI.format("tps22918"),
     EASY, KICAD, KICAD, LIC_EASY, ""),
    ("U_LS_ALT", "TPS22917DBVR", "Texas Instruments", "C2681320", "verify", "B,C", "alternate",
     "Lower-leakage load switch (1 A)", 0, None, "", TI.format("tps22917"), KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("U_UVLO", "TPS3840PL27DBVR", "Texas Instruments", "C2066421", "verify", "B,C", "primary",
     "Nano-power supervisor: turns the 3.3 V converter off below 2.7 V (battery protection)", 1, None, "",
     TI.format("tps3840"), EASY, KICAD, KICAD, LIC_EASY, "Push-pull, active-low output drives TPS63020 EN."),
    ("U_BOOST", "TPS61023DRLR", "Texas Instruments", "C919459", "verify", "B", "alternate (DNP)",
     "Optional 5 V boost for the PMSA003I / ZE07-CO alternates", 0, None, "", TI.format("tps61023"),
     EASY, KICAD, KICAD, LIC_EASY, "Fitted only if the PM alternate is used."),
    ("U_LDO_A", "AP2112K-3.3TRG1", "Diodes Inc.", "C51118", "verify", "A", "primary",
     "Tier A 3.3 V LDO from USB 5 V", 0, None, "", "https://www.diodes.com/assets/Datasheets/AP2112.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("D_OR", "B5819W SL", "Changjing (CJ)", "C8598", "", "B,C", "primary",
     "Schottky OR-ing: solar and USB into the charger; reverse-polarity block", 2, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "JLCPCB basic part."),
    ("D_TVS", "SMF12A", "MDD", "C123800", "", "B,C", "primary", "Solar input TVS (12 V standoff)", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "6 V panel Voc ~7.2 V, up to ~8 V in the cold."),
    ("F_BAT", "0466002.NRHF", "Littelfuse", "C3105", "verify", "B,C", "primary",
     "2 A fast fuse on the battery lead", 1, None, "", "", KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("TH_BAT", "NCP18XH103F03RB", "Murata", "C13564", "verify", "B,C", "primary",
     "10k NTC on the cell: BQ24650 TS blocks charging below 0 C / above 45 C", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "Place against the cell holder (or use a wired 103AT on the cell)."),
    ("BT_HOLD", "1042", "Keystone", "C5249310", "verify", "B", "primary",
     "18650 SMT holder, two for the 1S2P battery", 2, None, "", "https://www.keyelco.com/product.cfm/product_id/918",
     KICAD, KICAD, KICAD, LIC_KICAD, "Hand-place or JLCPCB extended part."),
    ("BT_CELL", "IFR18650 LiFePO4 1500-1800 mAh (unprotected, flat top)", "generic (e.g. Lithium Werks / K2)", "", "", "B", "primary",
     "Energy storage, 3.2 V nominal, two in parallel (1S2P, user decision 2026-10-25)", 2, 6.0, "est. $5-8 (battery shops), verify", "", NONE, NONE, NONE, "",
     "Buy matched cells from one batch (same SoC before paralleling)."),
    ("PV", "6 V 2 W solar panel", "generic (e.g. Voltaic P105 / Adafruit #200)", "", "", "B", "primary", "Solar input", 1, 20.0,
     "est. $15-29, verify", "", NONE, NONE, NONE, "", "Wired to J_SOLAR (JST PH 2-pin) through a cable gland."),
    ("J_SOLAR", "S2B-PH-K-S(LF)(SN)", "JST", "C173752", "verify", "B,C", "primary", "Solar input connector (JST PH 2-pin)", 1,
     None, "", "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf", KICAD, KICAD, KICAD, LIC_KICAD, ""),

    # ---------------- USB, UI, protection, misc ----------------
    ("J_USB", "TYPE-C-31-M-12", "Korean Hroparts", "C165948", "", "A,B,C", "primary", "USB-C (USB 2.0) for power + programming", 1,
     None, "", "", KICAD, KICAD, KICAD, LIC_KICAD, "5.1k CC pull-downs make it a sink."),
    ("U_ESD", "USBLC6-2SC6", "STMicroelectronics", "C7519", "verify", "A,B,C", "primary",
     "USB D+/D- and VBUS ESD protection", 1, None, "", "https://www.st.com/resource/en/datasheet/usblc6-2.pdf",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("D_ESD", "ESD9B5.0ST5G", "onsemi", "C111566", "verify", "B,C", "primary",
     "ESD on external sensor cable lines (SEN66 I2C)", 2, None, "", "", KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("LED", "KT-0603G", "Hubei KENTO", "C12624", "", "A,B,C", "primary", "Status LED (green)", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("BZ", "MLT-8530", "Jiangsu Huaneng", "C94599", "", "B,C", "primary (pads)", "Magnetic buzzer 8.5 mm", 1, None, "", "",
     EASY, EASY, EASY, LIC_EASY, "Driven by 2N7002 with 1N4148WS flyback."),
    ("Q_SW", "2N7002", "Changjing (CJ)", "C8545", "", "B,C", "primary", "Small-signal N-FET (buzzer, level control)", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "JLCPCB basic part."),
    ("D_FLY", "1N4148WS", "Changjing (CJ)", "C2128", "", "B,C", "primary", "Buzzer flyback diode", 1, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, "JLCPCB basic part."),
    ("SW", "TS-1187A-B-A-B", "XKB Connection", "C318884", "", "A,B,C", "primary", "RESET and BOOT buttons", 2, None, "", "",
     EASY, EASY, EASY, LIC_EASY, "JLCPCB basic part."),
    ("ENC", "IP65 polycarbonate box + radiation shield", "Hammond 1554 series or similar", "", "", "B", "primary",
     "Enclosure with louvred PM inlet/outlet path, PTFE vent, cable glands", 1, 30.0, "est. $20-35, verify", "",
     NONE, NONE, NONE, "", "Mechanical design is the team's: see docs/layout-guide.md."),
    ("GW", "RAK7268V2 WisGate Edge Lite 2 (US915)", "RAKwireless", "", "", "pilot infra", "infrastructure",
     "LoRaWAN gateway for a pilot area without public coverage", 0, 170.0, "est. $150-250, verify", "",
     NONE, NONE, NONE, "", "Not a board part."),

    # ---------------- Key passives (JLCPCB basic parts) ----------------
    ("C_100N", "CL05B104KO5NNNC", "Samsung", "C1525", "", "A,B,C", "passive", "100 nF 0402 X7R decoupling", 20, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("C_10U", "CL10A106KP8NNNC", "Samsung", "C19702", "", "A,B,C", "passive", "10 uF 0603 X5R bulk", 8, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("C_22U", "CL21A226MAQNNNE", "Samsung", "C45783", "", "B,C", "passive", "22 uF 0805 X5R regulator in/out", 6, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("R_10K", "0402WGF1002TCE", "UNI-ROYAL", "C25744", "", "A,B,C", "passive", "10k 0402 (pull-ups/downs)", 12, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("R_4K7", "0402WGF4701TCE", "UNI-ROYAL", "C25900", "", "A,B,C", "passive", "4.7k 0402 (on-board I2C pull-ups)", 2, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("R_5K1", "0402WGF5101TCE", "UNI-ROYAL", "C25905", "", "A,B,C", "passive", "5.1k 0402 (USB-C CC)", 2, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("R_1M", "0402WGF1004TCE", "UNI-ROYAL", "C26083", "", "B,C", "passive", "1M 0402 (high-value dividers)", 4, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
    ("R_0", "0603WAF0000T5E", "UNI-ROYAL", "C21189", "", "B,C", "passive", "0 ohm 0603 isolation jumpers", 10, None, "", "",
     KICAD, KICAD, KICAD, LIC_KICAD, ""),
]

COLUMNS = ["key", "mpn", "manufacturer", "lcsc", "digikey", "tiers", "role", "function", "qty_tier_b",
           "est_usd_q1", "price_source", "lcsc_stock", "jlc_library", "datasheet_url", "datasheet_sha256",
           "symbol", "footprint", "model_3d", "licence", "notes"]


def sha256(mpn):
    f = DATASHEETS / (safe_name(mpn) + ".pdf")
    return hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else ""


def safe_name(mpn):
    return "".join(ch if ch.isalnum() or ch in "-_.+" else "_" for ch in mpn)


def main():
    offline = "--offline" in sys.argv
    today = dt.date.today().isoformat()
    rows = []
    for (key, mpn, mfr, lcsc, dk, tiers, role, func, qty, price, psrc, ds, sym, fp, m3d, lic, notes) in PARTS:
        stock = lib = ""
        if lcsc and not offline:
            snap = jlc_api.lookup(lcsc)
            if snap:
                stock, lib = snap["stock"], snap["library"]
                if price is None and snap["price_q1"] is not None:
                    price = round(snap["price_q1"], 4)
                    psrc = f"JLCPCB/LCSC qty 1 snapshot {today}"
                if not ds:
                    ds = snap["datasheet"]
            else:
                notes = (notes + " " if notes else "") + f"[LCSC {lcsc} not found {today}]"
        rows.append(dict(zip(COLUMNS, [key, mpn, mfr, lcsc, dk, tiers, role, func, qty,
                                       "" if price is None else price, psrc, stock, lib, ds, sha256(mpn),
                                       sym, fp, m3d, lic, notes])))
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} parts -> {OUT}")


if __name__ == "__main__":
    main()
