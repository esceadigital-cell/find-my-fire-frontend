export type Geometry = {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
};

export type RuleProfile = {
    name: string;
    maxGkg: number | null;
    minEffPct: number | null;
    requireUleb: boolean | null;
    wetbackMaxGkg: number | null;
    installation: "ok" | "replacement only" | "no new build" | null;
    propertySize: "all" | "under 2ha" | "over 2ha" | null;
    note: string | null;
    legalText: string | null;
    sourceUrl: string | null;
};

export type LocationData = {
    country: "NZ" | "AU";
    postcode: string;
    lat: number;
    lng: number;
    precise: boolean;
    address: string | null;
    region: string | null;
    airShed: string | null;
    climateZone: ClimateZone | null;
    ruleProfile: RuleProfile | null;
    nearby: { name: string; geometry: Geometry }[];
};

export type Region = {
    name: string;
    rule_profile: RuleProfile | null;
};

export type AirShed = {
    name: string;
    geometry: Geometry | null;
    rule_profile: RuleProfile | null;
};

export type Postcode = {
    code: string;
    country: MarketCode;
    place: string | null;
    lat: number;
    lng: number;
    region: { name: string; rule_profile: RuleProfile | null } | null;
};

export type MarketCode = "NZ" | "AU";

/** One chosen option of a property answer */
export type ChosenOption = {
    optionId: number | null; // the chosen button (null for a number question)
    compareMethod: Operator | null;
    filterValue: string | number | null; // null = this answer doesn't filter, e.g. "No preference"
    label: string;
};

export type PropertyAnswer = {
    productProperty: string | null; // e.g. "fuelType"
    isHardFiltering: boolean; // true: a fire that doesn't match is removed. False: it moves down
    /** One entry per chosen option: several with allowMultipleAnswers, otherwise one (empty: not answered) */
    chosen: ChosenOption[];
};

export type PropertyAnswers = Record<string, PropertyAnswer>;

export type HeatingAnswer = {
    optionId: number; // which button was chosen
    modifier: number; // what it does to the heat need
};

export type HeatingAnswers = Record<string, HeatingAnswer>;

// ---------- Products ----------

export type ProductLink = {
    id: number;
    url: string;
    brand: Brand | null;
    configuration: Configuration | null; // empty: the link is for the product as a whole
    label: string | null;
};

export type Brand = {
    documentId: string;
    brandName: string;
    url: string;
    slug: string;
};
export type Configuration = { documentId: string; configurationType: string };
export type Base = { documentId: string; baseType: string | null };

export type Media = { url: string; alternativeText: string | null };

export type Product = {
    documentId: string;
    name: string;
    //productUrl: string | null;
    fuelType: "wood" | "gas" | "electric";
    installType: "freestanding" | "inbuilt" | "insert" | null;
    maxOutputKw: number | null;
    emissionsGkg: number | null;
    efficiencyPct: number | null;
    uleb: boolean | null;
    wetback: boolean | null;
    width: number | null;
    height: number | null;
    depth: number | null;
    markets: { code: MarketCode }[];
    image: Media | null;
    brands?: Brand[];
    manufacturer?: Brand | null; // the fire's own brand (Escea, Ambe, Maxen, MODE)
    //configurations?: Configuration[];
    bases?: Base[];
    isOutdoor: boolean | null;
    emissionFactorMgMj: number | null;
    star_rating: number | null;
    clean_air_approved: boolean | null;
    zero_clearance_rated: boolean | null;
    flue_type: "direct vent" | "powered direct vent" | "ventless" | null;
    remote_control: boolean | null;
    smartheat_wifi: boolean | null;
    external_fan: "Yes" | "No" | "Optional" | null;
    productLinks?: ProductLink[];
};

// ---------- Shared ----------

export type Operator =
    | "equals"
    | "not equals"
    | "less or equal"
    | "greater or equal";

// ---------- Heating questions: each answer changes the heat need ----------

export type HeatingOption = {
    id: number;
    label: string;
    modifier: number;
    key: string | null; // only needed if a follow-up depends on this answer
};

export type HeatingQuestion = {
    documentId: string;
    text: string;
    order: number | null;
    options: HeatingOption[];
    showIfKey: string | null; // a follow-up only shows when the chosen answer has this key
    dependsOn?: { documentId: string } | null; // the question this one is a follow-up to
    followUps?: HeatingQuestion[]; // the questions that are follow-ups to this one
    isDependingOnHeatDemand: boolean | null; // asked in step 2, and only when the fire is to heat the room
    extraDescription: string | null; // shown next to the question's label
};

// ---------- Property questions: each answer is compared with a property of the fire ----------

export type PropertyOption = {
    id: number;
    label: string;
    filterValue: string | null; // empty = this answer doesn't filter
    filterOperator: Operator | null;
    key: string | null;
};

export type PropertyQuestion = {
    documentId: string;
    text: string;
    order: number | null;
    productField: string | null; // the property on Product, e.g. "fuelType"
    inputOption: "options" | "number" | null; // buttons, or a number field
    operator: Operator | null; // only for number questions
    unit: string | null; // only for number questions, e.g. "mm"
    options: PropertyOption[];
    showIfKey: string | null;
    dependsOn?: { documentId: string } | null;
    followUps?: PropertyQuestion[];
    allowMultipleAnswers: boolean | null; // several options can be chosen
    isHardFiltering: boolean | null; // on: fires that don't match are removed. Off: they move to "You might love these too"
    extraDescription: string | null; // shown next to the question's label
};

// ---------- Categories: one step each ----------

export type QuestionCategory = {
    documentId: string;
    name: string;
    order: number | null;
    isOptionalCategory: boolean | null; // the user can move on without answering every question
    heatingQuestions: HeatingQuestion[];
    propertyQuestions: PropertyQuestion[];
};

// GeoJSON stores points as [longitude, latitude]
export type Point = [number, number];

// ---------- Climate ----------

export type ClimateZone = {
    documentId: string;
    name: string;
    baseM2PerKw: number;
    minJulyTempC: number | null;
    order: number | null;
};

export type ClimateAnchor = {
    name: string;
    lat: number;
    lng: number;
    julyMinC: number;
};
