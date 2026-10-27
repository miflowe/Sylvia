"""Provision one Sylvia Node: per-device credentials -> factory NVS image. Secrets never enter git.

    python -I hardware/firmware/tools/provision.py --device-id sylvia-node-0001 --hub <hub>.azure-devices.net \
        --wifi-ssid "<ssid>" --deveui <16 hex from AT+DEVEUI=?> --co-sens 4.62

Creates hardware/firmware/secrets/<device-id>/ (gitignored):
  device.key / device.pem   EC P-256 key + self-signed X.509 cert (CN = device id), via openssl
  appkey.txt                random LoRaWAN AppKey (or pass --appkey)
  fctry.csv / fctry.bin     NVS partition for the "fctry" slot (0x12000, 24 KB)
Then prints the two commands to run yourself (they touch your Azure subscription and the board):
  az iot hub device-identity create ... --am x509_thumbprint --ptp <sha1 thumbprint>
  esptool.py --chip esp32s3 write_flash 0x12000 fctry.bin
Wi-Fi password: prompted (not a CLI argument, so it stays out of shell history).
"""
import argparse
import csv
import getpass
import os
import pathlib
import secrets
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
SECRETS = HERE.parent / "secrets"
FCTRY_SIZE = 0x6000


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device-id", required=True)
    ap.add_argument("--hub", required=True, help="<hub>.azure-devices.net")
    ap.add_argument("--wifi-ssid", default="")
    ap.add_argument("--deveui", default="", help="RAK3172 DevEUI (AT+DEVEUI=?)")
    ap.add_argument("--joineui", default="0000000000000000")
    ap.add_argument("--appkey", default="")
    ap.add_argument("--co-sens", default="4.75", help="nA/ppm from the SPEC sensor label")
    ap.add_argument("--co-zero", default="0", help="clean-air offset volts (commissioning)")
    a = ap.parse_args()

    out = SECRETS / a.device_id
    out.mkdir(parents=True, exist_ok=True)
    key, pem = out / "device.key", out / "device.pem"
    if not key.exists():
        run(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", str(key)])
        run(["openssl", "req", "-new", "-x509", "-key", str(key), "-out", str(pem), "-days", "3650",
             "-subj", f"/CN={a.device_id}"])
    thumb = run(["openssl", "x509", "-in", str(pem), "-noout", "-fingerprint", "-sha1"]).split("=", 1)[1]
    thumb = thumb.strip().replace(":", "")
    appkey = a.appkey
    if not appkey and (out / "appkey.txt").exists():
        appkey = (out / "appkey.txt").read_text().strip()  # keep the key already registered on the network
    if not appkey:
        appkey = secrets.token_hex(16).upper()
    (out / "appkey.txt").write_text(appkey + "\n")
    wifi_pass = getpass.getpass("Wi-Fi password (blank for LoRa-only): ") if a.wifi_ssid else ""

    rows = [("key", "type", "encoding", "value"), ("node", "namespace", "", ""),
            ("device_id", "data", "string", a.device_id), ("hub_host", "data", "string", a.hub),
            ("wifi_ssid", "data", "string", a.wifi_ssid), ("wifi_pass", "data", "string", wifi_pass),
            ("client_cert", "file", "string", str(pem)), ("client_key", "file", "string", str(key)),
            ("lora_deveui", "data", "string", a.deveui), ("lora_joineui", "data", "string", a.joineui),
            ("lora_appkey", "data", "string", appkey), ("co_sens", "data", "string", a.co_sens),
            ("co_zero", "data", "string", a.co_zero)]
    with (out / "fctry.csv").open("w", newline="") as f:
        csv.writer(f).writerows(rows)

    idf = os.environ.get("IDF_PATH")
    gen = pathlib.Path(idf) / "components" / "nvs_flash" / "nvs_partition_generator" / "nvs_partition_gen.py" if idf else None
    if gen and gen.exists():
        run([sys.executable, str(gen), "generate", str(out / "fctry.csv"), str(out / "fctry.bin"), hex(FCTRY_SIZE)])
        print(f"wrote {out / 'fctry.bin'}")
    else:
        print("IDF_PATH not set: run nvs_partition_gen.py on fctry.csv from an ESP-IDF shell")
    print("\nNext, run these yourself:")
    print(f"  az iot hub device-identity create --hub-name {a.hub.split('.')[0]} --device-id {a.device_id} "
          f"--am x509_thumbprint --ptp {thumb} --stp {thumb}")
    print(f"  esptool.py --chip esp32s3 write_flash 0x12000 {out / 'fctry.bin'}")
    print(f"  Register DevEUI {a.deveui or '<AT+DEVEUI=?>'} with AppKey from {out / 'appkey.txt'} on your LoRaWAN network")


if __name__ == "__main__":
    main()
