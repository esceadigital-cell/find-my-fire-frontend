"use client";

import styles from "./SideBar.module.scss";
import {
    HeatingAnswers,
    LocationData,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import LocationMap from "../locationMap/LocationMap";
import QuestionCategoryStep from "../questionCategoryStep/QuestionCategoryStep";
import Icon, { PlusMinus } from "../icon/Icon";
import { FUEL_NAMES } from "@/lib/display";
import { isRequiredStep, missingInStep } from "@/lib/progress";

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
    setReplacingExistingWoodBurner: (value: boolean) => void;
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
}

export default function SideBar(props: SideBarProps) {
    console.log("Question categories: ", props.questionCategories);

    const [stepIndex, setStepIndex] = useState<number>(1);
    const [country, setCountry] = useState<"AU" | "NZ" | null>(null);
    const [postcode, setPostcode] = useState<string>("");
    const [street, setStreet] = useState<string>("");
    const [lastStreet, setLastStreet] = useState<string>("");
    const [width, setWidth] = useState<number | null>(null);
    const [depth, setDepth] = useState<number | null>(null);
    const [openArea, setOpenArea] = useState<number | null>(null);
    // Added: show "Choose a country first" above the country buttons, instead of an alert
    const [askedForCountry, setAskedForCountry] = useState(false);

    async function lookUp(
        country: string,
        postcode: string,
        street: string,
        pin?: { lat: number; lng: number },
    ) {
        setLastStreet(street);
        const params = new URLSearchParams({ country, postcode, street });
        if (pin) {
            params.set("lat", String(pin.lat));
            params.set("lng", String(pin.lng));
        }
        const res = await fetch(`/api/location?${params}`);
        const data = await res.json();
        if (!res.ok) {
            console.error(data);
            return; // don't save an error as location data
        }
        props.updateLocationData(data);
    }

    function handleStreetDone() {
        if (postcode.length !== 4 || !country) return; // the postcode has to be there first
        if (street.trim() === lastStreet) return; // nothing new to look up
        lookUp(country, postcode, street.trim());
    }

    async function handlePostcodeChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ) {
        const input = e.target.value.replace(/\D/g, "").slice(0, 4); // only digits, max 4
        setPostcode(input);

        if (input.length === 4) {
            if (!country) {
                setAskedForCountry(true); // was: alert("Choose country")
                return;
            }
            await lookUp(country, input, street);
        }
    }

    function handleCountryChange(country: "AU" | "NZ") {
        setCountry(country);
        if (postcode.length === 4) lookUp(country, postcode, street);
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

    function updateRoom(
        w: number | null,
        d: number | null,
        extra: number | null,
    ) {
        setWidth(w);
        setDepth(d);
        setOpenArea(extra);

        if (w && d) {
            props.setM2ToHeat(w * d + (extra ?? 0));
        } else {
            props.setM2ToHeat(null);
        }
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

    /** Go to a step, unless an earlier required step is missing answers: then stop there and show what's missing */
    function goTo(target: number) {
        for (let step = 1; step < target; step++) {
            if (missing(step).length) {
                setStepIndex(step);
                setNudge((prev) => ({ step, count: (prev?.count ?? 0) + 1 }));
                return;
            }
        }
        setStepIndex(target);
    }

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

    // Open a step when asked from outside (the hint's "Go to step").
    // On phones, unfold the box, and float it at the top if it's out of view.
    useEffect(() => {
        if (!props.stepRequest) return;
        goTo(props.stepRequest.step);
        if (isPhone()) {
            if (live.current.collapsed) {
                flushSync(() => setCollapsed(false));
                live.current.collapsed = false;
            }
            const r = box.current?.getBoundingClientRect();
            if (r && (r.bottom < 60 || r.top > window.innerHeight)) undock();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.stepRequest]);

    // =====================================================================
    // Phones: fold away, minibar, floating
    // =====================================================================
    // On phones the box scrolls with the page, and:
    // - folds into one line once it's scrolled out of view and the page is at rest
    // - a bar slides down from the top when the user scrolls back up (the "minibar")
    // - tapping that bar opens the box as a floating panel at the top of the screen

    const space = useRef<HTMLDivElement>(null); // keeps the box's place in the page while it floats
    const minibar = useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [floating, setFloating] = useState(false);

    // Values the scroll handlers read and change without re-rendering
    const live = useRef({
        lastY: 0,
        up: false,
        busy: false,
        holdUntil: 0,
        timer: 0,
        collapsed: false,
        floating: false,
    });
    live.current.collapsed = collapsed;
    live.current.floating = floating;

    const isPhone = () => window.matchMedia("(max-width: 699px)").matches;
    const reducedMotion = () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const EASE = "cubic-bezier(.2,.8,.2,1)";

    /** Folds the box into one line once it has scrolled out of view, keeping the page where it was */
    function foldAway() {
        const f = box.current;
        const l = live.current;
        if (
            !f ||
            !isPhone() ||
            l.floating ||
            l.collapsed ||
            l.busy ||
            f.getBoundingClientRect().bottom >= 0
        )
            return;
        l.busy = true;
        const h0 = f.offsetHeight;
        const y0 = window.scrollY;
        flushSync(() => setCollapsed(true));
        l.collapsed = true;
        const dh = h0 - f.offsetHeight;
        window.scrollTo(0, y0 - dh); // the box got shorter: move the page up by as much, so nothing jumps
        l.lastY = y0 - dh;
        l.up = false;
        l.holdUntil = performance.now() + 200;
        l.busy = false;
    }

    /** Shows the minibar when scrolling up while the box is out of view */
    function syncMinibar() {
        const f = box.current;
        const m = minibar.current;
        const sp = space.current;
        if (!f || !m || !sp) return;
        const l = live.current;

        // Which way is the page scrolling? (ignoring tiny movements)
        const y = window.scrollY;
        const dy = y - l.lastY;
        if (performance.now() < l.holdUntil) l.lastY = y;
        else {
            if (dy < -4) l.up = true;
            else if (dy > 4) l.up = false;
            if (Math.abs(dy) > 4) l.lastY = y;
        }

        // Back at its place in the page: the floating box docks again
        if (l.floating && (!isPhone() || sp.getBoundingClientRect().top >= 0))
            dock();

        // Fold the box once the page is at rest (correcting the scroll mid-swipe makes phones jump)
        if (!l.busy) {
            window.clearTimeout(l.timer);
            l.timer = window.setTimeout(foldAway, 220);
        }

        const r = f.getBoundingClientRect();
        const was = m.dataset.show === "true";
        const show =
            isPhone() &&
            !l.floating &&
            l.up &&
            r.top < 0 &&
            (was || r.bottom < 0);

        // Handing over to the box at its own place: vanish at once instead of sliding up
        if (was && !show && r.top >= 0) {
            m.style.transition = "none";
            delete m.dataset.show;
            void m.offsetHeight;
            m.style.transition = "";
        }
        if (show) m.dataset.show = "true";
        else delete m.dataset.show;

        f.toggleAttribute("data-under-bar", show); // only one shadow at a time
        m.setAttribute("aria-hidden", String(!show));
        const button = m.querySelector("button");
        if (button) button.tabIndex = show ? 0 : -1;
    }

    /** Opens the box as a floating panel at the top of the screen */
    function undock() {
        const f = box.current;
        const sp = space.current;
        if (!f || !sp) return;
        const l = live.current;

        if (l.collapsed) {
            const h0 = f.offsetHeight;
            const y0 = window.scrollY;
            l.busy = true;
            flushSync(() => setCollapsed(false));
            l.collapsed = false;
            l.busy = false;
            const dh = f.offsetHeight - h0;
            window.scrollTo(0, y0 + dh);
            l.lastY = y0 + dh;
        }

        // A placeholder keeps the box's place in the page while it floats
        sp.style.height = f.offsetHeight + "px";
        flushSync(() => setFloating(true));
        l.floating = true;
        if (minibar.current) delete minibar.current.dataset.show;

        if (!reducedMotion()) {
            f.animate(
                [
                    { transform: "translateY(-24px)", opacity: 0 },
                    { transform: "none", opacity: 1 },
                ],
                {
                    duration: 450,
                    easing: EASE,
                },
            );
        }
    }

    function dock() {
        live.current.floating = false;
        setFloating(false);
        if (space.current) space.current.style.height = "";
    }

    /** The + / − button: folds or unfolds the box, turning the plus into a minus with a little spin */
    function toggleCollapse() {
        const nowClosed = !live.current.collapsed;
        flushSync(() => setCollapsed(nowClosed));
        live.current.collapsed = nowClosed;

        const f = box.current;
        const chev = f?.querySelector(
            nowClosed
                ? `.${styles.mini} .${styles.chev}`
                : `.${styles.collapse} .${styles.chev}`,
        );
        if (chev && !reducedMotion()) {
            const timing = { duration: 420, easing: EASE };
            chev.animate(
                nowClosed
                    ? [
                          { transform: "rotate(-90deg)" },
                          { transform: "rotate(0deg)" },
                      ]
                    : [
                          { transform: "rotate(90deg)" },
                          { transform: "rotate(0deg)" },
                      ],
                timing,
            );
            chev.querySelector(`.${styles.pv}`)?.animate(
                nowClosed
                    ? [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }]
                    : [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }],
                timing,
            );
        }
        f?.querySelector<HTMLElement>(
            nowClosed ? `.${styles.mini}` : `.${styles.collapse}`,
        )?.focus({ preventScroll: true });
    }

    /** The fold button: while floating it closes the panel, otherwise it folds or unfolds the box */
    function onCollapseClick() {
        if (live.current.floating) {
            dock();
            live.current.up = true;
            live.current.lastY = window.scrollY;
            syncMinibar();
            return;
        }
        toggleCollapse();
    }

    // Scroll listeners for the phone behaviour
    useEffect(() => {
        live.current.lastY = window.scrollY;
        const onScroll = () => requestAnimationFrame(syncMinibar);
        const onScrollEnd = () => {
            window.clearTimeout(live.current.timer);
            foldAway();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("scrollend", onScrollEnd);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("scrollend", onScrollEnd);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the minibar in step after every change
    useEffect(() => {
        syncMinibar();
    });

    // The one-line summary: in the folded box, and in the minibar
    const area = props.m2ToHeat ? Math.round(props.m2ToHeat * 10) / 10 : null;
    const miniContent = (
        <>
            <Icon name="sliders" />
            <span className={styles.miniText}>
                <span className={styles.miniTitle}>
                    Your home · step {stepIndex} of {totalSteps}
                </span>
                <span className={styles.miniSub}>
                    {props.showingFires
                        ? `${area} m² · ${props.bestCount} best, ${props.moreCount} more`
                        : area
                          ? `${area} m² · fires at step ${props.firesAtStep}`
                          : "Add location and room"}
                    <span className={styles.ftags}>
                        {(props.fuels.length
                            ? props.fuels
                            : (["gas", "wood", "electric"] as const)
                        ).map((f) => (
                            <span key={f} className={styles.ftag}>
                                <i className={`${styles.fdot} ${styles[f]}`} />
                                {FUEL_NAMES[f]}
                            </span>
                        ))}
                    </span>
                </span>
            </span>
            <span className={styles.chevBox}>
                <span className={styles.chev}>
                    <PlusMinus
                        className={styles.pm}
                        verticalClassName={styles.pv}
                    />
                </span>
            </span>
        </>
    );

    const boxClass = [
        styles.box,
        collapsed && styles.collapsed,
        floating && styles.floating,
    ]
        .filter(Boolean)
        .join(" ");

    const REQUIRED_MESSAGES: Record<number, string> = {
        1: "Choose your country, add your postcode and answer both questions to continue.",
        2: "Add the room’s width and depth to continue.",
    };

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

    return (
        <>
            {/* Phones: keeps the box's place in the page while it floats */}
            <div ref={space} hidden={!floating} />

            <aside ref={box} className={boxClass} data-filters>
                {/* Phones: the box folded into one line. Tap to unfold */}
                <button
                    type="button"
                    className={styles.mini}
                    aria-expanded="false"
                    onClick={onCollapseClick}
                >
                    {miniContent}
                </button>

                {/* ---------- Head: which step, and the arrows ---------- */}
                <div className={styles.head}>
                    <div className={styles.title}>
                        <small>
                            Step {stepIndex} of {totalSteps}
                        </small>
                        <strong>{stepTitles[stepIndex - 1]}</strong>
                    </div>
                    <button
                        type="button"
                        className={styles.ib}
                        aria-label="Previous step"
                        disabled={stepIndex === 1}
                        onClick={() => setStepIndex((prev) => prev - 1)}
                    >
                        <Icon name="arrowLeft" />
                    </button>
                    <button
                        type="button"
                        className={`${styles.ib} ${styles.dark}`}
                        aria-label="Next step"
                        data-next
                        disabled={
                            stepIndex === props.questionCategories.length + 2
                        }
                        onClick={() => goTo(stepIndex + 1)}
                    >
                        <Icon name="arrowRight" />
                    </button>
                    {/* Phones only: fold the box into one line */}
                    <button
                        type="button"
                        className={`${styles.ib} ${styles.ghost} ${styles.collapse}`}
                        aria-label="Minimise filters"
                        aria-expanded="true"
                        onClick={onCollapseClick}
                    >
                        <span className={`${styles.chev} ${styles.open}`}>
                            <PlusMinus
                                className={styles.pm}
                                verticalClassName={styles.pv}
                            />
                        </span>
                    </button>
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
                                i + 1 < stepIndex
                                    ? styles.done
                                    : i + 1 === stepIndex
                                      ? styles.now
                                      : undefined
                            }
                            data-todo={
                                props.todoSteps.includes(i + 1) || undefined
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
                <div className={styles.body}>
                    {nudgeMissing.length > 0 && (
                        <p className={styles.required} role="alert">
                            {REQUIRED_MESSAGES[stepIndex] ??
                                "Answer every question to continue."}
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
                                <span className={styles.label}>Country</span>
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

                            <label
                                className={
                                    needs("postcode")
                                        ? `${styles.field} ${styles.need}`
                                        : styles.field
                                }
                                data-need={needs("postcode") || undefined}
                            >
                                <span className={styles.label}>
                                    Postcode{" "}
                                    <span className={styles.optTag}>
                                        (enough for your climate zone)
                                    </span>
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    value={postcode}
                                    onChange={handlePostcodeChange}
                                />
                            </label>
                            <p className={styles.hint}>{postcodeHint}</p>

                            <label className={styles.field}>
                                <span className={styles.label}>
                                    Address{" "}
                                    <span className={styles.optTag}>
                                        (street, to check local rules)
                                    </span>
                                </span>
                                {/* Until the address is found, say so here, where it can be fixed */}
                                {props.location && !props.location.precise && (
                                    <p className={styles.warn}>
                                        {locationMessage(props.location)}
                                    </p>
                                )}
                                <input
                                    type="text"
                                    autoComplete="address-line1"
                                    placeholder="12 Example Street"
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
                                    needs("replacing")
                                        ? `${styles.question} ${styles.need}`
                                        : styles.question
                                }
                                data-need={needs("replacing") || undefined}
                            >
                                <span className={styles.label}>
                                    Replacing an existing wood burner?
                                </span>
                                <div className={styles.options}>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            props.replacingExistingWoodBurner ===
                                            true
                                        }
                                        onClick={() =>
                                            props.setReplacingExistingWoodBurner(
                                                true,
                                            )
                                        }
                                    >
                                        Yes
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={
                                            props.replacingExistingWoodBurner ===
                                            false
                                        }
                                        onClick={() =>
                                            props.setReplacingExistingWoodBurner(
                                                false,
                                            )
                                        }
                                    >
                                        No
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/** Step 2 */}
                    {stepIndex === 2 && (
                        <div className={styles.stepBody}>
                            <div className={styles.row}>
                                <label
                                    className={
                                        needs("room") && width == null
                                            ? `${styles.field} ${styles.need}`
                                            : styles.field
                                    }
                                    data-need={
                                        (needs("room") && width == null) ||
                                        undefined
                                    }
                                >
                                    <span className={styles.label}>
                                        Width (m)
                                    </span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step={0.1}
                                        value={width ?? ""}
                                        onChange={(e) =>
                                            updateRoom(
                                                toNumber(e.target.value),
                                                depth,
                                                openArea,
                                            )
                                        }
                                    />
                                </label>

                                <label
                                    className={
                                        needs("room") && depth == null
                                            ? `${styles.field} ${styles.need}`
                                            : styles.field
                                    }
                                    data-need={
                                        (needs("room") && depth == null) ||
                                        undefined
                                    }
                                >
                                    <span className={styles.label}>
                                        Depth (m)
                                    </span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step={0.1}
                                        value={depth ?? ""}
                                        onChange={(e) =>
                                            updateRoom(
                                                width,
                                                toNumber(e.target.value),
                                                openArea,
                                            )
                                        }
                                    />
                                </label>
                            </div>

                            <label className={styles.field}>
                                <span className={styles.label}>
                                    Adjoining open area (m²){" "}
                                    <span className={styles.optTag}>
                                        (optional)
                                    </span>
                                </span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    value={openArea ?? ""}
                                    onChange={(e) =>
                                        updateRoom(
                                            width,
                                            depth,
                                            toNumber(e.target.value),
                                        )
                                    }
                                />
                            </label>

                            <p className={styles.hint}>
                                {props.m2ToHeat ? (
                                    <>
                                        Total space to heat:{" "}
                                        <b>
                                            {Math.round(props.m2ToHeat * 10) /
                                                10}{" "}
                                            m²
                                        </b>
                                        .
                                    </>
                                ) : (
                                    "Add the room’s width and depth."
                                )}{" "}
                                The open area is space that stays open to the
                                room, like an open-plan kitchen.
                            </p>
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
                                onPropertyAnswer={(question, option) =>
                                    props.updatePropertyAnswers({
                                        [question.documentId]: {
                                            optionId: option.id,
                                            productProperty:
                                                question.productField,
                                            compareMethod:
                                                option.filterOperator,
                                            filterValue: option.filterValue,
                                            label: option.label,
                                            isPreference:
                                                props.questionCategories[
                                                    stepIndex - 3
                                                ].isPreferenceCategory ?? false,
                                        },
                                    })
                                }
                                onPropertyNumber={(question, value) =>
                                    props.updatePropertyAnswers({
                                        [question.documentId]: {
                                            optionId: null, // no button was chosen
                                            productProperty:
                                                question.productField,
                                            compareMethod: question.operator, // the operator is on the question, not an option
                                            filterValue: value, // the typed number, or null if the field is empty
                                            label:
                                                value != null
                                                    ? `${value}${question.unit ? " " + question.unit : ""}`
                                                    : "",
                                            isPreference:
                                                props.questionCategories[
                                                    stepIndex - 3
                                                ].isPreferenceCategory ?? false,
                                        },
                                    })
                                }
                                removeAnswers={props.removeAnswers}
                                missingIds={nudgeMissing}
                            />
                        </div>
                    )}
                </div>

                {/* ---------- Foot: how many fires, and start again ---------- */}
                <div className={styles.foot}>
                    <span>
                        {props.showingFires ? (
                            <>
                                <b>{props.bestCount} recommendations</b>
                                {props.moreCount > 0
                                    ? ` · ${props.moreCount} you might also like`
                                    : null}
                            </>
                        ) : (
                            `Your fires show at step ${props.firesAtStep}`
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

            {/* Phones: slides down from the top when scrolling back up. Tap to open the box */}
            <div
                ref={minibar}
                className={styles.minibar}
                aria-hidden="true"
                data-filters
            >
                <button
                    type="button"
                    className={styles.mini}
                    tabIndex={-1}
                    aria-label="Show filters"
                    onClick={undock}
                >
                    {miniContent}
                </button>
            </div>
        </>
    );
}
