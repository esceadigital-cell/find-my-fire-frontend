"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import styles from "./LocationMap.module.scss";
import type { Geometry } from "@/types";

// The map background. OpenStreetMap is fine while developing; use LINZ Basemaps in production.
const TILES_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILES_CREDIT = "© OpenStreetMap contributors";

interface LocationMapProps {
    lat: number;
    lng: number;
    /** air sheds to draw as dashed outlines */
    zones: { name: string; geometry: Geometry }[];
    caption: string;
    /** called with the pin's new position when the user drags it */
    onMove: (lat: number, lng: number) => void;
}

/** A map with the address as a pin you can drag, and nearby air sheds as dashed outlines. */
export default function LocationMap(props: LocationMapProps) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<LeafletMap | null>(null);
    const marker = useRef<Marker | null>(null);
    const outlines = useRef<LayerGroup | null>(null);

    // The latest onMove, so the drag handler (set up once) always calls the current one
    const onMove = useRef(props.onMove);
    onMove.current = props.onMove;

    // Create the map once. Leaflet needs the browser, so it's loaded here and not at the top.
    useEffect(() => {
        let cancelled = false;

        import("leaflet").then((L) => {
            if (cancelled || !container.current || map.current) return;

            map.current = L.map(container.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false })
                .setView([props.lat, props.lng], 13);
            L.tileLayer(TILES_URL, { maxZoom: 19 }).addTo(map.current);
            outlines.current = L.layerGroup().addTo(map.current);

            const pin = L.divIcon({ className: styles.pin, iconSize: [22, 22] });
            marker.current = L.marker([props.lat, props.lng], { icon: pin, draggable: true }).addTo(map.current);
            marker.current.on("dragend", () => {
                const position = marker.current!.getLatLng();
                onMove.current(position.lat, position.lng);
            });

            drawZones(L);
        });

        return () => {
            cancelled = true;
            map.current?.remove();
            map.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When the position or the zones change: move the pin and redraw the zones
    useEffect(() => {
        if (!map.current || !marker.current) return;
        marker.current.setLatLng([props.lat, props.lng]);
        map.current.setView([props.lat, props.lng], map.current.getZoom());
        import("leaflet").then(drawZones);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.lat, props.lng, props.zones]);

    function drawZones(L: typeof import("leaflet")) {
        if (!outlines.current) return;
        outlines.current.clearLayers();
        for (const zone of props.zones) {
            L.geoJSON(zone.geometry as GeoJSON.Geometry, {
                style: { color: "#F0541E", weight: 2, dashArray: "6 5", fillColor: "#F0541E", fillOpacity: 0.06 },
            })
                .bindTooltip(zone.name)
                .addTo(outlines.current);
        }
    }

    return (
        <figure className={styles.map}>
            <div ref={container} className={styles.canvas} role="img" aria-label={props.caption} />
            <figcaption className={styles.caption}>
                <span>{props.caption}</span>
                <span className={styles.credit}>{TILES_CREDIT}</span>
            </figcaption>
        </figure>
    );
}
