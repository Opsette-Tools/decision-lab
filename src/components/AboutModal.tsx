import { Modal, Typography } from "antd";

const { Paragraph, Title } = Typography;

export default function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="About Decision Lab" width={560}>
      <Title level={5} style={{ marginTop: 0 }}>
        Your judgment, made repeatable
      </Title>
      <Paragraph>
        Build a scorecard once — what matters, how much each thing counts, and what ends the
        conversation on the spot. Then run it whenever the decision comes up and get the same
        answer you'd have reasoned your way to on a good day, in about a minute.
      </Paragraph>
      <Paragraph>
        Every run is saved with a frozen copy of the scorecard it was measured against, so
        editing a scorecard later never rewrites what you decided last month. Nine runs of the
        same scorecard are nine numbers you can actually line up.
      </Paragraph>
      <Paragraph>
        There's no AI in the scoring, on purpose. Same answers, same verdict, every time, and
        you can see the arithmetic.
      </Paragraph>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Part of Opsette Tools. Everything stays on your device.
      </Paragraph>
    </Modal>
  );
}
