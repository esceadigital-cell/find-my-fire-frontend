"use client";

import styles from "./SideBar.module.scss";
import {
    HeatingAnswers,
    HeatingQuestion,
    LocationData,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useEffect, useRef, useState } from "react";
import LocationMap from "../locationMap/LocationMap";
import QuestionCategoryStep from "../questionCategoryStep/QuestionCategoryStep";
import Icon from "../icon/Icon";
import { FUEL_NAMES } from "@/lib/display";
import { isRequiredStep, missingInStep, unansweredIn } from "@/lib/progress";
import Tip from "../tip/Tip";
import { TIPS, shareHelp } from "@/lib/tips";

interface SideBarProps {
    questionCategories: QuestionCategory[];
    updateLocationData: (data: LocationData) => void;
    updatePropertyAnswers: (answers: PropertyAnswers) => void;
    updateHeatingAnswers: (answers: HeatingAnswers) => void;
    setM2ToHeat: (m2: number | null) => void;
    location: LocationData | null;
    m2ToHeat: number | null;
    heatingAnswers: HeatingAnswers;
    propertyAnswers: PropertyAnswers;
    setPropertyOver2Hectares: (value: boolean) => void;
    setReplacingExistingWoodBurner: (value: boolean | null) => void;
    propertyOver2Hectares: boolean | null;
    replacingExistingWoodBurner: boolean | null;
    removeAnswers: (questionIds: string[]) => void;
    // ---- Added (display only) ----
    /** true once the fires are showing */
    showingFires: boolean;
    bestCount: number;
    moreCount: number;
    /** the step where the fires start showing */
    firesAtStep: number;
    /** tells FireFinder which step is open (for when the fires show, and the hint) */
    onStepChange: (step: number) => void;
    /** a step to open, asked for from outside (the hint's "Go to step"). count makes a repeat request work */
    stepRequest: { step: number; count: number } | null;
    /** steps that pulse in the progress bar while the hint is open */
    todoSteps: number[];
    /** the fuels still possible, shown in the one-line summary on phones */
    fuels: ("gas" | "wood" | "electric")[];
    /** 0–100 %. At 0 the fire is only for looks, and the room size and heat questions are hidden */
    heatShare: number;
    setHeatShare: (share: number) => void;
    /** the heating questions asked in step 2, when the fire is to heat the room */
    heatDemandQuestions: HeatingQuestion[];
    /** how many fires are close on heat, for the footer */
    closeCount: number;
    /** "See your N fires" on the last step */
    onSeeFires: () => void;
    /** collapsed into a narrow column (tablet and desktop, after "See your N fires") */
    rail: boolean;
    /** open the filter again, on this step */
    onOpenRail: (step: number) => void;
    /** goes up each time the reminder shows: every unfinished step is marked */
    remindCount: number;
    // ---- Phones ----
    /** the first pass is over ("See your N fires" was pressed): the filter is a pinned bar, or an open sheet */
    phoneDone: boolean;
    /** the filter is open as a full-screen sheet */
    sheetOpen: boolean;
    onOpenSheet: () => void;
    onCloseSheet: () => void;
    /** a small line in the bar after the reminder, e.g. "Answer steps 3 and 4 for better recommendations" */
    barNote: string | null;
}

export default function SideBar(props: SideBarProps) {
    console.log("Question categories: ", props.questionCategories);

    const [stepIndex, setStepIndex] = useState<number>(1);
    const [country, setCountry] = useState<"AU" | "NZ" | null>(null);
    const [postcode, setPostcode] = useState<string>("");
    const [street, setStreet] = useState<string>("");
    const [lastStreet, setLastStreet] = useState<string>("");
    // Added: show "Choose a country first" above the country buttons, instead of an alert
    const [askedForCountry, setAskedForCountry] = useState(false);
    // The lookup's message, e.g. "We couldn't find that address in New Zealand"
    const [lookupError, setLookupError] = useState<string | null>(null);
    // "Replacing an existing fireplace?" and, if yes, "What's your current fire?"
    const [replacingFireplace, setReplacingFireplace] = useState<
        boolean | null
    >(null);
    const [currentFire, setCurrentFire] = useState<
        "wood" | "gas" | "electric" | null
    >(null);

    async function lookUp(
        country: string,
        postcode: string,
        street: string,
        pin?: { lat: number; lng: number },
    ) {
        setLastStreet(street);
        const params = new URLSearchParams({
            country,
            postcode,
            address: street,
        });
        if (pin) {
            params.set("lat", String(pin.lat));
            params.set("lng", String(pin.lng));
        }
        const res = await fetch(`/api/location?${params}`);
        const data = await res.json();
        if (!res.ok) {
            setLookupError(data.error ?? "Something went wrong. Try again.");
            return; // don't save an error as location data
        }
        setLookupError(null);
        setPostcode(data.postcode); // filled in from the address
        props.updateLocationData(data);
    }

    function handleStreetDone() {
        if (!street.trim() || street.trim() === lastStreet) return; // nothing (new) to look up
        if (!country) {
            setAskedForCountry(true);
            return;
        }
        lookUp(country, "", street.trim()); // the postcode comes from the address
    }

    async function handlePostcodeChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ) {
        const input = e.target.value.replace(/\D/g, "").slice(0, 4); // only digits, max 4
        setPostcode(input);
        setLookupError(null);

        // A postcode typed by hand replaces the address: it no longer matches
        if (street) {
            setStreet("");
            setLastStreet("");
        }

        if (input.length === 4) {
            if (!country) {
                setAskedForCountry(true); // was: alert("Choose country")
                return;
            }
            await lookUp(country, input, ""); // the postcode's centre
        }
    }

    function handleCountryChange(country: "AU" | "NZ") {
        setCountry(country);
        setLastStreet(""); // so the address is looked up again in the new country
        if (street.trim()) lookUp(country, "", street.trim());
        else if (postcode.length === 4) lookUp(country, postcode, "");
    }

    // Replacing a fireplace? No: not replacing a wood burner. Yes: it depends on the current fire,
    // so it's unknown (null) until that's answered.
    function handleReplacingFireplace(value: boolean) {
        setReplacingFireplace(value);
        setCurrentFire(null);
        props.setReplacingExistingWoodBurner(value ? null : false);
    }

    // Replacing a wood burner only if the current fire is a wood fire
    function handleCurrentFire(fire: "wood" | "gas" | "electric") {
        setCurrentFire(fire);
        props.setReplacingExistingWoodBurner(fire === "wood");
    }

    function locationMessage(location: LocationData) {
        if (location.airShed && !location.precise) {
            return `The centre of ${location.postcode} is inside ${location.airShed}. Add your address to be sure.`;
        }
        if (location.airShed) {
            return `Your address is inside ${location.airShed}.`;
        }
        if (!location.precise) {
            return "Add your address to check the local rules for your house.";
        }
        return `${location.region} rules apply.`;
    }

    function toNumber(value: string) {
        return value === "" ? null : Number(value);
    }

    // =====================================================================
    // Added: everything below is display only
    // =====================================================================

    const totalSteps = props.questionCategories.length + 2;
    const stepTitles = [
        "Location",
        "The room",
        ...props.questionCategories.map((c) => c.name),
    ];

    // ---------- Required answers ----------
    // Steps 1 and 2, and every category that isn't a preference category, must be answered before moving on.

    const progress = {
        location: props.location,
        m2ToHeat: props.m2ToHeat,
        propertyOver2Hectares: props.propertyOver2Hectares,
        replacingExistingWoodBurner: props.replacingExistingWoodBurner,
        heatingAnswers: props.heatingAnswers,
        propertyAnswers: props.propertyAnswers,
        questionCategories: props.questionCategories,
        heatShare: props.heatShare,
        heatDemandQuestions: props.heatDemandQuestions,
    };
    const missing = (step: number) => {
        if (!isRequiredStep(step, progress)) return [];
        const list = missingInStep(step, progress);
        // The country is only known here in the sidebar, so it's checked here
        return step === 1 && country === null ? ["country", ...list] : list;
    };

    // The step where the user tried to move on with something missing.
    // The red message and borders show while something there is still missing, and go away by themselves.
    const [nudge, setNudge] = useState<{ step: number; count: number } | null>(
        null,
    );
    const nudgeMissing =
        nudge && nudge.step === stepIndex ? missing(nudge.step) : [];
    const needs = (key: string) => nudgeMissing.includes(key);
    const box = useRef<HTMLElement>(null);

    // ---------- Skipped questions ----------
    // A step is "done" when every question in it is answered, optional ones too.
    // Moving forward past a step with unanswered questions marks it (flagged): its line in the step bar pulses,
    // and its skipped questions get a thin orange line. Going back never marks anything.
    // The pulsing only starts after the first pass: once the user has pressed "See your fires".

    const [flagged, setFlagged] = useState<number[]>([]);
    const [firstPass, setFirstPass] = useState(true);

    /** The unanswered questions in a step: what's missing in steps 1 and 2, every unanswered question in a category */
    function unanswered(step: number) {
        if (step <= 2) return missingInStep(step, progress);
        const category = props.questionCategories[step - 3];
        return category ? unansweredIn(category, progress) : [];
    }
    const stepDone = (step: number) => unanswered(step).length === 0;

    function flag(step: number) {
        if (!stepDone(step) && !flagged.includes(step))
            setFlagged((prev) => [...prev, step]);
    }

    /** Go to a step, unless an earlier required step is missing answers: then stop there and show what's missing */
    function goTo(target: number) {
        for (let step = 1; step < target; step++) {
            if (missing(step).length) {
                setStepIndex(step);
                setNudge((prev) => ({ step, count: (prev?.count ?? 0) + 1 }));
                return;
            }
        }
        if (target > stepIndex) flag(stepIndex); // moving forward past unanswered questions marks the step
        setStepIndex(target);
    }

    /** "See your N fires" on the last step: like moving past it, then show the fires */
    function seeFires() {
        for (let step = 1; step <= totalSteps; step++) {
            if (missing(step).length) {
                setStepIndex(step);
                setNudge((prev) => ({ step, count: (prev?.count ?? 0) + 1 }));
                return;
            }
        }
        flag(stepIndex);
        setFirstPass(false);
        props.onSeeFires();
    }

    // The reminder marks every unfinished step, and ends the first pass (so the marked steps pulse)
    useEffect(() => {
        if (!props.remindCount) return;
        const total = props.questionCategories.length + 2;
        const unfinished = Array.from(
            { length: total },
            (_, i) => i + 1,
        ).filter((st) => !stepDone(st));
        setFlagged((prev) => [...new Set([...prev, ...unfinished])]);
        setFirstPass(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.remindCount]);

    // The skipped questions shown on the current step, once it's marked
    const skippedHere = flagged.includes(stepIndex)
        ? unanswered(stepIndex)
        : [];

    // Shake what's missing, and the Next button, each time the user is stopped
    useEffect(() => {
        if (
            !nudge ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
            return;
        const shake = [
            { transform: "translateX(0)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(-2px)" },
            { transform: "translateX(0)" },
        ];
        box.current
            ?.querySelectorAll("[data-need], [data-next]")
            .forEach((el) =>
                el.animate(shake, { duration: 360, easing: "ease-out" }),
            );
    }, [nudge]);

    // Tell FireFinder which step is open
    const onStepChange = props.onStepChange;
    useEffect(() => onStepChange(stepIndex), [stepIndex, onStepChange]);

    // Open a step when asked from outside (the reminder, or a step in the collapsed filter)
    useEffect(() => {
        if (props.stepRequest) goTo(props.stepRequest.step);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.stepRequest]);

    // =====================================================================
    // Phones
    // =====================================================================
    // First pass: the filter is a card under the heading.
    // After "See your N fires" it shrinks into a pinned "Find my fireplace" bar at the top of the screen,
    // which opens the filter as a full-screen sheet (the page behind it doesn't scroll).
    // On tablet and desktop none of this applies: the classes only have styles on phones.

    const pinned = props.phoneDone && !props.sheetOpen;
    const boxClass = [
        styles.box,
        pinned && styles.pinned,
        props.sheetOpen && styles.sheet,
    ]
        .filter(Boolean)
        .join(" ");

    // ---------- After an answer: bring the next question into view ----------
    // If the next question is hidden below the bottom of the filter's scroll area, scroll it into view,
    // but never so far that the question just answered leaves the top.
    const bodyRef = useRef<HTMLDivElement>(null);

    // A new step starts at its top: the steps share one scroll area, so reset it.
    // On phones (first pass), the box is part of the page: if its top is above the screen, bring it back.
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
        const top = box.current?.getBoundingClientRect().top ?? 0;
        if (top < 0)
            box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [stepIndex]);
    function revealNext(e: React.MouseEvent) {
        const button = (e.target as HTMLElement).closest(
            "button[aria-pressed]",
        );
        const body = bodyRef.current;
        if (!button || !body || body.scrollHeight <= body.clientHeight) return;
        requestAnimationFrame(() => {
            const blocks = [
                ...body.querySelectorAll<HTMLElement>(
                    `[data-q], .${styles.question}, .${styles.field}`,
                ),
            ];
            const current = blocks.find((b) => b.contains(button));
            const next = current && blocks[blocks.indexOf(current) + 1];
            if (!current || !next) return;
            const box = body.getBoundingClientRect();
            const pad = 16;
            const below =
                next.getBoundingClientRect().bottom + pad - box.bottom;
            if (below <= 0) return; // already visible
            const room = current.getBoundingClientRect().top - box.top - pad; // how far before the answered one leaves
            const by = Math.min(below, Math.max(0, room));
            if (by > 0) body.scrollBy({ top: by, behavior: "smooth" });
        });
    }

    // The Next button's text: "Next: The room", or "See your 33 fires" on the last step
    const nextLabel = (
        <span className={styles.fnLabel}>
            <span>
                {stepIndex < totalSteps
                    ? `Next: ${stepTitles[stepIndex]}`
                    : props.showingFires
                        ? `See your ${props.bestCount} fire${props.bestCount === 1 ? "" : "s"}`
                        : "See your fires"}
            </span>
            <Icon name="arrowRight" size={14} />
        </span>
    );

    /** The asterisk after a required question's label: black, orange once it's been skipped */
    const ast = (key: string) => (
        <span
            className={
                needs(key) ? `${styles.ast} ${styles.missAst}` : styles.ast
            }
            aria-hidden="true"
        >
            *
        </span>
    );

    // ---------- Text ----------

    let postcodeHint: React.ReactNode =
        "Enter a 4-digit postcode to set your climate zone.";
    if (props.location?.climateZone) {
        postcodeHint = (
            <>
                {props.location.postcode} is in the{" "}
                <b>{props.location.climateZone.name} zone</b> · 1 kW per{" "}
                {props.location.climateZone.baseM2PerKw} m²
            </>
        );
    }

    // Under the map: the rule once the address is known, otherwise where the pin is
    function mapCaption(location: LocationData) {
        return location.precise
            ? locationMessage(location)
            : `Pin on the centre of ${location.postcode} · drag it to your house`;
    }

    // ---------- Collapsed: the filter icon and the numbered steps ----------
    // Clicking a step opens the filter on that step; clicking anywhere else opens it where it was
    if (props.rail) {
        return (
            <aside
                className={`${styles.box} ${styles.railBox}`}
                data-filters
                onClick={() => props.onOpenRail(stepIndex)}
            >
                <button
                    type="button"
                    className={styles.railOpen}
                    aria-label="Open the filter"
                >
                    <Icon name="sliders" />
                </button>
                <ol className={styles.railSteps}>
                    {stepTitles.map((title, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation(); // this step, not the last one
                                    props.onOpenRail(i + 1);
                                }}
                            >
                                <span className={styles.railNum}>{i + 1}</span>
                                <span>{title}</span>
                            </button>
                        </li>
                    ))}
                </ol>
            </aside>
        );
    }

    return (
        <>
            <aside ref={box} className={boxClass} data-filters>
                {/* Phones, after the first pass: the pinned bar. Tap to open the filter as a sheet */}
                {pinned && (
                    <button
                        type="button"
                        className={styles.bar}
                        onClick={props.onOpenSheet}
                    >
                        <Icon name="sliders" />
                        <span className={styles.barText}>
                            <span className={styles.barTitle}>
                                Find my fireplace
                            </span>
                            {props.barNote && (
                                <span className={styles.barNote}>
                                    {props.barNote}
                                </span>
                            )}
                        </span>
                        <span className={styles.barChev} aria-hidden="true">
                            <Icon name="chevronDown" size={18} />
                        </span>
                    </button>
                )}

                {/* ---------- Head: which step, and the arrows ---------- */}
                <div className={styles.head}>
                    <div className={styles.title}>
                        <small>
                            Step {stepIndex} of {totalSteps}
                        </small>
                        <strong>{stepTitles[stepIndex - 1]}</strong>
                    </div>
                    {/* Phones: close the sheet (the chevron turns, and stays in place) */}
                    {props.sheetOpen && (
                        <button
                            type="button"
                            className={`${styles.ib} ${styles.sheetClose}`}
                            aria-label="Close the filter"
                            onClick={props.onCloseSheet}
                        >
                            <Icon name="chevronDown" />
                        </button>
                    )}
                </div>

                {/* ---------- Progress: one bar per step, click to jump ---------- */}
                <div
                    className={styles.progress}
                    style={{
                        gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))`,
                    }}
                    role="group"
                    aria-label="Steps"
                >
                    {stepTitles.map((title, i) => (
                        <button
                            key={i}
                            type="button"
                            className={
                                i + 1 === stepIndex
                                    ? styles.now
                                    : i + 1 < stepIndex && stepDone(i + 1)
                                        ? styles.done // passed and complete: black. Passed with gaps: stays grey
                                        : undefined
                            }
                            data-todo={
                                props.todoSteps.includes(i + 1) || undefined
                            }
                            // Marked steps pulse one after the other (not on the first pass through the filter)
                            data-soft={
                                (!firstPass &&
                                    flagged.includes(i + 1) &&
                                    !stepDone(i + 1)) ||
                                undefined
                            }
                            style={
                                {
                                    "--k": flagged
                                        .filter((f) => !stepDone(f))
                                        .sort((a, b) => a - b)
                                        .indexOf(i + 1),
                                } as React.CSSProperties
                            }
                            aria-label={`Step ${i + 1}: ${title}`}
                            aria-current={
                                i + 1 === stepIndex ? "step" : undefined
                            }
                            onClick={() =>
                                i + 1 < stepIndex
                                    ? setStepIndex(i + 1)
                                    : goTo(i + 1)
                            }
                        >
                            <span />
                        </button>
                    ))}
                </div>

                {/* ---------- Body: the open step ---------- */}
                <div ref={bodyRef} className={styles.body} onClick={revealNext}>
                    {/* An optional step that was skipped: how many answers are missing */}
                    {skippedHere.length > 0 && (
                        <p className={styles.sl}>
                            {skippedHere.length} missing answer
                            {skippedHere.length === 1 ? "" : "s"} in this step
                        </p>
                    )}
                    {/* A required question left empty: explained once, at the top */}
                    {nudgeMissing.length > 0 && (
                        <p className={styles.reqMsg} role="alert">
                            <span
                                className={`${styles.ast} ${styles.missAst}`}
                                aria-hidden="true"
                            >
                                *
                            </span>{" "}
                            Required
                        </p>
                    )}

                    {/** Step 1 */}
                    {stepIndex === 1 && (
                        <div className={styles.stepBody}>
                            <div
                                className={
                                    needs("country")
                                        ? `${styles.question} ${styles.need}`
                                        : styles.question
                                }
                                data-need={needs("country") || undefined}
                            >
                                <span className={styles.label}>
                                    Country
                                    {ast("country")}
                                </span>
                                {askedForCountry && country === null && (
                                    <p className={styles.warn} role="alert">
                                        Choose a country first.
                                    </p>
                                )}
                                <div className={styles.options}>
                                    <button
                                        type="button"
                                        aria-pressed={country === "NZ"}
                                        onClick={() =>
                                            handleCountryChange("NZ")
                                        }
                                    >
                                        New Zealand
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={country === "AU"}
                                        onClick={() =>
                                            handleCountryChange("AU")
                                        }
                                    >
                                        Australia
                                    </button>
                                </div>
                            </div>

                            <label className={styles.field}>
                                <span className={styles.label}>
                                    Address
                                    <Tip text={TIPS.address} label="Address" />
                                </span>
                                {/* Until the address is found, say so here, where it can be fixed */}
                                {props.location && !props.location.precise && (
                                    <p className={styles.warn}>
                                        {locationMessage(props.location)}
                                    </p>
                                )}
                                <input
                                    type="text"
                                    autoComplete="street-address"
                                    placeholder="12 Riccarton Road, Christchurch"
                                    value={street}
                                    onChange={(e) => setStreet(e.target.value)}
                                    onBlur={handleStreetDone}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleStreetDone();
                                        }
                                    }}
                                />
                            </label>
                            {props.location?.address && (
                                <p className={styles.hint}>
                                    Found: {props.location.address}
                                </p>
                            )}
                            {lookupError && (
                                <p className={styles.warn} role="alert">
                                    {lookupError}
                                </p>
                            )}

                            <label
                                className={
                                    needs("postcode")
                                        ? `${styles.field} ${styles.need}`
                                        : styles.field
                                }
                                data-need={needs("postcode") || undefined}
                            >
                                <span className={styles.label}>
                                    Postcode
                                    {ast("postcode")}{" "}
                                    <span className={styles.optTag}>
                                        fills in from your address
                                    </span>
                                    <Tip
                                        text={TIPS.postcode}
                                        label="Postcode"
                                    />
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    value={postcode}
                                    onChange={handlePostcodeChange}
                                />
                            </label>
                            {props.location?.climateZone && (
                                <p className={styles.hint}>{postcodeHint}</p>
                            )}

                            {props.location && country && (
                                <LocationMap
                                    lat={props.location.lat}
                                    lng={props.location.lng}
                                    zones={props.location.nearby}
                                    caption={mapCaption(props.location)}
                                    onMove={(lat, lng) =>
                                        lookUp(country, postcode, street, {
                                            lat,
                                            lng,
                                        })
                                    }
                                />
                            )}

                            <div
                                className={
                                    needs("propertySize")
                                        ? `${styles.question} ${styles.need}`
                                        : styles.question
                                }
                                data-need={needs("propertySize") || undefined}
                            >
                                <span className={styles.label}>
                                    Property size
                                    {ast("propertySize")}
                                    <Tip
                                        text={TIPS.propertySize}
                                        label="Property size"
                                    />
                                </span>
                                <div className={styles.options}>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            props.propertyOver2Hectares ===
                                            false
                                        }
                                        onClick={() =>
                                            props.setPropertyOver2Hectares(
                                                false,
                                            )
                                        }
                                    >
                                        Under 2 hectares
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            props.propertyOver2Hectares === true
                                        }
                                        onClick={() =>
                                            props.setPropertyOver2Hectares(true)
                                        }
                                    >
                                        2 hectares or more
                                    </button>
                                </div>
                            </div>

                            <div
                                className={
                                    needs("replacing") &&
                                        replacingFireplace !== true
                                        ? `${styles.question} ${styles.need}`
                                        : styles.question
                                }
                                data-need={
                                    (needs("replacing") &&
                                        replacingFireplace !== true) ||
                                    undefined
                                }
                            >
                                <span className={styles.label}>
                                    Replacing an existing fireplace?
                                    {ast("replacing")}
                                </span>
                                <div className={styles.options}>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            replacingFireplace === true
                                        }
                                        onClick={() =>
                                            handleReplacingFireplace(true)
                                        }
                                    >
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            replacingFireplace === false
                                        }
                                        onClick={() =>
                                            handleReplacingFireplace(false)
                                        }
                                    >
                                        No
                                    </button>
                                </div>

                                {/* Follow-up: only when replacing a fireplace */}
                                {replacingFireplace === true && (
                                    <div
                                        className={
                                            needs("replacing")
                                                ? `${styles.question} ${styles.followUp} ${styles.need}`
                                                : `${styles.question} ${styles.followUp}`
                                        }
                                        data-need={
                                            needs("replacing") || undefined
                                        }
                                    >
                                        <span className={styles.label}>
                                            What kind of fireplace are you
                                            replacing?
                                            {ast("replacing")}
                                        </span>
                                        <div className={styles.options}>
                                            {(
                                                [
                                                    "wood",
                                                    "gas",
                                                    "electric",
                                                ] as const
                                            ).map((fire) => (
                                                <button
                                                    key={fire}
                                                    type="button"
                                                    aria-pressed={
                                                        currentFire === fire
                                                    }
                                                    onClick={() =>
                                                        handleCurrentFire(fire)
                                                    }
                                                >
                                                    {FUEL_NAMES[fire]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/** Step 2: how much the fire is to heat, the room size, and the heat questions */}
                    {stepIndex === 2 && (
                        <div className={styles.stepBody}>
                            {/* "What should heat your room?": two linked bars that always add up to 100% */}
                            <div className={styles.question} data-q>
                                <span className={styles.label}>
                                    What should heat your room?
                                    {ast("share")}
                                    <Tip
                                        text={TIPS.share}
                                        label="What should heat your room?"
                                    />
                                </span>
                                <div className={styles.bars}>
                                    {(
                                        [
                                            [
                                                "fireplace",
                                                "This fireplace",
                                                props.heatShare,
                                            ],
                                            [
                                                "other",
                                                "Other heat sources",
                                                100 - props.heatShare,
                                            ],
                                        ] as const
                                    ).map(([key, label, value]) => (
                                        <div
                                            key={key}
                                            className={styles.barRow}
                                            data-bar={key}
                                        >
                                            <label
                                                className={styles.barLabel}
                                                htmlFor={`share-${key}`}
                                            >
                                                {label}
                                            </label>
                                            <span
                                                className={styles.barTrack}
                                                style={
                                                    {
                                                        "--w": value,
                                                    } as React.CSSProperties
                                                }
                                            >
                                                <span
                                                    className={styles.barFill}
                                                />
                                                <input
                                                    id={`share-${key}`}
                                                    type="range"
                                                    className={styles.barInput}
                                                    min={0}
                                                    max={100}
                                                    step={10}
                                                    value={value}
                                                    aria-valuetext={`${value}%`}
                                                    onChange={(e) =>
                                                        // The other bar is the rest: dragging it to 30% gives the fireplace 70%
                                                        props.setHeatShare(
                                                            key === "fireplace"
                                                                ? Number(
                                                                    e.target
                                                                        .value,
                                                                )
                                                                : 100 -
                                                                Number(
                                                                    e
                                                                        .target
                                                                        .value,
                                                                ),
                                                        )
                                                    }
                                                />
                                                <span
                                                    className={styles.barValue}
                                                    aria-hidden="true"
                                                >
                                                    {value}%
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p
                                    className={`${styles.hint} ${styles.shareHelp}`}
                                    aria-live="polite"
                                >
                                    {shareHelp(props.heatShare)}
                                </p>
                            </div>

                            {/* Only when the fire is to heat the room */}
                            {props.heatShare > 0 && (
                                <>
                                    <label
                                        className={
                                            needs("room")
                                                ? `${styles.field} ${styles.need}`
                                                : styles.field
                                        }
                                        data-need={needs("room") || undefined}
                                    >
                                        <span className={styles.label}>
                                            Area (m²)
                                            {ast("room")}
                                            <Tip
                                                text={TIPS.area}
                                                label="Area"
                                            />
                                        </span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="any"
                                            value={props.m2ToHeat ?? ""}
                                            onChange={(e) =>
                                                props.setM2ToHeat(
                                                    toNumber(e.target.value),
                                                )
                                            }
                                        />
                                    </label>

                                    <QuestionCategoryStep
                                        category={{
                                            documentId: "heat-demand",
                                            name: "",
                                            order: 0,
                                            isOptionalCategory: false,
                                            heatingQuestions:
                                                props.heatDemandQuestions,
                                            propertyQuestions: [],
                                        }}
                                        propertyAnswers={props.propertyAnswers}
                                        heatingAnswers={props.heatingAnswers}
                                        onHeatingAnswer={(question, option) =>
                                            props.updateHeatingAnswers({
                                                [question.documentId]: {
                                                    optionId: option.id,
                                                    modifier: option.modifier,
                                                },
                                            })
                                        }
                                        onPropertyAnswer={() => { }} // step 2 only has heating questions
                                        onPropertyNumber={() => { }}
                                        removeAnswers={props.removeAnswers}
                                        missingIds={nudgeMissing}
                                        required
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {/** All other steps (every question category) */}
                    {stepIndex > 2 && (
                        <div className={styles.stepBody}>
                            <QuestionCategoryStep
                                category={
                                    props.questionCategories[stepIndex - 3]
                                }
                                propertyAnswers={props.propertyAnswers}
                                heatingAnswers={props.heatingAnswers}
                                onHeatingAnswer={(question, option) =>
                                    props.updateHeatingAnswers({
                                        [question.documentId]: {
                                            optionId: option.id,
                                            modifier: option.modifier,
                                        },
                                    })
                                }
                                onPropertyAnswer={(question, options) =>
                                    props.updatePropertyAnswers({
                                        [question.documentId]: {
                                            productProperty:
                                                question.productField,
                                            // Hard (removed) or soft (moved down), from the question itself
                                            isHardFiltering:
                                                !!question.isHardFiltering,
                                            // Which fires the question applies to (empty: all of them)
                                            onlyForField: question.onlyForField ?? null,
                                            onlyForValue: question.onlyForValue ?? null,
                                            // One entry per chosen option
                                            chosen: options.map((option) => ({
                                                optionId: option.id,
                                                compareMethod:
                                                    option.filterOperator,
                                                filterValue: option.filterValue,
                                                label: option.label,
                                            })),
                                        },
                                    })
                                }
                                onPropertyNumber={(question, value) =>
                                    props.updatePropertyAnswers({
                                        [question.documentId]: {
                                            productProperty:
                                                question.productField,
                                            // Hard (removed) or soft (moved down), from the question itself
                                            isHardFiltering:
                                                !!question.isHardFiltering,
                                            // Which fires the question applies to (empty: all of them)
                                            onlyForField: question.onlyForField ?? null,
                                            onlyForValue: question.onlyForValue ?? null,
                                            // The typed number as the one chosen value, or nothing if the field is empty
                                            chosen:
                                                value != null
                                                    ? [
                                                        {
                                                            optionId: null, // no button was chosen
                                                            compareMethod:
                                                                question.operator, // the operator is on the question, not an option
                                                            filterValue:
                                                                value,
                                                            label: `${value}${question.unit ? " " + question.unit : ""}`,
                                                        },
                                                    ]
                                                    : [],
                                        },
                                    })
                                }
                                removeAnswers={props.removeAnswers}
                                missingIds={nudgeMissing}
                                required={
                                    !props.questionCategories[stepIndex - 3]
                                        .isOptionalCategory
                                }
                                skippedIds={skippedHere}
                            />
                        </div>
                    )}
                </div>

                {/* ---------- Back / Next: "Next: The room", and "See your N fires" on the last step ---------- */}
                {/* Next fills black, left to right, once every question in the step is answered */}
                <div className={styles.fnav}>
                    {stepIndex > 1 && (
                        <button
                            type="button"
                            className={styles.fnBack}
                            aria-label="Back"
                            onClick={() => setStepIndex((prev) => prev - 1)}
                        >
                            <Icon name="arrowLeft" size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={
                            stepDone(stepIndex)
                                ? `${styles.fnNext} ${styles.filled}`
                                : styles.fnNext
                        }
                        data-next
                        onClick={() =>
                            stepIndex < totalSteps
                                ? goTo(stepIndex + 1)
                                : seeFires()
                        }
                    >
                        {nextLabel}
                        {/* A white copy, revealed from the left together with the black fill */}
                        <span className={styles.fnWipe} aria-hidden="true">
                            {nextLabel}
                        </span>
                    </button>
                </div>

                {/* ---------- Foot: how many fires, and start again ---------- */}
                <div className={styles.foot}>
                    <span>
                        {props.showingFires ? (
                            <>
                                <b>{props.bestCount} best</b> ·{" "}
                                {props.closeCount} close · {props.moreCount}{" "}
                                more ideas
                            </>
                        ) : (
                            "Steps 1 and 2 are required"
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                    >
                        Start again
                    </button>
                </div>
            </aside>
        </>
    );
}
