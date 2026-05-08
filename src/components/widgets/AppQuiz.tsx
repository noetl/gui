import React, { useState } from "react";
import { Radio, Button, Space } from "antd";
import type { AppQuizArgs, OnWidgetEvent, WidgetProps } from "./types";

// chatui's AppQuiz: multi-question quiz with radio answers. Emits
// onQuizAnswer(questionId, answerId) on each pick and onFinishQuiz when
// the user clicks the finish button after answering everything.
export function AppQuiz({ args, onWidgetEvent }: WidgetProps<AppQuizArgs> & { onWidgetEvent?: OnWidgetEvent }) {
  const { questionWidth, finishText = "Finish", questions = [] } = args || ({} as AppQuizArgs);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const ready = questions.every((question) => selections[question.questionId]);

  return (
    <div className="noetl-widget noetl-widget-quiz" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {questions.map((question) => (
        <div
          key={question.questionId}
          style={{ width: questionWidth ? `${questionWidth}px` : undefined, padding: 8, border: "1px solid var(--noetl-border, #e5e7eb)", borderRadius: 6 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{question.questionText}</div>
          <Radio.Group
            value={selections[question.questionId]}
            onChange={(event) => {
              const answerId = event.target.value;
              setSelections((current) => ({ ...current, [question.questionId]: answerId }));
              if (onWidgetEvent) {
                onWidgetEvent({
                  event: "onQuizAnswer",
                  key: "quizSelection",
                  value: `questionId: ${question.questionId}, answerId: ${answerId}`,
                });
              }
            }}
          >
            <Space direction="vertical">
              {question.answers.map((answer) => (
                <Radio key={answer.answerId} value={answer.answerId}>
                  {answer.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
      ))}
      <Button
        type="primary"
        disabled={!ready}
        onClick={() => {
          if (!onWidgetEvent) return;
          onWidgetEvent({ event: "onFinishQuiz", key: "quizSelectionFinished", value: "finished: true" });
        }}
      >
        {finishText}
      </Button>
    </div>
  );
}
