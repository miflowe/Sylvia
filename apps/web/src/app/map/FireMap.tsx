"use client";
import { useEffect, useRef, useState } from "react";
import type * as Atlas from "azure-maps-control";
import type { Place } from "@sylvia/core";
import { DetailCard, type Selected } from "./DetailCard";
import styles from "./map.module.css";

type LayerId = "fires" | "hotspots" | "aqhi" | "pm25" | "sightings";
const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "fires", label: "Fire areas", swatch: "var(--ember)" },
  { id: "hotspots", label: "Satellite heat", swatch: "#e8771a" },
  { id: "aqhi", label: "Air quality", swatch: "var(--sky)" },
  { id: "pm25", label: "Smoke sensors", swatch: "#7a5fb3" },
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

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

export function FireMap() {
  const el = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Partial<Record<LayerId, Atlas.layer.Layer[]>>>({});
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ fires: true, hotspots: true, aqhi: true, pm25: true, sightings: true });
  const [counts, setCounts] = useState<Partial<Record<LayerId, number>>>({});
  const [selected, setSelected] = useState<Selected | undefined>();
  const [status, setStatus] = useState("Loading the map…");

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
        map.controls.add([new atlas.control.ZoomControl(), new atlas.control.CompassControl()], { position: atlas.ControlPosition.TopRight });

        const sources = Object.fromEntries(LAYERS.map((l) => [l.id, new atlas.source.DataSource()])) as Record<LayerId, Atlas.source.DataSource>;
        Object.values(sources).forEach((s) => map!.sources.add(s));
        type Filter = Atlas.BubbleLayerOptions["filter"];
        const isPoint = ["==", ["geometry-type"], "Point"] as unknown as Filter;
        const isPolygon = ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]] as unknown as Filter;
        const ember = css("--ember");

        layerRefs.current = {
          fires: [
            new atlas.layer.PolygonLayer(sources.fires, "fires-fill", { fillColor: ember, fillOpacity: 0.25, filter: isPolygon }),
            new atlas.layer.LineLayer(sources.fires, "fires-line", { strokeColor: ember, strokeWidth: 1.5, filter: isPolygon }),
            new atlas.layer.BubbleLayer(sources.fires, "fires-point", { color: ember, radius: 7, strokeColor: "#ffffff", strokeWidth: 1, filter: isPoint }),
          ],
          hotspots: [new atlas.layer.BubbleLayer(sources.hotspots, "hotspots", { color: "#e8771a", radius: 4, strokeColor: "#5a2a00", strokeWidth: 1, opacity: 0.9 })],
          aqhi: [
            new atlas.layer.BubbleLayer(sources.aqhi, "aqhi", { color: css("--sky"), radius: 13, strokeColor: "#ffffff", strokeWidth: 1.5 }),
            new atlas.layer.SymbolLayer(sources.aqhi, "aqhi-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 13, font: ["SegoeUi-Bold"], allowOverlap: true },
            }),
          ],
          pm25: [
            new atlas.layer.BubbleLayer(sources.pm25, "pm25", { color: "#7a5fb3", radius: 9, strokeColor: "#ffffff", strokeWidth: 1 }),
            new atlas.layer.SymbolLayer(sources.pm25, "pm25-label", {
              iconOptions: { image: "none" },
              textOptions: { textField: ["to-string", ["round", ["get", "value"]]], color: "#ffffff", size: 11, allowOverlap: true },
            }),
          ],
          sightings: [new atlas.layer.BubbleLayer(sources.sightings, "sightings", { color: css("--moss"), radius: 6, strokeColor: "#ffffff", strokeWidth: 1.5 })],
        };
        for (const id of ["fires", "hotspots", "pm25", "aqhi", "sightings"] as LayerId[]) {
          for (const layer of layerRefs.current[id]!) {
            map.layers.add(layer);
            map.events.add("click", layer, (e: Atlas.MapMouseEvent) => {
              const shape = e.shapes?.[0];
              const props = shape && ("getProperties" in shape ? (shape as Atlas.Shape).getProperties() : (shape as Atlas.data.Feature<Atlas.data.Geometry, Record<string, unknown>>).properties);
              if (props) setSelected({ ...(props as Selected), position: e.position });
            });
          }
        }

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
        <span className={styles.chipDisabled} title="Sylvia Node sensors are on the roadmap">Sylvia Nodes · coming soon</span>
      </div>
      <div ref={el} className={styles.map} role="region" aria-label="Map of fires, smoke and air quality" />
      {status && <p className={styles.status} aria-live="polite">{status}</p>}
      {selected && <DetailCard item={selected} onClose={() => setSelected(undefined)} />}
    </div>
  );
}
