import {
    findAddress,
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
    let postcode = params.get("postcode")?.trim() ?? "";
    const address = params.get("address")?.trim() ?? "";
    const pinLat = params.get("lat");
    const pinLng = params.get("lng");

    if (country !== "NZ" && country !== "AU") {
        return Response.json(
            { error: "Choose New Zealand or Australia" },
            { status: 400 },
        );
    }

    const countryName = country === "NZ" ? "New Zealand" : "Australia";

    // 2. The address, if there is one: its exact point, and its postcode (unless one was typed)
    let point: { lat: number; lng: number } | null = null;
    let foundAddress: string | null = null;

    if (pinLat && pinLng) {
        // the user dragged the pin: that's the exact point
        point = { lat: Number(pinLat), lng: Number(pinLng) };
    } else if (address) {
        const hit = await findAddress(address, country);
        if (!hit) {
            return Response.json(
                {
                    error: `We couldn’t find that address in ${countryName}. Check it, or type your postcode below.`,
                },
                { status: 404 },
            );
        }
        point = { lat: hit.lat, lng: hit.lng };
        foundAddress = hit.address;
        if (!postcode) postcode = hit.postcode ?? "";
        if (!postcode) {
            return Response.json(
                {
                    error: "We found the address, but not its postcode. Please type it below.",
                    needsPostcode: true,
                },
                { status: 422 },
            );
        }
    }

    if (!postcode) {
        return Response.json({ error: "Enter a postcode" }, { status: 400 });
    }

    // 3. Fetch what's needed from Strapi (at the same time)
    const [found, airSheds, anchors, zones] = await Promise.all([
        getPostcode(postcode, country),
        getAirSheds(),
        getClimateAnchors(),
        getClimateZones(),
    ]);
    if (!found) {
        return Response.json(
            {
                error: `We can’t find ${postcode} in ${countryName}. Check the number.`,
            },
            { status: 404 },
        );
    }

    // 4. The point to check: the address (or the dragged pin), otherwise the postcode's centre
    const lat = point?.lat ?? found.lat;
    const lng = point?.lng ?? found.lng;
    const precise = point !== null;

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
        address: foundAddress,
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
