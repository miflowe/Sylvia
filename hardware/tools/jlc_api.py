"""Small client for the public JLCPCB parts search and EasyEDA component endpoints.

Used to snapshot LCSC numbers, stock and unit prices into parts.csv. Prices are JLCPCB
quantity-1 USD snapshots: re-run tools/build_parts.py before ordering.
"""
import json
import subprocess

JLC_SEARCH = "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList"
EASYEDA_COMPONENT = "https://easyeda.com/api/products/{lcsc}/components?version=6.4.19.5"
# These endpoints reject python-requests' default user agent but accept curl's.
_CURL = ["curl", "-s", "-m", "30", "-A", "curl/8.0"]


def _curl_json(args):
    out = subprocess.run(_CURL + args, capture_output=True).stdout
    return json.loads(out)


def search(keyword, page_size=10):
    body = json.dumps({"keyword": keyword, "currentPage": 1, "pageSize": page_size})
    data = _curl_json(["-H", "Content-Type: application/json", "-X", "POST", JLC_SEARCH, "-d", body])
    return data["data"]["componentPageInfo"]["list"] or []


def lookup(lcsc):
    """Return the JLCPCB listing whose LCSC code matches exactly, or None."""
    for c in search(lcsc):
        if c["componentCode"] == lcsc:
            p = c.get("componentPrices") or []
            return {
                "lcsc": lcsc,
                "mpn": c["componentModelEn"],
                "manufacturer": c["componentBrandEn"],
                "package": c.get("componentSpecificationEn") or "",
                "library": c["componentLibraryType"],
                "stock": c["stockCount"],
                "price_q1": p[0]["productPrice"] if p else None,
                "datasheet": c.get("dataManualUrl") or "",
            }
    return None


def easyeda_component(lcsc):
    return _curl_json([EASYEDA_COMPONENT.format(lcsc=lcsc)])["result"]
