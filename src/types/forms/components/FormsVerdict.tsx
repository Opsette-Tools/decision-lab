import type { FormsDoc } from "../model";
import type { FormsScoreResult } from "../score";
import "@/types/advanced/verdict/verdict.css";

/**
 * The live verdict for a questionnaire run.
 *
 * Reuses `advanced`'s verdict.css wholesale — the tokens, the state fill, the
 * bar — because the verdict surface is type-agnostic apart from what it counts.
 * What is NOT here is blockers and dealbreakers: those belong to `advanced`,
 * and leaving them out is most of the reason this type exists.
 *
 * Three things vary with the doc's settings:
 *   · `scoreDisplay` chooses a percentage, a raw point count, or no number
 *   · `scoreInversion` swaps the displayed points for what remains
 *   · `scored: false` hides the verdict's judgment entirely, leaving progress
 */
export function FormsVerdict({ doc, result }: { doc: FormsDoc; result: FormsScoreResult }) {
  const { percent, state, stateLabel, answeredCount, totalCount, displayScore, maxScore } = result;
  const display = doc.scoreDisplay ?? "percent";
  const inverted = (doc.scoreInversion ?? "earned") === "remaining";
  const unscored = percent === null;

  // An unscored questionnaire is a structured checklist. It still reports
  // progress, because "how far through am I" is a real question — it just
  // never reports a judgment.
  if (!result.scored) {
    return (
      <div className="dl-state dl-verdict" data-state="warn" role="status" aria-live="polite">
        <div className="dl-verdict-top">
          <span className="dl-verdict-number" data-unscored={answeredCount === 0}>
            {answeredCount}
            <span className="dl-fv-of">/{totalCount}</span>
          </span>
          <span className="dl-verdict-label">Answered</span>
        </div>
        <div className="dl-verdict-bar" aria-hidden="true">
          <div
            className="dl-verdict-bar-fill"
            style={{ width: `${totalCount === 0 ? 0 : (answeredCount / totalCount) * 100}%` }}
          />
        </div>
        <div className="dl-verdict-meta">
          <span>This questionnaire records answers without scoring them</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dl-state dl-verdict" data-state={state} role="status" aria-live="polite">
      <div className="dl-verdict-top">
        {display === "off" ? (
          <span className="dl-verdict-number" data-unscored={unscored}>
            {answeredCount}
            <span className="dl-fv-of">/{totalCount}</span>
          </span>
        ) : display === "number" ? (
          <span className="dl-verdict-number" data-unscored={unscored}>
            {unscored ? "—" : displayScore}
            {!unscored && <span className="dl-fv-of">/{maxScore}</span>}
          </span>
        ) : (
          <span className="dl-verdict-number" data-unscored={unscored}>
            {unscored ? "—" : `${percent}%`}
          </span>
        )}
        <span className="dl-verdict-label">{stateLabel}</span>
      </div>

      <div className="dl-verdict-bar" aria-hidden="true">
        <div className="dl-verdict-bar-fill" style={{ width: `${percent ?? 0}%` }} />
      </div>

      <div className="dl-verdict-meta">
        <span>
          {answeredCount} of {totalCount} answered
        </span>
        {!unscored && display !== "number" && (
          <span>
            {/* Naming the term explicitly, because "12 points" means the
                opposite thing under inversion and a bare number would not say
                which one this is. */}
            {displayScore} of {maxScore} {inverted ? "points left" : "points"}
          </span>
        )}
        {answeredCount < totalCount && <span>Skipped questions don't count against the score</span>}
      </div>
    </div>
  );
}
