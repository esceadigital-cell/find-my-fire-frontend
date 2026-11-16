import {
    ClimateZone,
    HeatingAnswers,
    Product,
    PropertyAnswer,
    PropertyAnswers,
    RuleProfile,
} from "@/types";

type FilterInput = {
    products: Product[];
    country: "NZ" | "AU" | null;
    m2ToHeat: number | null;
    climateZone: ClimateZone | null;
    ruleProfile: RuleProfile | null;
    propertyOver2Hectares: boolean | null;
    replacingExistingWoodBurner: boolean | null;
    heatingAnswers: HeatingAnswers;
    propertyAnswers: PropertyAnswers;
};

export type Match = {
    product: Product;
    misses: string[]; // the preferences it doesn't match, e.g. ["Gas"]
};

export type FilterResult = {
    kwNeeded: number | null; // rounded up to one decimal: shown to the user and used for filtering
    counts: { range: number; heat: number; allowed: number; fits: number };
    best: Match[];
    more: Match[];
};

export function filterFires(input: FilterInput): FilterResult {
    const counts = {
        range: 0,
        heat: 0,
        allowed: 0,
        fits: 0,
    };

    // Without a country, a room size and a climate zone, there's nothing to calculate yet
    if (!input.country || !input.m2ToHeat || !input.climateZone) {
        return {
            kwNeeded: null,
            counts,
            best: [],
            more: [],
        };
    }

    //Heat
    const m2ToHeat = input.m2ToHeat;
    const heatingAnswers = input.heatingAnswers;
    const climateZone = input.climateZone;

    let modifiers = 0;
    for (const answer of Object.values(heatingAnswers)) {
        modifiers += answer.modifier;
    }

    const m2PerKw = Math.max(1, climateZone.baseM2PerKw + modifiers); // Never below 1 m² per kW, so lots of negative answers can't make it zero or negative

    const kwNeeded = m2ToHeat / m2PerKw;
    const kwNeededRoundedUp = Math.ceil(kwNeeded * 10) / 10; // up to one decimal

    //Rule profile
    let ruleProfile: RuleProfile | null = input.ruleProfile;

    if (
        ruleProfile &&
        ruleProfile.propertySize &&
        ruleProfile.propertySize !== "all"
    ) {
        const isOver2Hectares = input.propertyOver2Hectares === true;
        const ruleIsForOver2Hectares = ruleProfile.propertySize === "over 2ha";
        if (isOver2Hectares !== ruleIsForOver2Hectares) ruleProfile = null; // the rule does not apply for this property size
    }

    // Some areas only allow a wood fire that replaces an existing one
    const onlyReplacements =
        ruleProfile?.installation === "replacement only" ||
        ruleProfile?.installation === "no new build";
    const woodBlocked =
        onlyReplacements && input.replacingExistingWoodBurner !== true;

    // Property answers: leave out the ones that don't filter, then split them into requirements and preferences
    const activeAnswers = Object.values(input.propertyAnswers).filter(
        (answer) =>
            answer.productProperty && // linked to a property on the product
            answer.filterValue !== null && // e.g. "No preference" has no value
            answer.filterValue !== "", // an empty field from Strapi counts as no value too
    );

    const requirements = activeAnswers.filter((answer) => !answer.isPreference); // don't match: removed completely
    const preferences = activeAnswers.filter((answer) => answer.isPreference); // don't match: moved down to "Might also like" list

    const best: Match[] = [];
    const more: Match[] = [];

    //Looping through every product
    for (const product of input.products) {
        //country
        if (!product.markets.some((market) => market.code === input.country))
            continue;
        counts.range++;

        //heat
        if ((product.maxOutputKw ?? 0) < kwNeededRoundedUp) continue;
        counts.heat++;

        //Rule profile (only wood fires have rules)
        if (product.fuelType === "wood") {
            if (woodBlocked) continue; // this area only allows a wood fire that replaces an existing one
            if (ruleProfile && !meetsRule(product, ruleProfile)) continue;
        }
        counts.allowed++;

        //requirements questions
        let missesARequirement = false;
        for (const answer of requirements) {
            if (!matches(product, answer)) {
                missesARequirement = true;
                break; // no need to check the rest
            }
        }
        if (missesARequirement) continue;
        counts.fits++;

        //preferences questions
        const misses = preferences
            .filter((answer) => !matches(product, answer))
            .map((answer) => answer.label);

        if (misses.length === 0) best.push({ product, misses });
        else more.push({ product, misses });
    }

    // Best: the smallest fire that's big enough first, since it's closest to the need
    best.sort(
        (a, b) => (a.product.maxOutputKw ?? 0) - (b.product.maxOutputKw ?? 0),
    );

    // More: fewest misses first, then the smallest fire
    more.sort(
        (a, b) =>
            a.misses.length - b.misses.length ||
            (a.product.maxOutputKw ?? 0) - (b.product.maxOutputKw ?? 0),
    );

    return {
        kwNeeded: kwNeededRoundedUp,
        counts,
        best,
        more,
    };
}

// For relations (lists of objects), which text field to compare with the answer
const RELATION_FIELDS: Record<string, string> = {
    bases: "baseType",
    brands: "brandName",
};

/** Does a product match one property answer? */
function matches(product: Product, answer: PropertyAnswer) {
    const property = answer.productProperty ?? "";

    // The product's value for the property, e.g. product["fuelType"] → "wood"
    const productValue = (product as Record<string, unknown>)[property];
    const value = answer.filterValue;

    // A relation, e.g. configurations: [{ configurationType: "Corner" }, { configurationType: "Single sided" }]
    // "equals" means the product has it, "not equals" means it doesn't
    if (Array.isArray(productValue)) {
        const field = RELATION_FIELDS[property];
        const hasIt = productValue.some(
            (item) => String(item[field]) === String(value),
        );
        return answer.compareMethod === "not equals" ? !hasIt : hasIt;
    }

    switch (answer.compareMethod) {
        case "less or equal":
            return (
                productValue != null && Number(productValue) <= Number(value)
            );
        case "greater or equal":
            return (
                productValue != null && Number(productValue) >= Number(value)
            );
        case "not equals":
            return String(productValue) !== String(value);
        default: // "equals", or no operator
            return String(productValue) === String(value);
    }
}

/** Does a wood fire meet the rule? */
function meetsRule(product: Product, rule: RuleProfile) {
    // Efficiency too low?
    if (rule.minEffPct != null && (product.efficiencyPct ?? 0) < rule.minEffPct)
        return false;

    // The rule needs an ultra-low-emission burner, and this isn't one?
    if (rule.requireUleb && !product.uleb) return false;

    // Emissions too high? Inserts with a wetback can have a softer limit (Hastings)
    const softerLimit =
        rule.wetbackMaxGkg != null &&
        product.wetback &&
        product.installType === "insert";
    const maxGkg = softerLimit ? rule.wetbackMaxGkg : rule.maxGkg;
    if (
        maxGkg != null &&
        (product.emissionsGkg == null || product.emissionsGkg > maxGkg)
    )
        return false;

    return true;
}
