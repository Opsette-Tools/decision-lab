import { useState } from "react";
import { Button, Dropdown, Empty, Modal, Spin, Tag, message } from "antd";
import { MoreOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { runsRepo } from "@/db/runsRepo";
import { useScorecards } from "@/lib/useScorecards";
import { formatDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { TypeChooser } from "@/components/TypeChooser";
import { TemplatePicker } from "@/components/TemplatePicker";
import { typeInfo } from "@/types/registry";
import type { Scorecard, ScorecardType } from "@/db/types";
import "./scorecards.css";

/**
 * The scorecard library — every type in one list.
 *
 * Each row leads with Run, because after the first week the operator is here to
 * use a scorecard, not to admire it. Editing and the destructive actions live
 * behind a kebab rather than strung across the row as a button bar.
 */
export default function ScorecardsPage() {
  const { scorecards, loading, reload } = useScorecards();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [templateType, setTemplateType] = useState<ScorecardType | null>(null);
  const navigate = useNavigate();

  /** Rows counted by the type's own summary, so the list stays type-agnostic. */
  function summarize(scorecard: Scorecard): string {
    switch (scorecard.content.type) {
      case "advanced": {
        const n = scorecard.content.doc.criteria.length;
        return `${n} ${n === 1 ? "question" : "questions"}`;
      }
      case "forms": {
        const n = scorecard.content.doc.questions.length;
        return `${n} ${n === 1 ? "question" : "questions"}`;
      }
    }
  }

  function isEmpty(scorecard: Scorecard): boolean {
    return scorecard.content.type === "advanced"
      ? scorecard.content.doc.criteria.length === 0
      : scorecard.content.doc.questions.length === 0;
  }

  async function startRun(scorecard: Scorecard) {
    if (isEmpty(scorecard)) {
      message.info("Add at least one question before running this.");
      navigate(`/scorecards/${scorecard.id}`);
      return;
    }
    haptic("tap");
    const run = await runsRepo.start(scorecard);
    navigate(`/run/${run.id}`);
  }

  async function handleDuplicate(scorecard: Scorecard) {
    await scorecardsRepo.duplicate(scorecard.id);
    await reload();
    message.success("Copied");
  }

  function confirmDelete(scorecard: Scorecard) {
    Modal.confirm({
      title: `Delete "${scorecard.name}"?`,
      content:
        "The scorecard goes away. Runs you've already saved keep their own frozen copy, so your history stays intact and still scores correctly.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await scorecardsRepo.remove(scorecard.id);
        await reload();
        message.success("Deleted");
      },
    });
  }

  return (
    <div>
      <div className="dl-page-head">
        <div>
          <p className="dl-eyebrow">Scorecards</p>
          <h1 className="dl-h1">How you decide</h1>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setChooserOpen(true)} size="large">
          New scorecard
        </Button>
      </div>

      {loading ? (
        <div className="dl-loading">
          <Spin />
        </div>
      ) : scorecards.length === 0 ? (
        <div className="dl-empty-panel">
          <Empty
            image={null}
            description={
              <div className="dl-empty-copy">
                <h2 className="dl-h2">Nothing here yet</h2>
                <p className="dl-muted">
                  A scorecard is the set of questions you already ask, written down once. Decision Lab
                  holds more than one kind, so start by picking the shape that fits the decision.
                </p>
              </div>
            }
          >
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setChooserOpen(true)}>
              Build your first one
            </Button>
          </Empty>
        </div>
      ) : (
        <ul className="dl-list">
          {scorecards.map((scorecard) => (
            <li key={scorecard.id} className="dl-row">
              <button
                type="button"
                className="dl-row-main"
                onClick={() => navigate(`/scorecards/${scorecard.id}`)}
              >
                <span className="dl-row-name">{scorecard.name}</span>
                <span className="dl-row-meta">
                  <Tag className="dl-type-tag">{typeInfo(scorecard.type).name}</Tag>
                  {summarize(scorecard)}
                  <span className="dl-row-sep">·</span>
                  edited {formatDate(scorecard.updatedAt)}
                </span>
              </button>

              <div className="dl-row-actions">
                <Button
                  type="primary"
                  ghost
                  icon={<PlayCircleOutlined />}
                  onClick={() => void startRun(scorecard)}
                >
                  Run
                </Button>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      { key: "edit", label: "Edit" },
                      { key: "duplicate", label: "Duplicate" },
                      { type: "divider" },
                      { key: "delete", label: "Delete", danger: true },
                    ],
                    onClick: ({ key }) => {
                      if (key === "edit") navigate(`/scorecards/${scorecard.id}`);
                      if (key === "duplicate") void handleDuplicate(scorecard);
                      if (key === "delete") confirmDelete(scorecard);
                    },
                  }}
                >
                  <Button type="text" icon={<MoreOutlined />} aria-label={`More actions for ${scorecard.name}`} />
                </Dropdown>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TypeChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onPick={(type) => {
          setChooserOpen(false);
          // Picking a type leads into that type's templates, so a new scorecard
          // never starts as a blank page unless the operator asks for one.
          setTemplateType(type);
        }}
      />

      <TemplatePicker
        type={templateType}
        onClose={() => setTemplateType(null)}
        onCreated={(id) => {
          setTemplateType(null);
          navigate(`/scorecards/${id}`);
        }}
      />
    </div>
  );
}
