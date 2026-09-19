import { Button, Modal } from "antd";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { ADVANCED_TEMPLATES, instantiate } from "@/types/advanced/templates";
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
 * Only `advanced` has templates today. A type with none goes straight to a
 * blank scorecard instead of showing an empty modal.
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
    const template = ADVANCED_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    const { name, content } = instantiate(template);
    const created = await scorecardsRepo.create({ type: "advanced", name, content });
    onCreated(created.id);
  }

  const templates = type === "advanced" ? ADVANCED_TEMPLATES : [];

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
