import "server-only";
import {
  CHECKLIST,
  COMMUNITIES,
  MIN_GROUP,
  safeCount,
  type CommunityStats,
  type OfficialNoticeDoc,
} from "@sylvia/core";
import { getConditions } from "./conditions";
import { container } from "./cosmos";

const label = (id: string) => CHECKLIST.find((i) => i.id === id)?.id ?? id;

/** Anonymous totals for one community. Nothing here identifies a household. */
export async function communityStats(id: string): Promise<CommunityStats | undefined> {
  const community = COMMUNITIES.find((c) => c.id === id);
  if (!community) return undefined;
  const [w, s, e, n] = community.bbox;
  const box = { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
  const since = `${new Date().getUTCFullYear()}-01-01`;
  const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString();

  const count = async (name: string, where: string, params: { name: string; value: unknown }[] = []) =>
    ((await container(name).items.query<number>({ query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`, parameters: [{ name: "@box", value: box }, ...params] as never }).fetchAll()).resources[0] ?? 0);

  const [conditions, alertsHomes, checklists, sightings, notices, hotspots, fireAreas] = await Promise.all([
    getConditions(community.centre, community.name, community.regionCode, false, false),
    count("pushSubscriptions", "ST_WITHIN(c.location, @box)"),
    container("checklists").items.query<{ percent: number; done: Record<string, boolean> }>({ query: "SELECT c.percent, c.done FROM c WHERE c.communityId = @id", parameters: [{ name: "@id", value: id }] }).fetchAll(),
    container("sightings").items.query<{ commonName: string }>({ query: "SELECT c.commonName FROM c WHERE ST_WITHIN(c.location, @box) AND c.createdAt >= @since", parameters: [{ name: "@box", value: box }, { name: "@since", value: since }] as never }).fetchAll(),
    container("officialAlerts").items.query<OfficialNoticeDoc>({ query: "SELECT c.kind, c.areaName, c.agency, c.bbox FROM c WHERE c.bbox[0] <= @e AND c.bbox[2] >= @w AND c.bbox[1] <= @n AND c.bbox[3] >= @s", parameters: [{ name: "@w", value: w }, { name: "@s", value: s }, { name: "@e", value: e }, { name: "@n", value: n }] }, { partitionKey: community.regionCode }).fetchAll(),
    count("observations", "c.kind = 'hotspot' AND c.observedAt >= @since AND ST_WITHIN(c.location, @box)", [{ name: "@since", value: dayAgo }]),
    count("observations", "c.kind = 'fire-perimeter' AND ST_WITHIN(c.location, @box)"),
  ]);

  const homes = checklists.resources;
  const itemCounts = CHECKLIST.map((i) => ({ id: i.id, n: homes.filter((h) => h.done?.[i.id]).length })).sort((a, b) => b.n - a.n);
  const bySpecies = Object.entries(
    sightings.resources.reduce<Record<string, number>>((acc, x) => ((acc[x.commonName] = (acc[x.commonName] ?? 0) + 1), acc), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, c]) => ({ name, count: safeCount(c) }));

  return {
    id,
    name: community.name,
    sample: false,
    now: {
      fireDanger: conditions.fireDanger.level,
      aqhi: conditions.aqhi && { value: conditions.aqhi.value, risk: conditions.aqhi.risk, station: conditions.aqhi.station },
      hotspots24h: hotspots,
      fireAreasThisSeason: fireAreas,
      officialOrders: notices.resources.filter((x) => x.kind === "order").length,
      officialAlerts: notices.resources.filter((x) => x.kind === "alert").length,
      notices: notices.resources.slice(0, 5).map((x) => ({ kind: x.kind, areaName: x.areaName, agency: x.agency })),
    },
    readiness: {
      homesWithAlerts: safeCount(alertsHomes),
      homesUsingChecklist: safeCount(homes.length),
      averageChecklistPercent: homes.length >= MIN_GROUP ? Math.round(homes.reduce((t, h) => t + (h.percent ?? 0), 0) / homes.length) : undefined,
      mostDone: homes.length >= MIN_GROUP ? itemCounts.slice(0, 3).map((x) => label(x.id)) : [],
      leastDone: homes.length >= MIN_GROUP ? itemCounts.slice(-3).reverse().map((x) => label(x.id)) : [],
    },
    sightings: { total: safeCount(sightings.resources.length), bySpecies, since },
    generatedAt: new Date().toISOString(),
  };
}
