import { Button, Input, Select, Tooltip } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import type { FormsAnswerValue } from "@/db/types";
import { DEFAULT_SCALE, type FormsQuestion } from "../model";
import "./run-row.css";

/**
 * One question during a run.
 *
 * Answers are real tap targets, one per line at phone width — the same
 * hand-rolled buttons `advanced` uses rather than AntD's Segmented, which
 * truncates long labels and has no unselected state to return to.
 *
 * No dropdowns for `choice` or `checkboxes`: a dropdown costs two interactions
 * and hides the choices, and the choices are what gets read off the screen. A
 * `dropdown` question is the one exception, because collapsing is the whole
 * reason the author picked that kind.
 */
export function QuestionRow({
  question,
  index,
  value,
  onAnswer,
  disabled = false,
  showRequired = false,
}: {
  question: FormsQuestion;
  /** Position among answerable questions. */
  index: number;
  value: FormsAnswerValue | undefined;
  onAnswer: (value: FormsAnswerValue | undefined) => void;
  disabled?: boolean;
  /** True once a finish attempt found this required question unanswered. */
  showRequired?: boolean;
}) {
  const answered =
    value !== undefined &&
    value !== null &&
    (typeof value === "string" ? value.trim() !== "" : Array.isArray(value) ? value.length > 0 : true);

  /* ---- Answer controls, one per kind ------------------------------------- */

  function renderChoice() {
    const selectedId = typeof value === "string" ? value : null;
    return (
      <div className="dl-frow-options" role="group" aria-label={question.label}>
        {question.options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              className="dl-fanswer"
              data-selected={isSelected}
              disabled={disabled}
              aria-pressed={isSelected}
              // Tapping the selected option again clears it. Skipping is
              // first-class here, same as `advanced`.
              onClick={() => onAnswer(isSelected ? undefined : option.id)}
            >
              <span className="dl-fanswer-mark" data-kind="choice" aria-hidden="true" />
              <span className="dl-fanswer-label">{option.label.trim() || "—"}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderCheckboxes() {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="dl-frow-options" role="group" aria-label={question.label}>
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="dl-fanswer"
              data-selected={isSelected}
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => {
                const next = isSelected
                  ? selected.filter((id) => id !== option.id)
                  : [...selected, option.id];
                // An empty array is "skipped", not "answered with nothing" —
                // it must not count toward the score's denominator.
                onAnswer(next.length > 0 ? next : undefined);
              }}
            >
              <span className="dl-fanswer-mark" data-kind="checkboxes" aria-hidden="true" />
              <span className="dl-fanswer-label">{option.label.trim() || "—"}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderDropdown() {
    return (
      <Select
        value={typeof value === "string" ? value : undefined}
        onChange={(v) => onAnswer(v)}
        options={question.options.map((o) => ({
          value: o.id,
          label: o.label.trim() || "—",
        }))}
        placeholder="Choose one"
        disabled={disabled}
        allowClear
        onClear={() => onAnswer(undefined)}
        className="dl-frow-select"
        size="large"
        aria-label={question.label}
      />
    );
  }

  function renderScale() {
    const scale = question.scale ?? { ...DEFAULT_SCALE };
    const points: number[] = [];
    for (let n = scale.min; n <= scale.max; n += 1) points.push(n);
    const current = typeof value === "number" ? value : null;

    return (
      <div className="dl-frow-scale">
        <div className="dl-frow-scale-points" role="group" aria-label={question.label}>
          {points.map((n) => (
            <button
              key={n}
              type="button"
              className="dl-fscale"
              data-selected={current === n}
              disabled={disabled}
              aria-pressed={current === n}
              onClick={() => onAnswer(current === n ? undefined : n)}
            >
              {n}
            </button>
          ))}
        </div>
        {(scale.minLabel?.trim() || scale.maxLabel?.trim()) && (
          <div className="dl-frow-scale-labels">
            <span>{scale.minLabel?.trim()}</span>
            <span>{scale.maxLabel?.trim()}</span>
          </div>
        )}
      </div>
    );
  }

  function renderText() {
    return (
      <Input.TextArea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onAnswer(e.target.value || undefined)}
        placeholder="Their answer"
        autoSize={{ minRows: 2, maxRows: 8 }}
        disabled={disabled}
        aria-label={question.label}
      />
    );
  }

  function renderControl() {
    switch (question.kind) {
      case "choice":
        return renderChoice();
      case "checkboxes":
        return renderCheckboxes();
      case "dropdown":
        return renderDropdown();
      case "scale":
        return renderScale();
      case "text":
        return renderText();
      case "section":
        return null;
    }
  }

  /* ---- A section is a break in the list, not a question ------------------ */

  if (question.kind === "section") {
    return (
      <div className="dl-frow-section">
        <h2 className="dl-frow-section-title">{question.label.trim() || "Section"}</h2>
        {question.description?.trim() && (
          <p className="dl-frow-section-desc">{question.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="dl-frow" data-answered={answered} data-missing={showRequired && !answered}>
      <div className="dl-frow-head">
        <span className="dl-frow-num" aria-hidden="true">
          {index}
        </span>
        <div className="dl-frow-text">
          <h3 className="dl-frow-label">
            {question.label.trim() || "Untitled question"}
            {question.required && (
              <span className="dl-frow-required" aria-label="Required">
                *
              </span>
            )}
          </h3>
          {question.description?.trim() && (
            <p className="dl-frow-desc">{question.description}</p>
          )}
        </div>
        {answered && !disabled && (
          <Tooltip title="Clear this answer">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => onAnswer(undefined)}
              aria-label={`Clear answer for ${question.label}`}
              className="dl-frow-clear"
            />
          </Tooltip>
        )}
      </div>

      {renderControl()}

      {showRequired && !answered && (
        <p className="dl-frow-missing">This one is required.</p>
      )}
    </div>
  );
}
