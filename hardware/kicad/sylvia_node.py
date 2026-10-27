"""Sylvia Node Tier B: schematic as code (SKiDL) -> KiCad 9 netlist.

    hardware/.venv/Scripts/python -I hardware/kicad/sylvia_node.py

Outputs (next to this file): sylvia-node.net (import into the PCB editor), sylvia_node.erc, bom-draft.csv.
Exit code 1 if ERC reports any error or warning.

Every value here is explained in docs/reference-circuits.md; pins in docs/pin-map.md; addresses in
docs/i2c-map.md. Reference designators are fixed (tag = ref) so regenerating the netlist keeps the
PCB layout attached to the same footprints.

Adding parts: R()/C()/TP() number in call order, so a part inserted mid-file would renumber everything after
it. Give every new passive the next free designator explicitly (ref="R50") instead. Never renumber.
"""
import builtins
import csv
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
os.environ.setdefault("KIPRJMOD", str(HERE))  # lets SKiDL resolve the project fp-lib-table
os.chdir(HERE)  # SKiDL writes its .erc/.log next to the current directory

import skidl  # noqa: E402
from skidl import ERC, POWER, Net, Part, generate_netlist, set_default_tool  # noqa: E402

NC = builtins.NC  # SKiDL's no-connect net
set_default_tool("kicad9")
skidl.lib_search_paths["kicad9"] = [str(HERE / "lib")]
skidl.footprint_search_paths["kicad9"] = [str(HERE)]

LIB = "sylvia"
FP_R = {"0402": "sylvia:R_0402_1005Metric", "0603": "sylvia:R_0603_1608Metric", "0805": "sylvia:R_0805_2012Metric"}
FP_C = {"0402": "sylvia:C_0402_1005Metric", "0603": "sylvia:C_0603_1608Metric", "0805": "sylvia:C_0805_2012Metric"}
# JLCPCB basic/extended parts for passives (LCSC numbers, snapshot 2026-10-25; see parts/parts.csv).
# Every number below was checked against JLCPCB with tools/check_bom_lcsc.py (value + package).
LCSC_R = {"10k": "C25744", "4.7k": "C25900", "5.1k": "C25905", "1M": "C26083", "100k": "C25741",
          "1k": "C11702", "180k": "C25760", "270k": "C25770", "71.5k": "C43534", "4.42k": "C52269",
          "21.5k": "C25872", "732k": "C27016", "100R": "C25076", "0.1R": "C127687", "309k": "C122546",
          "80.6k": "C25921"}
LCSC_0R = {"0402": "C17168", "0603": "C21189"}
LCSC_C = {"100nF": "C1525", "1uF": "C15849", "10uF": "C19702", "22uF": "C45783", "4.7nF": "C1538", "1nF": "C1523",
          "4.7uF": "C19666"}

_count = {}


def part(lib_name, ref, value=None, footprint=None, lcsc="", dnp=False, note=""):
    p = Part(LIB, lib_name, ref=ref, tag=ref, footprint=footprint, value=value or lib_name)
    p.fields["LCSC"] = lcsc
    if dnp:
        p.fields["DNP"] = "DNP"
    if note:
        p.fields["Note"] = note
    return p


def ref(prefix):
    _count[prefix] = _count.get(prefix, 0) + 1
    return f"{prefix}{_count[prefix]}"


def R(value, a, b, size="0402", dnp=False, note="", designator=None):
    fp = FP_R["0805" if value == "0.1R" else size]
    lcsc = LCSC_0R[size] if value == "0R" else LCSC_R.get(value, "")
    r = part("R", designator or ref("R"), value, fp, lcsc, dnp, note)
    r[1] += a
    r[2] += b
    return r


def C(value, a, b, size=None, dnp=False, note="", designator=None):
    size = size or ("0805" if value == "22uF" else "0603" if value in ("10uF", "1uF", "4.7uF") else "0402")
    c = part("C", designator or ref("C"), value, FP_C[size], LCSC_C.get(value, ""), dnp, note)
    c[1] += a
    c[2] += b
    return c


def TP(net, label):
    t = part("TestPoint", ref("TP"), label, "sylvia:TestPoint_Pad_D1.5mm")
    t[1] += net
    return t


def JUMPER(a, b, label):
    """Bridged solder jumper on a power path: cut to isolate a subsystem at bring-up."""
    j = part("SolderJumper_2_Bridged", ref("JP"), label, "sylvia:SolderJumper-2_P1.3mm_Bridged_RoundedPad1.0x1.5mm")
    j[1] += a
    j[2] += b
    return j


def power(name):
    n = Net(name)
    n.drive = POWER
    return n


# ------------------------------------------------------------------ nets
GND = power("GND")
VBUS = power("VBUS")            # USB-C 5 V
SOLAR = power("SOLAR_IN")       # panel after the TVS
VCHG = power("VCHG")            # charger input (diode-OR of solar and USB)
VCELL = power("VCELL")          # cells, before the fuse
VBAT = power("VBAT")            # battery after the fuse (charger output, fuel gauge, supervisor)
VBAT_SYS = power("VBAT_SYS")    # buck-boost input (JP1)
V3V3_REG = power("3V3_REG")     # buck-boost output (JP2)
V3V3 = power("3V3")             # always-on 3.3 V
V3V3_SEN = power("3V3_SEN")     # switched: SEN66 + its I2C pull-ups
V3V3_ALT = power("3V3_ALT")     # switched: alternates (boost input)
V5_ALT = power("5V_ALT")        # 5 V for PMSA003I / ZE07-CO (DNP boost)
V3V3_CO = power("3V3_CO")       # CO front end (0R isolation)
V3V3_LORA = power("3V3_LORA")   # RAK3172 (0R isolation)
VREF_BQ = power("VREF_BQ")      # BQ24650 3.3 V reference output
REGN = power("REGN")            # BQ24650 6 V gate-drive rail

I2C0_SDA, I2C0_SCL = Net("I2C0_SDA"), Net("I2C0_SCL")
I2C1_SDA, I2C1_SCL = Net("I2C1_SDA"), Net("I2C1_SCL")

# ------------------------------------------------------------------ MCU (U1)
U1 = part("ESP32-S3-WROOM-1", "U1", "ESP32-S3-WROOM-1-N8R8", "sylvia:ESP32-S3-WROOM-1", "C2913201")
U1["3V3"] += V3V3
U1["GND"] += GND
C("22uF", V3V3, GND, note="U1 bulk")
C("100nF", V3V3, GND, note="U1 decoupling")
EN = Net("ESP_EN")
U1["EN"] += EN
R("10k", V3V3, EN)
C("1uF", EN, GND, note="EN RC delay per Espressif")
SW1 = part("TS-1187A", "SW1", "RESET", "sylvia:SW-SMD_4P-L5.1-W5.1-P3.70-LS6.5-TL_H1.5", "C318884")
SW1["A"] += EN  # A-B and C-D are joined inside the switch: pressing joins AB to CD
SW1["B"] += EN
SW1["C"] += GND
SW1["D"] += GND
BOOT = Net("ESP_BOOT")
U1["IO0"] += BOOT
R("10k", V3V3, BOOT)
SW2 = part("TS-1187A", "SW2", "BOOT", "sylvia:SW-SMD_4P-L5.1-W5.1-P3.70-LS6.5-TL_H1.5", "C318884")
SW2["A"] += BOOT  # A-B and C-D are joined inside the switch: pressing joins AB to CD
SW2["B"] += BOOT
SW2["C"] += GND
SW2["D"] += GND
for pin in ("IO3", "IO45", "IO46", "IO35", "IO36", "IO37"):
    U1[pin] += NC  # strapping pins left at their defaults; 35-37 belong to the octal PSRAM

U1["IO4"] += I2C0_SDA
U1["IO5"] += I2C0_SCL
U1["IO6"] += I2C1_SDA
U1["IO7"] += I2C1_SCL
USB_DM, USB_DP = Net("USB_D-"), Net("USB_D+")
U1["USB_D-"] += USB_DM
U1["USB_D+"] += USB_DP

TXD0, RXD0 = Net("UART0_TX"), Net("UART0_RX")
U1["TXD0"] += TXD0
U1["RXD0"] += RXD0
J6 = part("Conn_01x04", "J6", "UART0", "sylvia:PinHeader_1x04_P2.54mm_Vertical")
J6[1] += V3V3
J6[2] += TXD0
J6[3] += RXD0
J6[4] += GND

# LED + buzzer
LED_N = Net("LED")
U1["IO14"] += LED_N
D7 = part("LED", "D7", "green", "sylvia:LED_0603_1608Metric", "C12624")
LED_A = Net("LED_A")
R("1k", LED_N, LED_A)
D7["A"] += LED_A
D7["K"] += GND
BUZ = Net("BUZZER")
U1["IO15"] += BUZ
Q3 = part("2N7002", "Q3", "2N7002", "sylvia:SOT-23", "C8545", dnp=True, note="buzzer driver")
BUZ_G, BUZ_D = Net("BUZ_G"), Net("BUZ_D")
R("100R", BUZ, BUZ_G, dnp=True)
R("100k", BUZ_G, GND, dnp=True)
Q3["G"] += BUZ_G
Q3["S"] += GND
Q3["D"] += BUZ_D
BZ1 = part("MLT-8530", "BZ1", "MLT-8530", "sylvia:BUZ-SMD_4P-L8.5-W8.5-P8.50-BR", "C94599", dnp=True)
BZ1["+"] += V3V3
# Datasheet p.2: '+' and '-' leads share one edge, the other two corners are dummy pads. In the EasyEDA
# footprint '+' is pad 1 (bottom-left), so '-' is pad 4 (left edge). Verify on the part before fitting.
BZ1["4"] += BUZ_D
BZ1["2"] += NC
BZ1["3"] += NC
D6 = part("1N4148WS", "D6", "1N4148WS", "sylvia:D_SOD-323", "C2128", dnp=True)
D6["K"] += V3V3
D6["A"] += BUZ_D

TAMPER = Net("TAMPER")
U1["IO21"] += TAMPER
R("100k", V3V3, TAMPER)
TP(TAMPER, "TAMPER")
TP(GND, "TAMPER_GND")
SPARE48 = Net("IO48_SPARE")
U1["IO48"] += SPARE48
TP(SPARE48, "IO48")

# ------------------------------------------------------------------ USB-C + ESD + VBUS path
J1 = part("USB_C_Receptacle_USB2.0_16P", "J1", "TYPE-C-31-M-12", "sylvia:USB_C_Receptacle_HRO_TYPE-C-31-M-12",
          "C165948")
J1["VBUS"] += VBUS
J1["GND"] += GND
J1["D-"] += USB_DM
J1["D+"] += USB_DP
CC1, CC2 = Net("CC1"), Net("CC2")
J1["CC1"] += CC1
J1["CC2"] += CC2
R("5.1k", CC1, GND, note="UFP sink")
R("5.1k", CC2, GND, note="UFP sink")
J1["SBU1"] += NC
J1["SBU2"] += NC
SHIELD = Net("USB_SHIELD")
J1["SHIELD"] += SHIELD
R("1M", SHIELD, GND)
C("4.7nF", SHIELD, GND)
U13 = part("USBLC6-2SC6", "U13", "USBLC6-2SC6", "sylvia:SOT-23-6", "C7519")
# Pins 1/6 and 3/4 are joined inside the USBLC6 (ST fig. 1): one net per line, routed flow-through.
U13[1] += USB_DM
U13[6] += USB_DM
U13[3] += USB_DP
U13[4] += USB_DP
U13["VBUS"] += VBUS
U13["GND"] += GND
C("4.7uF", VBUS, GND, note="VBUS bulk (USB limit 10 uF)")
# TPS2121 power mux (datasheet SLVSEA3F): IN1 = USB with priority, IN2 = solar. CP2 = GND and PR1 above VREF
# (1.06 V) selects IN1 (Table 9-3), so USB always wins when present: no hunting between a loaded panel and USB.
# Replaces an LM66100, whose 6 V absolute maximum the panel (~7.5 V open-circuit) would exceed.
SOLAR_MUX = power("SOLAR_MUX")  # panel after the reverse-polarity diode
U14 = part("TPS2121RUX", "U14", "TPS2121RUXR", "sylvia:VQFN-HR-12_L2.5-W2.0-P0.50-BL", "C485916",
           note="USB/solar power mux, 2.8-22 V")
U14["IN1"] += VBUS
U14["IN2"] += SOLAR_MUX
U14["OUT"] += VCHG
U14["GND"] += GND
C("1uF", VBUS, GND, note="U14 IN1", designator="C38")
C("1uF", SOLAR_MUX, GND, note="U14 IN2", designator="C39")
PR1 = Net("MUX_PR1")
U14["PR1"] += PR1
R("309k", VBUS, PR1, note="USB selected above 1.06*(1+309/100) = 4.33 V", designator="R47")
R("100k", PR1, GND, designator="R48")
U14["CP2"] += GND   # priority mode (not comparator mode)
U14["OV1"] += GND   # overvoltage supervisors unused (datasheet: connect to GND)
U14["OV2"] += GND
U14["ST"] += GND    # status unused (datasheet: connect to GND); VBUS_DET tells firmware about USB
U14["ST"].func = skidl.Pin.types.PASSIVE  # grounded open-drain output by design: not a drive conflict
MUX_ILM, MUX_SS = Net("MUX_ILM"), Net("MUX_SS")
U14["ILM"] += MUX_ILM
R("80.6k", MUX_ILM, GND, note="I_LM = 65.2 / 80.6^0.861 = 1.5 A (datasheet eq. 2)", designator="R49")
U14["SS"] += MUX_SS
C("100nF", MUX_SS, GND, note="soft start ~780 V/s: ~35 mA inrush into VCHG", designator="C40")
VBUS_DET = Net("VBUS_DET")
R("100k", VBUS, VBUS_DET)
R("100k", VBUS_DET, GND)
U1["IO38"] += VBUS_DET
TP(VBUS, "VBUS")

# ------------------------------------------------------------------ solar input
J3 = part("Conn_01x02", "J3", "SOLAR 6V", "sylvia:JST_PH_S2B-PH-K_1x02_P2.00mm_Horizontal", "C173752")
J3[1] += SOLAR
J3[2] += GND
D1 = part("SMF12A", "D1", "SMF12A", "sylvia:D_SOD-123F", "C123800", note="pin 1 = cathode")
D1[1] += SOLAR
D1[2] += GND
D2 = part("D_Schottky", "D2", "B5819W", "sylvia:D_SOD-123", "C8598", note="reverse-polarity block (IN2 min -0.3 V)")
D2["A"] += SOLAR
D2["K"] += SOLAR_MUX
TP(SOLAR, "SOLAR_IN")

# ------------------------------------------------------------------ charger U6 BQ24650
U6 = part("BQ24650", "U6", "BQ24650RVAR",
          "sylvia:Texas_RVA_VQFN-16-1EP_3.5x3.5mm_P0.5mm_EP2.14x2.14mm_ThermalVias", "C53712")
U6["VCC"] += VCHG
C("22uF", VCHG, GND, note="25 V")
C("22uF", VCHG, GND, note="25 V")
C("100nF", VCHG, GND)
MPPSET = Net("MPPSET")
U6["MPPSET"] += MPPSET
R("270k", VCHG, MPPSET, note="MPPSET: VCHG regulated to 1.2*(1+270/100) = 4.44 V")
R("100k", MPPSET, GND)
Q4 = part("2N7002", "Q4", "2N7002", "sylvia:SOT-23", "C8545", note="pulls MPPSET low = charge disabled")
CHG_INH = Net("CHG_INHIBIT")
U1["IO10"] += CHG_INH
Q4["G"] += CHG_INH
R("100k", CHG_INH, GND, note="charging enabled by default")
Q4["D"] += MPPSET
Q4["S"] += GND
STAT1, STAT2 = Net("CHG_STAT1"), Net("CHG_STAT2")
U6["STAT1"] += STAT1
U6["STAT2"] += STAT2
R("10k", V3V3, STAT1)
R("10k", V3V3, STAT2)
U1["IO12"] += STAT1
U1["IO13"] += STAT2
TP(STAT1, "CHG_STAT1")
TP(STAT2, "CHG_STAT2")
U6["VREF"] += VREF_BQ
C("1uF", VREF_BQ, GND)
U6["TERM_EN"] += VREF_BQ
TS = Net("CHG_TS")
U6["TS"] += TS
R("4.42k", VREF_BQ, TS, note="TS window 0..45 C with 10k B3380 NTC")
R("21.5k", TS, GND)
TH1 = part("Thermistor_NTC", "TH1", "10k B3380", "sylvia:R_0603_1608Metric", "C13564", note="against the cells")
TH1[1] += TS
TH1[2] += GND
U6["REGN"] += REGN
C("1uF", REGN, GND)
BTST, PH, HIDRV, LODRV = Net("CHG_BTST"), Net("CHG_PH"), Net("CHG_HIDRV"), Net("CHG_LODRV")
U6["BTST"] += BTST
U6["PH"] += PH
U6["HIDRV"] += HIDRV
U6["LODRV"] += LODRV
D3 = part("D_Schottky", "D3", "1N5819WS", "sylvia:D_SOD-323", "C191023", note="bootstrap")
D3["A"] += REGN
D3["K"] += BTST
C("100nF", BTST, PH)
Q1 = part("AO3400A", "Q1", "AO3400A", "sylvia:SOT-23", "C20917", note="high side")
Q1["G"] += HIDRV
Q1["D"] += VCHG
Q1["S"] += PH
Q2 = part("AO3400A", "Q2", "AO3400A", "sylvia:SOT-23", "C20917", note="low side")
Q2["G"] += LODRV
Q2["D"] += PH
Q2["S"] += GND
SRP = Net("CHG_SRP")
L1 = part("L", "L1", "15uH", "sylvia:L_Sunlord_SWPA6045S", "C83374")
L1[1] += PH
L1[2] += SRP
U6["SRP"] += SRP
U6["SRN"] += VBAT
R("0.1R", SRP, VBAT, note="charge current 40 mV / 0.1 ohm = 400 mA")
C("100nF", SRP, VBAT)
C("100nF", VBAT, GND)
C("22uF", VBAT, GND)
VFB = Net("CHG_VFB")
U6["VFB"] += VFB
R("71.5k", VBAT, VFB, note="float = 2.1*(1+71.5/100) = 3.60 V (LiFePO4)")
R("100k", VFB, GND)
U6["GND"] += GND

# ------------------------------------------------------------------ battery, fuel gauge, supervisor
BT1 = part("Battery_Cell", "BT1", "LiFePO4 18650", "sylvia:BatteryHolder_Keystone_1042_1x18650", "C5249310")
BT2 = part("Battery_Cell", "BT2", "LiFePO4 18650", "sylvia:BatteryHolder_Keystone_1042_1x18650", "C5249310")
for bt in (BT1, BT2):
    bt["+"] += VCELL
    bt["-"] += GND
F1 = part("Fuse", "F1", "2A", "sylvia:Fuse_1206_3216Metric", "C3105")
F1[1] += VCELL
F1[2] += VBAT
TP(VBAT, "VBAT")
TP(VCHG, "VCHG")

U7 = part("MAX17048G", "U7", "MAX17048G+T10", "sylvia:TDFN-8_L2.0-W2.0-P0.50-BL-EP1.2", "C2682616")
U7["VDD"] += VBAT
U7["CELL"] += VBAT
C("100nF", VBAT, GND, note="U7 VDD")
U7["GND"] += GND
U7["EP"] += GND
U7["CTG"] += GND
U7["QSTRT"] += GND
FG_ALRT = Net("FG_ALRT")
U7["~{ALRT}"] += FG_ALRT
R("10k", V3V3, FG_ALRT)
U1["IO11"] += FG_ALRT
TP(FG_ALRT, "FG_ALRT")
U7["SCL"] += I2C0_SCL
U7["SDA"] += I2C0_SDA

BB_EN = Net("BB_EN")
U9 = part("TPS3840PL27DBV", "U9", "TPS3840PL27", "sylvia:SOT-23-5_L2.9-W1.6-P0.95-LS2.8-BR", "C2066421",
          note="cuts 3.3 V below 2.7 V")
U9["VDD"] += VBAT
C("100nF", VBAT, GND, note="U9 VDD")
U9["GND"] += GND
U9["~{MR}/NC"] += NC
U9["CT"] += NC
U9["~{RESET}"] += BB_EN
TP(BB_EN, "BB_EN")

# ------------------------------------------------------------------ 3.3 V buck-boost U8
JUMPER(VBAT, VBAT_SYS, "JP1 VBAT->SYS")
U8 = part("TPS63020DSJR", "U8", "TPS63020DSJR", "sylvia:VSON-14_L4.0-W3.0-P0.50-BL-EP_TI_DSJ", "C15483")
U8["VIN"] += VBAT_SYS
U8["VINA"] += VBAT_SYS
C("10uF", VBAT_SYS, GND)
C("10uF", VBAT_SYS, GND)
C("100nF", VBAT_SYS, GND, note="VINA")
U8["EN"] += BB_EN
U8["PS/SYNC"] += GND
U8["GND"] += GND
U8["PGND"] += GND
SW_L1, SW_L2 = Net("BB_L1"), Net("BB_L2")
U8["L1"] += SW_L1
U8["L2"] += SW_L2
L2 = part("L", "L2", "1.5uH", "sylvia:L_Sunlord_SWPA4020S", "C42099")
L2[1] += SW_L1
L2[2] += SW_L2
U8["VOUT"] += V3V3_REG
for _ in range(3):
    C("22uF", V3V3_REG, GND)
FB = Net("BB_FB")
U8["FB"] += FB
R("1M", V3V3_REG, FB, note="VOUT = 0.5*(1+1000/180) = 3.28 V (TI table)")
R("180k", FB, GND)
BB_PG = Net("BB_PG")
U8["PG"] += BB_PG
TP(BB_PG, "BB_PG")
JUMPER(V3V3_REG, V3V3, "JP2 3V3 out")
TP(V3V3, "3V3")
TP(GND, "GND")
TP(GND, "GND")

# ------------------------------------------------------------------ load switches
EN_SEN, EN_ALT = Net("EN_SEN"), Net("EN_ALT")
U1["IO8"] += EN_SEN
U1["IO9"] += EN_ALT
U10 = part("TPS22918DBV", "U10", "TPS22918", "sylvia:SOT-23-6_L2.9-W1.6-P0.95-LS2.8-BR", "C131941", note="LS1 SEN66")
U10["VIN"] += V3V3
U10["GND"] += GND
U10["ON"] += EN_SEN
R("100k", EN_SEN, GND, note="off by default")
CT1 = Net("LS1_CT")
U10["CT"] += CT1
C("1nF", CT1, GND, note="slow ramp for SEN66 inrush")
U10["QOD"] += V3V3_SEN
U10["VOUT"] += V3V3_SEN
C("1uF", V3V3, GND, note="U10 VIN")
C("10uF", V3V3_SEN, GND)
TP(V3V3_SEN, "3V3_SEN")

U11 = part("TPS22918DBV", "U11", "TPS22918", "sylvia:SOT-23-6_L2.9-W1.6-P0.95-LS2.8-BR", "C131941", note="LS2 alternates")
U11["VIN"] += V3V3
U11["GND"] += GND
U11["ON"] += EN_ALT
R("100k", EN_ALT, GND, note="off by default")
U11["CT"] += NC
U11["QOD"] += V3V3_ALT
U11["VOUT"] += V3V3_ALT
C("1uF", V3V3_ALT, GND)
TP(V3V3_ALT, "3V3_ALT")

# 5 V boost for the alternates (DNP on the default build)
U12 = part("TPS61023DRL", "U12", "TPS61023", "sylvia:SOT-563_L1.6-W1.2-P0.50-LS1.6-BR", "C919459", dnp=True)
U12["VIN"] += V3V3_ALT
U12["EN"] += V3V3_ALT
U12["GND"] += GND
BST_SW = Net("BST_SW")
U12["SW"] += BST_SW
L3 = part("L", "L3", "1uH", "sylvia:L_Sunlord_SWPA4020S", "C91254", dnp=True)
L3[1] += V3V3_ALT
L3[2] += BST_SW
C("10uF", V3V3_ALT, GND, dnp=True)
U12["VOUT"] += V5_ALT
C("22uF", V5_ALT, GND, dnp=True)
BST_FB = Net("BST_FB")
U12["FB"] += BST_FB
R("732k", V5_ALT, BST_FB, dnp=True, note="VOUT = 0.6*(1+732/100) = 4.99 V")
R("100k", BST_FB, GND, dnp=True)
TP(V5_ALT, "5V_ALT")

# ------------------------------------------------------------------ SEN66 (J2) on I2C1
J2 = part("SEN66_Conn", "J2", "SEN66", "sylvia:JST_GH_SM06B-GHS-TB_1x06-1MP_P1.25mm_Horizontal", "C133065")
J2["VDD"] += V3V3_SEN
J2["GND"] += GND
J2["SDA"] += I2C1_SDA
J2["SCL"] += I2C1_SCL
J2["SHIELD"] += GND
R("4.7k", V3V3_SEN, I2C1_SDA, note="pull-ups on the switched rail: no back-feed")
R("4.7k", V3V3_SEN, I2C1_SCL)
for net, r in ((I2C1_SDA, "D4"), (I2C1_SCL, "D5")):
    d = part("ESD9B5.0ST5G", r, "ESD9B5.0ST5G", "sylvia:D_SOD-923", "C111566")
    d[1] += net
    d[2] += GND
TP(I2C1_SDA, "I2C1_SDA")
TP(I2C1_SCL, "I2C1_SCL")

# PMSA003I alternate (J4, DNP header on the same bus)
J4 = part("PMSA003I_Conn", "J4", "PMSA003I", "sylvia:PinHeader_2x05_P1.27mm_Vertical", "", dnp=True)
J4["VCC"] += V5_ALT
J4["GND"] += GND
J4["SCL"] += I2C1_SCL
J4["SDA"] += I2C1_SDA
PM_SET = Net("PM_SET")
J4["SET"] += PM_SET
U1["IO40"] += PM_SET
J4["~{RESET}"] += NC
J4[6] += NC
J4[8] += NC

# ------------------------------------------------------------------ on-board I2C0 + BME688
R("4.7k", V3V3, I2C0_SDA)
R("4.7k", V3V3, I2C0_SCL)
TP(I2C0_SDA, "I2C0_SDA")
TP(I2C0_SCL, "I2C0_SCL")
U3 = part("BME680", "U3", "BME688", "sylvia:Bosch_LGA-8_3x3mm_P0.8mm_ClockwisePinNumbering", "C3664478")
U3["VDD"] += V3V3
U3["VDDIO"] += V3V3
C("100nF", V3V3, GND, note="U3 VDD")
C("100nF", V3V3, GND, note="U3 VDDIO")
U3["GND"] += GND
U3["CSB"] += V3V3
U3["SDI"] += I2C0_SDA
U3["SCK"] += I2C0_SCL
U3["SDO"] += GND

# ------------------------------------------------------------------ CO front end: SPEC 110-102 + LMP91000 + ADS1115
R("0R", V3V3, V3V3_CO, size="0603", note="isolation: CO front end")
TP(V3V3_CO, "3V3_CO")
U4 = part("LMP91000SD", "U4", "LMP91000SDX/NOPB", "sylvia:WSON-14_L4.0-W4.0-P0.50-BL-EP-1", "C2651584")
U4["VDD"] += V3V3_CO
C("100nF", V3V3_CO, GND, note="U4 VDD")
C("10uF", V3V3_CO, GND)
U4["GND"] += GND
U4["AGND"] += GND
U4["DAP"] += GND
U4["MENB"] += GND
U4["NC"] += NC
U4["SCL"] += I2C0_SCL
U4["SDA"] += I2C0_SDA
VREF_CO = Net("VREF_CO")
R("1k", V3V3_CO, VREF_CO, note="RC-filtered external reference for the LMP91000")
C("1uF", VREF_CO, GND)
U4["VREF"] += VREF_CO
CO_VOUT, TIA_C1, TIA_C2 = Net("CO_VOUT"), Net("TIA_C1"), Net("TIA_C2")
U4["VOUT"] += CO_VOUT
U4["C1"] += TIA_C1
U4["C2"] += TIA_C2
C("100nF", TIA_C1, TIA_C2, dnp=True, note="optional TIA low-pass")
WE, RE, CE = Net("CO_WE"), Net("CO_RE"), Net("CO_CE")
U4["WE"] += WE
U4["RE"] += RE
U4["CE"] += CE
U15 = part("SPEC_110-102", "U15", "110-102", "sylvia:SPEC_110-102_THT", "",
           note="HAND-SOLDER ONLY after reflow; never reflow")
U15[1] += WE
U15[6] += WE
U15[4] += RE
U15[5] += CE
U15[2] += NC
U15[3] += NC
TP(CO_VOUT, "CO_VOUT")
CO_ADC = Net("CO_ADC_ESP")
R("1k", CO_VOUT, CO_ADC, note="backup: ESP32 ADC1_CH0")
U1["IO1"] += CO_ADC

U5 = part("ADS1115IDGS", "U5", "ADS1115IDGSR", "sylvia:VSSOP-10_3x3mm_P0.5mm", "C37593")
U5["VDD"] += V3V3_CO
C("100nF", V3V3_CO, GND, note="U5 VDD")
U5["GND"] += GND
U5["ADDR"] += V3V3_CO  # 0x49 (LMP91000 owns 0x48)
U5["SDA"] += I2C0_SDA
U5["SCL"] += I2C0_SCL
ADC_RDY = Net("ADC_RDY")
U5["ALERT/RDY"] += ADC_RDY
R("10k", V3V3, ADC_RDY)
U1["IO47"] += ADC_RDY
U5["AIN0"] += CO_VOUT
U5["AIN1"] += VREF_CO
ZE_DAC = Net("ZE07_DAC")
U5["AIN2"] += ZE_DAC
R("100k", ZE_DAC, GND, note="defined level when ZE07 is not fitted")
AIN3 = Net("ADC_AIN3")
U5["AIN3"] += AIN3
R("100k", AIN3, GND)
TP(AIN3, "AIN3")

# ZE07-CO alternate (U16, DNP pads)
U16 = part("ZE07-CO", "U16", "ZE07-CO", "sylvia:SENSOR-TH_ZE07-CO", "C141345", dnp=True)
U16["Vin"] += V5_ALT
U16["GND"] += GND
ZE_TX, ZE_RX = Net("ZE07_TXD"), Net("ZE07_RXD")
U16["TXD"] += ZE_TX
U16["RXD"] += ZE_RX
U16["DAC"] += ZE_DAC
ALT_RX, ALT_TX = Net("ALT_UART_RX"), Net("ALT_UART_TX")
R("1k", ZE_TX, ALT_RX, dnp=True, note="ZE07 UART is 3.0 V logic")
R("1k", ALT_TX, ZE_RX, dnp=True)
U1["IO41"] += ALT_RX
U1["IO42"] += ALT_TX
ZE_ADC = Net("ZE07_ADC_ESP")
R("0R", ZE_DAC, ZE_ADC, dnp=True)
U1["IO2"] += ZE_ADC
for p in U16.pins:
    if p.name in ("RESERVED", "NC"):
        p += NC

# ------------------------------------------------------------------ LoRaWAN U2 RAK3172
R("0R", V3V3, V3V3_LORA, size="0603", note="isolation: LoRa")
U2 = part("RAK3172-xx-9-SM-xI", "U2", "RAK3172-9-SM-I", "sylvia:RAK3172", "C19723905")
U2["VDD"] += V3V3_LORA
C("10uF", V3V3_LORA, GND)
C("100nF", V3V3_LORA, GND)
U2["GND"] += GND
LORA_TX, LORA_RX = Net("LORA_TX"), Net("LORA_RX")      # named from the ESP32's side
RAK_RX, RAK_TX = Net("RAK_UART2_RX"), Net("RAK_UART2_TX")
U1["IO17"] += LORA_TX
U1["IO18"] += LORA_RX
R("0R", LORA_TX, RAK_RX, size="0603", note="isolation: LoRa UART")
R("0R", RAK_TX, LORA_RX, size="0603")
U2["UART2_RX/PA3"] += RAK_RX
U2["UART2_TX/PA2"] += RAK_TX
TP(LORA_TX, "LORA_TX")
TP(LORA_RX, "LORA_RX")
LORA_RST, LORA_BOOT = Net("LORA_RST"), Net("LORA_BOOT0")
U1["IO16"] += LORA_RST
U2["~{RST}"] += LORA_RST
R("10k", V3V3_LORA, LORA_RST)
U1["IO39"] += LORA_BOOT
U2["BOOT0"] += LORA_BOOT
R("10k", LORA_BOOT, GND, note="boot from flash by default")
SWDIO, SWCLK = Net("RAK_SWDIO"), Net("RAK_SWCLK")
U2["PA13/SWDIO"] += SWDIO
U2["PA14/SWCLK"] += SWCLK
J7 = part("Conn_01x05", "J7", "RAK SWD", "sylvia:PinHeader_1x05_P2.54mm_Vertical")
J7[1] += V3V3_LORA
J7[2] += SWDIO
J7[3] += SWCLK
J7[4] += LORA_RST
J7[5] += GND
U2["RF"] += NC  # -I variant: antenna on the module's IPEX
for p in U2.pins:
    if not p.nets and p.name not in ("RF",):
        p += NC

# ------------------------------------------------------------------ ERC + outputs


# ESP32 GPIOs that only read open-drain status lines are typed as inputs, so ERC checks the drive properly.
for pin in ("IO11", "IO12", "IO13", "IO47", "IO38", "IO21"):
    U1[pin].func = skidl.Pin.types.INPUT
for p in U1.pins:  # anything still unassigned is a deliberate no-connect
    if not p.nets:
        p += NC


def bom(path):
    rows = {}
    for p in builtins.default_circuit.parts:
        if not p.footprint:
            continue
        key = (p.value, p.footprint, p.fields.get("LCSC", ""), p.fields.get("DNP", ""))
        rows.setdefault(key, []).append(p.ref)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Comment", "Designator", "Footprint", "LCSC", "Qty", "DNP"])
        for (val, fp, lcsc, dnp), refs in sorted(rows.items(), key=lambda kv: kv[1][0]):
            w.writerow([val, ",".join(sorted(refs, key=lambda s: (s.rstrip("0123456789"), int("0" + s.lstrip("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))))),
                        fp.split(":")[-1], lcsc, len(refs), dnp])


if __name__ == "__main__":
    ERC()  # SKiDL writes <script>.erc next to the script
    generate_netlist(file_=str(HERE / "sylvia-node.net"))
    bom(HERE / "bom-draft.csv")
    erc = (HERE / "sylvia_node.erc").read_text(encoding="utf-8", errors="replace")
    missing = sorted({p.footprint for p in builtins.default_circuit.parts
                      if not (HERE / "lib" / "sylvia.pretty" / (p.footprint.split(":")[-1] + ".kicad_mod")).exists()})
    if missing:
        print("MISSING FOOTPRINTS:", missing)
    bad = [line for line in erc.splitlines() if "ERC WARNING" in line or "ERC ERROR" in line]
    print(f"parts: {len(builtins.default_circuit.parts)}  nets: {len(builtins.default_circuit.get_nets())}")
    print("\n".join(bad) if bad else "ERC: 0 errors, 0 warnings")
    sys.exit(1 if bad or missing else 0)
