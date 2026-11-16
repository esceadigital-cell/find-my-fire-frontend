// How products are shown: names for fuels and install types, and the card colour.
import { Product } from "@/types";

export const FUEL_NAMES = { gas: "Gas", wood: "Wood", electric: "Electric" };

export const INSTALL_TYPES = {
    freestanding: "Freestanding",
    inbuilt: "Inbuilt",
    insert: "Insert",
};

// The colour behind a card until there are product photos. A fire always gets the same one.
const TONES = {
    gas: ["#DDD5CE", "#C7C5BE", "#B6ABA0"],
    wood: ["#77685D", "#5E5347"],
    electric: ["#4E594D", "#5E5347"],
};

export function toneFor(product: Product) {
    const tones = TONES[product.fuelType];
    let hash = 0;
    for (const char of product.documentId)
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return tones[hash % tones.length];
}

/** Millimetres as metres with one decimal, e.g. 1695 → "1.7 m" */
export function metres(mm: number | null) {
    return mm == null ? "–" : `${Math.round(mm / 100) / 10} m`;
}

/** Cards per row: 3 on desktop (4 from 1440px, 5 from 1920px), 2 on tablet, 1 on phones */
export function cardsPerRow() {
    const w = window.innerWidth;
    if (w >= 1920) return 5;
    if (w >= 1440) return 4;
    if (w >= 1100) return 3;
    if (w >= 700) return 2;
    return 1;
}
