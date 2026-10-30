"use client";
import { useEffect, useRef, useState } from "react";
import type * as Atlas from "azure-maps-control";
import { buildTimeline, replayAt, type Alert, type Place, type ReplayTimeline } from "@sylvia/core";
import { DetailCard, type Selected } from "./DetailCard";
import { HEAT_AGE, TimeBar } from "./TimeBar";
import { ReplayAlert, ReplayBar, ReplayHeader } from "./ReplayBar";
import { isDark } from "@/lib/theme";
import styles from "./map.module.css";

type LayerId = "evac" | "named" | "fires" | "hotspots" | "aqhi" | "pm25" | "nodes" | "sightings";
const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "evac", label: "Evacuation areas", swatch: "#9c1c1c" },
  { id: "named", label: "Named fires", swatch: "#e07a2c" },
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
const POINT_LAYERS = ["named", "nodes", "aqhi", "pm25", "pm25-group", "fires-point", "sightings", "hotspots", "replay-heat"];
// Official evacuation areas win over estimated fire areas when a tap lands on both.
const AREA_LAYERS = ["evac-fill", "fires-fill", "replay-fill"];

// Official stage of control, from most to least urgent.
const FIRE_STATUS_COLOUR = ["match", ["get", "status"], "Out of control", "#9c1c1c", "Being held", "#e07a2c", "Under control", "#4f7d3a", "#6b7570"] as unknown as string;

const HOUR = 3600 * 1000;
// Fresh heat is darker and bigger; older detections fade. Shared by live and replay heat.
const heatColor = ["step", ["get", "ageH"], HEAT_AGE[0].color, HEAT_AGE[0].upTo, HEAT_AGE[1].color, HEAT_AGE[1].upTo, HEAT_AGE[2].color] as unknown as string;
const heatRadius = ["step", ["get", "ageH"], 6, 3, 5, 12, 4] as unknown as number;

// Environment Canada's FireWork forecast of surface smoke PM2.5, as map tiles (transparent below 1 µg/m³).
const HOUR_NOW = () => Math.ceil(Date.now() / HOUR) * HOUR;
const smokeTiles = (aheadH: number) =>
  "https://geo.weather.gc.ca/geomet?service=WMS&version=1.3.0&request=GetMap&layers=RAQDPS.Sfc_PM2.5-WildfireSmokePlume&styles=PM2.5_0to100ugm3_Dis" +
  `&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true&time=${new Date(HOUR_NOW() + aheadH * HOUR).toISOString().replace(".000", "")}`;

interface Replay {
  name: string;
  dateLabel: string;
  home: { name: string; lat: number; lon: number };
  timeline: ReplayTimeline;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

export function FireMap() {
  const el = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Partial<Record<LayerId, Atlas.layer.Layer[]>>>({});
  const ring = useRef<Atlas.source.DataSource | undefined>(undefined);
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ evac: true, named: true, fires: true, hotspots: true, aqhi: true, pm25: true, nodes: true, sightings: true });
  const [counts, setCounts] = useState<Partial<Record<LayerId, number>>>({});
  const [selected, setSelected] = useState<Selected | undefined>();
  const [status, setStatus] = useState("Loading the map…");
  const [heatHours, setHeatHours] = useState(24);
  const smokeLayer = useRef<Atlas.layer.TileLayer | undefined>(undefined);
  const [smokeOn, setSmokeOn] = useState(false);
  const [smokeAhead, setSmokeAhead] = useState(24);
  // Replay mode: an archived fire plays on the map with the same alert rules as live.
  const mapRef = useRef<Atlas.Map | undefined>(undefined);
  const atlasRef = useRef<typeof Atlas | undefined>(undefined);
  const placeRef = useRef<Place | undefined>(undefined);
  const replayRefs = useRef<{ heat: Atlas.source.DataSource; area: Atlas.source.DataSource; layers: Atlas.layer.Layer[]; marker?: Atlas.HtmlMarker } | undefined>(undefined);
  const [replay, setReplay] = useState<Replay | undefined>();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayAlerts, setReplayAlerts] = useState<Alert[]>([]);
  const [caption, setCaption] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const seenAlerts = useRef(new Set<string>());
  const holdUntil = useRef(0);

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
      placeRef.current = place;
      const dark = isDark();

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
        mapRef.current = map;
        atlasRef.current = atlas;
        const controlStyle = (dark ? "dark" : "light") as Atlas.ControlStyle;
        map.controls.add([new atlas.control.ZoomControl({ style: controlStyle, zoomDelta: 1 }), new atlas.control.CompassControl({ style: controlStyle, rotationDegreesDelta: 15 })], { position: atlas.ControlPosition.BottomRight });

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

        const isOrder = ["==", ["get", "noticeKind"], "order"] as unknown as boolean;
        layerRefs.current = {
          evac: [
            new atlas.layer.PolygonLayer(sources.evac, "evac-fill", { fillColor: ["case", isOrder, "#9c1c1c", "#e8b931"] as unknown as string, fillOpacity: 0.2 }),
            new atlas.layer.LineLayer(sources.evac, "evac-line", { strokeColor: ["case", isOrder, "#9c1c1c", "#b98a12"] as unknown as string, strokeWidth: 2, strokeDashArray: [3, 2] }),
          ],
          named: [
            new atlas.layer.BubbleLayer(sources.named, "named", { color: FIRE_STATUS_COLOUR, radius: 9, strokeColor: "#ffffff", strokeWidth: 3 }),
            new atlas.layer.SymbolLayer(sources.named, "named-label", {
              iconOptions: { image: "none" },
              minZoom: 7,
              textOptions: { textField: ["get", "name"], size: 12, font: ["SegoeUi-Bold"], color: "#3a1a0a", haloColor: "#ffffff", haloWidth: 2, anchor: "top", offset: [0, 1] },
            }),
          ],
          fires: [
            new atlas.layer.PolygonLayer(sources.fires, "fires-fill", { fillColor: ember, fillOpacity: 0.25, filter: isPolygon }),
            new atlas.layer.LineLayer(sources.fires, "fires-line", { strokeColor: ember, strokeWidth: 1.5, filter: isPolygon }),
            new atlas.layer.BubbleLayer(sources.fires, "fires-point", { color: ember, radius: 7, strokeColor: "#ffffff", strokeWidth: 1, filter: isPoint }),
          ],
          // ageH is set when the data loads.
          hotspots: [
            new atlas.layer.BubbleLayer(sources.hotspots, "hotspots", {
              color: heatColor,
              radius: heatRadius,
              strokeColor: "#5a2a00",
              strokeWidth: 1,
              opacity: 0.95,
            }),
          ],
          aqhi: [
            new atlas.layer.BubbleLayer(sources.aqhi, "aqhi", { color: css("--sky"), radius: 13, strokeColor: "#ffffff", strokeWidth: 1.5 }),
            new atlas.layer.SymbolLayer(sources.aqhi, "aqhi-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 13, font: ["SegoeUi-Bold"], anchor: "center", offset: [0, 0], allowOverlap: true, ignorePlacement: true },
            }),
          ],
          pm25: [
            new atlas.layer.BubbleLayer(sources.pm25, "pm25", { color: "#7a5fb3", radius: 9, strokeColor: "#ffffff", strokeWidth: 1, filter: isSingle }),
            new atlas.layer.SymbolLayer(sources.pm25, "pm25-label", {
              iconOptions: { image: "none" },
              filter: isSingle,
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 11, font: ["SegoeUi-Bold"], anchor: "center", offset: [0, 0], allowOverlap: true, ignorePlacement: true },
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
              textOptions: { textField: ["get", "point_count_abbreviated"], color: "#5b4391", size: 12, font: ["SegoeUi-Bold"], anchor: "center", offset: [0, 0], allowOverlap: true, ignorePlacement: true },
            }),
          ],
          nodes: [
            new atlas.layer.BubbleLayer(sources.nodes, "nodes", { color: css("--pine"), radius: 11, strokeColor: "#ffffff", strokeWidth: 2 }),
            new atlas.layer.SymbolLayer(sources.nodes, "nodes-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["case", ["has", "value"], ["to-string", ["round", ["get", "value"]]], ""], color: "#ffffff", size: 11, font: ["SegoeUi-Bold"], anchor: "center", offset: [0, 0], allowOverlap: true, ignorePlacement: true },
            }),
          ],
          sightings: [new atlas.layer.BubbleLayer(sources.sightings, "sightings", { color: css("--moss"), radius: 6, strokeColor: "#ffffff", strokeWidth: 1.5 })],
        };
        for (const id of ["evac", "fires", "hotspots", "named", "pm25", "aqhi", "nodes", "sightings"] as LayerId[]) {
          for (const layer of layerRefs.current[id]!) map.layers.add(layer);
        }
        // Smoke forecast tiles sit under every data layer; off until the chip is turned on.
        smokeLayer.current = new atlas.layer.TileLayer({ tileUrl: smokeTiles(24), tileSize: 256, opacity: 0.55, visible: false }, "smoke-forecast");
        map.layers.add(smokeLayer.current, "fires-fill");

        // Replay layers stay hidden until a replay starts.
        const replayHeat = new atlas.source.DataSource();
        const replayArea = new atlas.source.DataSource();
        map.sources.add([replayHeat, replayArea]);
        const replayLayers = [
          new atlas.layer.PolygonLayer(replayArea, "replay-fill", { fillColor: ember, fillOpacity: 0.3, visible: false }),
          new atlas.layer.LineLayer(replayArea, "replay-line", { strokeColor: ember, strokeWidth: 2, strokeDashArray: [2, 1.5], visible: false }),
          new atlas.layer.BubbleLayer(replayHeat, "replay-heat", { color: heatColor, radius: heatRadius, strokeColor: "#5a2a00", strokeWidth: 1, opacity: 0.95, visible: false }),
        ];
        map.layers.add(replayLayers);
        replayRefs.current = { heat: replayHeat, area: replayArea, layers: replayLayers };

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
          const area = best ? undefined : (map.layers.getRenderedShapes(e.position, AREA_LAYERS) as Hit[])[0];
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
      layerRefs.current[id]?.forEach((l) => l.setOptions({ visible: visible[id] && !replay }));
    }
  }, [visible, counts, replay]);

  useEffect(() => {
    smokeLayer.current?.setOptions({ visible: smokeOn && !replay, tileUrl: smokeTiles(smokeAhead) });
  }, [smokeOn, smokeAhead, replay, counts]);

  async function startReplay() {
    setStatus("Loading the replay…");
    try {
      const [first] = (await fetch("/api/replay").then((r) => r.json())) as { id: string }[];
      const res = await fetch(`/api/replay?id=${encodeURIComponent(first!.id)}`);
      if (!res.ok) throw new Error();
      const ev = await res.json();
      const timeline = buildTimeline(ev.frames);
      seenAlerts.current = new Set();
      holdUntil.current = 0;
      setSelected(undefined);
      ring.current?.clear();
      setReplay({ name: ev.name, dateLabel: ev.dateLabel, home: ev.home, timeline });
      setT(timeline.start);
      setPlaying(true);
      setStatus("");
    } catch {
      setStatus("Couldn't load the replay.");
    }
  }

  function exitReplay() {
    setReplay(undefined);
    setPlaying(false);
    setSelected(undefined);
    ring.current?.clear();
  }

  // Entering or leaving a replay: show its layers and home, and move the camera.
  useEffect(() => {
    const map = mapRef.current;
    const atlas = atlasRef.current;
    const r = replayRefs.current;
    if (!map || !atlas || !r) return;
    r.layers.forEach((l) => l.setOptions({ visible: !!replay }));
    if (replay) {
      r.marker = new atlas.HtmlMarker({ position: [replay.home.lon, replay.home.lat], htmlContent: `<div class="${styles.home}" title="${replay.home.name}"></div>` });
      map.markers.add(r.marker);
      // Frame the whole fire and the replay home, clear of the alert banner and the bottom bar.
      const pts = [...replay.timeline.detections.map((d) => [d.location.lon, d.location.lat]), [replay.home.lon, replay.home.lat]];
      map.setCamera({ bounds: atlas.data.BoundingBox.fromPositions(pts), padding: matchMedia("(min-width: 768px)").matches ? 60 : { top: 190, bottom: 250, left: 40, right: 80 }, maxZoom: 11, type: "fly", duration: 1200 });
    } else {
      if (r.marker) map.markers.remove(r.marker);
      r.marker = undefined;
      r.heat.clear();
      r.area.clear();
      setReplayAlerts([]);
      const place = placeRef.current;
      if (place) map.setCamera({ center: [place.lon, place.lat], zoom: 7, type: "fly", duration: 1000 });
    }
  }, [replay]);

  // What was known at time t: heat so far, the estimated area, and the alerts the live rules would raise.
  useEffect(() => {
    const atlas = atlasRef.current;
    const r = replayRefs.current;
    if (!replay || !atlas || !r) return;
    let sensitive = false;
    try {
      sensitive = JSON.parse(localStorage.getItem("sylvia.sensitive") ?? "false");
    } catch {}
    const s = replayAt(replay.timeline, replay.home, t, sensitive);
    r.heat.setShapes(
      s.hotspots.map((h) => new atlas.data.Feature(new atlas.data.Point([h.location.lon, h.location.lat]), { kind: "hotspot", observedAt: h.observedAt, frp: null, satellite: "", confidence: "", ageH: h.ageH })),
    );
    const firstSeen = replay.timeline.detections[0]?.observedAt ?? "";
    r.area.setShapes(s.outlines.map((ring) => new atlas.data.Feature(new atlas.data.Polygon([ring]), { kind: "fire", areaHa: null, firstSeen, lastSeen: new Date(t).toISOString(), replay: true })));
    // A new alert holds the playback for a moment so it can be read.
    const fresh = s.alerts.filter((a) => !seenAlerts.current.has(a.key ?? a.title));
    fresh.forEach((a) => seenAlerts.current.add(a.key ?? a.title));
    if (fresh.length) {
      holdUntil.current = Date.now() + 2500;
      setAlertOpen(false);
    }
    setReplayAlerts(s.alerts);
    setCaption(s.caption);
  }, [replay, t]);

  // Playback: one hour of the fire every 450 ms.
  useEffect(() => {
    if (!replay || !playing) return;
    const end = replay.timeline.end;
    const id = setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      setT((prev) => Math.min(end, prev + HOUR));
    }, 450);
    return () => clearInterval(id);
  }, [replay, playing]);

  useEffect(() => {
    if (replay && t >= replay.timeline.end) setPlaying(false);
  }, [replay, t]);

  useEffect(() => {
    layerRefs.current.hotspots?.[0]?.setOptions({ filter: ["<=", ["get", "ageH"], heatHours] } as Atlas.BubbleLayerOptions);
  }, [heatHours, counts]);

  return (
    <div className={styles.wrap}>
      {/* Phones: the panel's children float over the map. Tablet and up: they stack in a side panel. */}
      <aside className={styles.panel} aria-label="Map controls">
      <h1 className={styles.panelTitle}>Map</h1>
      {replay && <ReplayHeader name={replay.name} dateLabel={replay.dateLabel} onExit={exitReplay} />}
      {replay && !selected && <ReplayAlert alerts={replayAlerts} open={alertOpen} onToggle={() => setAlertOpen((o) => !o)} />}
      <div className={styles.chips} role="group" aria-label="Map layers" hidden={!!replay}>
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
        <button type="button" className={styles.chip} aria-pressed={smokeOn} onClick={() => setSmokeOn((s) => !s)}>
          <span className={styles.swatch} style={{ background: "linear-gradient(90deg, #22c4f0, #ffe933, #ff3333)" }} aria-hidden="true" />
          Smoke forecast
        </button>
      </div>
      {status && <p className={styles.status} aria-live="polite">{status}</p>}
      {/* On phones a card replaces the time bar; on bigger screens both fit in the panel. */}
      <div className={selected ? styles.phoneHidden : undefined}>
      {!replay && <TimeBar hours={heatHours} onHours={setHeatHours} onReplay={startReplay} smoke={smokeOn ? { aheadH: smokeAhead, at: HOUR_NOW() + smokeAhead * HOUR, onAhead: setSmokeAhead } : undefined} />}
      {replay && (
        <ReplayBar
          start={replay.timeline.start}
          end={replay.timeline.end}
          t={t}
          playing={playing}
          caption={caption}
          onPlay={() => {
            if (!playing && t >= replay.timeline.end) setT(replay.timeline.start);
            setPlaying((p) => !p);
          }}
          onScrub={(next) => {
            setPlaying(false);
            setT(next);
          }}
        />
      )}
      </div>
      {selected && <DetailCard item={selected} onClose={() => { setSelected(undefined); ring.current?.clear(); }} />}
      </aside>
      <div ref={el} className={styles.map} role="region" aria-label="Map of fires, smoke and air quality" />
    </div>
  );
}
