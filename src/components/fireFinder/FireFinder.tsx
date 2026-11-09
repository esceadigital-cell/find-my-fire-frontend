"use client";

import styles from "./FireFinder.module.scss";
import {
    HeatingAnswers,
    LocationData,
    Product,
    PropertyAnswers,
    QuestionCategory,
} from "@/types";
import { useState } from "react";
import SideBar from "../SideBar/SideBar";
import Results from "../results/Results";

interface FireFinderProps {
    products: Product[];
    questionCategories: QuestionCategory[];
}

export default function FireFinder(props: FireFinderProps) {
    const [locationData, setLocationData] = useState<LocationData | null>(null);
    const [m2ToHeat, setM2ToHeat] = useState<number | null>(null);
    const [heatingAnswers, setHeatingAnswers] = useState<HeatingAnswers>({});
    const [propertyAnswers, setPropertyAnswers] = useState<PropertyAnswers>({});
    const [propertyOver2Hectares, setPropertyOver2Hectares] = useState<
        boolean | null
    >(null);
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

    console.log(
        "FINAL RESULTS: ",
        locationData,
        m2ToHeat,
        heatingAnswers,
        propertyAnswers,
    );

    return (
        <div className={styles.wrapper}>
            <SideBar
                questionCategories={props.questionCategories}
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
            />

            <Results />
        </div>
    );
}
