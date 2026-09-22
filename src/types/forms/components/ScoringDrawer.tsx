import { Button, Drawer, Segmented, Switch, Tooltip, message } from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import { ThresholdEditor } from "@/types/advanced/components/ThresholdEditor";
import type { Threshold } from "@/db/types";
import {
  type FormsDoc,
  type FormsQuestion,
  type ScoreDisplay,
  type ScoreInversion,
} from "../model";
import { isScorable, maxPointsFor, totalPossible } from "../score";
import "./scoring-drawer.css";

/**
 * The scoring drawer — the second of the type's two surfaces.
 *
 * The card's inline Answer key handles ONE question's points while you happen
 * to be editing it. This drawer does everything the card cannot:
 *
 *   · Bulk operations across every scored question. This is the point. Setting
 *     points one card at a time across eighteen questions is exactly the
 *     per-question grind this type exists to avoid.
 *   · Settings that belong to no single question, and so have no card to live
 *     on: the scoring switch, display mode, inversion, and the bands.
 *
 * What is deliberately NOT taken from Opsette's QuizDrawer is its structure.
 * That drawer carries the whole per-question scoring UI as the ONLY place to
 * set points, which makes it long and makes the canvas and the drawer feel like
 * two disconnected apps. Here the card owns the single-question case, so this
 * stays focused on bulk and global concerns.
 */

const DISPLAY_OPTIONS: Array<{ label: string; value: ScoreDisplay }> = [
  { label: "Percent", value: "percent" },
  { label: "Points", value: "number" },
  { label: "Hidden", value: "off" },
];

const INVERSION_OPTIONS: Array<{ label: string; value: ScoreInversion }> = [
  { label: "Points earned", value: "earned" },
  { label: "Points remaining", value: "remaining" },
];

export function ScoringDrawer({
  open,
  doc,
  onClose,
  onChange,
}: {
  open: boolean;
  doc: FormsDoc;
  onClose: () => void;
  onChange: (next: Partial<FormsDoc>) => void;
}) {
  const scorable = doc.questions.filter(isScorable);
  const possible = totalPossible(doc);

  /** Apply a transform to every scorable question at once. */
  function mapScorable(fn: (q: FormsQuestion) => FormsQuestion) {
    onChange({ questions: doc.questions.map((q) => (isScorable(q) ? fn(q) : q)) });
  }

  /**
   * Turning scoring on for a questionnaire that has never been scored seeds the
   * sane default — first option full points, the rest zero — rather than
   * leaving every question worth nothing.
   *
   * Without this, flipping the switch on an eighteen-question intake produces a
   * total of 0 and demands eighteen hand edits, which is precisely the grind
   * this type exists to remove. Only applied when NOTHING is scored yet, so it
   * can never overwrite points an author already set and then toggled off.
   */
  function enableScoring(scored: boolean) {
    if (!scored) {
      onChange({ scored });
      return;
    }
    const nothingScored = possible === 0;
    if (!nothingScored) {
      onChange({ scored });
      return;
    }
    onChange({
      scored,
      questions: doc.questions.map((q) => {
        if (!isScorable(q)) return q;
        if (q.kind === "scale") {
          return { ...q, scale: q.scale ? { ...q.scale, maxPoints: q.scale.maxPoints || 1 } : q.scale };
        }
        return { ...q, options: q.options.map((o, i) => ({ ...o, points: i === 0 ? 1 : 0 })) };
      }),
    });
  }

  /** Every option on every scored question becomes worth one point. */
  function setEveryOptionToOne() {
    mapScorable((q) =>
      q.kind === "scale"
        ? { ...q, scale: q.scale ? { ...q.scale, maxPoints: 1 } : q.scale }
        : { ...q, options: q.options.map((o) => ({ ...o, points: 1 })) },
    );
    message.success("Every option is worth 1 point");
  }

  /**
   * The sane default, applied across the board: the first option carries the
   * points and the rest are zero. For a list written best-answer-first this is
   * usually right, and the author overrides only where it is not.
   */
  function applyFirstOptionWins(points: number) {
    mapScorable((q) =>
      q.kind === "scale"
        ? { ...q, scale: q.scale ? { ...q.scale, maxPoints: points } : q.scale }
        : { ...q, options: q.options.map((o, i) => ({ ...o, points: i === 0 ? points : 0 })) },
    );
    message.success(`First option is worth ${points}, the rest zero`);
  }

  /** Clear every point value back to zero. */
  function resetAll() {
    mapScorable((q) =>
      q.kind === "scale"
        ? { ...q, scale: q.scale ? { ...q.scale, maxPoints: 0 } : q.scale }
        : { ...q, options: q.options.map((o) => ({ ...o, points: 0 })) },
    );
    message.success("Points cleared");
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Scoring"
      width={520}
      // Full width on a phone: a 520px drawer on a 375px screen is a drawer
      // with its right half off the edge.
      styles={{ body: { paddingTop: "var(--ops-space-lg)" } }}
      className="dl-scoredrawer"
    >
      {/* ---- The switch this whole surface hangs on ------------------------ */}
      <div className="dl-sd-row">
        <div className="dl-sd-row-text">
          {/* No hint. A labelled on/off switch explains itself, and a second
              sentence restating it is noise. */}
          <span className="dl-sd-label">Score this questionnaire</span>
        </div>
        <Switch checked={doc.scored} onChange={enableScoring} />
      </div>

      {doc.scored && (
        <>
          <div className="dl-sd-total">
            <span className="dl-sd-total-num">{possible}</span>
            <span className="dl-sd-total-label">
              total points across {scorable.length}{" "}
              {scorable.length === 1 ? "question" : "questions"}
            </span>
          </div>

          {/* ---- Bulk actions: the reason this drawer exists --------------- */}
          <section className="dl-sd-section">
            <h3 className="dl-sd-heading">Set points across every question</h3>
            <p className="dl-sd-hint dl-sd-section-hint">
              This replaces the points you set on each question.
            </p>
            <div className="dl-sd-bulk">
              <Button onClick={setEveryOptionToOne} disabled={scorable.length === 0}>
                Every option worth 1
              </Button>
              <Button onClick={() => applyFirstOptionWins(1)} disabled={scorable.length === 0}>
                First option wins
              </Button>
              <Button onClick={resetAll} disabled={scorable.length === 0}>
                Clear all points
              </Button>
            </div>
          </section>

          {/* ---- Every scored question, in one place ---------------------- */}
          <section className="dl-sd-section">
            <h3 className="dl-sd-heading">Points per question</h3>
            {scorable.length === 0 ? (
              <p className="dl-sd-hint">No scorable questions yet.</p>
            ) : (
              <ul className="dl-sd-list">
                {scorable.map((q) => (
                  <li key={q.id} className="dl-sd-item">
                    <span className="dl-sd-item-label">
                      {q.label.trim() || "Untitled question"}
                    </span>
                    <span className="dl-sd-item-points">
                      {maxPointsFor(q)} {maxPointsFor(q) === 1 ? "pt" : "pts"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Global settings ------------------------------------------ */}
          <section className="dl-sd-section">
            <h3 className="dl-sd-heading">What the run shows</h3>

            <div className="dl-sd-field">
              <span className="dl-sd-label">Score display</span>
              <Segmented
                block
                options={DISPLAY_OPTIONS}
                value={doc.scoreDisplay ?? "percent"}
                onChange={(v) => onChange({ scoreDisplay: v as ScoreDisplay })}
              />
            </div>

            <div className="dl-sd-field">
              <span className="dl-sd-label">Count</span>
              <Segmented
                block
                options={INVERSION_OPTIONS}
                value={doc.scoreInversion ?? "earned"}
                onChange={(v) => onChange({ scoreInversion: v as ScoreInversion })}
              />
              {/* One short line that says what the setting does. It does NOT
                  swap with state — making the reader re-read a paragraph to
                  find the one clause that changed is work for no gain. */}
              <p className="dl-sd-hint">
                Use remaining when a high score is bad.
              </p>
            </div>
          </section>

          {/* The bands editor is shared with `advanced` outright — a score band
              is a score band, and forking it would mean two copies of the same
              "highest floor a score clears" rule drifting apart. */}
          <ThresholdEditor
            thresholds={doc.thresholds}
            onChange={(thresholds: Threshold[]) => onChange({ thresholds })}
          />
        </>
      )}
    </Drawer>
  );
}

/**
 * The header's running total, which is also the way into this drawer.
 *
 * A real AntD Button at the same size as the page's primary action, NOT a
 * hand-rolled box that merely looks button-ish. Every actionable thing in a
 * header is a Button and inherits its height from the theme's controlHeightLG,
 * so the row lines up by construction rather than by coincidence.
 */
export function ScoreTotalButton({
  doc,
  onClick,
}: {
  doc: FormsDoc;
  onClick: () => void;
}) {
  const possible = totalPossible(doc);
  return (
    <Tooltip title="Set points across every question, and what the run shows">
      <Button size="large" icon={<TrophyOutlined />} onClick={onClick}>
        {doc.scored ? `${possible} points` : "Scoring off"}
      </Button>
    </Tooltip>
  );
}
