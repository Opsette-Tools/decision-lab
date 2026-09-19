import { useEffect, useState } from "react";
import { Button, Spin } from "antd";
import { ArrowRightOutlined, PlayCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { runsRepo } from "@/db/runsRepo";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import { useScorecards } from "@/lib/useScorecards";
import { scoreSavedRun } from "@/types/advanced/score";
import { formatDateTime } from "@/lib/format";
import { TypeChooser } from "@/components/TypeChooser";
import { TemplatePicker } from "@/components/TemplatePicker";
import { typeInfo } from "@/types/registry";
import { StatePill } from "@/types/advanced/verdict/VerdictPanel";
import type { Run, Scorecard, ScorecardType } from "@/db/types";
import "./home.css";

/**
 * Home. Two jobs, in order: get the operator into a run fast, and show what
 * they decided recently.
 *
 * Deliberately not a marketing hero with three feature cards. The type carries
 * the opening statement, and everything below it is real data or a real action.
 */
export default function HomePage() {
  const { scorecards, loading } = useScorecards();
  const [recent, setRecent] = useState<Run[]>([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [templateType, setTemplateType] = useState<ScorecardType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const all = await runsRepo.list();
      if (!cancelled) setRecent(all.slice(0, 5));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startRun(scorecardId: string) {
    const scorecard = await scorecardsRepo.get(scorecardId);
    if (!scorecard) return;
    const run = await runsRepo.start(scorecard);
    navigate(`/run/${run.id}`);
  }

  /** Each type reports its own size, so this page never learns their internals. */
  function questionCount(scorecard: Scorecard): number {
    return scorecard.content.type === "advanced"
      ? scorecard.content.doc.criteria.length
      : scorecard.content.doc.questions.length;
  }

  const empty = !loading && scorecards.length === 0;

  return (
    <div className="dl-home">
      <header className="dl-home-intro">
        <p className="dl-eyebrow">Decision Lab</p>
        <h1 className="dl-home-title">
          Decide the same way
          <br />
          every time.
        </h1>
        <p className="dl-home-lede">
          Write down what actually matters, how much each thing counts, and what ends the conversation on
          the spot. Then run it when the decision is in front of you, instead of working it out again
          under pressure.
        </p>
      </header>

      {loading ? (
        <div className="dl-loading">
          <Spin />
        </div>
      ) : empty ? (
        <section className="dl-home-start">
          <h2 className="dl-h2">Start with a scorecard</h2>
          <p className="dl-muted">
            Decision Lab holds more than one kind of scorecard. Pick the shape that fits the decision,
            then start from a template or a blank one.
          </p>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setChooserOpen(true)}>
            Build your first scorecard
          </Button>
        </section>
      ) : (
        <section className="dl-home-section">
          <div className="dl-section-head">
            <h2 className="dl-h2">Run one now</h2>
            <Button type="link" onClick={() => navigate("/scorecards")}>
              All scorecards <ArrowRightOutlined />
            </Button>
          </div>

          <ul className="dl-home-cards">
            {scorecards.slice(0, 4).map((scorecard) => (
              <li key={scorecard.id}>
                <div className="dl-home-card">
                  <button
                    type="button"
                    className="dl-home-card-body"
                    onClick={() => navigate(`/scorecards/${scorecard.id}`)}
                  >
                    <span className="dl-home-card-name">{scorecard.name}</span>
                    <span className="dl-home-card-meta">
                      {typeInfo(scorecard.type).name} · {questionCount(scorecard)}{" "}
                      {questionCount(scorecard) === 1 ? "question" : "questions"}
                    </span>
                  </button>
                  <Button
                    type="primary"
                    ghost
                    icon={<PlayCircleOutlined />}
                    onClick={() => void startRun(scorecard.id)}
                    aria-label={`Run ${scorecard.name}`}
                  >
                    Run
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="dl-home-section">
          <div className="dl-section-head">
            <h2 className="dl-h2">Lately</h2>
            <Button type="link" onClick={() => navigate("/history")}>
              Full history <ArrowRightOutlined />
            </Button>
          </div>

          <ul className="dl-list">
            {recent.map((run) => {
              const result = scoreSavedRun(run);
              const open = run.completedAt === undefined;
              return (
                <li key={run.id} className="dl-row">
                  <button type="button" className="dl-row-main" onClick={() => navigate(`/run/${run.id}`)}>
                    <span className="dl-row-name">{run.subject.trim() || "Untitled"}</span>
                    <span className="dl-row-meta">
                      {run.scorecardSnapshot.name}
                      <span className="dl-row-sep">·</span>
                      {open ? "started" : "finished"}{" "}
                      {formatDateTime(open ? run.startedAt : run.completedAt!)}
                    </span>
                  </button>
                  <div className="dl-row-actions">
                    {result && <StatePill state={result.state} label={result.stateLabel} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <TypeChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onPick={(type) => {
          setChooserOpen(false);
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
