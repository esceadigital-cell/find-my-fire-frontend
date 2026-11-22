import {
    ClimateZone,
    HeatingAnswers,
    Operator,
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
    /** how much of the room the fire is to heat, 0–100 %. At 0 the fire is only for looks */
    heatShare: number;
};

// A fire up to this many kW below the heat need is "close": it goes in its own list instead of being removed
const CLOSE_KW = 1.1;

export type Match = {
    product: Product;
    misses: string[]; // the preferences it doesn't match, e.g. ["Gas"]
    kwShort: number; // how many kW below the heat need it is (0 when it's enough)
};

export type FilterResult = {
    kwNeeded: number | null; // rounded up to one decimal: shown to the user and used for filtering
    best: Match[]; // every answer met, and enough heat
    close: Match[]; // every answer met, but up to 1.1 kW short of the heat need
    more: Match[]; // a preference missed (enough heat, or up to 1.1 kW short)
};

export function filterFires(input: FilterInput): FilterResult {
    // Without a country, a room size and a climate zone, there's nothing to calculate yet
    if (
        !input.country ||
        !input.climateZone ||
        (input.heatShare > 0 && !input.m2ToHeat)
    ) {
        return {
            kwNeeded: null,
            best: [],
            close: [],
            more: [],
        };
    }

    //Heat
    const m2ToHeat = input.m2ToHeat ?? 0;
    const heatingAnswers = input.heatingAnswers;
    const climateZone = input.climateZone;

    let modifiers = 0;
    for (const answer of Object.values(heatingAnswers)) {
        modifiers += answer.modifier;
    }

    const m2PerKw = Math.max(1, climateZone.baseM2PerKw + modifiers); // Never below 1 m² per kW, so lots of negative answers can't make it zero or negative

    // The room's need, times the share the fire is to cover. At 0 % that's 0, so every fire passes the heat check
    const kwNeeded = (m2ToHeat / m2PerKw) * (input.heatShare / 100);
    // Up to one decimal. The tiny tolerance stops rounding errors (0.30000000000000004) from rounding up to 0.4
    const kwNeededRoundedUp = Math.ceil(kwNeeded * 10 - 1e-9) / 10;

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
            answer.chosen.length > 0 && // something is chosen
            answer.chosen.every(
                (c) => c.filterValue !== null && c.filterValue !== "",
            ), // e.g. "No preference" has no value
    );

    const requirements = activeAnswers.filter((answer) => !answer.isPreference); // don't match: removed completely
    const preferences = activeAnswers.filter((answer) => answer.isPreference); // don't match: moved down to "Might also like" list

    const best: Match[] = [];
    const more: Match[] = [];
    const close: Match[] = [];

    // The lowest output still shown: the need minus 1.1 kW (no lower limit when the fire is just for looks)
    const lowestKw =
        kwNeededRoundedUp > 0
            ? Math.round((kwNeededRoundedUp - CLOSE_KW) * 10) / 10
            : 0;

    //Looping through every product
    for (const product of input.products) {
        //country
        if (!product.markets.some((market) => market.code === input.country))
            continue;

        //heat
        if ((product.maxOutputKw ?? 0) < lowestKw) continue;

        //Rule profile (only wood fires have rules)
        if (product.fuelType === "wood") {
            if (woodBlocked) continue; // this area only allows a wood fire that replaces an existing one
            if (ruleProfile && !meetsRule(product, ruleProfile)) continue;
        }

        //requirements questions
        let missesARequirement = false;
        for (const answer of requirements) {
            if (!matches(product, answer)) {
                missesARequirement = true;
                break; // no need to check the rest
            }
        }
        if (missesARequirement) continue;

        //preferences questions
        const misses = preferences
            .filter((answer) => !matches(product, answer))
            .map((answer) => answer.chosen.map((c) => c.label).join(" or ")); // e.g. "Gas or Electric"

        // How far below the need the fire is (0 when it's enough)
        const kwShort = Math.max(
            0,
            Math.round((kwNeededRoundedUp - (product.maxOutputKw ?? 0)) * 10) /
                10,
        );
        const match = { product, misses, kwShort };

        if (misses.length > 0)
            more.push(match); // a preference missed: "You might love these too", short or not
        else if (kwShort > 0)
            close.push(match); // every answer met, but a little short on heat
        else best.push(match); // everything met
    }

    // Best: the smallest fire that's big enough first, since it's closest to the need
    best.sort(
        (a, b) => (a.product.maxOutputKw ?? 0) - (b.product.maxOutputKw ?? 0),
    );

    // Close: the one closest to the need first
    close.sort((a, b) => a.kwShort - b.kwShort);

    // More: fewest misses first, then the ones with enough heat, then the smallest fire
    more.sort(
        (a, b) =>
            a.misses.length - b.misses.length ||
            a.kwShort - b.kwShort ||
            (a.product.maxOutputKw ?? 0) - (b.product.maxOutputKw ?? 0),
    );

    return {
        kwNeeded: kwNeededRoundedUp,
        best,
        close,
        more,
    };
}

// For relations (lists of objects), which text field to compare with the answer
const RELATION_FIELDS: Record<string, string> = {
    bases: "baseType",
    brands: "brandName",
};

/** Does a product match an answer? With several chosen options, matching any one of them is enough. */
function matches(product: Product, answer: PropertyAnswer) {
    const property = answer.productProperty ?? "";
    return answer.chosen.some((c) =>
        matchesOption(product, property, c.compareMethod, c.filterValue),
    );
}

/** Does a product match one chosen option? */
function matchesOption(
    product: Product,
    property: string,
    compareMethod: Operator | null,
    value: string | number | null,
) {
    // The product's value for the property, e.g. product["fuelType"] → "wood"
    const productValue = (product as Record<string, unknown>)[property];

    // A relation, e.g. configurations: [{ configurationType: "Corner" }, { configurationType: "Single sided" }]
    // "equals" means the product has it, "not equals" means it doesn't
    if (Array.isArray(productValue)) {
        const field = RELATION_FIELDS[property];
        const hasIt = productValue.some(
            (item) => String(item[field]) === String(value),
        );
        return compareMethod === "not equals" ? !hasIt : hasIt;
    }

    switch (compareMethod) {
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
