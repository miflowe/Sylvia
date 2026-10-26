import "server-only";
import type { Place } from "@sylvia/core";
import { env } from "./env";

// Azure Maps place search and reverse lookup, Canada only. Used to name the person's home area and pick its region.
const regionFor = (countryCode?: string, subdivision?: string) =>
  countryCode === "CA" && subdivision && /^[A-Z]{2}$/.test(subdivision) ? `CA-${subdivision}` : undefined;

export async function searchPlaces(query: string): Promise<Place[]> {
  const params = new URLSearchParams({
    "api-version": "1.0",
    query,
    countrySet: "CA",
    limit: "5",
    idxSet: "Geo,PAD,Addr",
    typeahead: "true",
    language: "en-CA",
    "subscription-key": env("AZURE_MAPS_KEY"),
  });
  const res = await fetch(`https://atlas.microsoft.com/search/fuzzy/json?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    results?: { address: { freeformAddress?: string; countryCode?: string; countrySubdivision?: string }; position: { lat: number; lon: number } }[];
  };
  return (body.results ?? []).map((r) => ({
    name: r.address.freeformAddress ?? query,
    lat: r.position.lat,
    lon: r.position.lon,
    regionCode: regionFor(r.address.countryCode, r.address.countrySubdivision),
  }));
}

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  const params = new URLSearchParams({ "api-version": "1.0", query: `${lat},${lon}`, language: "en-CA", "subscription-key": env("AZURE_MAPS_KEY") });
  const res = await fetch(`https://atlas.microsoft.com/search/address/reverse/json?${params}`, { signal: AbortSignal.timeout(8000) });
  const a = res.ok
    ? ((await res.json()) as { addresses?: { address: { municipality?: string; countrySubdivision?: string; countryCode?: string } }[] }).addresses?.[0]?.address
    : undefined;
  return {
    name: [a?.municipality, a?.countrySubdivision].filter(Boolean).join(", ") || "Your location",
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100,
    regionCode: regionFor(a?.countryCode, a?.countrySubdivision),
  };
}
