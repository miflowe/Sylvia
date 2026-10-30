import "server-only";
import type { SqlParameter } from "@azure/cosmos";
import { groupReports, matchHeatToFire, type FireStatus, type NamedFireRef, type Observation, type OfficialNoticeDoc, type Sighting } from "@sylvia/core";
import { container } from "./cosmos";
import { reportsWithin } from "./reports";

type Feature = { type: "Feature"; id: string; geometry: unknown; properties: Record<string, unknown> };
type Collection = { type: "FeatureCollection"; features: Feature[] };
export type MapLayers = Record<"evac" | "hotspots" | "fires" | "named" | "reports" | "aqhi" | "pm25" | "sightings" | "nodes", Collection>;

const fc = (features: Feature[]): Collection => ({ type: "FeatureCollection", features });

/** Everything visible in a bounding box. Fire outlines only when zoomed in (they're large). */
export async function mapLayers([w, s, e, n]: [number, number, number, number], withShapes: boolean): Promise<MapLayers> {
  // Counter-clockwise ring, as Cosmos DB expects.
  const box = { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const within = async <T>(name: string, extra: string, params: SqlParameter[] = []) =>
    (
      await container(name)
        .items.query<T>({
          query: `SELECT * FROM c WHERE ST_WITHIN(c.location, @box) ${extra}`,
          parameters: [{ name: "@box", value: box }, ...params],
        })
        .fetchAll()
    ).resources;

  // Named fires a little beyond the view, so heat at the edge can still be matched to its fire.
  const pad = 0.3;
  const wide = { type: "Polygon", coordinates: [[[w - pad, s - pad], [e + pad, s - pad], [e + pad, n + pad], [w - pad, n + pad], [w - pad, s - pad]]] };
  const nowIso = new Date().toISOString();

  const [hotspots, fires, aqhi, pm25, sightings, nodes, named, notices, reports] = await Promise.all([
    within<Observation>("observations", "AND c.kind = 'hotspot' AND c.observedAt >= @since", [{ name: "@since", value: dayAgo }]),
    within<Observation>("observations", "AND c.kind = 'fire-perimeter'"),
    within<Observation>("observations", "AND c.kind = 'aqhi'"),
    within<Observation>("observations", "AND c.kind = 'pm25'"),
    within<Sighting>("sightings", ""),
    within<Observation>("observations", "AND c.kind = 'node'"),
    container("observations")
      .items.query<Observation>({ query: "SELECT * FROM c WHERE c.kind = 'named-fire' AND ST_WITHIN(c.location, @wide)", parameters: [{ name: "@wide", value: wide }] })
      .fetchAll()
      .then((r) => r.resources),
    // Official evacuation alerts and orders whose area overlaps the view and hasn't expired.
    container("officialAlerts")
      .items.query<OfficialNoticeDoc>({
        query: "SELECT * FROM c WHERE c.bbox[0] <= @e AND c.bbox[2] >= @w AND c.bbox[1] <= @n AND c.bbox[3] >= @s AND (NOT IS_DEFINED(c.expiresAt) OR c.expiresAt > @now)",
        parameters: [{ name: "@w", value: w }, { name: "@s", value: s }, { name: "@e", value: e }, { name: "@n", value: n }, { name: "@now", value: nowIso }],
      })
      .fetchAll()
      .then((r) => r.resources),
    reportsWithin(box as { type: "Polygon"; coordinates: number[][][] }).catch(() => []),
  ]);

  const refs: NamedFireRef[] = named.map((o) => ({
    id: o.id,
    name: o.label ?? String(o.props?.fireNumber ?? "Wildfire"),
    status: o.props?.status as FireStatus,
    agency: String(o.props?.agency ?? o.source.name),
    at: { lat: o.location.coordinates[1], lon: o.location.coordinates[0] },
    areaHa: o.value,
  }));

  const point = (o: { id: string; location: unknown }, properties: Record<string, unknown>): Feature => ({
    type: "Feature",
    id: o.id,
    geometry: o.location,
    properties,
  });

  return {
    hotspots: fc(
      hotspots.slice(0, 3000).map((o) => {
        const fire = matchHeatToFire({ lat: o.location.coordinates[1], lon: o.location.coordinates[0] }, refs);
        return point(o, {
          kind: "hotspot",
          observedAt: o.observedAt,
          frp: o.value ?? null,
          satellite: o.props?.satellite ?? "",
          confidence: o.props?.confidence ?? "",
          ...(fire ? { fireName: fire.name, fireStatus: fire.status, fireAgency: fire.agency } : {}),
        });
      }),
    ),
    fires: fc(
      fires.map((o) => ({
        type: "Feature",
        id: o.id,
        geometry: withShapes && o.shape ? o.shape : o.location,
        properties: { kind: "fire", areaHa: o.value ?? null, firstSeen: o.props?.firstSeen ?? "", lastSeen: o.observedAt },
      })),
    ),
    named: fc(
      named
        .filter((o) => o.location.coordinates[0] >= w && o.location.coordinates[0] <= e && o.location.coordinates[1] >= s && o.location.coordinates[1] <= n)
        .map((o) =>
          point(o, {
            kind: "namedFire",
            name: o.label ?? "",
            status: o.props?.status ?? "",
            areaHa: o.value ?? null,
            agency: o.props?.agency ?? o.source.name,
            fireNumber: o.props?.fireNumber ?? "",
            url: o.props?.url ?? o.source.url,
            ofNote: !!o.props?.ofNote,
            updatedAt: o.observedAt,
          }),
        ),
    ),
    reports: fc(
      groupReports(reports).map((g) => ({
        type: "Feature",
        id: g.key,
        geometry: { type: "Point", coordinates: [g.location.lon, g.location.lat] },
        properties: { kind: "report", reportKind: g.kind, people: g.people, latestAt: g.latestAt, notes: g.notes, photoId: g.photoId ?? "" },
      })),
    ),
    evac: fc(
      notices.map((x) => ({
        type: "Feature",
        id: x.id,
        geometry: x.area,
        properties: { kind: "evac", noticeKind: x.kind, areaName: x.areaName, agency: x.agency, issuedAt: x.issuedAt, url: x.url, sourceName: x.source.name },
      })),
    ),
    aqhi: fc(aqhi.map((o) => point(o, { kind: "aqhi", value: o.value, label: o.label ?? "", observedAt: o.observedAt }))),
    pm25: fc(pm25.map((o) => point(o, { kind: "pm25", value: o.value, observedAt: o.observedAt, corrected: o.props?.corrected === "US EPA" }))),
    sightings: fc(sightings.map((x) => point(x, { kind: "sighting", commonName: x.commonName, date: x.createdAt }))),
    nodes: fc(nodes.map((o) => point(o, { kind: "node", ...(o.value !== undefined ? { value: o.value } : {}), name: o.label ?? "", observedAt: o.observedAt, ...o.props }))),
  };
}
