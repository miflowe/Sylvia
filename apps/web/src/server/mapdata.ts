import "server-only";
import type { SqlParameter } from "@azure/cosmos";
import type { Observation, Sighting } from "@sylvia/core";
import { container } from "./cosmos";

type Feature = { type: "Feature"; id: string; geometry: unknown; properties: Record<string, unknown> };
type Collection = { type: "FeatureCollection"; features: Feature[] };
export type MapLayers = Record<"hotspots" | "fires" | "aqhi" | "pm25" | "sightings", Collection>;

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

  const [hotspots, fires, aqhi, pm25, sightings] = await Promise.all([
    within<Observation>("observations", "AND c.kind = 'hotspot' AND c.observedAt >= @since", [{ name: "@since", value: dayAgo }]),
    within<Observation>("observations", "AND c.kind = 'fire-perimeter'"),
    within<Observation>("observations", "AND c.kind = 'aqhi'"),
    within<Observation>("observations", "AND c.kind = 'pm25'"),
    within<Sighting>("sightings", ""),
  ]);

  const point = (o: { id: string; location: unknown }, properties: Record<string, unknown>): Feature => ({
    type: "Feature",
    id: o.id,
    geometry: o.location,
    properties,
  });

  return {
    hotspots: fc(
      hotspots.slice(0, 3000).map((o) =>
        point(o, { kind: "hotspot", observedAt: o.observedAt, frp: o.value ?? null, satellite: o.props?.satellite ?? "", confidence: o.props?.confidence ?? "" }),
      ),
    ),
    fires: fc(
      fires.map((o) => ({
        type: "Feature",
        id: o.id,
        geometry: withShapes && o.shape ? o.shape : o.location,
        properties: { kind: "fire", areaHa: o.value ?? null, firstSeen: o.props?.firstSeen ?? "", lastSeen: o.observedAt },
      })),
    ),
    aqhi: fc(aqhi.map((o) => point(o, { kind: "aqhi", value: o.value, label: o.label ?? "", observedAt: o.observedAt }))),
    pm25: fc(pm25.map((o) => point(o, { kind: "pm25", value: o.value, observedAt: o.observedAt }))),
    sightings: fc(sightings.map((x) => point(x, { kind: "sighting", commonName: x.commonName, date: x.createdAt }))),
  };
}
