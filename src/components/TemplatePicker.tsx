import { Button, Modal } from "antd";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { ADVANCED_TEMPLATES, instantiate as instantiateAdvanced } from "@/types/advanced/templates";
import { FORMS_TEMPLATES, instantiate as instantiateForms } from "@/types/forms/templates";
import { typeInfo } from "@/types/registry";
import type { ScorecardType } from "@/db/types";
import "./template-picker.css";

/**
 * Templates for a chosen type, shown right after the type chooser.
 *
 * Every mature rubric tool treats the empty state as a failure — nobody expects
 * you to start from a blank grid. So picking a type leads here rather than
 * dropping straight into an empty editor, and "start blank" is the deliberate
 * choice rather than the default.
 *
 * A type with no templates goes straight to a blank scorecard instead of
 * showing an empty modal.
 */
export function TemplatePicker({
  type,
  onClose,
  onCreated,
}: {
  /** Null when closed. */
  type: ScorecardType | null;
  onClose: () => void;
  onCreated: (scorecardId: string) => void;
}) {
  async function createBlank(forType: ScorecardType) {
    const created = await scorecardsRepo.create({ type: forType });
    onCreated(created.id);
  }

  async function createFromTemplate(key: string) {
    // Each type instantiates its own templates — the shapes are unrelated, and
    // the picker only ever needs a key, a name and a blurb from either.
    if (type === "advanced") {
      const template = ADVANCED_TEMPLATES.find((t) => t.key === key);
      if (!template) return;
      const { name, content } = instantiateAdvanced(template);
      const created = await scorecardsRepo.create({ type: "advanced", name, content });
      onCreated(created.id);
      return;
    }
    if (type === "forms") {
      const template = FORMS_TEMPLATES.find((t) => t.key === key);
      if (!template) return;
      const { name, content } = instantiateForms(template);
      const created = await scorecardsRepo.create({ type: "forms", name, content });
      onCreated(created.id);
    }
  }

  /** Just the three fields the picker renders, so the two shapes unify here. */
  const templates: Array<{ key: string; name: string; blurb: string }> =
    type === "advanced" ? ADVANCED_TEMPLATES : type === "forms" ? FORMS_TEMPLATES : [];

  // A type with no templates has nothing to choose between — skip the modal
  // rather than showing an empty one with a single "start blank" button.
  if (type && templates.length === 0) {
    void createBlank(type);
    return null;
  }

  return (
    <Modal
      open={type !== null}
      onCancel={onClose}
      footer={null}
      width={620}
      title={type ? `New ${typeInfo(type).name.toLowerCase()}` : ""}
    >
      <ul className="dl-templatelist">
        {templates.map((template) => (
          <li key={template.key}>
            <button
              type="button"
              className="dl-template"
              onClick={() => void createFromTemplate(template.key)}
            >
              <span className="dl-template-name">{template.name}</span>
              <span className="dl-template-blurb">{template.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="dl-template-blank">
        <Button type="link" onClick={() => type && void createBlank(type)}>
          Start blank instead
        </Button>
      </div>
    </Modal>
  );
}
