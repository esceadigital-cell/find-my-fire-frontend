// AI helped with these functions

import { AirShed, ClimateAnchor, ClimateZone, Geometry, Point } from "@/types";

// ---------------------------------------------------------------------
// Air sheds
// ---------------------------------------------------------------------

// Draws an imaginary line from the point to the right and counts how often it
// crosses the edge. An odd number of crossings means the point is inside.
function pointInRing(point: Point, ring: number[][]) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const crosses =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
    }
    return inside;
}

// A polygon is an outer edge, plus any holes cut out of it
function pointInPolygon(point: Point, rings: number[][][]) {
    const [outerEdge, ...holes] = rings;
    if (!pointInRing(point, outerEdge)) return false;
    for (const hole of holes) {
        if (pointInRing(point, hole)) return false;
    }
    return true;
}

// An air shed is either one polygon or several (a MultiPolygon)
function pointInGeometry(point: Point, geometry: Geometry) {
    if (geometry.type === "Polygon") {
        return pointInPolygon(point, geometry.coordinates as number[][][]);
    }
    const polygons = geometry.coordinates as number[][][][];
    return polygons.some((polygon) => pointInPolygon(point, polygon));
}

/** The air shed the point is in, or null. */
export function findAirShed(lat: number, lng: number, airSheds: AirShed[]) {
    for (const airShed of airSheds) {
        if (airShed.geometry && pointInGeometry([lng, lat], airShed.geometry))
            return airShed;
    }
    return null;
}

/** Air sheds with a corner within about 30 km of the point. Only used to draw them on the map. */
export function nearbyAirSheds(lat: number, lng: number, airSheds: AirShed[]) {
    // A corner counts as close if it's within 0.3° north-south and 0.4° east-west
    const isClose = ([x, y]: number[]) =>
        Math.abs(y - lat) < 0.3 && Math.abs(x - lng) < 0.4;

    return airSheds.filter((airShed) => {
        if (!airShed.geometry) return false;

        // Treat a single polygon as a list of one, so both kinds are handled the same way
        const polygons =
            airShed.geometry.type === "Polygon"
                ? [airShed.geometry.coordinates as number[][][]]
                : (airShed.geometry.coordinates as number[][][][]);

        // Look at the outer edge of each polygon (rings[0]): is any of its corners close?
        return polygons.some((rings) => rings[0].some(isClose));
    });
}

// ---------------------------------------------------------------------
// Climate zone
// ---------------------------------------------------------------------

/** The reference town closest to the point. */
export function nearestAnchor(
    lat: number,
    lng: number,
    anchors: ClimateAnchor[],
) {
    // Degrees of longitude get shorter further south, so they're scaled down
    // before measuring. Otherwise towns to the east or west would seem too far away.
    const scale = Math.cos((lat * Math.PI) / 180);

    let nearest: ClimateAnchor | null = null;
    let shortest = Infinity;
    for (const anchor of anchors) {
        const distance =
            (anchor.lat - lat) ** 2 + ((anchor.lng - lng) * scale) ** 2;
        if (distance < shortest) {
            shortest = distance;
            nearest = anchor;
        }
    }
    return nearest;
}

/**
 * The zone for a July temperature. Zones are checked from warmest to coldest,
 * and the first one whose lower limit the temperature reaches is the answer.
 * Uses >=, like Escea's spreadsheet: exactly 0 °C is Cold, not Extreme.
 */
export function zoneForTemperature(julyMinC: number, zones: ClimateZone[]) {
    const warmestFirst = [...zones].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const zone of warmestFirst) {
        // The coldest zone has no lower limit, so everything left ends up there
        if (zone.minJulyTempC == null || julyMinC >= zone.minJulyTempC)
            return zone;
    }
    return null;
}
