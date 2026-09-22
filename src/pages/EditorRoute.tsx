import { useEffect, useState } from "react";
import { Button, Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { scorecardsRepo } from "@/db/scorecardsRepo";
import AdvancedEditor from "@/types/advanced/AdvancedEditor";
import FormsEditor from "@/types/forms/FormsEditor";
import type { ScorecardType } from "@/db/types";

/**
 * Editor dispatch. Loads just enough of the scorecard to learn its type, then
 * hands off to that type's own editor.
 *
 * The route is `/scorecards/:id` for every type — the URL names the scorecard,
 * not the format, so a link keeps working if a type is ever migrated. This is
 * the only place that maps a type to an editor component.
 */
export default function EditorRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<ScorecardType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const found = await scorecardsRepo.get(id);
      if (cancelled) return;
      setType(found?.type ?? null);
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

  switch (type) {
    case "advanced":
      return <AdvancedEditor />;
    case "forms":
      return <FormsEditor />;
  }
}
