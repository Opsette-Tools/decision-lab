import { Modal, Typography } from "antd";

const { Paragraph, Title } = Typography;

export default function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Privacy" width={560}>
      <Title level={5} style={{ marginTop: 0 }}>
        Your scorecards stay with you
      </Title>
      <Paragraph>
        Decision Lab runs entirely in your browser. Scorecards and runs are stored on this
        device and are never uploaded, and there is no account to create.
      </Paragraph>
      <Paragraph>
        Because storage is local to the browser, clearing site data removes your scorecards and
        run history, and another device won't see them. Export anything you'd be unhappy to
        lose.
      </Paragraph>
      <Paragraph style={{ marginBottom: 0 }}>
        When Decision Lab is opened inside Opsette, your data saves to your Opsette workspace
        instead, so it follows you across devices.
      </Paragraph>
    </Modal>
  );
}
