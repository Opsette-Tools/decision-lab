import { useRef, useState } from "react";
import { Button, Dropdown, Input, InputNumber, Select, Switch, Tooltip } from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  MoreOutlined,
  PlusOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { uuid } from "@/lib/uuid";
import {
  DEFAULT_SCALE,
  SCALE_MAX_CEILING,
  SCALE_MIN_FLOOR,
  parsePastedOptions,
  type FormsOption,
  type FormsQuestion,
  type QuestionKind,
} from "../model";
import { maxPointsFor } from "../score";
import "./question-card.css";

/**
 * ONE question card that morphs on `kind` — not one component per type.
 *
 * The card owns the whole frame: drag handle, question input, type picker,
 * and the footer bar with the Answer key reveal. Only the MIDDLE SECTION
 * swaps. Six sibling components that each re-render a label input and a footer
 * is exactly the over-engineering this design avoids, and it is why three of
 * the six kinds (choice / checkboxes / dropdown) cost nothing extra: they are
 * one options editor rendered three ways.
 *
 * Layout follows Google Forms, which is the shape everyone already knows:
 * question text top-left, type picker top-right, answer key bottom-left,
 * actions bottom-right.
 */

const KIND_OPTIONS: Array<{ value: QuestionKind; label: string }> = [
  { value: "choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "scale", label: "Linear scale" },
  { value: "text", label: "Short answer" },
  { value: "section", label: "Section" },
];

/** Kinds that share the one options editor. */
const HAS_OPTIONS = new Set<QuestionKind>(["choice", "checkboxes", "dropdown"]);

export function QuestionCard({
  question,
  index,
  isFirst,
  isLast,
  scored,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onAddAfter,
}: {
  question: FormsQuestion;
  /** Position among ANSWERABLE questions; sections are numbered separately. */
  index: number | null;
  isFirst: boolean;
  isLast: boolean;
  /** The doc's scoring switch. Answer key is hidden entirely when off. */
  scored: boolean;
  onChange: (next: FormsQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddAfter: () => void;
}) {
  // Scoring is progressive disclosure: closed, a question is just a question.
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // Enter at the end of an option row adds the next one and focuses it — the
  // fast-entry affordance that makes a long list bearable to type. This holds
  // which id to focus once React has mounted its input.
  const focusNext = useRef<string | null>(null);

  const isSection = question.kind === "section";
  const showAnswerKey = scored && !isSection && question.kind !== "text";
  const points = maxPointsFor(question);

  function patch(next: Partial<FormsQuestion>) {
    onChange({ ...question, ...next });
  }

  /**
   * Changing type preserves everything that still applies — the label, the
   * description, and the options when moving between the three option kinds.
   * Retyping a question you already wrote because you picked the wrong kind
   * first is the kind of small loss that makes an editor feel hostile.
   */
  function changeKind(kind: QuestionKind) {
    const next: FormsQuestion = { ...question, kind };

    if (HAS_OPTIONS.has(kind)) {
      // Arriving at an option kind with nothing to show would render an empty
      // middle section, so seed a first option rather than a dead end.
      next.options =
        question.options.length > 0
          ? question.options
          : [{ id: uuid(), label: "", points: scored ? 1 : undefined }];
      delete next.scale;
    } else if (kind === "scale") {
      next.options = [];
      // Seeded worth points when the doc is scored, so a new scale is not
      // silently worth zero; worth nothing when it isn't, so switching scoring
      // on later still starts everything from the same place.
      next.scale = question.scale ?? {
        ...DEFAULT_SCALE,
        maxPoints: scored ? DEFAULT_SCALE.maxPoints : 0,
      };
    } else {
      // text / section take no answer set at all.
      next.options = [];
      delete next.scale;
      if (kind === "section") next.required = undefined;
    }

    onChange(next);
  }

  /* ---- Options ----------------------------------------------------------- */

  function patchOption(optionId: string, next: Partial<FormsOption>) {
    patch({ options: question.options.map((o) => (o.id === optionId ? { ...o, ...next } : o)) });
  }

  function addOption(afterId?: string) {
    const fresh: FormsOption = { id: uuid(), label: "", points: scored ? 0 : undefined };
    const options = [...question.options];
    const at = afterId ? options.findIndex((o) => o.id === afterId) + 1 : options.length;
    options.splice(at, 0, fresh);
    // Focus lands on the row we just created, so typing continues uninterrupted.
    focusNext.current = fresh.id;
    patch({ options });
  }

  function removeOption(optionId: string) {
    patch({ options: question.options.filter((o) => o.id !== optionId) });
  }

  function moveOption(optionId: string, direction: -1 | 1) {
    const i = question.options.findIndex((o) => o.id === optionId);
    const target = i + direction;
    if (i === -1 || target < 0 || target >= question.options.length) return;
    const options = [...question.options];
    [options[i], options[target]] = [options[target], options[i]];
    patch({ options });
  }

  /**
   * The comma-paste affordance. This is the single interaction that makes
   * authoring feel like the intake list it came from:
   *
   *   US only, Europe only, worldwide, not sure yet   ->   four options
   *
   * Offered, never forced — the paste box is a reveal, and typing one option at
   * a time keeps working exactly as before.
   */
  function applyPaste() {
    const existing = question.options.map((o) => o.label).filter((l) => l.trim() !== "");
    const labels = parsePastedOptions(pasteText, existing);
    if (labels.length === 0) {
      setPasteOpen(false);
      setPasteText("");
      return;
    }
    // Replace a lone blank starter option rather than leaving it stranded at
    // the top of the list the paste just filled.
    const kept = question.options.filter((o) => o.label.trim() !== "");
    const fresh = labels.map(
      (label, i): FormsOption => ({
        id: uuid(),
        label,
        // Scoring default: first option carries the points, the rest zero. The
        // author overrides only where it matters.
        points: scored ? (kept.length === 0 && i === 0 ? 1 : 0) : undefined,
      }),
    );
    patch({ options: [...kept, ...fresh] });
    setPasteOpen(false);
    setPasteText("");
  }

  /* ---- Middle sections, one per kind -------------------------------------- */

  function renderOptionsEditor() {
    return (
      <div className="dl-fq-middle">
        <ul className="dl-fq-options">
          {question.options.map((option, i) => (
            <li key={option.id} className="dl-fq-option">
              {/* The marker previews the control the run will actually show —
                  a circle for one answer, a square for several. */}
              <span
                className="dl-fq-marker"
                data-kind={question.kind}
                aria-hidden="true"
              >
                {question.kind === "dropdown" ? i + 1 : ""}
              </span>

              <Input
                value={option.label}
                onChange={(e) => patchOption(option.id, { label: e.target.value })}
                onKeyDown={(e) => {
                  // Enter at the end of a row adds the next one. This is the
                  // difference between typing a list and clicking a button
                  // between every line.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption(option.id);
                  }
                }}
                ref={(el) => {
                  // Focus the row we just created, so typing a list continues
                  // uninterrupted. Uses Ant's own focus() rather than reaching
                  // for the underlying input node.
                  if (el && focusNext.current === option.id) {
                    focusNext.current = null;
                    el.focus();
                  }
                }}
                placeholder={`Option ${i + 1}`}
                variant="borderless"
                className="dl-fq-option-input"
                aria-label={`Option ${i + 1}`}
              />

              {answerKeyOpen && (
                <Tooltip title="Points this option is worth">
                  <InputNumber
                    value={option.points ?? 0}
                    onChange={(v) => patchOption(option.id, { points: v ?? 0 })}
                    className="dl-fq-option-points"
                    aria-label={`Points for option ${i + 1}`}
                    size="small"
                  />
                </Tooltip>
              )}

              <span className="dl-fq-option-actions">
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  disabled={i === 0}
                  onClick={() => moveOption(option.id, -1)}
                  aria-label={`Move option ${i + 1} up`}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  disabled={i === question.options.length - 1}
                  onClick={() => moveOption(option.id, 1)}
                  aria-label={`Move option ${i + 1} down`}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={question.options.length <= 1}
                  onClick={() => removeOption(option.id)}
                  aria-label={`Delete option ${i + 1}`}
                />
              </span>
            </li>
          ))}
        </ul>

        {pasteOpen ? (
          <div className="dl-fq-paste">
            <Input.TextArea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Apples, bananas, kangaroos"
              autoSize={{ minRows: 2, maxRows: 6 }}
              autoFocus
              aria-label="Paste options"
            />
            <p className="dl-fq-paste-hint">One per line, or separated by commas.</p>
            <div className="dl-fq-paste-actions">
              <Button type="primary" size="small" onClick={applyPaste}>
                Add them
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="dl-fq-option-add">
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => addOption()}>
              Add option
            </Button>
            <Button type="link" size="small" onClick={() => setPasteOpen(true)}>
              Paste a list
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderScaleEditor() {
    const scale = question.scale ?? { ...DEFAULT_SCALE };
    return (
      <div className="dl-fq-middle dl-fq-scale">
        <div className="dl-fq-scale-row">
          <label className="dl-fq-inline-field">
            <span className="dl-fq-inline-label">From</span>
            <InputNumber
              min={SCALE_MIN_FLOOR}
              max={scale.max - 1}
              value={scale.min}
              onChange={(v) => patch({ scale: { ...scale, min: v ?? 1 } })}
              aria-label="Scale start"
            />
          </label>
          <label className="dl-fq-inline-field">
            <span className="dl-fq-inline-label">To</span>
            <InputNumber
              min={scale.min + 1}
              max={SCALE_MAX_CEILING}
              value={scale.max}
              onChange={(v) => patch({ scale: { ...scale, max: v ?? 5 } })}
              aria-label="Scale end"
            />
          </label>
          {answerKeyOpen && (
            <label className="dl-fq-inline-field">
              <span className="dl-fq-inline-label">Points at top</span>
              <InputNumber
                value={scale.maxPoints ?? 0}
                onChange={(v) => patch({ scale: { ...scale, maxPoints: v ?? 0 } })}
                aria-label="Points awarded at the top of the scale"
              />
            </label>
          )}
        </div>

        <div className="dl-fq-scale-row">
          <label className="dl-fq-inline-field dl-fq-grow">
            <span className="dl-fq-inline-label">{scale.min} means</span>
            <Input
              value={scale.minLabel ?? ""}
              onChange={(e) => patch({ scale: { ...scale, minLabel: e.target.value } })}
              placeholder="Not at all"
              aria-label="Label for the bottom of the scale"
            />
          </label>
          <label className="dl-fq-inline-field dl-fq-grow">
            <span className="dl-fq-inline-label">{scale.max} means</span>
            <Input
              value={scale.maxLabel ?? ""}
              onChange={(e) => patch({ scale: { ...scale, maxLabel: e.target.value } })}
              placeholder="Completely ready"
              aria-label="Label for the top of the scale"
            />
          </label>
        </div>

        {answerKeyOpen && (
          <p className="dl-fq-scale-note">
            {scale.min} scores 0 and {scale.max} scores {scale.maxPoints ?? 0}. The steps between
            split the difference evenly.
          </p>
        )}
      </div>
    );
  }

  function renderTextEditor() {
    return (
      <div className="dl-fq-middle">
        <div className="dl-fq-text-preview" aria-hidden="true">
          Their answer
        </div>
      </div>
    );
  }

  function renderMiddle() {
    if (isSection) return null;
    if (HAS_OPTIONS.has(question.kind)) return renderOptionsEditor();
    if (question.kind === "scale") return renderScaleEditor();
    return renderTextEditor();
  }

  /* ---- The card ----------------------------------------------------------- */

  return (
    <div className="dl-fq" data-kind={question.kind} data-section={isSection}>
      <div className="dl-fq-head">
        <div className="dl-fq-head-main">
          {index !== null && (
            <span className="dl-fq-num" aria-hidden="true">
              {index}
            </span>
          )}
          <Input
            value={question.label}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder={isSection ? "Section title" : "Question"}
            variant="borderless"
            className="dl-fq-label"
            aria-label={isSection ? "Section title" : "Question"}
          />
        </div>

        {/* A plain Select at the top-right, beside the label. No menu of
            icons, no modal — the type is one of six and the list says so. */}
        <Select
          value={question.kind}
          onChange={changeKind}
          options={KIND_OPTIONS}
          className="dl-fq-kind"
          aria-label="Question type"
          popupMatchSelectWidth={false}
        />
      </div>

      <Input
        value={question.description ?? ""}
        onChange={(e) => patch({ description: e.target.value })}
        placeholder="Description"
        variant="borderless"
        className="dl-fq-desc"
        aria-label="Description"
      />

      {renderMiddle()}

      <div className="dl-fq-foot">
        <div className="dl-fq-foot-left">
          {showAnswerKey && (
            <button
              type="button"
              className="dl-fq-answerkey"
              onClick={() => setAnswerKeyOpen((o) => !o)}
              aria-expanded={answerKeyOpen}
            >
              <span className="dl-fq-answerkey-box" data-on={answerKeyOpen} aria-hidden="true" />
              Answer key
              <span className="dl-fq-points">
                {points} {points === 1 ? "point" : "points"}
              </span>
            </button>
          )}
        </div>

        <div className="dl-fq-foot-right">
          {!isSection && (
            <label className="dl-fq-required">
              <span>Required</span>
              <Switch
                size="small"
                checked={!!question.required}
                onChange={(required) => patch({ required })}
                aria-label="Required"
              />
            </label>
          )}

          <Tooltip title="Duplicate">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={onDuplicate}
              aria-label="Duplicate question"
            />
          </Tooltip>

          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "up", label: "Move up", disabled: isFirst, icon: <UpOutlined /> },
                { key: "down", label: "Move down", disabled: isLast, icon: <DownOutlined /> },
                { key: "after", label: "Add question below", icon: <PlusOutlined /> },
                { type: "divider" },
                { key: "remove", label: "Delete", danger: true, icon: <DeleteOutlined /> },
              ],
              onClick: ({ key }) => {
                if (key === "up") onMove(-1);
                if (key === "down") onMove(1);
                if (key === "after") onAddAfter();
                if (key === "remove") onRemove();
              },
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label="Question actions" />
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
