import { notFound } from "next/navigation";
import FireFinderPage from "@/components/fireFinderPage/FireFinderPage";
import {
    getBrands,
    getHeatDemandQuestions,
    getProducts,
    getQuestionCategories,
} from "@/lib/api";

// A brand's own page, e.g. /stoke or /escea: only that brand's fires, and its links.
// The brand sites embed this page in an iframe.
export default async function BrandPage(props: {
    params: Promise<{ brand: string }>;
}) {
    const { brand: slug } = await props.params;

    const brands = await getBrands();
    const brand = brands.find((b) => b.slug === slug);
    if (!brand) notFound(); // e.g. /abc

    const products = await getProducts(brand.slug);
    const questionCategories = await getQuestionCategories();
    const heatDemandQuestions = await getHeatDemandQuestions();

    return (
        <FireFinderPage
            products={products}
            questionCategories={questionCategories}
            brand={brand}
            heatDemandQuestions={heatDemandQuestions}
        />
    );
}
