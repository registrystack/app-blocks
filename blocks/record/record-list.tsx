import { ArrowRight, FileText } from "lucide-react";
import type { EntityModel, RecordView } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { useBlockContent } from "@/blocks/lib/content";
import { RecordFacts } from "@/blocks/record/record-summary";

/**
 * A record list as cards: one card per record, its title and a compact
 * summary of the fields the app chooses to show beneath it. `titleOf` and
 * `recordHref` come from the app: what names a record and the route it opens
 * on are the app's business, not a block's.
 */
export function RecordCards({
  entity,
  records,
  fields,
  titleOf,
  recordHref,
}: {
  entity: EntityModel;
  records: readonly RecordView[];
  /** The fields shown beneath the title, in order. */
  fields: readonly string[];
  titleOf: (record: RecordView) => string;
  recordHref: (record: RecordView) => string;
}) {
  const c = useBlockContent();
  return (
    <div className="record-cards">
      {records.map((record) => (
        <a className="record-card" href={recordHref(record)} key={record.id}>
          <div className="record-card-top">
            <span className="record-icon">
              <FileText size={21} />
            </span>
          </div>
          <p className="eyebrow">{entity.label}</p>
          <h2>{titleOf(record)}</h2>
          <RecordFacts
            entity={entity}
            record={record}
            fields={fields}
            compact
          />
          <span className="text-link card-link">
            {c.viewRecord}
            <ArrowRight size={17} />
          </span>
        </a>
      ))}
    </div>
  );
}

/**
 * A cursor pager: Previous steps back through the pages visited, Next moves
 * on with the cursor the last page carried. There is no total, so the count
 * shown is how many pages this session has turned, not a position in one.
 */
export function RecordPager({
  nextCursor,
  pageCount,
  onPrevious,
  onNext,
}: {
  nextCursor?: string | null;
  /** Pages visited so far, including this one; Previous disables at 1. */
  pageCount: number;
  onPrevious: () => void;
  onNext: (cursor: string) => void;
}) {
  const c = useBlockContent();
  return (
    <div className="pager">
      <span>
        {c.page} {pageCount}
      </span>
      <div className="actions">
        <Button
          variant="outline"
          disabled={pageCount === 1}
          onClick={onPrevious}
        >
          {c.previous}
        </Button>
        <Button
          variant="outline"
          disabled={!nextCursor}
          onClick={() => nextCursor && onNext(nextCursor)}
        >
          {c.next}
        </Button>
      </div>
    </div>
  );
}
