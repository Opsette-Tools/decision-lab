import { useEffect, useState } from "react";
import { Button, Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { runsRepo } from "@/db/runsRepo";
import AdvancedRun from "@/types/advanced/AdvancedRun";
import type { ScorecardType } from "@/db/types";

/**
 * Run dispatch. Mirrors EditorRoute: reads the run's frozen snapshot to learn
 * which type it was scored against, then hands off to that type's run screen.
 *
 * Note it reads the type from the SNAPSHOT, not from the live scorecard. A run
 * is scored against the copy it froze at start, so the snapshot is the only
 * honest source for how to render it.
 */
export default function RunRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<ScorecardType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const found = await runsRepo.get(id);
      if (cancelled) return;
      setType(found?.scorecardSnapshot.content.type ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="dl-loading">
        <Spin />
      </div>
    );
  }

  if (!type) {
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

  switch (type) {
    case "advanced":
      return <AdvancedRun />;
    case "forms":
      return (
        <div>
          <p className="dl-eyebrow">Run</p>
          <h1 className="dl-h1">Not built yet</h1>
          <p className="dl-muted" style={{ marginTop: "var(--ops-space-md)" }}>
            Questionnaire runs are still to come.
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
}
