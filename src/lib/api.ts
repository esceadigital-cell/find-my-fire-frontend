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

export async function getProducts() {
  return strapi(
    `products?filters[active][$eq]=true&populate[markets][fields][0]=code&pagination[pageSize]=200`,
  );
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

//Question categories
export async function getQuestionCategories() {
  return strapi(
    `question-categories?sort=order:asc&pagination[pageSize]=100` +
      // Heating questions, sorted, with their options and follow-ups
      `&populate[heatingQuestions][sort][0]=order:asc` +
      `&populate[heatingQuestions][populate][options]=true` +
      `&populate[heatingQuestions][populate][followUps][populate][options]=true` +
      // Property questions, the same
      `&populate[propertyQuestions][sort][0]=order:asc` +
      `&populate[propertyQuestions][populate][options]=true` +
      `&populate[propertyQuestions][populate][followUps][populate][options]=true`,
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

export async function findStreet(
  street: string,
  postcode: string,
  country: string,
) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1` +
    `&street=${encodeURIComponent(street)}&postalcode=${encodeURIComponent(postcode)}` +
    `&countrycodes=${country.toLowerCase()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "FindMyFire/0.1 (Escea fire finder)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Street lookup failed (${res.status})`);

  const [hit] = await res.json();
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    address: hit.display_name as string,
  };
}
