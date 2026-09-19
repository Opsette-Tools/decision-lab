import { Button } from "antd";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{ padding: "var(--ops-space-2xl) var(--ops-page-pad)", maxWidth: 560, margin: "0 auto" }}>
      <p className="dl-eyebrow">404</p>
      <h1 className="dl-h1">No page here</h1>
      <p className="dl-muted" style={{ marginTop: "var(--ops-space-md)" }}>
        That link doesn't point anywhere in Decision Lab.
      </p>
      <Button type="primary" style={{ marginTop: "var(--ops-space-lg)" }}>
        <Link to="/">Back to Decision Lab</Link>
      </Button>
    </div>
  );
}
