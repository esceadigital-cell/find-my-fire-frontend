import FireFinderPage from "@/components/fireFinderPage/FireFinderPage";
import {
    getHeatDemandQuestions,
    getProducts,
    getQuestionCategories,
} from "@/lib/api";

// The main page: every brand's fires
export default async function Home() {
    const allProducts = await getProducts();
    const questionCategories = await getQuestionCategories();
    const heatDemandQuestions = await getHeatDemandQuestions();

    return (
        <FireFinderPage
            products={allProducts}
            questionCategories={questionCategories}
            heatDemandQuestions={heatDemandQuestions}
        />
    );
}
