import type { ReactNode } from "react";

/**
 * One label-and-value pair, styled as a description-list entry. The smallest
 * shared piece between a request's read-only detail and its editable form,
 * so both present an answer the same way.
 */
export function Definition({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="definition">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export interface AnswerItem {
  key: string;
  label: string;
  value: ReactNode;
  /** Extra content under the value, such as a prefill badge or a change-answer control. */
  note?: ReactNode;
}

/**
 * The fields a request asked for, read as a description list. Whether the
 * list appears at all when it would be empty is the caller's own choice, so
 * this always renders the `<dl>`, even around zero items.
 */
export function AnswerList({ items }: { items: AnswerItem[] }) {
  return (
    <dl className="facts">
      {items.map((item) => (
        <Definition key={item.key} label={item.label}>
          {item.value}
          {item.note}
        </Definition>
      ))}
    </dl>
  );
}
