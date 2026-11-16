import FireFinderPage from "@/components/fireFinderPage/FireFinderPage";
import { getProducts, getQuestionCategories } from "@/lib/api";

// The main page: every brand's fires
export default async function Home() {
    const allProducts = await getProducts();
    const questionCategories = await getQuestionCategories();

    return (
        <FireFinderPage
            products={allProducts}
            questionCategories={questionCategories}
        />
    );
}
