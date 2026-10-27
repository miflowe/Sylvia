/**
 * Home checklist based on FireSmart Canada's Home Ignition Zone guidance (paraphrased, not copied). Each item says
 * what to do and why, in plain words. Zones: 0–1.5 m, 1.5–10 m and 10–30 m from the home.
 */
import type { LatLon } from "./geo";

export const FIRESMART_SOURCE = { name: "FireSmart Canada", url: "https://firesmartcanada.ca/" } as const;

export interface ChecklistItem {
  id: string;
  zone: "home" | "0-1.5m" | "1.5-10m" | "10-30m" | "ready";
  text: string;
  why: string;
  link?: { label: string; href: string };
}

export const ZONES: Record<ChecklistItem["zone"], string> = {
  home: "Your roof and walls",
  "0-1.5m": "Right next to the house (0–1.5 m)",
  "1.5-10m": "The yard (1.5–10 m)",
  "10-30m": "Farther out (10–30 m)",
  ready: "Be ready",
};

export const CHECKLIST: ChecklistItem[] = [
  { id: "roof-material", zone: "home", text: "Roof is a fire-resistant material (metal, asphalt shingle, clay or concrete tile).", why: "Embers land on roofs first. Wood shakes catch easily." },
  { id: "gutters-clear", zone: "home", text: "Roof and gutters are clear of needles and leaves.", why: "Dry debris in gutters is where embers start fires." },
  { id: "vents-screened", zone: "home", text: "Vents and openings have 3 mm metal mesh screens.", why: "Screens stop embers from blowing into the attic and crawl space." },
  { id: "under-deck", zone: "home", text: "Nothing that burns is stored under the deck or porch.", why: "Embers collect under decks and ignite what's there." },
  { id: "noncombustible-ring", zone: "0-1.5m", text: "Gravel, rock or pavers around the house instead of bark mulch.", why: "This first 1.5 m is the most important zone. Mulch and dry plants here carry fire to the walls." },
  { id: "no-plants-touching", zone: "0-1.5m", text: "No shrubs or plants touching the siding.", why: "Plants against the house can carry flames straight to it." },
  { id: "firewood-far", zone: "1.5-10m", text: "Firewood and building materials stacked at least 10 m from the house.", why: "Woodpiles catch embers and burn hot for a long time." },
  { id: "lawn-short", zone: "1.5-10m", text: "Grass is mowed to 10 cm or less and kept green when you can.", why: "Short, green grass slows a fire moving toward the house." },
  { id: "plants-checked", zone: "1.5-10m", text: "Garden plants checked: highly flammable or invasive ones replaced.", why: "Some plants, like junipers and cedar hedges, burn very easily.", link: { label: "Scan plants with Sprout", href: "/sprout" } },
  { id: "fuel-away", zone: "1.5-10m", text: "Propane tanks and fuel stored away from the house.", why: "Fuel near walls makes a small fire much worse." },
  { id: "branches-pruned", zone: "10-30m", text: "Lower tree branches pruned up to 2 m from the ground.", why: "Low branches let a ground fire climb into the treetops." },
  { id: "dead-wood", zone: "10-30m", text: "Dead branches, fallen trees and brush cleared away.", why: "Dead wood is dry fuel that lets fire spread faster." },
  { id: "official-alerts", zone: "ready", text: "You know how your community sends emergency alerts, and Alert Ready is on for your phone.", why: "Official alerts tell you when to leave. Sylvia adds to them, never replaces them." },
  { id: "sylvia-alerts", zone: "ready", text: "Sylvia alerts are on for your home.", why: "You'll hear about nearby fire activity and smoke early.", link: { label: "Turn on alerts", href: "/alerts" } },
  { id: "grab-and-go", zone: "ready", text: "A grab-and-go bag and a plan for where you'd go are ready.", why: "If an order comes, you'll leave faster and calmer." },
];

export function checklistProgress(done: Record<string, boolean>): { done: number; total: number; percent: number } {
  const total = CHECKLIST.length;
  const count = CHECKLIST.filter((i) => done[i.id]).length;
  return { done: count, total, percent: Math.round((count / total) * 100) };
}

/** Community pages: aggregate, anonymous views for towns and regional districts. */
export const COMMUNITIES = [
  {
    id: "central-okanagan",
    name: "Central Okanagan",
    regionCode: "CA-BC",
    // Approximate bounds of the Regional District of Central Okanagan: [west, south, east, north].
    bbox: [-119.95, 49.65, -119.15, 50.3] as [number, number, number, number],
    centre: { lat: 49.888, lon: -119.496 },
  },
] as const;

export function communityFor(p: LatLon): (typeof COMMUNITIES)[number] | undefined {
  return COMMUNITIES.find(({ bbox: [w, s, e, n] }) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
}

/** Counts below this are hidden so no one household can be singled out. */
export const MIN_GROUP = 5;
export function safeCount(n: number): number | `fewer than ${typeof MIN_GROUP}` {
  return n >= MIN_GROUP ? n : `fewer than ${MIN_GROUP}`;
}
