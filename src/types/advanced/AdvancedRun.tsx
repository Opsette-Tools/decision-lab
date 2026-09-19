import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Spin, Tooltip, message } from "antd";
import { CheckCircleOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { runsRepo } from "@/db/runsRepo";
import { scoreRun } from "./score";
import { haptic } from "@/lib/haptics";
import { formatDateTime } from "@/lib/format";
import { BlockerList, VerdictPanel } from "./verdict/VerdictPanel";
import { CriterionRow } from "./components/CriterionRow";
import type { Run } from "@/db/types";
import "./advanced-run.css";

/**
 * Run mode.
 *
 * Design assumption that drives every decision here: the operator is on a live
 * call and cannot look away. So —
 *   · one tap per answer, options always visible (Segmented, never a dropdown)
 *   · the verdict is pinned in view and changes state, not just its number
 *   · skipping is a first-class action, because calls do not go in order
 *   · the hint sits under the question where the eye already is
 *
 * Everything writes straight through to IDB on each tap. There is no save
 * action, because a call is not a moment to remember to save.
 */
export default function AdvancedRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const found = await runsRepo.get(id);
      if (cancelled) return;
      setRun(found ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Scored against the run's OWN frozen snapshot, never the live scorecard —
  // editing the scorecard later must not change what this run said.
  const result = useMemo(() => {
    if (!run) return null;
    if (run.scorecardSnapshot.content.type !== "advanced") return null;
    if (run.answers.type !== "advanced") return null;
    return scoreRun(run.scorecardSnapshot.content.doc, run.answers.values);
  }, [run]);

  const answer = useCallback(
    async (criterionId: string, optionId: string | null) => {
      if (!run) return;
      haptic("tap");
      // Optimistic: the tap lands instantly, IDB catches up. A call will not
      // wait for a write.
      if (run.answers.type !== "advanced") return;
      const values = { ...run.answers.values };
      if (optionId === null) delete values[criterionId];
      else values[criterionId] = optionId;
      const answers = { type: "advanced" as const, values };
      setRun((prev) => (prev ? { ...prev, answers } : prev));
      await runsRepo.setAnswers(run.id, answers);
    },
    [run],
  );

  const saveSubject = useCallback(
    async (subject: string) => {
      if (!run) return;
      setRun((prev) => (prev ? { ...prev, subject } : prev));
      await runsRepo.update(run.id, { subject });
    },
    [run],
  );

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!run) return;
      setRun((prev) => (prev ? { ...prev, notes } : prev));
      await runsRepo.update(run.id, { notes });
    },
    [run],
  );

  async function finish() {
    if (!run || !result) return;
    const unanswered = result.totalCount - result.answeredCount;
    const done = async () => {
      const updated = await runsRepo.complete(run.id);
      setRun(updated ?? run);
      message.success("Run saved");
    };
    // Unanswered questions are legitimate — but finishing with most of them
    // open is usually an accident, so confirm rather than silently freezing a
    // near-empty run.
    if (unanswered > 0 && result.answeredCount < result.totalCount / 2) {
      Modal.confirm({
        title: `Finish with ${unanswered} unanswered?`,
        content:
          "Unanswered questions are left out of the score entirely, so the percentage reflects only what you asked. You can reopen this run and keep going later.",
        okText: "Finish anyway",
        onOk: done,
      });
      return;
    }
    await done();
  }

  async function reopen() {
    if (!run) return;
    const updated = await runsRepo.reopen(run.id);
    setRun(updated ?? run);
  }

  if (loading) {
    return (
      <div className="dl-loading">
        <Spin />
      </div>
    );
  }

  if (!run || !result) {
    return (
      <div>
        <p className="dl-eyebrow">Run</p>
        <h1 className="dl-h1">Not found</h1>
        <p className="dl-muted" style={{ marginTop: "var(--ops-space-md)" }}>
          This run isn&rsquo;t on this device.
        </p>
        <Button type="primary" style={{ marginTop: "var(--ops-space-lg)" }} onClick={() => navigate("/history")}>
          Back to run history
        </Button>
      </div>
    );
  }

  const isComplete = run.completedAt !== undefined;
  // Narrowed once here rather than at each use. `result` being non-null above
  // already proves both discriminants, but TypeScript can't carry that through
  // a useMemo, so these re-assert it in one place instead of ten.
  const criteria =
    run.scorecardSnapshot.content.type === "advanced" ? run.scorecardSnapshot.content.doc.criteria : [];
  const answerValues = run.answers.type === "advanced" ? run.answers.values : {};

  return (
    <div className="dl-run" data-complete={isComplete}>
      <div className="dl-run-head">
        <div className="dl-run-head-text">
          <p className="dl-eyebrow">
            {run.scorecardSnapshot.name}
            {isComplete && <span className="dl-run-done-tag">Finished {formatDateTime(run.completedAt!)}</span>}
          </p>
          <Input
            value={run.subject}
            onChange={(e) => void saveSubject(e.target.value)}
            placeholder="Who or what is this about?"
            variant="borderless"
            className="dl-title-input"
            aria-label="What this run is about"
          />
        </div>
      </div>

      {/* The verdict is the first thing in the flow on a phone (where it scrolls
          into a sticky bar) and pinned alongside on desktop. Either way it is
          never more than a glance away. */}
      <div className="dl-run-grid">
        <div className="dl-run-questions">
          <ul className="dl-run-list">
            {criteria.map((criterion, index) => (
              <li key={criterion.id}>
                <CriterionRow
                  criterion={criterion}
                  index={index}
                  selectedOptionId={answerValues[criterion.id] ?? null}
                  onAnswer={(optionId) => void answer(criterion.id, optionId)}
                  disabled={isComplete}
                />
              </li>
            ))}
          </ul>

          <div className="dl-run-footer-actions">
            <Button icon={<EditOutlined />} onClick={() => setNotesOpen(true)} size="large">
              {run.notes?.trim() ? "Edit notes" : "Add notes"}
            </Button>
            {isComplete ? (
              <Button icon={<HistoryOutlined />} onClick={() => void reopen()} size="large">
                Reopen this run
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => void finish()}
                size="large"
              >
                Finish run
              </Button>
            )}
          </div>
        </div>

        <aside className="dl-run-side" aria-label="Live verdict">
          <div className="dl-run-side-sticky">
            <VerdictPanel result={result} />
            <BlockerList result={result} />
            {run.notes?.trim() && (
              <div className="dl-run-notes-preview">
                <span className="dl-run-notes-label">Notes</span>
                <p>{run.notes}</p>
              </div>
            )}
            <Tooltip title="Every run keeps its own frozen copy of the scorecard, so later edits never change it">
              <p className="dl-run-snapshot-note">
                Scored against this scorecard as it stood on {formatDateTime(run.startedAt)}
              </p>
            </Tooltip>
          </div>
        </aside>
      </div>

      <Modal
        open={notesOpen}
        onCancel={() => setNotesOpen(false)}
        onOk={() => setNotesOpen(false)}
        okText="Done"
        title="Notes on this run"
      >
        <Input.TextArea
          value={run.notes ?? ""}
          onChange={(e) => void saveNotes(e.target.value)}
          placeholder="Anything the scorecard doesn't capture — who referred them, what they said about timing, a gut feeling worth recording."
          autoSize={{ minRows: 4, maxRows: 12 }}
        />
      </Modal>
    </div>
  );
}
