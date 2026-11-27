"use client";

import styles from "./FireFinder.module.scss";
import {
    Brand,
    HeatingAnswers,
    HeatingQuestion,
    LocationData,
    Product,
    PropertyAnswers,
    PropertyQuestion,
    QuestionCategory,
} from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import SideBar from "../SideBar/SideBar";
import Results from "../results/Results";
import Reminder, { stepList } from "../reminder/Reminder";
import { filterFires } from "@/lib/filterFires";
import { firesAtStep, stepsWithUnanswered } from "@/lib/progress";

interface FireFinderProps {
    products: Product[];
    questionCategories: QuestionCategory[];
    /** Added: the brand on a brand's own page (e.g. Stoke), or undefined on the main page */
    brand?: Brand;
    heatDemandQuestions: HeatingQuestion[];
}

export default function FireFinder(props: FireFinderProps) {
    const [locationData, setLocationData] = useState<LocationData | null>(null);
    const [m2ToHeat, setM2ToHeat] = useState<number | null>(null);
    // How much of the room the fire is to heat, 0–100 %. Starts at 100 (the fire is the main heat source)
    const [heatShare, setHeatShare] = useState<number>(100);
    const [heatingAnswers, setHeatingAnswers] = useState<HeatingAnswers>({});
    const [propertyAnswers, setPropertyAnswers] = useState<PropertyAnswers>({});
    const [propertyOver2Hectares, setPropertyOver2Hectares] = useState<
        boolean | null
    >(false);
    const [replacingExistingWoodBurner, setReplacingExistingWoodBurner] =
        useState<boolean | null>(null);

    const allProducts = props.products;
    console.log("All products: ", allProducts);

    function updateLocationData(data: LocationData) {
        setLocationData(data);
        console.log("location data: ", data);
    }
    function updateHeatingAnswers(answers: HeatingAnswers) {
        setHeatingAnswers((prev) => ({
            ...prev,
            ...answers,
        }));
    }
    function updatePropertyAnswers(answers: PropertyAnswers) {
        setPropertyAnswers((prev) => ({
            ...prev,
            ...answers,
        }));
    }

    function removeAnswers(questionIds: string[]) {
        setHeatingAnswers((prev) => {
            const next = { ...prev };
            for (const id of questionIds) delete next[id];
            return next;
        });
        setPropertyAnswers((prev) => {
            const next = { ...prev };
            for (const id of questionIds) delete next[id];
            return next;
        });
    }

    // Recalculated whenever an answer, the location or the products change
    const result = useMemo(
        () =>
            filterFires({
                products: props.products,
                country: locationData?.country ?? null,
                m2ToHeat,
                heatShare,
                climateZone: locationData?.climateZone ?? null,
                ruleProfile: locationData?.ruleProfile ?? null,
                propertyOver2Hectares,
                replacingExistingWoodBurner,
                heatingAnswers,
                propertyAnswers,
            }),
        [
            props.products,
            locationData,
            m2ToHeat,
            heatShare,
            propertyOver2Hectares,
            replacingExistingWoodBurner,
            heatingAnswers,
            propertyAnswers,
        ],
    );

    // The categories without the step 2 questions (those are asked in step 2, not in a category),
    // and without property questions that don't apply in the chosen country.
    // A category left with no questions is left out, so there's no empty step.
    const country = locationData?.country ?? null;

    const questionCategories = useMemo(() => {
        // Does a question apply in the chosen country? No markets: everywhere
        const inCountry = (q: PropertyQuestion) =>
            !q.markets?.length ||
            !country ||
            q.markets.some((m) => m.code === country);

        return props.questionCategories
            .map((c) => ({
                ...c,
                heatingQuestions: c.heatingQuestions.filter(
                    (q) => q.isDependingOnHeatDemand !== true,
                ),
                propertyQuestions: c.propertyQuestions
                    .filter(inCountry)
                    .map((q) => ({
                        ...q,
                        followUps: q.followUps?.filter(inCountry).map((f) => ({
                            ...f,
                            followUps: f.followUps?.filter(inCountry),
                        })),
                    })),
            }))
            .filter(
                (c) =>
                    c.heatingQuestions.length + c.propertyQuestions.length > 0,
            );
    }, [props.questionCategories, country]);

    // A new country: answers to questions that don't apply there any more are removed
    useEffect(() => {
        const ids = (q: PropertyQuestion): string[] => [
            q.documentId,
            ...(q.followUps ?? []).flatMap(ids),
        ];
        const visible = new Set(
            questionCategories.flatMap((c) => c.propertyQuestions.flatMap(ids)),
        );
        const hidden = Object.keys(propertyAnswers).filter(
            (id) => !visible.has(id),
        );
        if (hidden.length) removeAnswers(hidden);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [country]);

    // Focus rings only show when the keyboard is used, not on every click
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Tab") document.documentElement.classList.add("kb");
        };
        const onPointer = () => document.documentElement.classList.remove("kb");
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer);
        };
    }, []);

    // ---------- When the fires show ----------
    // From the first preference category on (or step 3 if there are none), once there's a heat need.
    // Once they've shown, they stay, also when the user goes back to an earlier step.

    const [step, setStep] = useState(1);
    const [furthestStep, setFurthestStep] = useState(1);
    // "See your fires" was pressed (it only goes through once every required step is answered)
    const [seenFires, setSeenFires] = useState(false);
    const onStepChange = useCallback((s: number) => {
        setStep(s);
        setFurthestStep((prev) => Math.max(prev, s));
    }, []);

    const firesAt = firesAtStep(questionCategories);
    const showFires =
        result.kwNeeded !== null && (furthestStep >= firesAt || seenFires);

    // ---------- Phones ----------
    // First pass: the filter is a card under the heading, and the fires stay hidden.
    // "See your N fires" ends it: the filter becomes a pinned bar, and the fires appear.
    // Tapping the bar opens the filter as a full-screen sheet; the page behind it doesn't scroll.
    const [phone, setPhone] = useState(false);
    const [phoneDone, setPhoneDone] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        const query = window.matchMedia("(max-width: 699px)");
        const update = () => {
            setPhone(query.matches);
            if (!query.matches) setSheetOpen(false); // widening the window closes the sheet
        };
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle("sheet-open", sheetOpen);
    }, [sheetOpen]);

    // ---------- The reminder: "Answer steps 2, 3 and 4 to get better recommendations" ----------
    // Shown the first time a fire is opened (or ticked for comparing, not on phones) while questions are missing.
    // Shown once, and again only after the step in the filter has changed. It never blocks the click.

    const [reminder, setReminder] = useState<number[] | null>(null); // the steps it lists, or null when not showing
    const [reminded, setReminded] = useState(false);
    const [remindCount, setRemindCount] = useState(0); // tells SideBar to mark every unfinished step
    const [closeProduct, setCloseProduct] = useState(0); // tells Results to close the product pop-up
    const [stepRequest, setStepRequest] = useState<{
        step: number;
        count: number;
    } | null>(null);
    const rattle = useRef(0);

    useEffect(() => setReminded(false), [step]); // a new step: it may show once more

    function maybeRemind(what: "open" | "compare") {
        const phone = window.matchMedia("(max-width: 699px)").matches;
        if (reminded || reminder || (what === "compare" && phone)) return;
        const left = stepsWithUnanswered({
            location: locationData,
            m2ToHeat,
            propertyOver2Hectares,
            replacingExistingWoodBurner,
            heatingAnswers,
            propertyAnswers,
            questionCategories: questionCategories,
            heatShare,
            heatDemandQuestions: props.heatDemandQuestions,
        });
        if (!left.length) return;
        setReminded(true);
        setReminder(left);
        setRemindCount((c) => c + 1);

        // Desktop: the filter rattles right after the reminder's shake, unless it was clicked first
        if (
            !phone &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            window.clearTimeout(rattle.current);
            rattle.current = window.setTimeout(() => {
                document
                    .querySelector("aside[data-filters]")
                    ?.animate(
                        [
                            { transform: "translateX(0)" },
                            { transform: "translateX(-5px) rotate(-0.4deg)" },
                            { transform: "translateX(5px) rotate(0.4deg)" },
                            { transform: "translateX(-3px)" },
                            { transform: "translateX(0)" },
                        ],
                        { duration: 450, easing: "ease-out" },
                    );
            }, 1800);
        }
    }

    /** Clicking the reminder: the pop-up closes, and the filter opens on the first step with missing answers */
    function openFirstMissing() {
        if (!reminder) return;
        window.clearTimeout(rattle.current);
        setCloseProduct((c) => c + 1);
        railTo(false);
        if (phone && phoneDone) setSheetOpen(true); // phones: tapping it opens the filter
        setStepRequest((prev) => ({
            step: reminder[0],
            count: (prev?.count ?? 0) + 1,
        }));
    }

    // Phones: after the reminder, the bar keeps saying which steps are left, until they're answered
    const left =
        remindCount > 0
            ? stepsWithUnanswered({
                  location: locationData,
                  m2ToHeat,
                  propertyOver2Hectares,
                  replacingExistingWoodBurner,
                  heatingAnswers,
                  propertyAnswers,
                  questionCategories: questionCategories,
                  heatShare,
                  heatDemandQuestions: props.heatDemandQuestions,
              })
            : [];
    const barNote = left.length
        ? `Answer ${stepList(left)} for better recommendations`
        : null;

    // ---------- The collapsed filter (tablet and desktop) ----------
    // "See your N fires" shrinks the filter to a narrow column with the steps; the results get wider.
    // It never collapses by itself. Clicking a step (or the filter icon) opens it there again.
    const [rail, setRail] = useState(false);
    useEffect(() => {
        document.body.classList.toggle("rail", rail);
    }, [rail]);

    /**
     * Collapses or opens the filter, animated like the mockup:
     * - a copy of the old box moves and resizes to where the new one is (450 ms), its content fading out,
     *   and the new box's content fades in as it lands
     * - the results move and widen at the same time, so the cards just get wider (no scaling)
     * The heading's height (--intro-h) is frozen while collapsed, so nothing moves up afterwards.
     */
    function railTo(next: boolean) {
        if (next === rail) return;
        const box = document.querySelector<HTMLElement>("aside[data-filters]");
        const results = document.querySelector<HTMLElement>(
            'section[aria-label="Recommended fires"]',
        );
        const intro = document.querySelector<HTMLElement>("[data-intro]");
        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (!box || !results || reduced) {
            document.body.classList.toggle("rail", next);
            setRail(next);
            return;
        }

        const DUR = 450;
        const EASE = "cubic-bezier(.2,.8,.2,1)";
        const b0 = box.getBoundingClientRect();
        const r0 = results.getBoundingClientRect();

        // The copy of the old box, fixed exactly where it is now
        const ghost = box.cloneNode(true) as HTMLElement;
        ghost.removeAttribute("data-filters");
        ghost.setAttribute("aria-hidden", "true");
        Object.assign(ghost.style, {
            position: "fixed",
            left: `${b0.left}px`,
            top: `${b0.top}px`,
            width: `${b0.width}px`,
            height: `${b0.height}px`,
            margin: "0",
            zIndex: "50",
            pointerEvents: "none",
            overflow: "hidden",
        });
        document.body.appendChild(ghost);

        // Switch now, so the new layout can be measured
        document.body.classList.add("rail-anim"); // no transitions on the heading while it moves
        document.body.classList.toggle("rail", next);
        if (!next && intro) {
            // opening: the heading's height is synced straight away, so nothing jumps
            document.documentElement.style.setProperty(
                "--intro-h",
                `${intro.offsetHeight}px`,
            );
        }
        flushSync(() => setRail(next));

        const box1 = document.querySelector<HTMLElement>("aside[data-filters]");
        const b1 = box1?.getBoundingClientRect() ?? b0;
        const r1 = results.getBoundingClientRect();

        const from = {
            left: `${b0.left}px`,
            top: `${b0.top}px`,
            width: `${b0.width}px`,
            height: `${b0.height}px`,
        };
        const to = {
            left: `${b1.left}px`,
            top: `${b1.top}px`,
            width: `${b1.width}px`,
            height: `${b1.height}px`,
        };
        ghost.animate([from, to], {
            duration: DUR,
            easing: EASE,
            fill: "forwards",
        });
        [...ghost.children].forEach((child) =>
            (child as HTMLElement).animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: DUR * 0.5,
                easing: "ease",
                fill: "forwards",
            }),
        );
        box1?.animate(
            [{ opacity: 0 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }],
            {
                duration: DUR + 150,
                easing: "ease",
            },
        );

        // The results: move and widen together
        results.animate(
            [
                {
                    transform: `translateX(${r0.left - r1.left}px)`,
                    width: `${r0.width}px`,
                },
                { transform: "none", width: `${r1.width}px` },
            ],
            { duration: DUR, easing: EASE },
        );

        // Opening: the heading fades in after the results have moved
        if (!next && intro) {
            intro.animate(
                [{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }],
                { duration: DUR + 250 },
            );
        }

        window.setTimeout(() => {
            ghost.remove();
            document.body.classList.remove("rail-anim");
        }, DUR + 20);
    }

    function openRail(target: number) {
        railTo(false);
        setStepRequest((prev) => ({
            step: target,
            count: (prev?.count ?? 0) + 1,
        }));
    }

    const stepTitles = [
        "Location",
        "The room",
        ...questionCategories.map((c) => c.name),
    ];

    return (
        <div
            className={[
                styles.wrapper,
                rail && styles.rail,
                phone && !phoneDone && styles.firstPass,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <SideBar
                questionCategories={questionCategories}
                updateLocationData={updateLocationData}
                updateHeatingAnswers={updateHeatingAnswers}
                updatePropertyAnswers={updatePropertyAnswers}
                setM2ToHeat={setM2ToHeat}
                location={locationData}
                m2ToHeat={m2ToHeat}
                heatingAnswers={heatingAnswers}
                propertyAnswers={propertyAnswers}
                setPropertyOver2Hectares={setPropertyOver2Hectares}
                setReplacingExistingWoodBurner={setReplacingExistingWoodBurner}
                propertyOver2Hectares={propertyOver2Hectares}
                replacingExistingWoodBurner={replacingExistingWoodBurner}
                removeAnswers={removeAnswers}
                showingFires={showFires}
                bestCount={result.best.length}
                moreCount={result.more.length}
                firesAtStep={firesAt}
                onStepChange={onStepChange}
                stepRequest={stepRequest}
                todoSteps={[]}
                remindCount={remindCount}
                closeCount={result.close.length}
                rail={rail}
                onOpenRail={openRail}
                onSeeFires={() => {
                    setSeenFires(true);
                    if (phone) {
                        // Phones: the first pass is over. The filter becomes the pinned bar, and the fires appear
                        setPhoneDone(true);
                        setSheetOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                        railTo(true); // tablet and desktop: the filter collapses, and the results get wider
                    }
                }}
                phoneDone={phone && phoneDone}
                sheetOpen={sheetOpen}
                onOpenSheet={() => setSheetOpen(true)}
                onCloseSheet={() => setSheetOpen(false)}
                barNote={barNote}
                fuels={[
                    ...new Set(
                        [...result.best, ...result.close, ...result.more].map(
                            (m) => m.product.fuelType,
                        ),
                    ),
                ]}
                heatShare={heatShare}
                setHeatShare={setHeatShare}
                heatDemandQuestions={props.heatDemandQuestions}
            />

            <Results
                result={result}
                location={locationData}
                m2ToHeat={m2ToHeat}
                showFires={showFires && (!phone || phoneDone)}
                firesAt={{
                    step: firesAt,
                    title: stepTitles[firesAt - 1] ?? "",
                }}
                brand={props.brand}
                onBeforeOpen={maybeRemind}
                closeProduct={closeProduct}
            />

            {reminder && (
                <Reminder
                    steps={reminder}
                    onClick={openFirstMissing}
                    onDone={() => setReminder(null)}
                />
            )}
        </div>
    );
}
