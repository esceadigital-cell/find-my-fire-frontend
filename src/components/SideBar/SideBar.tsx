"use client";

import styles from "./SideBar.module.scss";
import {
    HeatingAnswers,
    LocationData,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useState } from "react";
import LocationMap from "../locationMap/LocationMap";
import QuestionCategoryStep from "../questionCategoryStep/QuestionCategoryStep";

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
            if (!country) return alert("Choose country");
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

    return (
        <div className={styles.sidebar}>
            <h2>Steps</h2>
            <div className={styles.nav}>
                <button
                    disabled={stepIndex === 1}
                    onClick={() => setStepIndex((prev) => prev - 1)}
                >
                    Prev step
                </button>
                <button
                    disabled={stepIndex === props.questionCategories.length + 2}
                    onClick={() => setStepIndex((prev) => prev + 1)}
                >
                    Next step
                </button>
            </div>

            {/** Step 1 */}
            {stepIndex === 1 && (
                <div className={styles.stepWrapper}>
                    <h3>Your location</h3>
                    <div>
                        <p>Country</p>
                        <button
                            type="button"
                            aria-pressed={country === "NZ"}
                            onClick={() => handleCountryChange("NZ")}
                        >
                            NZ
                        </button>
                        <button
                            type="button"
                            aria-pressed={country === "AU"}
                            onClick={() => handleCountryChange("AU")}
                        >
                            AU
                        </button>
                    </div>
                    <label>
                        Postcode
                        <input
                            type="text"
                            inputMode="numeric"
                            value={postcode}
                            onChange={handlePostcodeChange}
                        />
                    </label>
                    <label>
                        Address
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
                    {/*props.location && (
                        <p className={styles.hint}>
                            {locationMessage(props.location)}
                        </p>
                    )*/}
                    {props.location && country && (
                        <LocationMap
                            lat={props.location.lat}
                            lng={props.location.lng}
                            zones={props.location.nearby}
                            caption={locationMessage(props.location)}
                            onMove={(lat, lng) =>
                                lookUp(country, postcode, street, { lat, lng })
                            }
                        />
                    )}
                    <div>
                        <p>Property size</p>
                        <button
                            type="button"
                            aria-pressed={props.propertyOver2Hectares === false}
                            onClick={() =>
                                props.setPropertyOver2Hectares(false)
                            }
                        >
                            Under 2 hectares
                        </button>
                        <button
                            type="button"
                            aria-pressed={props.propertyOver2Hectares === true}
                            onClick={() => props.setPropertyOver2Hectares(true)}
                        >
                            Over 2 hectares
                        </button>
                    </div>

                    <div>
                        <p>Are you replacing an existing wood burner?</p>
                        <button
                            type="button"
                            aria-pressed={
                                props.replacingExistingWoodBurner === true
                            }
                            onClick={() =>
                                props.setReplacingExistingWoodBurner(true)
                            }
                        >
                            Yes
                        </button>
                        <button
                            type="button"
                            aria-pressed={
                                props.replacingExistingWoodBurner === false
                            }
                            onClick={() =>
                                props.setReplacingExistingWoodBurner(false)
                            }
                        >
                            No
                        </button>
                    </div>
                </div>
            )}

            {/** Step 2 */}
            {stepIndex === 2 && (
                <div className={styles.stepWrapper}>
                    <h3>Your space to heat</h3>

                    <label>
                        Width (m)
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

                    <label>
                        Depth (m)
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

                    <label>
                        Adjoining open area (m²), optional
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
                        {props.m2ToHeat
                            ? `Total space to heat: ${props.m2ToHeat} m²`
                            : "Add the room's width and depth."}{" "}
                        The open area is space that stays open to the room, like
                        an open-plan kitchen.
                    </p>
                </div>
            )}

            {/** All other steps (every question category) */}
            {stepIndex > 2 && (
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
                            },
                        })
                    }
                    removeAnswers={props.removeAnswers}
                />
            )}
        </div>
    );
}
