import { StopOutlined, WarningOutlined } from "@ant-design/icons";
import type { ScoreResult, VerdictState } from "../score";
import { pluralize } from "@/lib/format";
import "./verdict.css";

/**
 * The live verdict. Designed to be read at a glance, mid-sentence, by someone
 * who cannot look away from the person they're talking to.
 *
 * The whole surface takes on the state — fill, border and edge — rather than
 * tinting a badge, because "what state am I in" has to survive peripheral
 * vision. A disqualification replaces the number entirely: once the answer is
 * no, a percentage is a distraction.
 */
export function VerdictPanel({ result }: { result: ScoreResult }) {
  const { percent, state, stateLabel, answeredCount, totalCount, disqualifiedBy, score, maxScore } = result;
  const unscored = percent === null;

  return (
    <div className="dl-state dl-verdict" data-state={state} role="status" aria-live="polite">
      <div className="dl-verdict-top">
        {disqualifiedBy ? (
          <span className="dl-verdict-number">No</span>
        ) : (
          <span className="dl-verdict-number" data-unscored={unscored}>
            {unscored ? "—" : `${percent}%`}
          </span>
        )}
        <span className="dl-verdict-label">{stateLabel}</span>
      </div>

      {!disqualifiedBy && (
        <div className="dl-verdict-bar" aria-hidden="true">
          <div className="dl-verdict-bar-fill" style={{ width: `${percent ?? 0}%` }} />
        </div>
      )}

      <div className="dl-verdict-meta">
        <span>
          {answeredCount} of {totalCount} answered
        </span>
        {!unscored && !disqualifiedBy && (
          <span>
            {score} of {maxScore} weighted points
          </span>
        )}
        {answeredCount < totalCount && !disqualifiedBy && (
          <span>Skipped questions don't count against the score</span>
        )}
      </div>

      {disqualifiedBy && (
        <div className="dl-dq">
          <StopOutlined className="dl-dq-icon" aria-hidden="true" />
          <div>
            <div className="dl-dq-title">This one's a no</div>
            <div className="dl-dq-body">
              &ldquo;{disqualifiedBy.optionLabel}&rdquo; on <strong>{disqualifiedBy.criterionLabel}</strong> ends
              it, whatever else is true.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The accumulating blocker list. Not a failure list — these are conditions of
 * delivery, and by the end of a run this list *is* the scope conversation, so
 * it's written to be read aloud or pasted into a proposal.
 */
export function BlockerList({ result, showEmpty = true }: { result: ScoreResult; showEmpty?: boolean }) {
  const { blockers } = result;

  if (blockers.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="dl-blockers">
        <div className="dl-blockers-head">
          <WarningOutlined aria-hidden="true" />
          Must be resolved first
        </div>
        <p className="dl-blockers-empty">Nothing yet. Answers that raise a condition will collect here.</p>
      </div>
    );
  }

  return (
    <div className="dl-blockers">
      <div className="dl-blockers-head">
        <WarningOutlined aria-hidden="true" />
        Must be resolved first · {blockers.length}
      </div>
      <ul className="dl-blockers-list">
        {blockers.map((b) => (
          <li key={b.criterionId} className="dl-blocker">
            <div>
              {b.note}
              <span className="dl-blocker-source">
                {b.criterionLabel} — &ldquo;{b.optionLabel}&rdquo;
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact state pill for list rows and history tables. */
export function StatePill({ state, label }: { state: VerdictState; label: string }) {
  return (
    <span className="dl-state dl-pill" data-state={state}>
      <span className="dl-pill-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Blocker count as a pill, for run rows where the full list is too much. */
export function BlockerCountPill({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="dl-state dl-pill" data-state="warn">
      {pluralize(count, "thing")} to resolve
    </span>
  );
}
