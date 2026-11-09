import {
    findStreet,
    getAirSheds,
    getClimateAnchors,
    getClimateZones,
    getPostcode,
} from "@/lib/api";
import {
    findAirShed,
    nearbyAirSheds,
    nearestAnchor,
    zoneForTemperature,
} from "@/lib/location";

export async function GET(request: Request) {
    // 1. Read what the browser sent
    const params = new URL(request.url).searchParams;
    const country = params.get("country");
    const postcode = params.get("postcode");
    const street = params.get("street")?.trim() ?? "";
    const pinLat = params.get("lat");
    const pinLng = params.get("lng");

    if (country !== "NZ" && country !== "AU") {
        return Response.json(
            { error: "Choose New Zealand or Australia" },
            { status: 400 },
        );
    }
    if (!postcode) {
        return Response.json({ error: "Enter a postcode" }, { status: 400 });
    }

    // 2. Fetch what's needed from Strapi (at the same time)
    const [found, airSheds, anchors, zones] = await Promise.all([
        getPostcode(postcode, country),
        getAirSheds(),
        getClimateAnchors(),
        getClimateZones(),
    ]);
    if (!found) {
        return Response.json({ error: "Unknown postcode" }, { status: 404 });
    }

    // 3. The point to check: the street if it's found, otherwise the postcode's centre
    let lat = found.lat;
    let lng = found.lng;
    let precise = false;

    if (pinLat && pinLng) {
        // the user dragged the pin: that's the exact point
        lat = Number(pinLat);
        lng = Number(pinLng);
        precise = true;
    } else if (street) {
        const hit = await findStreet(street, postcode, country);
        if (hit) {
            lat = hit.lat;
            lng = hit.lng;
            precise = true;
        }
    }

    // 4. The climate zone, from the postcode
    const anchor = nearestAnchor(found.lat, found.lng, anchors); //AI
    const climateZone = anchor
        ? zoneForTemperature(anchor.julyMinC, zones)
        : null; //AI

    // 5. The rule: the air shed's if the point is in one, otherwise the region's
    const airShed = findAirShed(lat, lng, airSheds); //AI
    const ruleProfile =
        airShed?.rule_profile ?? found.region?.rule_profile ?? null;

    // 6. Send back only what the browser needs
    return Response.json({
        country,
        postcode,
        lat,
        lng,
        precise,
        region: found.region?.name ?? null,
        airShed: airShed?.name ?? null,
        climateZone,
        ruleProfile,
        nearby: nearbyAirSheds(lat, lng, airSheds).map((a) => ({
            name: a.name,
            geometry: a.geometry!,
        })),
    });
}
