import { useCallback, useEffect, useState } from "react";
import { Button, Input, Spin, message } from "antd";
import { PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { runsRepo } from "@/db/runsRepo";
import { uuid } from "@/lib/uuid";
import { haptic } from "@/lib/haptics";
import { QuestionCard } from "./components/QuestionCard";
import { ScoreTotalButton, ScoringDrawer } from "./components/ScoringDrawer";
import { PasteQuestions, PasteQuestionsButton } from "./components/PasteQuestions";
import { defaultFormsThresholds } from "./templates";
import { DEFAULT_SCALE, type FormsDoc, type FormsQuestion, type QuestionKind } from "./model";
import type { Scorecard } from "@/db/types";
import "./forms-editor.css";

/**
 * The `forms` editor — questions authored IN PLACE, Google Forms style.
 *
 * No canvas, no side rail, no modal. A plain vertical list of cards, each of
 * which owns its own editing surface. The two surfaces are:
 *
 *   · the card    — write the question, pick its type, set ITS points
 *   · the drawer  — set points across MANY questions, and everything global
 *
 * Saves are debounced and implicit, same as `advanced`: a scorecard is edited
 * in small increments, and a Save button only creates a way to lose work.
 */
export default function FormsEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [doc, setDoc] = useState<FormsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const found = await scorecardsRepo.get(id);
      if (cancelled) return;
      if (found && found.content.type === "forms") {
        setScorecard(found);
        // A scorecard created blank has no bands yet; give it the defaults on
        // first open rather than rendering an empty, meaningless scale.
        const loaded = found.content.doc;
        setDoc(
          loaded.thresholds.length > 0
            ? loaded
            : { ...loaded, thresholds: defaultFormsThresholds() },
        );
      } else {
        setScorecard(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * Debounced persist. Local state is authoritative while typing; IDB catches
   * up 500ms after the last keystroke so a long question isn't one write per
   * character.
   */
  useEffect(() => {
    if (!scorecard || !doc || !dirty) return;
    const handle = setTimeout(() => {
      void scorecardsRepo
        .update(scorecard.id, {
          name: scorecard.name,
          description: scorecard.description,
          content: { type: "forms", doc },
        })
        .then(() => setDirty(false));
    }, 500);
    return () => clearTimeout(handle);
  }, [scorecard, doc, dirty]);

  const patchCard = useCallback((next: Partial<Scorecard>) => {
    setScorecard((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const patchDoc = useCallback((next: Partial<FormsDoc>) => {
    setDoc((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const updateQuestion = useCallback((questionId: string, next: FormsQuestion) => {
    setDoc((prev) =>
      prev
        ? { ...prev, questions: prev.questions.map((q) => (q.id === questionId ? next : q)) }
        : prev,
    );
    setDirty(true);
  }, []);

  const removeQuestion = useCallback((questionId: string) => {
    setDoc((prev) =>
      prev ? { ...prev, questions: prev.questions.filter((q) => q.id !== questionId) } : prev,
    );
    setDirty(true);
  }, []);

  /**
   * Duplicate is the real speed tool for a long questionnaire — Canvas and
   * Lever both ship it, and Google puts it in the card footer. Ids are minted
   * fresh throughout: a copy sharing option ids with its source would make one
   * answer register against both.
   */
  const duplicateQuestion = useCallback((questionId: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const index = prev.questions.findIndex((q) => q.id === questionId);
      if (index === -1) return prev;
      const source = prev.questions[index];
      const copy: FormsQuestion = {
        ...source,
        id: uuid(),
        options: source.options.map((o) => ({ ...o, id: uuid() })),
        scale: source.scale ? { ...source.scale } : undefined,
      };
      const questions = [...prev.questions];
      questions.splice(index + 1, 0, copy);
      return { ...prev, questions };
    });
    setDirty(true);
  }, []);

  /** Move a question by one slot. Order in the array IS the run order. */
  const moveQuestion = useCallback((questionId: string, direction: -1 | 1) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const index = prev.questions.findIndex((q) => q.id === questionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...prev, questions };
    });
    setDirty(true);
  }, []);

  /**
   * Add a question. One click, no menu — it arrives as a `choice`, and the
   * card's type picker changes it from there. Making the author pick a type
   * before they have written the question is backwards: the question comes
   * first, and its shape follows from it.
   */
  const addQuestion = useCallback(
    (kind: QuestionKind = "choice", afterId?: string) => {
      haptic("tap");
      setDoc((prev) => {
        if (!prev) return prev;
        const fresh: FormsQuestion = {
          id: uuid(),
          kind,
          label: "",
          options:
            kind === "choice" || kind === "checkboxes" || kind === "dropdown"
              ? [{ id: uuid(), label: "", points: prev.scored ? 1 : undefined }]
              : [],
          scale:
            kind === "scale"
              ? { ...DEFAULT_SCALE, maxPoints: prev.scored ? DEFAULT_SCALE.maxPoints : 0 }
              : undefined,
        };
        const questions = [...prev.questions];
        const at = afterId ? questions.findIndex((q) => q.id === afterId) + 1 : questions.length;
        questions.splice(at, 0, fresh);
        return { ...prev, questions };
      });
      setDirty(true);
    },
    [],
  );

  /**
   * Add a whole pasted list at once.
   *
   * Everything arrives as `choice`, which is the most common shape and the one
   * the type picker changes fastest. Options parsed out of trailing brackets
   * come with them; a question with none gets a single blank option so its card
   * is not a dead end.
   */
  const addManyQuestions = useCallback(
    (parsed: Array<{ label: string; options: string[] }>) => {
      if (parsed.length === 0) return;
      haptic("tap");
      setDoc((prev) => {
        if (!prev) return prev;
        const fresh: FormsQuestion[] = parsed.map((q) => ({
          id: uuid(),
          kind: "choice",
          label: q.label,
          options:
            q.options.length > 0
              ? q.options.map((label, i) => ({
                  id: uuid(),
                  label,
                  // Same default the rest of the editor uses: the first option
                  // carries the points, the rest zero, overridden where it
                  // matters rather than set eighteen times by hand.
                  points: prev.scored ? (i === 0 ? 1 : 0) : undefined,
                }))
              : [{ id: uuid(), label: "", points: prev.scored ? 1 : undefined }],
        }));
        return { ...prev, questions: [...prev.questions, ...fresh] };
      });
      setDirty(true);
    },
    [],
  );

  async function startRun() {
    if (!scorecard || !doc) return;
    // A questionnaire of nothing but section dividers has nothing to answer.
    const answerable = doc.questions.filter((q) => q.kind !== "section");
    if (answerable.length === 0) {
      message.info("Add at least one question first.");
      return;
    }
    // Flush any pending debounced edit before snapshotting, so the run can't
    // freeze a copy that's one keystroke behind what's on screen.
    const saved = await scorecardsRepo.update(scorecard.id, {
      name: scorecard.name,
      description: scorecard.description,
      content: { type: "forms", doc },
    });
    setDirty(false);
    const run = await runsRepo.start(saved ?? scorecard);
    navigate(`/run/${run.id}`);
  }

  if (loading) {
    return (
      <div className="dl-loading">
        <Spin />
      </div>
    );
  }

  if (!scorecard || !doc) {
    return (
      <div>
        <p className="dl-eyebrow">Scorecards</p>
        <h1 className="dl-h1">Not found</h1>
        <p className="dl-muted" style={{ marginTop: "var(--ops-space-md)" }}>
          This scorecard isn&rsquo;t on this device.
        </p>
        <Button
          type="primary"
          style={{ marginTop: "var(--ops-space-lg)" }}
          onClick={() => navigate("/scorecards")}
        >
          Back to scorecards
        </Button>
      </div>
    );
  }

  // Sections are numbered out of the question sequence, so "question 4" means
  // the fourth thing someone is actually asked.
  let questionNumber = 0;

  return (
    <div className="dl-editor dl-forms-editor">
      <div className="dl-page-head">
        <div className="dl-editor-title">
          <p className="dl-eyebrow">
            Questionnaire
            <span className="dl-save-state">{dirty ? "Saving…" : "Saved"}</span>
          </p>
          <Input
            value={scorecard.name}
            onChange={(e) => patchCard({ name: e.target.value })}
            placeholder="Name this scorecard"
            variant="borderless"
            className="dl-title-input"
            aria-label="Scorecard name"
          />
        </div>

        <div className="dl-forms-head-actions">
          {/* The running total is always visible while authoring, and it is
              also the way into the scoring drawer. Every mature tool shows it. */}
          <ScoreTotalButton doc={doc} onClick={() => setDrawerOpen(true)} />
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => void startRun()}
          >
            Run
          </Button>
        </div>
      </div>

      <Input.TextArea
        value={scorecard.description ?? ""}
        onChange={(e) => patchCard({ description: e.target.value })}
        placeholder="Description (optional)"
        autoSize={{ minRows: 1, maxRows: 3 }}
        className="dl-desc-input"
      />

      {doc.questions.length === 0 ? (
        <div className="dl-editor-empty">
          <p className="dl-muted">
            No questions yet. Add one, pick its type, and write the answers you already hear.
          </p>
        </div>
      ) : (
        <ul className="dl-forms-list">
          {doc.questions.map((question, index) => {
            if (question.kind !== "section") questionNumber += 1;
            return (
              <li key={question.id}>
                <QuestionCard
                  question={question}
                  index={question.kind === "section" ? null : questionNumber}
                  isFirst={index === 0}
                  isLast={index === doc.questions.length - 1}
                  scored={doc.scored}
                  onChange={(next) => updateQuestion(question.id, next)}
                  onRemove={() => removeQuestion(question.id)}
                  onDuplicate={() => duplicateQuestion(question.id)}
                  onMove={(dir) => moveQuestion(question.id, dir)}
                  onAddAfter={() => addQuestion("choice", question.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="dl-forms-add">
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => addQuestion("choice")} block size="large">
          Add a question
        </Button>
        {/* Tertiary, but the SAME height as the dashed primary beside them —
            three buttons on one row that don't share a height is the drift
            this hierarchy exists to stop. */}
        <Button type="text" size="large" onClick={() => addQuestion("section")}>
          Add a section
        </Button>
        <PasteQuestionsButton onClick={() => setPasteOpen(true)} />
      </div>

      <PasteQuestions
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onAdd={addManyQuestions}
      />

      <ScoringDrawer
        open={drawerOpen}
        doc={doc}
        onClose={() => setDrawerOpen(false)}
        onChange={patchDoc}
      />
    </div>
  );
}
