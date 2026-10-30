"use client";
import { useEffect, useRef, useState } from "react";
import type * as Atlas from "azure-maps-control";
import type { Place } from "@sylvia/core";
import { DetailCard, type Selected } from "./DetailCard";
import { HEAT_AGE, TimeBar } from "./TimeBar";
import styles from "./map.module.css";

type LayerId = "fires" | "hotspots" | "aqhi" | "pm25" | "nodes" | "sightings";
const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "fires", label: "Fire areas", swatch: "var(--ember)" },
  { id: "hotspots", label: "Satellite heat", swatch: "#e8771a" },
  { id: "aqhi", label: "Air quality", swatch: "var(--sky)" },
  { id: "pm25", label: "Smoke sensors", swatch: "#7a5fb3" },
  { id: "nodes", label: "Sylvia Nodes", swatch: "var(--pine)" },
  { id: "sightings", label: "Invasive sightings", swatch: "var(--moss)" },
];

// Microsoft's prebuilt SDK, copied into public/ by scripts/copy-atlas.mjs (bundling it breaks under Turbopack).
const ATLAS_VERSION = "3.7.4";
let atlasPromise: Promise<typeof Atlas> | undefined;
function loadAtlas(): Promise<typeof Atlas> {
  atlasPromise ??= new Promise((resolve, reject) => {
    const base = `/vendor/azure-maps/${ATLAS_VERSION}`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${base}/atlas.min.css`;
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = `${base}/atlas.min.js`;
    script.onload = () => resolve((window as unknown as { atlas: typeof Atlas }).atlas);
    script.onerror = () => reject(new Error("Couldn't load the map."));
    document.head.appendChild(script);
  });
  return atlasPromise;
}

// Half a 44 px touch target. Point layers that a tap can pick, by id.
const TAP_RADIUS = 22;
const POINT_LAYERS = ["nodes", "aqhi", "pm25", "pm25-group", "fires-point", "sightings", "hotspots"];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

export function FireMap() {
  const el = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Partial<Record<LayerId, Atlas.layer.Layer[]>>>({});
  const ring = useRef<Atlas.source.DataSource | undefined>(undefined);
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ fires: true, hotspots: true, aqhi: true, pm25: true, nodes: true, sightings: true });
  const [counts, setCounts] = useState<Partial<Record<LayerId, number>>>({});
  const [selected, setSelected] = useState<Selected | undefined>();
  const [status, setStatus] = useState("Loading the map…");
  const [heatHours, setHeatHours] = useState(24);

  useEffect(() => {
    let map: Atlas.Map | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const atlas = await loadAtlas();
      const { key } = (await fetch("/api/map/key").then((r) => r.json())) as { key: string };
      if (cancelled || !el.current) return;
      let place: Place | undefined;
      try {
        place = JSON.parse(localStorage.getItem("sylvia.place") ?? "null") ?? undefined;
      } catch {}
      const dark = matchMedia("(prefers-color-scheme: dark)").matches;

      map = new atlas.Map(el.current, {
        center: place ? [place.lon, place.lat] : [-105, 52],
        zoom: place ? 7 : 3.4,
        style: dark ? "grayscale_dark" : "grayscale_light",
        language: "en-US",
        view: "Auto",
        showFeedbackLink: false,
        authOptions: { authType: atlas.AuthenticationType.subscriptionKey, subscriptionKey: key },
      });

      map.events.add("ready", () => {
        if (!map) return;
        // Development only: lets tests drive the map from the browser console.
        if (process.env.NODE_ENV !== "production") (window as unknown as { __sylviaMap?: Atlas.Map }).__sylviaMap = map;
        map.controls.add([new atlas.control.ZoomControl(), new atlas.control.CompassControl()], { position: atlas.ControlPosition.BottomRight });

        // Smoke sensors bunch up in towns, so nearby ones merge into a group that splits apart as you zoom in.
        const sources = Object.fromEntries(
          LAYERS.map((l) => [l.id, new atlas.source.DataSource(undefined, l.id === "pm25" ? { cluster: true, clusterRadius: 36, clusterMaxZoom: 12 } : undefined)]),
        ) as Record<LayerId, Atlas.source.DataSource>;
        Object.values(sources).forEach((s) => map!.sources.add(s));
        type Filter = Atlas.BubbleLayerOptions["filter"];
        const isPoint = ["==", ["geometry-type"], "Point"] as unknown as Filter;
        const isPolygon = ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]] as unknown as Filter;
        const ember = css("--ember");
        const isGroup = ["has", "point_count"] as unknown as Filter;
        const isSingle = ["!", ["has", "point_count"]] as unknown as Filter;

        layerRefs.current = {
          fires: [
            new atlas.layer.PolygonLayer(sources.fires, "fires-fill", { fillColor: ember, fillOpacity: 0.25, filter: isPolygon }),
            new atlas.layer.LineLayer(sources.fires, "fires-line", { strokeColor: ember, strokeWidth: 1.5, filter: isPolygon }),
            new atlas.layer.BubbleLayer(sources.fires, "fires-point", { color: ember, radius: 7, strokeColor: "#ffffff", strokeWidth: 1, filter: isPoint }),
          ],
          // Fresh heat is darker and bigger; older detections fade (ageH is set when the data loads).
          hotspots: [
            new atlas.layer.BubbleLayer(sources.hotspots, "hotspots", {
              color: ["step", ["get", "ageH"], HEAT_AGE[0].color, HEAT_AGE[0].upTo, HEAT_AGE[1].color, HEAT_AGE[1].upTo, HEAT_AGE[2].color] as unknown as string,
              radius: ["step", ["get", "ageH"], 6, 3, 5, 12, 4] as unknown as number,
              strokeColor: "#5a2a00",
              strokeWidth: 1,
              opacity: 0.95,
            }),
          ],
          aqhi: [
            new atlas.layer.BubbleLayer(sources.aqhi, "aqhi", { color: css("--sky"), radius: 13, strokeColor: "#ffffff", strokeWidth: 1.5 }),
            new atlas.layer.SymbolLayer(sources.aqhi, "aqhi-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 13, font: ["SegoeUi-Bold"], allowOverlap: true },
            }),
          ],
          pm25: [
            new atlas.layer.BubbleLayer(sources.pm25, "pm25", { color: "#7a5fb3", radius: 9, strokeColor: "#ffffff", strokeWidth: 1, filter: isSingle }),
            new atlas.layer.SymbolLayer(sources.pm25, "pm25-label", {
              iconOptions: { image: "none" },
              filter: isSingle,
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 11, allowOverlap: true },
            }),
            // A group is white with a purple ring and shows how many sensors it holds, so it never reads as a PM2.5 value.
            new atlas.layer.BubbleLayer(sources.pm25, "pm25-group", {
              color: "#ffffff",
              radius: ["step", ["get", "point_count"], 13, 10, 16, 50, 19] as unknown as number,
              strokeColor: "#7a5fb3",
              strokeWidth: 3,
              filter: isGroup,
            }),
            new atlas.layer.SymbolLayer(sources.pm25, "pm25-group-label", {
              iconOptions: { image: "none" },
              filter: isGroup,
              textOptions: { textField: ["get", "point_count_abbreviated"], color: "#5b4391", size: 12, font: ["SegoeUi-Bold"], allowOverlap: true },
            }),
          ],
          nodes: [
            new atlas.layer.BubbleLayer(sources.nodes, "nodes", { color: css("--pine"), radius: 11, strokeColor: "#ffffff", strokeWidth: 2 }),
            new atlas.layer.SymbolLayer(sources.nodes, "nodes-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["case", ["has", "value"], ["to-string", ["round", ["get", "value"]]], ""], color: "#ffffff", size: 11, allowOverlap: true },
            }),
          ],
          sightings: [new atlas.layer.BubbleLayer(sources.sightings, "sightings", { color: css("--moss"), radius: 6, strokeColor: "#ffffff", strokeWidth: 1.5 })],
        };
        for (const id of ["fires", "hotspots", "pm25", "aqhi", "nodes", "sightings"] as LayerId[]) {
          for (const layer of layerRefs.current[id]!) map.layers.add(layer);
        }
        // Ring around the tapped point, so it's clear which dot in a cluster the card is about.
        ring.current = new atlas.source.DataSource();
        map.sources.add(ring.current);
        map.layers.add(new atlas.layer.BubbleLayer(ring.current, "selected", { color: "transparent", radius: 18, strokeColor: css("--ink"), strokeWidth: 3 }));

        // One tap handler for the whole map. A finger covers ~44 px, far more than a 8 px heat dot, so a tap picks
        // the nearest point within TAP_RADIUS; fire areas count only when no point is near. Empty map closes the card.
        type Hit = Atlas.Shape | Atlas.data.Feature<Atlas.data.Geometry, Record<string, unknown>>;
        const propsOf = (s: Hit) => ("getProperties" in s ? s.getProperties() : s.properties) as Selected;
        const pointOf = (s: Hit) => ("getCoordinates" in s ? s.getCoordinates() : s.geometry.coordinates) as Atlas.data.Position;
        map.events.add("click", (e: Atlas.MapMouseEvent) => {
          if (!map || !e.pixel || !e.position) return;
          const [x, y] = e.pixel;
          const corners = map.pixelsToPositions([[x - TAP_RADIUS, y + TAP_RADIUS], [x + TAP_RADIUS, y - TAP_RADIUS]]);
          const box = atlas.data.BoundingBox.fromPositions(corners);
          const points = map.layers.getRenderedShapes(box, POINT_LAYERS) as Hit[];
          let best: { hit: Hit; d: number } | undefined;
          for (const hit of points) {
            const [px, py] = map.positionsToPixels([pointOf(hit)])[0];
            const d = Math.hypot(px - x, py - y);
            if (d <= TAP_RADIUS && (!best || d < best.d)) best = { hit, d };
          }
          const area = best ? undefined : (map.layers.getRenderedShapes(e.position, ["fires-fill"]) as Hit[])[0];
          const group = best && (propsOf(best.hit) as unknown as { cluster?: boolean; cluster_id?: number });
          if (group?.cluster && group.cluster_id !== undefined) {
            // Tapping a group zooms in until it splits into single sensors.
            const center = pointOf(best!.hit);
            sources.pm25.getClusterExpansionZoom(group.cluster_id).then((zoom) => map?.setCamera({ center, zoom, type: "ease", duration: 350 }));
            setSelected(undefined);
            ring.current?.clear();
            return;
          }
          const hit = best?.hit ?? area;
          setSelected(hit ? { ...propsOf(hit), position: best ? pointOf(best.hit) : e.position } : undefined);
          ring.current?.setShapes(best ? [new atlas.data.Point(pointOf(best.hit))] : []);
        });

        if (place) {
          map.markers.add(new atlas.HtmlMarker({ position: [place.lon, place.lat], htmlContent: `<div class="${styles.home}" title="Your home"></div>` }));
        }

        const load = async () => {
          const cam = map!.getCamera();
          const [w, s, e, n] = cam.bounds as [number, number, number, number];
          try {
            const res = await fetch(`/api/map?bbox=${w.toFixed(3)},${s.toFixed(3)},${e.toFixed(3)},${n.toFixed(3)}&zoom=${Math.floor(cam.zoom ?? 0)}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.error);
            const next: Partial<Record<LayerId, number>> = {};
            const now = Date.now();
            for (const h of body.hotspots.features) h.properties.ageH = (now - Date.parse(h.properties.observedAt)) / 3.6e6;
            for (const id of Object.keys(sources) as LayerId[]) {
              sources[id].setShapes(body[id]);
              next[id] = body[id].features.length;
            }
            setCounts(next);
            setStatus("");
          } catch (err) {
            setStatus(err instanceof Error && err.message ? err.message : "Couldn't load map data.");
          }
        };
        map.events.add("moveend", () => {
          clearTimeout(timer);
          timer = setTimeout(load, 400);
        });
        load();
      });
    })().catch(() => setStatus("Couldn't load the map."));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      map?.dispose();
    };
  }, []);

  useEffect(() => {
    for (const id of Object.keys(visible) as LayerId[]) {
      layerRefs.current[id]?.forEach((l) => l.setOptions({ visible: visible[id] }));
    }
  }, [visible, counts]);

  useEffect(() => {
    layerRefs.current.hotspots?.[0]?.setOptions({ filter: ["<=", ["get", "ageH"], heatHours] } as Atlas.BubbleLayerOptions);
  }, [heatHours, counts]);

  return (
    <div className={styles.wrap}>
      <div className={styles.chips} role="group" aria-label="Map layers">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={styles.chip}
            aria-pressed={visible[l.id]}
            onClick={() => setVisible((v) => ({ ...v, [l.id]: !v[l.id] }))}
          >
            <span className={styles.swatch} style={{ background: l.swatch }} aria-hidden="true" />
            {l.label}
            {counts[l.id] !== undefined && <span className={styles.count}>{counts[l.id]}</span>}
          </button>
        ))}
      </div>
      <div ref={el} className={styles.map} role="region" aria-label="Map of fires, smoke and air quality" />
      {status && <p className={styles.status} aria-live="polite">{status}</p>}
      {!selected && <TimeBar hours={heatHours} onHours={setHeatHours} />}
      {selected && <DetailCard item={selected} onClose={() => { setSelected(undefined); ring.current?.clear(); }} />}
    </div>
  );
}
