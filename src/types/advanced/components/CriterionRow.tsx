import { Button, Tooltip } from "antd";
import { CloseOutlined, StopOutlined, WarningOutlined } from "@ant-design/icons";
import type { Criterion } from "../model";
import "./run-parts.css";

/**
 * One question during a run.
 *
 * The answers are rendered as a row of real buttons rather than AntD's
 * Segmented. Segmented is the right *shape* but the wrong control here: it has
 * no unselected state to return to (so Skip has nowhere to live), it truncates
 * long option labels instead of wrapping them, and it cannot carry a per-option
 * dealbreaker marker. Hand-rolled buttons keep the one-tap promise while
 * supporting all three.
 *
 * No dropdowns anywhere. A dropdown costs two interactions and hides the
 * choices, and the choices are what the operator is reading off the screen.
 */
export function CriterionRow({
  criterion,
  index,
  selectedOptionId,
  onAnswer,
  disabled = false,
}: {
  criterion: Criterion;
  index: number;
  selectedOptionId: string | null;
  onAnswer: (optionId: string | null) => void;
  disabled?: boolean;
}) {
  const selected = criterion.options.find((o) => o.id === selectedOptionId) ?? null;
  const answered = selected !== null;

  return (
    <div className="dl-qrow" data-answered={answered} data-dq={!!selected?.disqualifies}>
      <div className="dl-qrow-head">
        <span className="dl-qrow-num" aria-hidden="true">
          {index + 1}
        </span>
        <div className="dl-qrow-text">
          <h3 className="dl-qrow-label">{criterion.label.trim() || "Untitled question"}</h3>
          {criterion.hint?.trim() && <p className="dl-qrow-hint">{criterion.hint}</p>}
        </div>
        {answered && !disabled && (
          <Tooltip title="Clear this answer">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => onAnswer(null)}
              aria-label={`Clear answer for ${criterion.label}`}
              className="dl-qrow-clear"
            />
          </Tooltip>
        )}
      </div>

      <div className="dl-qrow-options" role="group" aria-label={criterion.label}>
        {criterion.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              className="dl-answer"
              data-selected={isSelected}
              data-dq={!!option.disqualifies}
              data-block={!!option.blocks}
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onAnswer(isSelected ? null : option.id)}
            >
              <span className="dl-answer-label">{option.label.trim() || "—"}</span>
              {/* The two flags are marked on the option itself, so the operator
                  can see the dealbreaker coming before tapping it. */}
              {option.disqualifies && (
                <StopOutlined className="dl-answer-flag" data-kind="dq" aria-label="Ends the decision" />
              )}
              {option.blocks && !option.disqualifies && (
                <WarningOutlined className="dl-answer-flag" data-kind="block" aria-label="Raises a condition" />
              )}
            </button>
          );
        })}
      </div>

      {/* Skipping is normal and gets a real, labelled affordance rather than
          being implied by "just don't tap anything" — an unanswered question is
          ambiguous between "not asked yet" and "deliberately passed". */}
      {!answered && !disabled && <div className="dl-qrow-skip">Not asked yet — skip it and come back</div>}
    </div>
  );
}
