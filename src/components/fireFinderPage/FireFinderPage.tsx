import FireFinder from "../fireFinder/FireFinder";
import styles from "./FireFinderPage.module.scss";
import { Brand, HeatingQuestion, Product, QuestionCategory } from "@/types";

interface FireFinderPageProps {
    products: Product[];
    questionCategories: QuestionCategory[];
    /** on a brand's own page (e.g. /stoke): that brand */
    brand?: Brand;
    heatDemandQuestions: HeatingQuestion[];
}

/** The whole page: the intro and the fire finder. Used by the main page and the brand pages. */
export default function FireFinderPage(props: FireFinderPageProps) {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                {/* data-intro: Results measures this when the intro shrinks into the left column */}
                <section className={styles.intro} data-intro>
                    <div>
                        <h1 className={styles.title}>Find your Fireplace</h1>
                    </div>
                    <p className={styles.lede}>
                        Answer a few questions and find the fireplaces best for
                        your home.
                    </p>
                </section>

                <FireFinder
                    products={props.products}
                    questionCategories={props.questionCategories}
                    brand={props.brand}
                    heatDemandQuestions={props.heatDemandQuestions}
                />
            </main>
        </div>
    );
}
