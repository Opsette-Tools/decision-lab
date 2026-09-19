import { useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Empty, Modal, Segmented, Spin, message } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { runsRepo } from "@/db/runsRepo";
import { scoreSavedRun } from "@/types/advanced/score";
import { formatDateTime, pluralize } from "@/lib/format";
import { BlockerCountPill, StatePill } from "@/types/advanced/verdict/VerdictPanel";
import type { Run } from "@/db/types";
import "./history.css";

/**
 * Run history. The comparison surface — what a saved run is FOR.
 *
 * Grouped by scorecard rather than presented as one flat list, because the only
 * comparison that means anything is between runs of the same scorecard. Two
 * runs of different scorecards both scoring 74% are not comparable, and a flat
 * list invites exactly that mistake.
 */
export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "finished" | "open">("all");
  const navigate = useNavigate();

  async function reload() {
    try {
      setRuns(await runsRepo.list());
    } catch (err) {
      console.error("[decision-lab] failed to load runs:", err);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const visible = useMemo(() => {
    if (filter === "finished") return runs.filter((r) => r.completedAt !== undefined);
    if (filter === "open") return runs.filter((r) => r.completedAt === undefined);
    return runs;
  }, [runs, filter]);

  /** Grouped by the scorecard each run was measured against, newest group first. */
  const groups = useMemo(() => {
    const byScorecard = new Map<string, { name: string; runs: Run[] }>();
    for (const run of visible) {
      const existing = byScorecard.get(run.scorecardId);
      if (existing) existing.runs.push(run);
      else byScorecard.set(run.scorecardId, { name: run.scorecardSnapshot.name, runs: [run] });
    }
    return [...byScorecard.entries()]
      .map(([scorecardId, group]) => ({ scorecardId, ...group }))
      .sort((a, b) => b.runs[0].startedAt - a.runs[0].startedAt);
  }, [visible]);

  function confirmDelete(run: Run) {
    Modal.confirm({
      title: "Delete this run?",
      content: `"${run.subject || "Untitled"}" and its answers are removed. This can't be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await runsRepo.remove(run.id);
        await reload();
        message.success("Deleted");
      },
    });
  }

  return (
    <div>
      <div className="dl-page-head">
        <div>
          <p className="dl-eyebrow">Run history</p>
          <h1 className="dl-h1">What you decided</h1>
        </div>
        {runs.length > 0 && (
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { label: "All", value: "all" },
              { label: "Finished", value: "finished" },
              { label: "In progress", value: "open" },
            ]}
          />
        )}
      </div>

      {loading ? (
        <div className="dl-loading">
          <Spin />
        </div>
      ) : groups.length === 0 ? (
        <div className="dl-empty-panel">
          <Empty
            image={null}
            description={
              <div className="dl-empty-copy">
                <h2 className="dl-h2">{runs.length === 0 ? "No runs yet" : "Nothing matches that filter"}</h2>
                <p className="dl-muted">
                  {runs.length === 0
                    ? "Run a scorecard and it lands here — scored, dated, and lined up against every other time you ran the same one."
                    : "Try a different filter."}
                </p>
              </div>
            }
          >
            {runs.length === 0 && (
              <Button type="primary" size="large" onClick={() => navigate("/scorecards")}>
                Go to scorecards
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <div className="dl-history">
          {groups.map((group) => (
            <section key={group.scorecardId} className="dl-history-group">
              <div className="dl-section-head">
                <h2 className="dl-h2">{group.name}</h2>
                <span className="dl-muted dl-section-meta">{pluralize(group.runs.length, "run")}</span>
              </div>

              <ul className="dl-list">
                {group.runs.map((run) => {
                  // Null for a type whose scoring isn't built yet — the row
                  // still lists, it just shows no verdict rather than crashing.
                  const result = scoreSavedRun(run);
                  const open = run.completedAt === undefined;
                  return (
                    <li key={run.id} className="dl-row">
                      <button type="button" className="dl-row-main" onClick={() => navigate(`/run/${run.id}`)}>
                        <span className="dl-row-name">{run.subject.trim() || "Untitled"}</span>
                        <span className="dl-row-meta">
                          {open ? "Started" : "Finished"}{" "}
                          {formatDateTime(open ? run.startedAt : run.completedAt!)}
                          {result && (
                            <>
                              <span className="dl-row-sep">·</span>
                              {result.answeredCount} of {result.totalCount} answered
                            </>
                          )}
                        </span>
                      </button>

                      <div className="dl-row-actions dl-history-actions">
                        {/* The score reads as a number, not just a pill — this is
                            the column the eye runs down when comparing runs. */}
                        {result && (
                          <>
                            <span className="dl-history-score" data-state={result.state}>
                              {result.disqualifiedBy
                                ? "No"
                                : result.percent === null
                                  ? "—"
                                  : `${result.percent}%`}
                            </span>
                            <StatePill state={result.state} label={result.stateLabel} />
                            <BlockerCountPill count={result.blockers.length} />
                          </>
                        )}
                        {open && <span className="dl-history-open">In progress</span>}
                        <Dropdown
                          trigger={["click"]}
                          menu={{
                            items: [
                              { key: "open", label: open ? "Continue" : "View" },
                              { type: "divider" },
                              { key: "delete", label: "Delete", danger: true },
                            ],
                            onClick: ({ key }) => {
                              if (key === "open") navigate(`/run/${run.id}`);
                              if (key === "delete") confirmDelete(run);
                            },
                          }}
                        >
                          <Button type="text" icon={<MoreOutlined />} aria-label="Run actions" />
                        </Dropdown>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
