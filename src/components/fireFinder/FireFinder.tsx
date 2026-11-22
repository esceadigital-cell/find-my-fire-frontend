"use client";

import styles from "./FireFinder.module.scss";
import {
    Brand,
    HeatingAnswers,
    HeatingQuestion,
    LocationData,
    Product,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import SideBar from "../SideBar/SideBar";
import Results from "../results/Results";
import HintToast from "../hintToast/HintToast";
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

    // The categories without the step 2 questions (those are asked in step 2, not in a category).
    // A category left with no questions is left out, so there's no empty step.
    const questionCategories = useMemo(
        () =>
            props.questionCategories
                .map((c) => ({
                    ...c,
                    heatingQuestions: c.heatingQuestions.filter(
                        (q) => q.isDependingOnHeatDemand !== true,
                    ),
                }))
                .filter(
                    (c) =>
                        c.heatingQuestions.length + c.propertyQuestions.length >
                        0,
                ),
        [props.questionCategories],
    );

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
    const onStepChange = useCallback((s: number) => {
        setStep(s);
        setFurthestStep((prev) => Math.max(prev, s));
    }, []);

    const firesAt = firesAtStep(questionCategories);
    const totalSteps = props.questionCategories.length + 2;
    const showFires =
        result.kwNeeded !== null &&
        (furthestStep >= firesAt || furthestStep === totalSteps);

    // ---------- The hint: "Answer 2 more steps for better recommendations" ----------
    // Shown when a fire is clicked (or ticked for comparing) while questions are still unanswered.
    // Once per step the user is on, so it doesn't nag.

    const [hint, setHint] = useState<number[] | null>(null); // the steps it lists, or null when closed
    const [hintedOnStep, setHintedOnStep] = useState<number[]>([]);
    const [stepRequest, setStepRequest] = useState<{
        step: number;
        count: number;
    } | null>(null);

    /** Returns true if the hint was shown (the click shouldn't go on to open the fire) */
    function maybeShowHint() {
        if (hint || hintedOnStep.includes(step)) return false;
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
        if (!left.length) return false;
        setHintedOnStep([...hintedOnStep, step]);
        setHint(left);
        return true;
    }

    function goToStep(target: number) {
        setHint(null);
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
        <div className={styles.wrapper}>
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
                todoSteps={hint ?? []}
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
                showFires={showFires}
                firesAt={{
                    step: firesAt,
                    title: stepTitles[firesAt - 1] ?? "",
                }}
                brand={props.brand}
                onBeforeOpen={maybeShowHint}
            />

            {hint && (
                <HintToast
                    steps={hint.map((s) => ({
                        step: s,
                        title: stepTitles[s - 1],
                    }))}
                    currentStep={step}
                    onGo={goToStep}
                    onClose={() => setHint(null)}
                />
            )}
        </div>
    );
}
