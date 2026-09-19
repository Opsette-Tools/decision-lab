import { useState } from "react";
import { Button, Dropdown, Input, InputNumber, Slider, Tooltip } from "antd";
import {
  CaretRightOutlined,
  DeleteOutlined,
  DownOutlined,
  MoreOutlined,
  PlusOutlined,
  StopOutlined,
  UpOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { uuid } from "@/lib/uuid";
import {
  VALUE_MAX,
  VALUE_MIN,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type AnswerOption,
  type Criterion,
} from "../model";
import { maxOptionValue } from "../score";
import "./editor-parts.css";

/**
 * One criterion, expandable. Collapsed it shows the question, its weight and a
 * summary of its scale; expanded it edits everything.
 *
 * Collapsed-by-default is the point: a scorecard with eight questions all
 * expanded is an unreadable wall, and most edits target one question.
 */
export function CriterionEditor({
  criterion,
  index,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  criterion: Criterion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: Criterion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  // A brand-new question arrives with an empty label, so open it immediately —
  // the operator's next action is unambiguously to type the question.
  const [open, setOpen] = useState(criterion.label.trim() === "");

  const dqCount = criterion.options.filter((o) => o.disqualifies).length;
  const blockCount = criterion.options.filter((o) => o.blocks).length;
  const ceiling = maxOptionValue(criterion);

  function patch(next: Partial<Criterion>) {
    onChange({ ...criterion, ...next });
  }

  function patchOption(optionId: string, next: Partial<AnswerOption>) {
    patch({
      options: criterion.options.map((o) => (o.id === optionId ? { ...o, ...next } : o)),
    });
  }

  function addOption() {
    // New options land at the bottom of the scale (worst), which is where a new
    // distinction almost always belongs, with a value one step below the
    // current floor but never under VALUE_MIN.
    const floor = criterion.options.reduce((min, o) => Math.min(min, o.value), ceiling);
    patch({
      options: [
        ...criterion.options,
        { id: uuid(), label: "", value: Math.max(VALUE_MIN, floor - 1) },
      ],
    });
  }

  function removeOption(optionId: string) {
    patch({ options: criterion.options.filter((o) => o.id !== optionId) });
  }

  function moveOption(optionId: string, direction: -1 | 1) {
    const i = criterion.options.findIndex((o) => o.id === optionId);
    const target = i + direction;
    if (i === -1 || target < 0 || target >= criterion.options.length) return;
    const options = [...criterion.options];
    [options[i], options[target]] = [options[target], options[i]];
    patch({ options });
  }

  return (
    <div className="dl-crit" data-open={open}>
      <div className="dl-crit-head">
        <button
          type="button"
          className="dl-crit-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <CaretRightOutlined className="dl-crit-caret" aria-hidden="true" />
          <span className="dl-crit-num" aria-hidden="true">
            {index + 1}
          </span>
          <span className="dl-crit-label">
            {criterion.label.trim() || <span className="dl-crit-untitled">Untitled question</span>}
          </span>
        </button>

        <div className="dl-crit-head-right">
          <Tooltip title={`Weight ${criterion.weight} of ${WEIGHT_MAX}`}>
            <span className="dl-weight-chip" aria-label={`Weight ${criterion.weight}`}>
              <span className="dl-weight-dots" aria-hidden="true">
                {Array.from({ length: WEIGHT_MAX }, (_, i) => (
                  <span key={i} className="dl-weight-dot" data-on={i < criterion.weight} />
                ))}
              </span>
            </span>
          </Tooltip>

          {dqCount > 0 && (
            <Tooltip title={`${dqCount} answer${dqCount === 1 ? "" : "s"} end the decision`}>
              <StopOutlined className="dl-flag-icon" data-kind="dq" aria-hidden="true" />
            </Tooltip>
          )}
          {blockCount > 0 && (
            <Tooltip title={`${blockCount} answer${blockCount === 1 ? "" : "s"} raise a condition`}>
              <WarningOutlined className="dl-flag-icon" data-kind="block" aria-hidden="true" />
            </Tooltip>
          )}

          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "up", label: "Move up", disabled: isFirst, icon: <UpOutlined /> },
                { key: "down", label: "Move down", disabled: isLast, icon: <DownOutlined /> },
                { key: "duplicate", label: "Duplicate" },
                { type: "divider" },
                { key: "remove", label: "Delete", danger: true, icon: <DeleteOutlined /> },
              ],
              onClick: ({ key }) => {
                if (key === "up") onMove(-1);
                if (key === "down") onMove(1);
                if (key === "duplicate") onDuplicate();
                if (key === "remove") onRemove();
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label="Question actions" />
          </Dropdown>
        </div>
      </div>

      {!open && (
        <div className="dl-crit-summary">
          {criterion.options.map((o) => o.label.trim() || "—").join("  ·  ")}
        </div>
      )}

      {open && (
        <div className="dl-crit-body">
          <label className="dl-field">
            <span className="dl-field-label">The question, as you'd ask it</span>
            <Input
              value={criterion.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Can they describe what they sell?"
            />
          </label>

          <label className="dl-field">
            <span className="dl-field-label">
              What to listen for
              <span className="dl-field-hint">Only you see this, during the run</span>
            </span>
            <Input
              value={criterion.hint ?? ""}
              onChange={(e) => patch({ hint: e.target.value })}
              placeholder="Ask for specifics — photos, a product list, anything concrete."
            />
          </label>

          <div className="dl-field">
            <span className="dl-field-label">
              How much this counts
              <span className="dl-field-hint">
                {criterion.weight === WEIGHT_MAX
                  ? "Counts the most"
                  : criterion.weight === WEIGHT_MIN
                    ? "Barely moves the number"
                    : `${criterion.weight} of ${WEIGHT_MAX}`}
              </span>
            </span>
            <Slider
              min={WEIGHT_MIN}
              max={WEIGHT_MAX}
              step={1}
              value={criterion.weight}
              onChange={(weight: number) => patch({ weight })}
              marks={{ [WEIGHT_MIN]: "Minor", [WEIGHT_MAX]: "Decisive" }}
            />
          </div>

          <div className="dl-field">
            <span className="dl-field-label">
              Answers, best to worst
              <span className="dl-field-hint">
                The middle answer is usually the real one — keep it
              </span>
            </span>

            <ul className="dl-options">
              {criterion.options.map((option, i) => (
                <li key={option.id} className="dl-option" data-dq={!!option.disqualifies}>
                  <div className="dl-option-main">
                    <Input
                      value={option.label}
                      onChange={(e) => patchOption(option.id, { label: e.target.value })}
                      placeholder="Answer they might give"
                      aria-label={`Answer ${i + 1} label`}
                    />
                    <Tooltip title="Points before weighting">
                      <InputNumber
                        min={VALUE_MIN}
                        max={VALUE_MAX}
                        value={option.value}
                        onChange={(value) => patchOption(option.id, { value: value ?? 0 })}
                        aria-label={`Answer ${i + 1} points`}
                        className="dl-option-value"
                      />
                    </Tooltip>
                  </div>

                  <div className="dl-option-flags">
                    {/* The two flags are independent — an answer can end the
                        decision, raise a condition, both, or neither. */}
                    <Tooltip title="This answer ends the decision, whatever else is true">
                      <Button
                        size="small"
                        type={option.disqualifies ? "primary" : "default"}
                        danger={option.disqualifies}
                        icon={<StopOutlined />}
                        onClick={() => patchOption(option.id, { disqualifies: !option.disqualifies })}
                      >
                        Dealbreaker
                      </Button>
                    </Tooltip>

                    <Tooltip title="Doesn't kill it, but must be fixed before you deliver">
                      <Button
                        size="small"
                        type={option.blocks ? "primary" : "default"}
                        icon={<WarningOutlined />}
                        onClick={() =>
                          patchOption(option.id, {
                            blocks: !option.blocks,
                            // Dropping the flag drops its note too, so a
                            // re-flagged answer doesn't resurrect stale text.
                            blockerNote: option.blocks ? undefined : option.blockerNote,
                          })
                        }
                      >
                        Must fix first
                      </Button>
                    </Tooltip>

                    <span className="dl-option-order">
                      <Button
                        size="small"
                        type="text"
                        icon={<UpOutlined />}
                        disabled={i === 0}
                        onClick={() => moveOption(option.id, -1)}
                        aria-label="Move answer up"
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<DownOutlined />}
                        disabled={i === criterion.options.length - 1}
                        onClick={() => moveOption(option.id, 1)}
                        aria-label="Move answer down"
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={criterion.options.length <= 2}
                        onClick={() => removeOption(option.id)}
                        aria-label="Delete answer"
                      />
                    </span>
                  </div>

                  {option.blocks && (
                    <Input
                      value={option.blockerNote ?? ""}
                      onChange={(e) => patchOption(option.id, { blockerNote: e.target.value })}
                      placeholder="What has to happen — e.g. domain purchased before handoff"
                      prefix={<WarningOutlined className="dl-flag-icon" data-kind="block" />}
                      className="dl-blocker-note"
                      aria-label="What must be resolved"
                    />
                  )}
                </li>
              ))}
            </ul>

            <Button type="dashed" icon={<PlusOutlined />} onClick={addOption} block>
              Add an answer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
