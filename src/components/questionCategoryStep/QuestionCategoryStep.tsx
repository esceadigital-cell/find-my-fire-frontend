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
    onPropertyAnswer: (
        question: PropertyQuestion,
        option: PropertyOption,
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
        option: { key: string | null },
    ) {
        const hidden = (question.followUps ?? [])
            .filter((f) => !option.key || f.showIfKey !== option.key)
            .map((f) => f.documentId);
        if (hidden.length) props.removeAnswers(hidden);
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
                        value={answer?.filterValue ?? ""}
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

        // Heating answers store the option id directly; property answers store it in optionId
        const chosenId =
            item.kind === "heating"
                ? props.heatingAnswers[item.question.documentId]?.optionId
                : props.propertyAnswers[item.question.documentId]?.optionId;

        const chosen = item.question.options.find(
            (option) => option.id === chosenId,
        );

        // Follow-ups only show if the chosen answer has the key they wait for
        const openFollowUps = (item.question.followUps ?? []).filter(
            (f) => chosen?.key && f.showIfKey === chosen.key,
        );

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
                <span className={styles.label}>{item.question.text}</span>

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
                            aria-pressed={chosenId === option.id}
                            onClick={() => {
                                hideFollowUps(item.question, option);
                                item.kind === "heating"
                                    ? props.onHeatingAnswer(
                                          item.question,
                                          option as HeatingOption,
                                      )
                                    : props.onPropertyAnswer(
                                          item.question,
                                          option as PropertyOption,
                                      );
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
