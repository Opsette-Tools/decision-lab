import { Modal, Tag } from "antd";
import { SCORECARD_TYPES } from "@/types/registry";
import type { ScorecardType } from "@/db/types";
import "./type-chooser.css";

/**
 * Pick a scorecard type when creating one.
 *
 * Decision Lab holds several kinds of scorecard, so "new scorecard" is a
 * question before it is an action. The chooser is the first thing that makes
 * the lab legible as a lab rather than as one rigid format.
 *
 * Rows, not a card grid: the detail line is what the choice actually turns on,
 * and a row gives it room to be a real sentence.
 */
export function TypeChooser({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: ScorecardType) => void;
}) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={620} title="What kind of scorecard?">
      <ul className="dl-typelist">
        {SCORECARD_TYPES.map((info) => (
          <li key={info.id}>
            <button
              type="button"
              className="dl-typecard"
              disabled={!info.ready}
              onClick={() => info.ready && onPick(info.id)}
            >
              <span className="dl-typecard-icon" aria-hidden="true">
                {info.icon}
              </span>
              <span className="dl-typecard-text">
                <span className="dl-typecard-name">
                  {info.name}
                  {!info.ready && <Tag className="dl-typecard-tag">Coming soon</Tag>}
                </span>
                <span className="dl-typecard-blurb">{info.blurb}</span>
                <span className="dl-typecard-detail">{info.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
