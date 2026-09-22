import { useState } from "react";
import { Button, Modal, Input } from "antd";
import { parsePastedQuestions } from "../model";

/**
 * Paste a whole questionnaire at once.
 *
 * The sibling of the card's "Paste a list", one level up: writing a
 * questionnaire one card at a time is the same grind as writing one option at a
 * time. Paste the list you already have — out of a doc, an email, your notes —
 * and set the types afterward, which is the fast order to work in.
 *
 * Answers written in trailing parentheses come through as options, because that
 * is how a question gets written when you already know the shapes the answer
 * comes in. A line without them is just a question with no answers yet.
 */
export function PasteQuestions({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (parsed: Array<{ label: string; options: string[] }>) => void;
}) {
  const [text, setText] = useState("");
  const parsed = parsePastedQuestions(text);
  const withOptions = parsed.filter((q) => q.options.length > 0).length;

  function close() {
    setText("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      title="Paste your questions"
      okText={parsed.length === 0 ? "Add" : `Add ${parsed.length}`}
      okButtonProps={{ disabled: parsed.length === 0 }}
      onOk={() => {
        onAdd(parsed);
        close();
      }}
      width={620}
    >
      <p className="dl-pq-lede">
        One question per line. Put the answers in brackets at the end and they
        come through as options.
      </p>

      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "Which fruit do you like? (apples, bananas, kangaroos)\nHow did you hear about us?\nAre you ready to start? (yes, no, not sure yet)"
        }
        autoSize={{ minRows: 8, maxRows: 16 }}
        autoFocus
        aria-label="Questions to paste"
      />

      {/* A live count rather than a preview list: the count is the thing worth
          checking before committing (did it find the lines I meant?), and a
          full preview would just be the textarea again, one step removed. */}
      {parsed.length > 0 && (
        <p className="dl-pq-count">
          {parsed.length} {parsed.length === 1 ? "question" : "questions"}
          {withOptions > 0 && (
            <>
              {" · "}
              {withOptions} with answers
            </>
          )}
          {". "}
          <span className="dl-pq-count-note">
            Numbered and bulleted lists are fine. Each one arrives as multiple
            choice, and the type picker changes it from there.
          </span>
        </p>
      )}
    </Modal>
  );
}

/** The button that opens it, so the editor just drops one element in. */
export function PasteQuestionsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="text" size="large" onClick={onClick}>
      Paste a list
    </Button>
  );
}
