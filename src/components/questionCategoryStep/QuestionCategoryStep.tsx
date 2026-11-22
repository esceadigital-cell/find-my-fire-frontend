import styles from "./QuestionCategoryStep.module.scss";
import {
    HeatingAnswers,
    HeatingOption,
    HeatingQuestion,
    PropertyAnswers,
    PropertyOption,
    PropertyQuestion,
    QuestionCategory,
} from "@/types";

interface QuestionCategoryStepProps {
    category: QuestionCategory;
    heatingAnswers: HeatingAnswers;
    propertyAnswers: PropertyAnswers;
    onHeatingAnswer: (question: HeatingQuestion, option: HeatingOption) => void;
    /** the chosen options: one for single-choice questions, one or more with allowMultipleAnswers */
    onPropertyAnswer: (
        question: PropertyQuestion,
        options: PropertyOption[],
    ) => void;
    onPropertyNumber: (
        question: PropertyQuestion,
        value: number | null,
    ) => void;
    removeAnswers: (questionIds: string[]) => void;
    /** Added: questions the user tried to skip in a required category (shown with an orange border) */
    missingIds?: string[];
}

// A question together with which kind it is, so both kinds can be listed together
type Item =
    | { kind: "heating"; question: HeatingQuestion }
    | { kind: "property"; question: PropertyQuestion };

export default function QuestionCategoryStep(props: QuestionCategoryStepProps) {
    // 1. Find the follow-ups, so they aren't also shown as main questions
    const followUpIds = new Set<string>();
    for (const q of [
        ...props.category.heatingQuestions,
        ...props.category.propertyQuestions,
    ]) {
        for (const f of q.followUps ?? []) followUpIds.add(f.documentId);
    }

    // 2. The main questions of both kinds, in one list sorted by order
    const mainQuestions: Item[] = [
        ...props.category.heatingQuestions.map((question) => ({
            kind: "heating" as const,
            question,
        })),
        ...props.category.propertyQuestions.map((question) => ({
            kind: "property" as const,
            question,
        })),
    ]
        .filter((item) => !followUpIds.has(item.question.documentId))
        .sort((a, b) => (a.question.order ?? 0) - (b.question.order ?? 0));

    // When an answer is chosen, the follow-ups waiting for a different key are hidden: remove their answers
    function hideFollowUps(
        question: HeatingQuestion | PropertyQuestion,
        keys: (string | null)[],
    ) {
        const hidden = (question.followUps ?? []).filter(
            (f) => !f.showIfKey || !keys.includes(f.showIfKey),
        );

        // The hidden follow-ups, and their follow-ups, all the way down
        const ids: string[] = [];
        const collect = (q: HeatingQuestion | PropertyQuestion) => {
            ids.push(q.documentId);
            (q.followUps ?? []).forEach(collect);
        };
        hidden.forEach(collect);

        if (ids.length) props.removeAnswers(ids);
    }

    /**
     * Clicking an option of a property question.
     * One answer: that option replaces the old one. Several answers (allowMultipleAnswers):
     * clicking an option adds it, clicking it again removes it.
     */
    function handlePropertyOptionClick(
        question: PropertyQuestion,
        option: PropertyOption,
        chosenIds: number[],
    ) {
        let ids: number[];
        if (!question.allowMultipleAnswers)
            ids = [option.id]; // one answer: overwrite
        else if (chosenIds.includes(option.id))
            ids = chosenIds.filter((id) => id !== option.id); // chosen: remove it
        else ids = [...chosenIds, option.id]; // not chosen: add it

        const chosen = question.options.filter((o) => ids.includes(o.id)); // in the question's own order
        hideFollowUps(
            question,
            chosen.map((o) => o.key),
        );
        if (chosen.length) props.onPropertyAnswer(question, chosen);
        else props.removeAnswers([question.documentId]); // nothing chosen: not answered
    }

    // 3. One question: its buttons, and below them the follow-ups that the chosen answer opens
    function renderQuestion(item: Item, isFollowUp: boolean) {
        // Number question: an input field instead of buttons
        if (
            item.kind === "property" &&
            item.question.inputOption === "number"
        ) {
            const question = item.question;
            const answer = props.propertyAnswers[question.documentId];

            return (
                <label
                    key={question.documentId}
                    className={[
                        styles.field,
                        isFollowUp && styles.followUp,
                        props.missingIds?.includes(question.documentId) &&
                            styles.need,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    data-need={
                        props.missingIds?.includes(question.documentId) ||
                        undefined
                    }
                >
                    <span className={styles.label}>
                        {question.text}
                        {question.unit && (
                            <span className={styles.optTag}>
                                {" "}
                                ({question.unit})
                            </span>
                        )}
                    </span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any" // decimals allowed, e.g. 1.8 (m)
                        value={answer?.chosen[0]?.filterValue ?? ""}
                        onChange={(e) =>
                            props.onPropertyNumber(
                                question,
                                e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                            )
                        }
                    />
                </label>
            );
        }
        // The chosen options: one for heating and single-choice questions, several with allowMultipleAnswers
        const chosenIds: number[] = (
            item.kind === "heating"
                ? [props.heatingAnswers[item.question.documentId]?.optionId]
                : (
                      props.propertyAnswers[item.question.documentId]?.chosen ??
                      []
                  ).map((c) => c.optionId)
        ).filter((id): id is number => id != null);

        const chosenKeys = item.question.options
            .filter((o) => chosenIds.includes(o.id))
            .map((o) => o.key);

        // Follow-ups show if any chosen option has the key they wait for
        const openFollowUps = (item.question.followUps ?? []).filter(
            (f) => f.showIfKey && chosenKeys.includes(f.showIfKey),
        );

        const multiple =
            item.kind === "property" && !!item.question.allowMultipleAnswers;

        return (
            <div
                key={item.question.documentId}
                className={[
                    styles.question,
                    isFollowUp && styles.followUp,
                    props.missingIds?.includes(item.question.documentId) &&
                        styles.need,
                ]
                    .filter(Boolean)
                    .join(" ")}
                data-need={
                    props.missingIds?.includes(item.question.documentId) ||
                    undefined
                }
            >
                <span className={styles.label}>
                    {item.question.text}
                    {multiple && (
                        <span className={styles.optTag}> (choose any)</span>
                    )}
                </span>

                {/* Five or more options are shown as a grid */}
                <div
                    className={
                        item.question.options.length >= 5
                            ? `${styles.options} ${styles.grid3}`
                            : styles.options
                    }
                >
                    {item.question.options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={chosenIds.includes(option.id)}
                            onClick={() => {
                                if (item.kind === "heating") {
                                    hideFollowUps(item.question, [option.key]);
                                    props.onHeatingAnswer(
                                        item.question,
                                        option as HeatingOption,
                                    );
                                } else {
                                    handlePropertyOptionClick(
                                        item.question,
                                        option as PropertyOption,
                                        chosenIds,
                                    );
                                }
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {openFollowUps.map((f) =>
                    renderQuestion(
                        { kind: item.kind, question: f } as Item,
                        true,
                    ),
                )}
            </div>
        );
    }

    // The category's name is shown in the filter box's header, so it isn't repeated here
    return (
        <div className={styles.step}>
            {mainQuestions.map((item) => renderQuestion(item, false))}
        </div>
    );
}
