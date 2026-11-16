// Which questions are on screen, and which of them haven't been answered yet.
// Only used to show things (the required check before Next, and the hint) — it never changes an answer.
//
// It follows the same rule as QuestionCategoryStep: a follow-up is shown when the chosen
// option of its main question has the key the follow-up waits for (showIfKey).

import {
    HeatingAnswers,
    HeatingQuestion,
    LocationData,
    PropertyAnswers,
    PropertyQuestion,
    QuestionCategory,
} from "@/types";

export type Progress = {
    location: LocationData | null;
    m2ToHeat: number | null;
    propertyOver2Hectares: boolean | null;
    replacingExistingWoodBurner: boolean | null;
    heatingAnswers: HeatingAnswers;
    propertyAnswers: PropertyAnswers;
    questionCategories: QuestionCategory[];
};

type Question = HeatingQuestion | PropertyQuestion;

/** Has this question got an answer? */
function isAnswered(
    question: Question,
    kind: "heating" | "property",
    p: Progress,
) {
    if (kind === "heating")
        return p.heatingAnswers[question.documentId] != null;
    const answer = p.propertyAnswers[question.documentId];
    if (!answer) return false;
    // A number question is answered when a number is typed, a button question when an option is chosen
    return (question as PropertyQuestion).inputOption === "number"
        ? answer.filterValue != null
        : answer.optionId != null;
}

/** The chosen option's key, used to open follow-ups */
function chosenKey(
    question: Question,
    kind: "heating" | "property",
    p: Progress,
) {
    const optionId =
        kind === "heating"
            ? p.heatingAnswers[question.documentId]?.optionId
            : p.propertyAnswers[question.documentId]?.optionId;
    return question.options.find((o) => o.id === optionId)?.key ?? null;
}

/** The ids of the questions on screen in a category that haven't been answered */
export function unansweredIn(
    category: QuestionCategory,
    p: Progress,
): string[] {
    const all: { kind: "heating" | "property"; question: Question }[] = [
        ...category.heatingQuestions.map((question) => ({
            kind: "heating" as const,
            question,
        })),
        ...category.propertyQuestions.map((question) => ({
            kind: "property" as const,
            question,
        })),
    ];
    const followUpIds = new Set(
        all.flatMap((q) =>
            (q.question.followUps ?? []).map((f) => f.documentId),
        ),
    );

    const missing: string[] = [];
    function check(kind: "heating" | "property", question: Question) {
        if (!isAnswered(question, kind, p)) missing.push(question.documentId);
        const key = chosenKey(question, kind, p);
        for (const f of question.followUps ?? []) {
            if (key && f.showIfKey === key) check(kind, f);
        }
    }
    for (const q of all)
        if (!followUpIds.has(q.question.documentId)) check(q.kind, q.question);
    return missing;
}

/**
 * What's still missing in a step (numbered from 1, like the sidebar):
 * field names in steps 1 and 2, question ids in a category.
 */
export function missingInStep(step: number, p: Progress): string[] {
    if (step === 1) {
        return [
            !p.location && "postcode",
            p.propertyOver2Hectares === null && "propertySize",
            p.replacingExistingWoodBurner === null && "replacing",
        ].filter((x): x is string => !!x);
    }
    if (step === 2) return p.m2ToHeat ? [] : ["room"];
    const category = p.questionCategories[step - 3];
    return category ? unansweredIn(category, p) : [];
}

/** Is a step required? Steps 1 and 2 are, and every category that isn't a preference category. */
export function isRequiredStep(step: number, p: Progress) {
    if (step <= 2) return true;
    return !p.questionCategories[step - 3]?.isPreferenceCategory;
}

/** The step where the fires start showing: the first preference category, or step 3 if there are none */
export function firesAtStep(categories: QuestionCategory[]) {
    const first = categories.findIndex((c) => c.isPreferenceCategory);
    return first >= 0 ? first + 3 : 3;
}

/** All steps (numbered from 1) that still have unanswered questions, for the hint */
export function stepsWithUnanswered(p: Progress): number[] {
    const total = p.questionCategories.length + 2;
    const steps: number[] = [];
    for (let step = 1; step <= total; step++)
        if (missingInStep(step, p).length) steps.push(step);
    return steps;
}
