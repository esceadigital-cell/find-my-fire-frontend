"use client";

import styles from "./SideBar.module.scss";
import {
    HeatingAnswers,
    LocationData,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useEffect, useRef, useState } from "react";
import LocationMap from "../locationMap/LocationMap";
import QuestionCategoryStep from "../questionCategoryStep/QuestionCategoryStep";
import Icon from "../icon/Icon";
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
    const [postcodeError, setPostcodeError] = useState<string | null>(null);

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
            setPostcodeError(
                res.status === 404
                    ? `We can’t find ${postcode} in ${country === "NZ" ? "New Zealand" : "Australia"}. Check the number.`
                    : "Something went wrong looking up the postcode. Try again.",
            );
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
        setPostcodeError(null);

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
    const missing = (step: number) =>
        isRequiredStep(step, progress) ? missingInStep(step, progress) : [];

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

    // Open a step when asked from outside (the hint's "Go to step")
    useEffect(() => {
        if (props.stepRequest) goTo(props.stepRequest.step);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.stepRequest]);

    const REQUIRED_MESSAGES: Record<number, string> = {
        1: "Add your postcode and answer both questions to continue.",
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
        <aside ref={box} className={styles.box}>
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
                    disabled={stepIndex === props.questionCategories.length + 2}
                    onClick={() => goTo(stepIndex + 1)}
                >
                    <Icon name="arrowRight" />
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
                        data-todo={props.todoSteps.includes(i + 1) || undefined}
                        aria-label={`Step ${i + 1}: ${title}`}
                        aria-current={i + 1 === stepIndex ? "step" : undefined}
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
                        <div className={styles.question}>
                            <span className={styles.label}>Country</span>
                            {askedForCountry && country === null && (
                                <p className={styles.warn} role="alert">
                                    Choose a country
                                </p>
                            )}
                            <div className={styles.options}>
                                <button
                                    type="button"
                                    aria-pressed={country === "NZ"}
                                    onClick={() => handleCountryChange("NZ")}
                                >
                                    New Zealand
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={country === "AU"}
                                    onClick={() => handleCountryChange("AU")}
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
                        {postcodeError ? (
                            <p className={styles.warn} role="alert">
                                {postcodeError}
                            </p>
                        ) : (
                            <p className={styles.hint}>{postcodeHint}</p>
                        )}

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
                            <span className={styles.label}>Property size</span>
                            <div className={styles.options}>
                                <button
                                    type="button"
                                    aria-pressed={
                                        props.propertyOver2Hectares === false
                                    }
                                    onClick={() =>
                                        props.setPropertyOver2Hectares(false)
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
                                <span className={styles.label}>Width (m)</span>
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
                                <span className={styles.label}>Depth (m)</span>
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
                                        {Math.round(props.m2ToHeat * 10) / 10}{" "}
                                        m²
                                    </b>
                                    .
                                </>
                            ) : (
                                "Add the room’s width and depth."
                            )}{" "}
                            The open area is space that stays open to the room,
                            like an open-plan kitchen.
                        </p>
                    </div>
                )}

                {/** All other steps (every question category) */}
                {stepIndex > 2 && (
                    <div className={styles.stepBody}>
                        <QuestionCategoryStep
                            category={props.questionCategories[stepIndex - 3]}
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
                                        productProperty: question.productField,
                                        compareMethod: option.filterOperator,
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
                                        productProperty: question.productField,
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
                            <b>{props.bestCount} best</b> · {props.moreCount}{" "}
                            more ideas
                        </>
                    ) : (
                        `Your fires show at step ${props.firesAtStep}`
                    )}
                </span>
                <button type="button" onClick={() => window.location.reload()}>
                    Start again
                </button>
            </div>
        </aside>
    );
}
