"""Assemble the project KiCad library: hardware/kicad/lib/{sylvia.kicad_sym, sylvia.pretty/, 3dmodels/}.

    python -I hardware/tools/build_library.py

Sources, in the plan's order of preference:
 1. KiCad 9 official libraries (local install, CC-BY-SA-4.0 + library exception)
 2. easyeda2kicad output by LCSC number (staged in _staging/batch1/cad/)
 3. Manufacturer CAD (Sensirion STEP) -> 3dmodels/mfr/ (gitignored: no redistribution licence)
 4. Drawn here from the datasheet (SPEC 110-102, SEN66 connector, PMSA003I connector) + placeholder boxes

EasyEDA symbols come with every pin "unspecified"; PIN_TYPES below assigns real electrical types so
ERC means something. Every 3D reference is rewritten to ${KIPRJMOD}/lib/3dmodels/.
"""
import pathlib
import re
import shutil
import sys

HW = pathlib.Path(__file__).resolve().parents[1]
KICAD = pathlib.Path(r"C:/Program Files/KiCad/9.0/share/kicad")
STAGE = HW / "_staging" / "batch1" / "cad"
LIB = HW / "kicad" / "lib"
SYM_OUT = LIB / "sylvia.kicad_sym"
FP_OUT = LIB / "sylvia.pretty"
M3D_OUT = LIB / "3dmodels"
MODEL_PREFIX = "${KIPRJMOD}/lib/3dmodels/"

OFFICIAL_SYMBOLS = {
    "RF_Module": ["ESP32-S3-WROOM-1", "RAK3172-xx-9-SM-xI"],
    "Sensor": ["BME680"],
    "Analog_ADC": ["ADS1115IDGS"],
    "Battery_Management": ["BQ24650"],
    "Connector": ["USB_C_Receptacle_USB2.0_16P", "TestPoint"],
    "Power_Protection": ["USBLC6-2SC6"],
    "Power_Management": ["LM66100DCK"],
    "Transistor_FET": ["AO3400A", "2N7002"],
    "Diode": ["SMF12A", "ESD9B5.0ST5G", "1N4148WS"],
    "Device": ["R", "C", "L", "LED", "D_Schottky", "Fuse", "Thermistor_NTC", "Buzzer", "Battery_Cell", "NetTie_2"],
    "Switch": ["SW_Push"],
    "Connector_Generic": ["Conn_01x02", "Conn_01x04", "Conn_01x05", "Conn_01x06", "Conn_02x05_Odd_Even"],
    "Jumper": ["SolderJumper_2_Open", "SolderJumper_2_Bridged"],
    "Mechanical": ["MountingHole"],
    "Sensor_Gas": ["SCD41-D-R2"],
    "Sensor_Humidity": ["SHT4x"],
    "Regulator_Linear": ["AP2112K-3.3"],
}

OFFICIAL_FOOTPRINTS = {
    "RF_Module": ["ESP32-S3-WROOM-1", "ESP32-S3-WROOM-1U", "RAK3172"],
    "Package_LGA": ["Bosch_LGA-8_3x3mm_P0.8mm_ClockwisePinNumbering"],
    "Package_SO": ["VSSOP-10_3x3mm_P0.5mm"],
    "Package_DFN_QFN": ["Texas_RVA_VQFN-16-1EP_3.5x3.5mm_P0.5mm_EP2.14x2.14mm_ThermalVias"],
    "Connector_USB": ["USB_C_Receptacle_HRO_TYPE-C-31-M-12"],
    "Package_TO_SOT_SMD": ["SOT-23", "SOT-23-5", "SOT-23-6", "SOT-363_SC-70-6"],
    "Diode_SMD": ["D_SOD-123F", "D_SOD-123", "D_SOD-323", "D_SOD-923"],
    "Resistor_SMD": ["R_0402_1005Metric", "R_0603_1608Metric", "R_0805_2012Metric"],
    "Capacitor_SMD": ["C_0402_1005Metric", "C_0603_1608Metric", "C_0805_2012Metric"],
    "Inductor_SMD": ["L_Sunlord_SWPA4020S", "L_Sunlord_SWPA6045S"],
    "LED_SMD": ["LED_0603_1608Metric"],
    "Fuse": ["Fuse_1206_3216Metric"],
    "Connector_JST": ["JST_GH_SM06B-GHS-TB_1x06-1MP_P1.25mm_Horizontal", "JST_PH_S2B-PH-K_1x02_P2.00mm_Horizontal"],
    "Connector_PinHeader_2.54mm": ["PinHeader_1x04_P2.54mm_Vertical", "PinHeader_1x05_P2.54mm_Vertical"],
    "Connector_PinHeader_1.27mm": ["PinHeader_2x05_P1.27mm_Vertical"],
    "Battery": ["BatteryHolder_Keystone_1042_1x18650"],
    "TestPoint": ["TestPoint_Pad_D1.5mm"],
    "Jumper": ["SolderJumper-2_P1.3mm_Open_RoundedPad1.0x1.5mm", "SolderJumper-2_P1.3mm_Bridged_RoundedPad1.0x1.5mm"],
    "MountingHole": ["MountingHole_3.2mm_M3_Pad_Via"],
    "Sensor": ["Sensirion_SCD4x-1EP_10.1x10.1mm_P1.25mm_EP4.8x4.8mm"],
    "Sensor_Humidity": ["Sensirion_DFN-4_1.5x1.5mm_P0.8mm_SHT4x_NoCentralPad"],
    "Package_TO_SOT_THT": ["TO-39-4"],
    "Connector_Card": ["nanoSIM_GCT_SIM8060-6-0-14-00"],
    "Connector_Coaxial": ["U.FL_Hirose_U.FL-R-SMT-1_Vertical"],
}

# EasyEDA symbol name -> (renamed symbol, footprint name from easyeda2kicad)
EASYEDA = {
    "TPS63020DSJR": ("TPS63020DSJR", "VSON-14_L4.0-W3.0-P0.50-BL-EP_TI_DSJ"),
    "LMP91000SDX_NOPB": ("LMP91000SD", "WSON-14_L4.0-W4.0-P0.50-BL-EP-1"),
    "MAX17048G+T10": ("MAX17048G", "TDFN-8_L2.0-W2.0-P0.50-BL-EP1.2"),
    "TPS22918DBVR": ("TPS22918DBV", "SOT-23-6_L2.9-W1.6-P0.95-LS2.8-BR"),
    "TPS3840PL27DBVR": ("TPS3840PL27DBV", "SOT-23-5_L2.9-W1.6-P0.95-LS2.8-BR"),
    "TPS61023DRLR": ("TPS61023DRL", "SOT-563_L1.6-W1.2-P0.50-LS1.6-BR"),
    "TPS63802DLAR": ("TPS63802DLA", "VSON-10_L3.0-W2.0-P0.50-TL"),
    "MAX17260SETD+T": ("MAX17260SETD", "TDFN-14_L3.0-W3.0-P0.40-BL-EP"),
    "CN3722": ("CN3722", "TSSOP-16_L5.0-W4.4-P0.65-LS6.4-BL"),
    "CN3791": ("CN3791", "SSOP-10_L4.9-W3.9-P1.00-LS6.0-BL"),
    "ESP32-C6-WROOM-1-N8": ("ESP32-C6-WROOM-1", "WIRELM-SMD_ESP32-C6-WROOM-1"),
    "NRF9151-LACA-R7": ("nRF9151-LACA", "LGA-113_L12.1-W11.1_NRF9151-LACA-R7"),
    "SIM7080G": ("SIM7080G", "LCC-SMD_SIM7080G"),
    "SGP41-D-R4": ("SGP41-D-R4", "DFN-6_L2.4-W2.4-P0.80-TL-EP"),
    "MLX90614ESF-BAA-000-TU": ("MLX90614", "TO-39-4_MELEXIS_MLX90614XXA"),
    "MLT-8530": ("MLT-8530", "BUZ-SMD_4P-L8.5-W8.5-P8.50-BR"),
    "TS-1187A-B-A-B": ("TS-1187A", "SW-SMD_4P-L5.1-W5.1-P3.70-LS6.5-TL_H1.5"),
    "ZE07-CO": ("ZE07-CO", "SENSOR-TH_ZE07-CO"),
}
# Only the RAK3172 3D model is taken from EasyEDA (KiCad's footprint has none).
EASYEDA_3D_FOR_OFFICIAL = {"RAK3172": "WIRELM-SMD_32P-L15.5-W15.0-P1.00"}

PWR_IN = {"GND", "PGND", "AGND", "VSS", "EP", "DAP", "VDD", "VIN", "VINA", "Vin", "VCC", "3V3", "VDDH",
          "VBAT", "VDD_GPIO", "VIO", "BATT"}
NC = {"NC", "n/a", "RESERVED", "~{MR}/NC"}
# Per-symbol overrides (pin name -> type); anything else falls back to the generic rules.
PIN_TYPES = {
    "TPS63020DSJR": {"VOUT": "power_out", "L1": "passive", "L2": "passive", "FB": "input", "EN": "input",
                     "PS/SYNC": "input", "PG": "open_collector"},
    "LMP91000SD": {"WE": "passive", "RE": "passive", "CE": "passive", "VREF": "input", "C1": "passive",
                   "C2": "passive", "VOUT": "output", "SDA": "bidirectional", "SCL": "input", "MENB": "input"},
    "MAX17048G": {"CTG": "passive", "CELL": "input", "~{ALRT}": "open_collector", "QSTRT": "input",
                  "SCL": "input", "SDA": "bidirectional"},
    "TPS22918DBV": {"VOUT": "power_out", "ON": "input", "CT": "passive", "QOD": "passive"},
    "TPS3840PL27DBV": {"~{RESET}": "output", "CT": "passive", "~{MR}/NC": "input"},
    "TPS61023DRL": {"VOUT": "power_out", "SW": "passive", "FB": "input", "EN": "input"},
    "ZE07-CO": {"RXD": "input", "TXD": "output", "DAC": "output"},
    "MLT-8530": {"+": "passive", "2": "passive", "3": "passive", "4": "passive"},
    "TS-1187A": {"A": "passive", "B": "passive", "C": "passive", "D": "passive"},
}


def generic_type(name):
    if name in PWR_IN:
        return "power_in"
    if name in NC:
        return "no_connect"
    if name.startswith("VOUT"):
        return "power_out"
    return "bidirectional"


# ------------------------------------------------------------------ s-expression helpers

def top_blocks(text, head):
    """Yield (name, block) for depth-1 '(symbol "name"' blocks of a .kicad_sym."""
    i = 0
    pat = re.compile(r'\(' + head + r' "([^"]+)"')
    while True:
        m = pat.search(text, i)
        if not m:
            return
        # depth-1 only: count parens before m.start() outside strings is costly; KiCad libs put
        # top-level symbols at line start with exactly one tab or two spaces of indent.
        line_start = text.rfind("\n", 0, m.start()) + 1
        indent = text[line_start:m.start()]
        end = match_paren(text, m.start())
        if indent in ("\t", "  "):
            yield m.group(1), text[m.start():end]
        i = end if indent in ("\t", "  ") else m.end()


def match_paren(text, start):
    depth, i, n, in_str = 0, start, len(text), False
    while i < n:
        c = text[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError("unbalanced")


def set_property(block, prop, value):
    return re.sub(r'(\(property "' + re.escape(prop) + r'" )"[^"]*"', lambda m: m.group(1) + '"' + value + '"',
                  block, count=1)


# ------------------------------------------------------------------ symbols

def official_symbols(fp_names):
    out = []
    for lib, names in OFFICIAL_SYMBOLS.items():
        text = (KICAD / "symbols" / f"{lib}.kicad_sym").read_text(encoding="utf-8")
        blocks = dict(top_blocks(text, "symbol"))
        wanted = list(names)
        for n in names:  # pull in parents of derived symbols
            m = re.search(r'\(extends "([^"]+)"\)', blocks[n])
            if m and m.group(1) not in wanted:
                wanted.insert(0, m.group(1))
        for n in wanted:
            b = blocks[n]
            fp = re.search(r'\(property "Footprint" "([^"]*)"', b)
            if fp and ":" in fp.group(1) and fp.group(1).split(":", 1)[1] in fp_names:
                b = set_property(b, "Footprint", "sylvia:" + fp.group(1).split(":", 1)[1])
            out.append((n, b))
    return out


def easyeda_symbols():
    text = (STAGE / "easyeda.kicad_sym").read_text(encoding="utf-8")
    out = []
    for name, block in top_blocks(text, "symbol"):
        if name not in EASYEDA:
            continue
        new, fp = EASYEDA[name]
        b = block.replace(f'"{name}"', f'"{new}"').replace(f'"{name}_', f'"{new}_')
        b = set_property(b, "Footprint", "sylvia:" + fp)
        overrides = PIN_TYPES.get(new, {})

        def fix(m):
            pname = m.group(2)
            return f"(pin {overrides.get(pname, generic_type(pname))} {m.group(1)}"

        b = re.sub(r'\(pin unspecified (line\s*\(at [^)]*\)\s*\(length [^)]*\)\s*\(name "([^"]*)")', fix, b)
        out.append((new, b))
    return out


def pin(num, name, ptype, x, y, angle, length=2.54):
    return (f'\t\t\t(pin {ptype} line (at {x:.2f} {y:.2f} {angle}) (length {length})\n'
            f'\t\t\t\t(name "{name}" (effects (font (size 1.27 1.27))))\n'
            f'\t\t\t\t(number "{num}" (effects (font (size 1.27 1.27))))\n\t\t\t)\n')


def box_symbol(name, ref, value, footprint, datasheet, desc, left, right, width=15.24):
    """Rectangular symbol; left/right = [(num, name, type)] top to bottom."""
    rows = max(len(left), len(right))
    h = (rows + 1) * 2.54
    top = h / 2
    pins = ""
    for i, (n, nm, t) in enumerate(left):
        pins += pin(n, nm, t, -width / 2 - 2.54, top - 2.54 * (i + 1), 0)
    for i, (n, nm, t) in enumerate(right):
        pins += pin(n, nm, t, width / 2 + 2.54, top - 2.54 * (i + 1), 180)
    return (f'\t(symbol "{name}"\n\t\t(exclude_from_sim no) (in_bom yes) (on_board yes)\n'
            f'\t\t(property "Reference" "{ref}" (at 0 {top + 1.27:.2f} 0) (effects (font (size 1.27 1.27))))\n'
            f'\t\t(property "Value" "{value}" (at 0 {-top - 1.27:.2f} 0) (effects (font (size 1.27 1.27))))\n'
            f'\t\t(property "Footprint" "{footprint}" (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))\n'
            f'\t\t(property "Datasheet" "{datasheet}" (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))\n'
            f'\t\t(property "Description" "{desc}" (at 0 0 0) (effects (font (size 1.27 1.27)) (hide yes)))\n'
            f'\t\t(symbol "{name}_0_1"\n\t\t\t(rectangle (start {-width / 2:.2f} {top:.2f}) (end {width / 2:.2f} {-top:.2f})\n'
            f'\t\t\t\t(stroke (width 0.254) (type default)) (fill (type background)))\n\t\t)\n'
            f'\t\t(symbol "{name}_1_1"\n{pins}\t\t)\n\t)\n')


def own_symbols():
    return [
        ("SPEC_110-102", box_symbol(
            "SPEC_110-102", "U", "110-102", "sylvia:SPEC_110-102_THT",
            "https://www.interlinkelectronics.com/downloads/subsidiary-docs/spec-sensors/3SP_CO_1000-P-Package-110-102.pdf",
            "SPEC Sensors 3SP_CO_1000 electrochemical CO sensor, pin package. Hand-solder only.",
            [("1", "WE", "passive"), ("6", "WE", "passive"), ("4", "RE", "passive"), ("5", "CE", "passive")],
            [("2", "NC", "no_connect"), ("3", "NC", "no_connect")])),
        ("SEN66_Conn", box_symbol(
            "SEN66_Conn", "J", "SEN66 (JST GH 6)", "sylvia:JST_GH_SM06B-GHS-TB_1x06-1MP_P1.25mm_Horizontal",
            "https://sensirion.com/media/documents/FAFC548D/6AC50BC5/PS_DS_SEN6x.pdf",
            "Cable connector to a Sensirion SEN6x module (pins 1/6 and 2/5 joined inside the sensor)",
            [("1", "VDD", "passive"), ("6", "VDD", "passive"), ("2", "GND", "passive"), ("5", "GND", "passive")],
            [("3", "SDA", "bidirectional"), ("4", "SCL", "bidirectional"), ("MP", "SHIELD", "passive")])),
        ("PMSA003I_Conn", box_symbol(
            "PMSA003I_Conn", "J", "PMSA003I (2x5 1.27 mm)", "sylvia:PinHeader_2x05_P1.27mm_Vertical",
            "https://cdn-shop.adafruit.com/product-files/4632/4505_PMSA003I_series_data_manual_English_V2.6.pdf",
            "Cable header to a Plantower PMSA003I (5 V supply, 3.3 V I2C at 0x12). Pins 6/8 must stay unconnected.",
            [("1", "VCC", "passive"), ("2", "VCC", "passive"), ("3", "GND", "passive"), ("4", "GND", "passive"),
             ("5", "~{RESET}", "bidirectional")],
            [("7", "SCL", "bidirectional"), ("9", "SDA", "bidirectional"), ("10", "SET", "bidirectional"),
             ("6", "NC", "no_connect"), ("8", "NC", "no_connect")])),
    ]


# ------------------------------------------------------------------ footprints + 3D

def rewrite_models(text, model_map):
    """Point every (model ...) at the project 3dmodels folder; model_map: basename -> new basename."""
    def repl(m):
        base = re.split(r"[/\\]", m.group(1))[-1]
        stem = base.rsplit(".", 1)[0]
        new = model_map.get(stem)
        return f'(model "{MODEL_PREFIX}{new}"' if new else m.group(0)
    return re.sub(r'\(model "([^"]+)"', repl, text)


def copy_official_footprints():
    names = set()
    for lib, fps in OFFICIAL_FOOTPRINTS.items():
        for fp in fps:
            src = KICAD / "footprints" / f"{lib}.pretty" / f"{fp}.kicad_mod"
            text = src.read_text(encoding="utf-8")
            model_map = {}
            for m in re.finditer(r'\(model "([^"]+)"', text):
                rel = m.group(1).replace("${KICAD9_3DMODEL_DIR}/", "")
                stem = pathlib.Path(rel).stem
                for ext in (".step", ".wrl"):
                    s3 = KICAD / "3dmodels" / (str(pathlib.Path(rel).with_suffix(ext)))
                    if s3.exists():
                        shutil.copy2(s3, M3D_OUT / s3.name)
                step = KICAD / "3dmodels" / str(pathlib.Path(rel).with_suffix(".step"))
                model_map[stem] = (stem + ".step") if step.exists() else (stem + ".wrl")
            text = rewrite_models(text, model_map)
            text = placeholder_missing(fp, text)
            if fp in EASYEDA_3D_FOR_OFFICIAL:
                e = EASYEDA_3D_FOR_OFFICIAL[fp]
                text = add_model(text, e + ".wrl")
            text = re.sub(r'^\(footprint "[^"]+"', f'(footprint "{fp}"', text)
            (FP_OUT / f"{fp}.kicad_mod").write_text(text, encoding="utf-8")
            names.add(fp)
    return names


# Body heights (mm) for placeholder boxes where the KiCad install ships no model.
PLACEHOLDER_H = {"USB_C_Receptacle_HRO_TYPE-C-31-M-12": 3.2, "ESP32-S3-WROOM-1U": 3.2,
                 "Sensirion_SCD4x-1EP_10.1x10.1mm_P1.25mm_EP4.8x4.8mm": 6.5, "TO-39-4": 4.5,
                 "nanoSIM_GCT_SIM8060-6-0-14-00": 1.4}


def placeholder_missing(fp, text):
    """Swap model references to files we don't have for a courtyard-sized placeholder box."""
    missing = [m for m in re.finditer(r'\t?\(model "\$\{KIPRJMOD\}/lib/3dmodels/([^"]+)".*?\n\t\)\n', text, re.S)
               if not (M3D_OUT / m.group(1)).exists()]
    if not missing:
        return text
    for m in reversed(missing):
        text = text[:m.start()] + text[m.end():]
    if fp in EASYEDA_3D_FOR_OFFICIAL:
        return text  # a real EasyEDA model gets added instead
    xs, ys = [], []
    for m in re.finditer(r'\((?:start|end|xy) ([-\d.]+) ([-\d.]+)\)[^\n]*?(?:\n[^\n]*?)*?\(layer "F\.CrtYd"\)', text):
        xs.append(float(m.group(1)))
        ys.append(float(m.group(2)))
    w = (max(xs) - min(xs) - 0.5) if xs else 3.0
    d = (max(ys) - min(ys) - 0.5) if ys else 3.0
    name = f"{fp}_placeholder.wrl"
    wrl_box(M3D_OUT / name, w, d, PLACEHOLDER_H.get(fp, 1.0))
    PLACEHOLDERS.append(fp)
    block = (f'\t(model "{MODEL_PREFIX}{name}"\n\t\t(offset (xyz 0 0 0))\n\t\t(scale (xyz 1 1 1))\n'
             f'\t\t(rotate (xyz 0 0 0))\n\t)\n')
    return text[: text.rstrip().rfind(")")] + block + ")\n"


PLACEHOLDERS = ["SPEC_110-102_THT"]


def copy_easyeda_model(stem):
    """EasyEDA STEP files are huge (~40 MB for this set): footprints use the .wrl (committed); the
    STEP goes to 3dmodels/easyeda_step/ (gitignored) for enclosure CAD."""
    src = STAGE / "easyeda.3dshapes"
    if (src / (stem + ".wrl")).exists():
        shutil.copy2(src / (stem + ".wrl"), M3D_OUT / (stem + ".wrl"))
    if (src / (stem + ".step")).exists():
        (M3D_OUT / "easyeda_step").mkdir(exist_ok=True)
        shutil.copy2(src / (stem + ".step"), M3D_OUT / "easyeda_step" / (stem + ".step"))


def add_model(text, model_file):
    copy_easyeda_model(pathlib.Path(model_file).stem)
    block = (f'\t(model "{MODEL_PREFIX}{model_file}"\n\t\t(offset (xyz 0 0 0))\n\t\t(scale (xyz 1 1 1))\n'
             f'\t\t(rotate (xyz 0 0 0))\n\t)\n')
    return text[: text.rstrip().rfind(")")] + block + ")\n"


def copy_easyeda_footprints():
    names = set()
    for _, (_, fp) in EASYEDA.items():
        src = STAGE / "easyeda.pretty" / f"{fp}.kicad_mod"
        text = src.read_text(encoding="utf-8")
        model_map = {}
        for m in re.finditer(r'\(model "([^"]+)"', text):
            stem = re.split(r"[/\\]", m.group(1))[-1].rsplit(".", 1)[0]
            copy_easyeda_model(stem)
            model_map[stem] = stem + ".wrl"
        text = rewrite_models(text, model_map)
        (FP_OUT / f"{fp}.kicad_mod").write_text(text, encoding="utf-8")
        names.add(fp)
    return names


def wrl_box(path, w, d, h, color=(0.2, 0.2, 0.2)):
    """Placeholder VRML box, centred in x/y, sitting on z=0 (mm -> KiCad's 0.1 inch VRML units)."""
    s = 1 / 2.54
    x, y, z = w / 2 * s, d / 2 * s, h * s
    pts = [(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = "0,1,2,3,-1,4,7,6,5,-1,0,4,5,1,-1,1,5,6,2,-1,2,6,7,3,-1,3,7,4,0,-1"
    path.write_text(
        "#VRML V2.0 utf8\n# PLACEHOLDER box model (Sylvia): replace with real CAD when available\n"
        "Shape { appearance Appearance { material Material { diffuseColor %.2f %.2f %.2f } }\n"
        " geometry IndexedFaceSet { coord Coordinate { point [ %s ] } coordIndex [ %s ] } }\n"
        % (*color, ", ".join(f"{a:.4f} {b:.4f} {c:.4f}" for a, b, c in pts), faces), encoding="utf-8")


def spec_footprint():
    """SPEC 110-102 from its datasheet 'PCB layout guidelines': 6 holes, 0.80 mm drill.
    Rows 17.78 mm apart (pins 4/5 top, 1/6 bottom, 2.00 mm pitch), pins 3/2 on the left at
    8.89 mm from the centre line, 2.00 mm apart. Origin = sensor centre line."""
    pads = [("1", -1.0, 8.89), ("6", 1.0, 8.89), ("4", -1.0, -8.89), ("5", 1.0, -8.89),
            ("3", -8.89, -1.0), ("2", -8.89, 1.0)]
    pad_txt = "".join(
        f'\t(pad "{n}" thru_hole {"rect" if n == "1" else "circle"} (at {x} {y}) (size 1.4 1.4) (drill 0.8) '
        f'(layers "*.Cu" "*.Mask"))\n' for n, x, y in pads)
    k = 15.75 / 2  # keep-out area from the datasheet (simplified to its bounding square: conservative)
    c = 11.0       # courtyard: 20.83 mm body + margin; exact body offset to the pins is unverified
    wrl_box(M3D_OUT / "SPEC_110-102_placeholder.wrl", 20.83, 20.83, 3.8, (0.1, 0.4, 0.1))
    return (
        '(footprint "SPEC_110-102_THT"\n\t(version 20241229)\n\t(generator "sylvia_build_library")\n'
        '\t(layer "F.Cu")\n'
        '\t(descr "SPEC Sensors 110-102 CO sensor (3SP_CO_1000 pin package). HAND-SOLDER ONLY, never reflow. '
        'Keep-out under the sensor. Verify pin offsets against a real sensor before ordering.")\n'
        '\t(tags "SPEC CO electrochemical")\n\t(attr through_hole)\n'
        '\t(property "Reference" "REF**" (at 0 -12.5 0) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))\n'
        '\t(property "Value" "110-102" (at 0 12.5 0) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))\n'
        f'\t(fp_rect (start {-c} {-c}) (end {c} {c}) (stroke (width 0.05) (type solid)) (fill no) (layer "F.CrtYd"))\n'
        f'\t(fp_rect (start -10.4 -10.4) (end 10.4 10.4) (stroke (width 0.1) (type solid)) (fill no) (layer "F.Fab"))\n'
        '\t(fp_text user "GAS PORT: KEEP CLEAR" (at 0 0 0) (layer "F.Fab") (effects (font (size 0.8 0.8) (thickness 0.12))))\n'
        '\t(fp_line (start -10.6 7.6) (end -10.6 10.6) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))\n'
        '\t(fp_line (start -10.6 10.6) (end -7.6 10.6) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))\n'
        f'\t(zone (net 0) (net_name "") (layers "F.Cu" "In1.Cu") (name "SPEC keep-out") (hatch edge 0.5)\n'
        '\t\t(connect_pads (clearance 0)) (min_thickness 0.25) (filled_areas_thickness no)\n'
        '\t\t(keepout (tracks not_allowed) (vias not_allowed) (pads allowed) (copperpour not_allowed) (footprints not_allowed))\n'
        f'\t\t(polygon (pts (xy {-k} {-k}) (xy {k} {-k}) (xy {k} {k}) (xy {-k} {k})))\n\t)\n'
        + pad_txt +
        f'\t(model "{MODEL_PREFIX}SPEC_110-102_placeholder.wrl"\n\t\t(offset (xyz 0 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0))\n\t)\n)\n')


def mfr_models():
    """Sensirion STEP files: local only (gitignored)."""
    out = M3D_OUT / "mfr"
    out.mkdir(exist_ok=True)
    for f in (STAGE / "mfr").glob("*.step"):
        shutil.copy2(f, out / f.name)
    z = STAGE / "mfr" / "SPS30_STEP.zip"
    if z.exists():
        import zipfile
        with zipfile.ZipFile(z) as zf:
            for info in zf.infolist():
                if info.filename.lower().endswith((".step", ".stp")) and "/" not in info.filename and ".." not in info.filename:
                    (out / "SPS30.step").write_bytes(zf.read(info))


def main():
    for d in (FP_OUT, M3D_OUT):
        d.mkdir(parents=True, exist_ok=True)
        # Empty rather than delete: Windows refuses to remove a folder some shell is sitting in.
        for f in d.iterdir():
            shutil.rmtree(f) if f.is_dir() else f.unlink()
    fp_names = copy_official_footprints()
    fp_names |= copy_easyeda_footprints()
    (FP_OUT / "SPEC_110-102_THT.kicad_mod").write_text(spec_footprint(), encoding="utf-8")
    fp_names.add("SPEC_110-102_THT")
    mfr_models()

    syms = official_symbols(fp_names) + easyeda_symbols() + own_symbols()
    seen, body = set(), ""
    for name, block in syms:
        if name in seen:
            continue
        seen.add(name)
        body += "\t" + block.strip() + "\n" if not block.startswith("\t") else block.rstrip() + "\n"
    SYM_OUT.write_text('(kicad_symbol_lib\n\t(version 20241209)\n\t(generator "sylvia_build_library")\n'
                       '\t(generator_version "9.0")\n' + body + ")\n", encoding="utf-8")
    n3d = len(list(M3D_OUT.glob("*.*")))
    print(f"{len(seen)} symbols -> {SYM_OUT}\n{len(fp_names)} footprints -> {FP_OUT}\n{n3d} 3D files -> {M3D_OUT}")
    print("placeholder 3D models:", ", ".join(PLACEHOLDERS))


if __name__ == "__main__":
    sys.exit(main())
