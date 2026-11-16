"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Results.module.scss";
import { FilterResult, Match } from "@/lib/filterFires";
import { Brand, LocationData, Product, ProductLink } from "@/types";
import { LINKS } from "@/lib/links";
import ProductSlider from "../productSlider/ProductSlider";
import NeedsSummary from "../needsSummary/NeedsSummary";
import Skeleton from "../skeleton/Skeleton";
import NextSteps from "../nextSteps/NextSteps";
import CompareBar from "../compareBar/CompareBar";
import CompareDialog from "../compareDialog/CompareDialog";
import RuleDialog from "../ruleDialog/RuleDialog";
import ProductLinksDialog from "../productLinksDialog/ProductLinksDialog";

interface ResultsProps {
    result: FilterResult;
    location: LocationData | null;
    m2ToHeat: number | null;
    /** show the fires (from the first preference step on, once there's a heat need) */
    showFires: boolean;
    /** the step where the fires start showing, for the text before then */
    firesAt: { step: number; title: string };
    /** the brand on a brand's own page; its links are used, and "Find a retailer" goes to its site */
    brand?: Brand;
    /** called before a fire opens or is ticked; returns true if it showed the hint instead */
    onBeforeOpen: () => boolean;
}

const MAX_COMPARE = 3;
const EASE = "cubic-bezier(.2,.8,.2,1)";

const isPhone = () => window.matchMedia("(max-width: 699px)").matches;
const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Everything on the right: what the home needs, the fires, next steps, compare and the pop-ups.
 * It only shows what filterFires has worked out; it doesn't change any answers.
 *
 * The first time the fires show, they "arrive":
 *   loading (1.3 s): the intro and the needs strip shrink, placeholders shimmer
 *   reveal  (1.7 s): the fires fade and rise in one by one
 *   done:            no more animation, also when the answers change later
 */
export default function Results(props: ResultsProps) {
    console.log("Result: ", props.result);

    const root = useRef<HTMLElement>(null);
    const ready = props.showFires;

    const [phase, setPhase] = useState<"idle" | "loading" | "reveal" | "done">(
        "idle",
    );
    const [needsCompact, setNeedsCompact] = useState(false);
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [compareMessage, setCompareMessage] = useState("");
    const [compareOpen, setCompareOpen] = useState(false);
    const [ruleOpen, setRuleOpen] = useState(false);
    const [linksFor, setLinksFor] = useState<{
        product: Product;
        links: ProductLink[];
    } | null>(null);

    // ---------- The first load ----------

    useEffect(() => {
        if (!ready) {
            setPhase("idle");
            return;
        }
        if (phase !== "idle") return;

        setPhase("loading");
        if (!isPhone()) {
            requestAnimationFrame(() => {
                shrinkIntro();
                setNeedsCompact(true);
            });
        }
        const toReveal = window.setTimeout(() => setPhase("reveal"), 1300);
        const toDone = window.setTimeout(() => setPhase("done"), 1300 + 1700);
        return () => {
            window.clearTimeout(toReveal);
            window.clearTimeout(toDone);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // Shrinks the intro into the top of the filter column (body.compact), once.
    // The filter box moves down by the intro's new height, and the results slide up into place.
    function shrinkIntro() {
        const el = root.current;
        if (!el || document.body.classList.contains("compact") || isPhone())
            return;
        const before = el.getBoundingClientRect().top;
        document.body.classList.add("compact");
        const after = el.getBoundingClientRect().top;
        if (!reducedMotion() && before !== after) {
            el.animate(
                [
                    { transform: `translateY(${before - after}px)` },
                    { transform: "none" },
                ],
                {
                    duration: 650,
                    easing: EASE,
                },
            );
        }
    }

    // The intro's height, so the filter box can sit right under the shrunk intro.
    // Measured whenever its size changes, also while it's shrinking and when the window is resized.
    useEffect(() => {
        const intro = document.querySelector<HTMLElement>("[data-intro]");
        if (!intro) return;
        const update = () =>
            document.documentElement.style.setProperty(
                "--intro-h",
                `${intro.offsetHeight}px`,
            );
        const observer = new ResizeObserver(update);
        observer.observe(intro);
        return () => observer.disconnect();
    }, []);

    // ---------- Compare ----------

    const all = [...props.result.best, ...props.result.more];
    const compared = compareIds
        .map((id) => all.find((m) => m.product.documentId === id))
        .filter((m): m is Match => !!m);

    function toggleCompare(id: string, checked: boolean) {
        props.onBeforeOpen(); // may show the hint, but the tick still counts
        if (!checked) {
            setCompareIds(compareIds.filter((x) => x !== id));
            setCompareMessage("");
        } else if (compareIds.length >= MAX_COMPARE) {
            setCompareMessage(
                `You can compare up to ${MAX_COMPARE} fires. Remove one to add another.`,
            );
        } else {
            setCompareIds([...compareIds, id]);
            setCompareMessage("");
        }
    }

    function removeCompare(id: string) {
        const next = compareIds.filter((x) => x !== id);
        setCompareIds(next);
        setCompareMessage("");
        if (next.length < 2) setCompareOpen(false);
    }

    function clearCompare() {
        setCompareIds([]);
        setCompareMessage("");
        setCompareOpen(false);
    }

    // Room for the compare bar at the bottom of the page
    useEffect(() => {
        document.body.classList.toggle("has-cmp", compared.length > 0);
    }, [compared.length]);

    // ---------- Clicking a fire ----------
    // Which links: on a brand's page (e.g. /stoke) that brand's, otherwise the fire's own brand's.
    // One link opens straight away; several (configurations or versions) open the pop-up.

    function openProduct(product: Product) {
        if (props.onBeforeOpen()) return; // the hint took this click

        const links = product.productLinks ?? [];
        const own = product.manufacturer?.slug;
        let options = links.filter(
            (l) => l.brand?.slug === (props.brand?.slug ?? own),
        );
        // This brand has no page for the fire yet: use the fire's own brand
        if (!options.length)
            options = links.filter((l) => l.brand?.slug === own);
        // No manufacturer set: use whatever links there are
        if (!options.length) options = links;

        if (options.length === 1)
            window.open(options[0].url, "_blank", "noopener");
        else if (options.length > 1) setLinksFor({ product, links: options });
    }

    // ---------- What to show ----------

    const loading = phase === "loading";
    const rootClass = [styles.results, phase === "reveal" && "reveal"]
        .filter(Boolean)
        .join(" ");

    let content: React.ReactNode;
    if (!ready) {
        content = (
            <div className={styles.gate}>
                <h2>Your fires will appear here</h2>
                <p>
                    {props.result.kwNeeded === null
                        ? "Add your location and the room’s size (steps 1 and 2). Then we can work out the heat you need."
                        : `Answer the questions on the left. Your fires appear at step ${props.firesAt.step}, ${props.firesAt.title}.`}
                </p>
            </div>
        );
    } else if (loading) {
        content = <Skeleton />;
    } else {
        content = (
            <>
                <ProductSlider
                    matches={props.result.best}
                    kwNeeded={props.result.kwNeeded}
                    title="Best for your home"
                    onOpenProduct={openProduct}
                    compareIds={compareIds}
                    onToggleCompare={toggleCompare}
                    emptyText="No fire meets every requirement yet. Try a different answer in one of the steps."
                />
                {props.result.more.length > 0 && (
                    <ProductSlider
                        matches={props.result.more}
                        title="You might love these too"
                        variant="more"
                        onOpenProduct={openProduct}
                        compareIds={compareIds}
                        onToggleCompare={toggleCompare}
                    />
                )}
                <NextSteps
                    postcode={props.location?.postcode ?? null}
                    retailerUrl={props.brand?.url}
                    retailerName={props.brand?.brandName}
                    shortlist={
                        props.result.best.length
                            ? props.result.best
                            : props.result.more
                    }
                />
            </>
        );
    }

    return (
        <>
            <section
                ref={root}
                className={rootClass}
                aria-label="Recommended fires"
                aria-live="polite"
            >
                <NeedsSummary
                    result={props.result}
                    location={props.location}
                    m2ToHeat={props.m2ToHeat}
                    showFunnel={ready && !loading}
                    compact={needsCompact}
                    onToggleCompact={() => setNeedsCompact(!needsCompact)}
                    onOpenRule={() => setRuleOpen(true)}
                />

                {content}

                <footer className={styles.footer}>
                    <span>© {new Date().getFullYear()} Escea</span>
                    <a href={LINKS.privacy}>Privacy Policy</a>
                </footer>
            </section>

            {compared.length > 0 && (
                <CompareBar
                    compared={compared}
                    message={compareMessage}
                    onRemove={removeCompare}
                    onClear={clearCompare}
                    onOpen={() => setCompareOpen(true)}
                />
            )}
            {compareOpen && compared.length >= 2 && (
                <CompareDialog
                    compared={compared}
                    result={props.result}
                    m2ToHeat={props.m2ToHeat}
                    ruleProfile={props.location?.ruleProfile ?? null}
                    onRemove={removeCompare}
                    onClose={() => setCompareOpen(false)}
                />
            )}
            {ruleOpen && props.location && (
                <RuleDialog
                    location={props.location}
                    onClose={() => setRuleOpen(false)}
                />
            )}
            {linksFor && (
                <ProductLinksDialog
                    product={linksFor.product}
                    links={linksFor.links}
                    onClose={() => setLinksFor(null)}
                />
            )}
        </>
    );
}
