import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Spin, message } from "antd";
import { PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { runsRepo } from "@/db/runsRepo";
import { uuid } from "@/lib/uuid";
import { haptic } from "@/lib/haptics";
import { CriterionEditor } from "./components/CriterionEditor";
import { ThresholdEditor } from "./components/ThresholdEditor";
import { defaultThresholds } from "./templates";
import type { AdvancedDoc, Criterion } from "./model";
import type { Scorecard, Threshold } from "@/db/types";
import "./advanced-editor.css";

/**
 * The `advanced` type's editor.
 *
 * Saves are debounced and implicit — there is no Save button, because a
 * scorecard is edited in small increments and a button only creates a way to
 * lose work. The save state is reported quietly next to the title instead.
 */
export default function AdvancedEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [doc, setDoc] = useState<AdvancedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const found = await scorecardsRepo.get(id);
      if (cancelled) return;
      if (found && found.content.type === "advanced") {
        setScorecard(found);
        // A scorecard created blank has no bands yet; give it the defaults on
        // first open rather than rendering an empty, meaningless scale.
        const loaded = found.content.doc;
        setDoc(
          loaded.thresholds.length > 0 ? loaded : { ...loaded, thresholds: defaultThresholds() },
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
   * up 500ms after the last keystroke so a long label isn't one write per
   * character.
   */
  useEffect(() => {
    if (!scorecard || !doc || !dirty) return;
    const handle = setTimeout(() => {
      void scorecardsRepo
        .update(scorecard.id, {
          name: scorecard.name,
          description: scorecard.description,
          content: { type: "advanced", doc },
        })
        .then(() => setDirty(false));
    }, 500);
    return () => clearTimeout(handle);
  }, [scorecard, doc, dirty]);

  const patchCard = useCallback((next: Partial<Scorecard>) => {
    setScorecard((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const patchDoc = useCallback((next: Partial<AdvancedDoc>) => {
    setDoc((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const updateCriterion = useCallback((criterionId: string, next: Criterion) => {
    setDoc((prev) =>
      prev ? { ...prev, criteria: prev.criteria.map((c) => (c.id === criterionId ? next : c)) } : prev,
    );
    setDirty(true);
  }, []);

  const removeCriterion = useCallback((criterionId: string) => {
    setDoc((prev) =>
      prev ? { ...prev, criteria: prev.criteria.filter((c) => c.id !== criterionId) } : prev,
    );
    setDirty(true);
  }, []);

  const duplicateCriterion = useCallback((criterionId: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const index = prev.criteria.findIndex((c) => c.id === criterionId);
      if (index === -1) return prev;
      const source = prev.criteria[index];
      // Fresh ids throughout — a duplicated criterion sharing option ids with
      // its source would make one answer register against both.
      const copy: Criterion = {
        ...source,
        id: uuid(),
        label: `${source.label} (copy)`,
        options: source.options.map((o) => ({ ...o, id: uuid() })),
      };
      const criteria = [...prev.criteria];
      criteria.splice(index + 1, 0, copy);
      return { ...prev, criteria };
    });
    setDirty(true);
  }, []);

  /** Move a criterion by one slot. Order in the array IS the run order. */
  const moveCriterion = useCallback((criterionId: string, direction: -1 | 1) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const index = prev.criteria.findIndex((c) => c.id === criterionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.criteria.length) return prev;
      const criteria = [...prev.criteria];
      [criteria[index], criteria[target]] = [criteria[target], criteria[index]];
      return { ...prev, criteria };
    });
    setDirty(true);
  }, []);

  const addCriterion = useCallback(() => {
    haptic("tap");
    setDoc((prev) => {
      if (!prev) return prev;
      // A new question starts with a three-step scale already in place. An
      // empty options list would be a dead end — the graded scale is the whole
      // idea, so the default demonstrates it.
      const fresh: Criterion = {
        id: uuid(),
        label: "",
        weight: 3,
        options: [
          { id: uuid(), label: "Yes", value: 3 },
          { id: uuid(), label: "Partly", value: 2 },
          { id: uuid(), label: "No", value: 1 },
        ],
      };
      return { ...prev, criteria: [...prev.criteria, fresh] };
    });
    setDirty(true);
  }, []);

  const totalWeight = useMemo(
    () => (doc ? doc.criteria.reduce((sum, c) => sum + c.weight, 0) : 0),
    [doc],
  );

  async function startRun() {
    if (!scorecard || !doc) return;
    if (doc.criteria.length === 0) {
      message.info("Add at least one question first.");
      return;
    }
    // Flush any pending debounced edit before snapshotting, so the run can't
    // freeze a copy that's one keystroke behind what's on screen.
    const saved = await scorecardsRepo.update(scorecard.id, {
      name: scorecard.name,
      description: scorecard.description,
      content: { type: "advanced", doc },
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

  return (
    <div className="dl-editor">
      <div className="dl-page-head">
        <div className="dl-editor-title">
          <p className="dl-eyebrow">
            Weighted rubric
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
        <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={() => void startRun()}>
          Run it
        </Button>
      </div>

      <Input.TextArea
        value={scorecard.description ?? ""}
        onChange={(e) => patchCard({ description: e.target.value })}
        placeholder="Description (optional)"
        autoSize={{ minRows: 1, maxRows: 3 }}
        className="dl-desc-input"
      />

      <section className="dl-section">
        <div className="dl-section-head">
          <h2 className="dl-h2">Questions</h2>
          <span className="dl-muted dl-section-meta">{totalWeight} total weight</span>
        </div>

        {doc.criteria.length === 0 ? (
          <div className="dl-editor-empty">
            <p className="dl-muted">No questions yet.</p>
          </div>
        ) : (
          <ul className="dl-criteria">
            {doc.criteria.map((criterion, index) => (
              <li key={criterion.id}>
                <CriterionEditor
                  criterion={criterion}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === doc.criteria.length - 1}
                  onChange={(next) => updateCriterion(criterion.id, next)}
                  onRemove={() => removeCriterion(criterion.id)}
                  onDuplicate={() => duplicateCriterion(criterion.id)}
                  onMove={(dir) => moveCriterion(criterion.id, dir)}
                />
              </li>
            ))}
          </ul>
        )}

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addCriterion}
          block
          size="large"
          className="dl-add-criterion"
        >
          Add a question
        </Button>
      </section>

      <ThresholdEditor
        thresholds={doc.thresholds}
        onChange={(thresholds: Threshold[]) => patchDoc({ thresholds })}
      />
    </div>
  );
}
