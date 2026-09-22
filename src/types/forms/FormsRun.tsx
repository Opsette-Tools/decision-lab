import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Spin, message } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { runsRepo } from "@/db/runsRepo";
import { haptic } from "@/lib/haptics";
import { formatDateTime } from "@/lib/format";
import { QuestionRow } from "./components/QuestionRow";
import { FormsVerdict } from "./components/FormsVerdict";
import { scoreForms } from "./score";
import type { FormsAnswerValue, Run } from "@/db/types";
import "@/types/advanced/advanced-run.css";
import "./forms-run.css";

/**
 * Run mode for a questionnaire.
 *
 * Same live-call assumptions as `advanced`: the verdict is pinned in view, every
 * tap writes straight through to IDB, and skipping is first-class because calls
 * do not go in order.
 *
 * The differences this type owns:
 *   · sections break the list into labelled groups
 *   · `required` questions must be answered before Finish
 *   · unscored mode hides the judgment and shows progress instead
 *   · no blockers and no dealbreakers — they belong to `advanced`
 */
export default function FormsRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  // Required questions are only flagged ON the rows after a finish attempt —
  // marking them red before anyone has tried to finish would scold the operator
  // for questions they simply haven't reached yet.
  const [showRequired, setShowRequired] = useState(false);

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
  const doc = useMemo(
    () =>
      run && run.scorecardSnapshot.content.type === "forms"
        ? run.scorecardSnapshot.content.doc
        : null,
    [run],
  );

  const result = useMemo(() => {
    if (!run || !doc) return null;
    if (run.answers.type !== "forms") return null;
    return scoreForms(doc, run.answers.values);
  }, [run, doc]);

  const answer = useCallback(
    async (questionId: string, value: FormsAnswerValue | undefined) => {
      if (!run) return;
      haptic("tap");
      if (run.answers.type !== "forms") return;
      // Optimistic: the tap lands instantly, IDB catches up. A call will not
      // wait for a write.
      const values = { ...run.answers.values };
      if (value === undefined) delete values[questionId];
      else values[questionId] = value;
      const answers = { type: "forms" as const, values };
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
    if (!run || !result || !doc) return;
    const values = run.answers.type === "forms" ? run.answers.values : {};

    // Required questions are a hard gate — that is what the author marked them
    // for. Everything else stays skippable.
    const missing = doc.questions.filter((q) => {
      if (q.kind === "section" || !q.required) return false;
      const v = values[q.id];
      if (v === undefined || v === null) return true;
      if (typeof v === "string") return v.trim() === "";
      if (Array.isArray(v)) return v.length === 0;
      return false;
    });

    if (missing.length > 0) {
      setShowRequired(true);
      message.warning(
        missing.length === 1
          ? "One required question still needs an answer."
          : `${missing.length} required questions still need answers.`,
      );
      return;
    }

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
          "Unanswered questions are left out of the score. You can reopen this run later.",
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

  if (!run || !result || !doc) {
    return (
      <div>
        <p className="dl-eyebrow">Run</p>
        <h1 className="dl-h1">Not found</h1>
        <p className="dl-muted" style={{ marginTop: "var(--ops-space-md)" }}>
          This run isn&rsquo;t on this device.
        </p>
        <Button
          type="primary"
          style={{ marginTop: "var(--ops-space-lg)" }}
          onClick={() => navigate("/history")}
        >
          Back to run history
        </Button>
      </div>
    );
  }

  const isComplete = run.completedAt !== undefined;
  const values = run.answers.type === "forms" ? run.answers.values : {};

  // Sections are numbered out of the sequence, so "question 4" means the fourth
  // thing someone is actually asked.
  let questionNumber = 0;

  return (
    <div className="dl-run" data-complete={isComplete}>
      <div className="dl-run-head">
        <div className="dl-run-head-text">
          <p className="dl-eyebrow">
            {run.scorecardSnapshot.name}
            {isComplete && (
              <span className="dl-run-done-tag">Finished {formatDateTime(run.completedAt!)}</span>
            )}
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

        {/* A real secondary button, same size as every other header action.
            Hitting Run to look the scorecard over is normal, and the way back
            has to be as findable as the way in — not an arrow glyph tucked
            into a label. */}
        <Button
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/scorecards/${run.scorecardId}`)}
        >
          Edit scorecard
        </Button>
      </div>

      <div className="dl-run-grid">
        <div className="dl-run-questions">
          <ul className="dl-run-list">
            {doc.questions.map((question) => {
              if (question.kind !== "section") questionNumber += 1;
              return (
                <li key={question.id}>
                  <QuestionRow
                    question={question}
                    index={questionNumber}
                    value={values[question.id]}
                    onAnswer={(value) => void answer(question.id, value)}
                    disabled={isComplete}
                    showRequired={showRequired}
                  />
                </li>
              );
            })}
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

        {/* Sticky on desktop, and a sticky bar above the questions on a phone —
            the same behavior `advanced` uses, inherited from advanced-run.css. */}
        <aside className="dl-run-side" aria-label="Live score">
          <div className="dl-run-side-sticky">
            <FormsVerdict doc={doc} result={result} />
            {run.notes?.trim() && (
              <div className="dl-run-notes-preview">
                <span className="dl-run-notes-label">Notes</span>
                <p>{run.notes}</p>
              </div>
            )}
            {/* One plain sentence, no tooltip. The point is simply that editing
                the scorecard later won't change what this run scored — saying
                that twice, once in jargon, said it less clearly. */}
            <p className="dl-run-snapshot-note">
              Uses the questions as they were on {formatDateTime(run.startedAt)}. Editing the
              scorecard later won't change this run.
            </p>
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
          placeholder="Anything the questionnaire doesn't capture — who referred them, what they said about timing, a gut feeling worth recording."
          autoSize={{ minRows: 4, maxRows: 12 }}
        />
      </Modal>
    </div>
  );
}
