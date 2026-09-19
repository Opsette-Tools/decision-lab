import { Button, Input, InputNumber, Segmented, Tooltip } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { uuid } from "@/lib/uuid";
import type { Threshold, VerdictTone } from "@/db/types";
import { StatePill } from "../verdict/VerdictPanel";
import "./editor-parts.css";

const TONE_OPTIONS: Array<{ label: string; value: VerdictTone }> = [
  { label: "Good", value: "pass" },
  { label: "Caution", value: "warn" },
  { label: "No", value: "fail" },
];

/**
 * Score bands. Each has a floor, a label, and a tone that drives the run
 * surface's color.
 *
 * Always displayed highest floor first, because that's how a scale reads, and
 * the repo normalizes to that order on read anyway.
 */
export function ThresholdEditor({
  thresholds,
  onChange,
}: {
  thresholds: Threshold[];
  onChange: (next: Threshold[]) => void;
}) {
  const sorted = [...thresholds].sort((a, b) => b.min - a.min);

  function patch(id: string, next: Partial<Threshold>) {
    onChange(thresholds.map((t) => (t.id === id ? { ...t, ...next } : t)));
  }

  function add() {
    // Slot the new band halfway between the lowest floor and zero, so it lands
    // somewhere plausible instead of colliding with an existing floor.
    const lowest = sorted.length > 0 ? sorted[sorted.length - 1].min : 50;
    onChange([
      ...thresholds,
      { id: uuid(), min: Math.max(0, Math.round(lowest / 2)), label: "New band", tone: "warn" },
    ]);
  }

  function remove(id: string) {
    onChange(thresholds.filter((t) => t.id !== id));
  }

  // A scale with no floor at 0 leaves low scores in "Below range" — legal, but
  // almost always an oversight worth naming.
  const hasFloor = sorted.some((t) => t.min === 0);

  return (
    <section className="dl-section">
      <div className="dl-section-head">
        <h2 className="dl-h2">What the number means</h2>
        <span className="dl-muted dl-section-meta">Read top down — the first floor a score clears wins</span>
      </div>

      <ul className="dl-thresholds">
        {sorted.map((t) => (
          <li key={t.id} className="dl-threshold">
            <div className="dl-threshold-min">
              <Tooltip title="Lowest percentage that earns this label">
                <InputNumber
                  min={0}
                  max={100}
                  value={t.min}
                  onChange={(min) => patch(t.id, { min: min ?? 0 })}
                  formatter={(v) => `${v}%`}
                  parser={(v) => Number((v ?? "").replace("%", ""))}
                  aria-label={`${t.label} floor`}
                />
              </Tooltip>
              <span className="dl-threshold-plus">and up</span>
            </div>

            <Input
              value={t.label}
              onChange={(e) => patch(t.id, { label: e.target.value })}
              placeholder="What you call this outcome"
              aria-label={`Band label for ${t.min}%`}
              className="dl-threshold-label"
            />

            <Segmented
              options={TONE_OPTIONS}
              value={t.tone}
              onChange={(tone) => patch(t.id, { tone: tone as VerdictTone })}
              aria-label={`Tone for ${t.label}`}
            />

            <div className="dl-threshold-preview">
              <StatePill state={t.tone} label={t.label.trim() || "—"} />
            </div>

            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => remove(t.id)}
              disabled={thresholds.length <= 1}
              aria-label={`Delete ${t.label} band`}
            />
          </li>
        ))}
      </ul>

      {!hasFloor && (
        <p className="dl-muted dl-threshold-warning">
          Nothing covers the bottom of the scale — a low score will just read &ldquo;Below range&rdquo;. Set one
          band's floor to 0% to name it.
        </p>
      )}

      <Button type="dashed" icon={<PlusOutlined />} onClick={add} block>
        Add a band
      </Button>
    </section>
  );
}
