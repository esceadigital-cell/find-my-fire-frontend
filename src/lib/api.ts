import { Brand, HeatingQuestion, Product } from "@/types";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

async function strapi(path: string) {
    const res = await fetch(`${STRAPI_URL}/api/${path}`, {
        headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
        cache: "no-store",
    });
    if (!res.ok)
        throw new Error(`Strapi responded ${res.status} to /api/${path}`);
    const json = await res.json();
    return json.data;
}

// ---------- Products ----------

export async function getProducts(brand?: string): Promise<Product[]> {
    const brandFilter = brand ? `&filters[brands][slug][$eq]=${brand}` : "";

    const products: Product[] = await strapi(
        `products?filters[active][$eq]=true${brandFilter}` +
            `&populate[image][fields][0]=url&populate[image][fields][1]=alternativeText` +
            `&populate[markets][fields][0]=code` +
            `&populate[brands][fields][0]=slug&populate[brands][fields][1]=brandName` +
            `&populate[manufacturer][fields][0]=slug&populate[manufacturer][fields][1]=brandName` +
            `&populate[bases][fields][0]=baseType` +
            `&populate[productLinks][populate][brand][fields][0]=slug` +
            `&populate[productLinks][populate][configuration][fields][0]=configurationType` +
            `&pagination[pageSize]=200`,
    );

    // A local Strapi gives image addresses like "/uploads/tfs650.avif", without the server in front.
    // The browser needs the full address, so put STRAPI_URL in front (Strapi Cloud already gives full ones).
    return products.map((p) =>
        p.image?.url.startsWith("/")
            ? {
                  ...p,
                  image: { ...p.image, url: `${STRAPI_URL}${p.image.url}` },
              }
            : p,
    );
}

// ---------- Brands ----------

// All brands, for the brand pages (/escea, /stoke ...)
export async function getBrands(): Promise<Brand[]> {
    return strapi(`brands?pagination[pageSize]=100`);
}

// ---------- Questions ----------

// Heating questions
export async function getHeatingQuestions() {
    return strapi(
        `heating-questions?sort=order:asc&populate[options]=true&populate[dependsOn][fields][0]=documentId&populate[category][fields][0]=documentId&pagination[pageSize]=100`,
    );
}

// Property questions
export async function getPropertyQuestions() {
    return strapi(
        `lifestyle-questions?sort=order:asc&populate[options]=true&populate[dependsOn][fields][0]=documentId&populate[category][fields][0]=documentId&pagination[pageSize]=100`,
    );
}

// Asked in step 2, and only when the fire is to heat the room. They have no category,
// so they're fetched on their own. Follow-ups come along through followUps.
export async function getHeatDemandQuestions(): Promise<HeatingQuestion[]> {
    return strapi(
        `heating-questions?filters[isDependingOnHeatDemand][$eq]=true` +
            `&filters[dependsOn][documentId][$null]=true` +
            `&sort=order:asc&pagination[pageSize]=100` +
            `&populate[options]=true` +
            `&populate[followUps][populate][options]=true`,
    );
}

//Question categories
export async function getQuestionCategories() {
    return strapi(
        `question-categories?sort=order:asc&pagination[pageSize]=100` +
            // Heating questions, sorted, with their options and follow-ups
            `&populate[heatingQuestions][sort][0]=order:asc` +
            `&populate[heatingQuestions][populate][options]=true` +
            `&populate[heatingQuestions][populate][followUps][populate][options]=true` +
            // Property questions, the same, plus the follow-ups' own follow-ups (e.g. piped gas → LPG)
            `&populate[propertyQuestions][sort][0]=order:asc` +
            `&populate[propertyQuestions][populate][options]=true` +
            `&populate[propertyQuestions][populate][followUps][populate][options]=true` +
            `&populate[propertyQuestions][populate][followUps][populate][followUps][populate][options]=true` +
            // Which countries each property question applies to (empty: all), at every level
            `&populate[propertyQuestions][populate][markets][fields][0]=code` +
            `&populate[propertyQuestions][populate][followUps][populate][markets][fields][0]=code` +
            `&populate[propertyQuestions][populate][followUps][populate][followUps][populate][markets][fields][0]=code`,
    );
}

// ---------- Climate ----------

export async function getClimateZones() {
    return strapi(`climate-zones?sort=order:asc`);
}

export async function getClimateAnchors() {
    return strapi(`climate-anchors?pagination[pageSize]=200`);
}

// ---------- Location & Regulations ----------

export async function getPostcode(code: string, country: string) {
    const rows = await strapi(
        `postcodes?filters[code][$eq]=${encodeURIComponent(code)}&filters[country][$eq]=${country}` +
            `&populate[region][populate][rule_profile]=true`,
    );
    return rows[0] ?? null;
}

export async function getAirSheds() {
    return strapi(
        `air-sheds?populate[rule_profile]=true&pagination[pageSize]=200`,
    );
}

// ---------- Street lookup (OpenStreetMap Nominatim) ----------

// Looks up a whole address (street and town) in one country, and returns the point and its postcode.
export async function findAddress(address: string, country: string) {
    const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1` +
        `&q=${encodeURIComponent(address)}` +
        `&countrycodes=${country.toLowerCase()}`; // only search the chosen country

    const res = await fetch(url, {
        headers: { "User-Agent": "FindMyFire/0.1 (Escea fire finder)" },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);

    const [hit] = await res.json();
    if (!hit) return null;
    return {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        postcode: (hit.address?.postcode as string | undefined)?.trim() ?? null,
        address: hit.display_name as string,
    };
}
