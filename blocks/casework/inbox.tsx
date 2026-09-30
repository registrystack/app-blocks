import { useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { CaseworkWorkItem } from "@registrystack/app-runtime";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loading } from "@/blocks/casework/shared";
import { CaseworkItemsTable } from "@/blocks/casework/items-table";

/**
 * The officer's own visible work: view tabs, a queue filter and one table of
 * items. Which items are visible, in which order, and what a page of them
 * means (a full page, a short one, or none yet) are the caller's decisions;
 * this block only lays the toolbar, the table and the footer out. The
 * heading above it and the next-item action beside it read register-specific
 * wording and a session's role, so they stay with the caller.
 */

/** One tab of the inbox's view switcher. */
export interface CaseworkInboxViewTab {
  value: string;
  label: string;
  href: string;
}

/** One queue the inbox's queue filter can narrow to. */
export interface CaseworkInboxQueueOption {
  id: string;
  label: string;
}

export interface CaseworkInboxProps {
  /** Names the view tabs for assistive technology. */
  viewsLabel: string;
  views: CaseworkInboxViewTab[];
  /** The tab currently selected; matches one view's `value`. */
  activeView: string;
  /** Fired when a view tab is picked, beyond following its href. */
  onViewClick?: () => void;

  /** So a page-level shortcut can find and focus the queue filter's trigger. */
  queueFilterId: string;
  /** The trigger's own label: "All queues" or a queue's name, already phrased. */
  queueTriggerLabel: string;
  allQueuesLabel: string;
  queues: CaseworkInboxQueueOption[];
  selectedQueueId: string;
  onSelectQueue: (id: string) => void;

  /** The active queue filter as a removable chip, or nothing when unfiltered. */
  filterChips?: ReactNode;

  loading: boolean;
  error?: unknown;
  /** Renders the host's own error in place of the table. No generic fallback: the caller always has one to give. */
  renderError: (error: unknown) => ReactNode;

  items: readonly CaseworkWorkItem[];
  /** Names the scrollable region and the table for assistive technology. */
  caption: string;
  /** What the item asks of the officer, for the task column of one row. */
  heading: (item: CaseworkWorkItem) => ReactNode;
  /** Where the item's reference links to. The block assumes no router of its own. */
  itemHref: (id: string) => string;
  /** Shown instead of the table when there are no items. */
  emptyTitle?: string;
  emptyBody?: string;
  emptyContent?: ReactNode;

  /** What Casework said about this page, when it was short of the officer's whole work. */
  shortfall?: string;

  /** Whether the footer (the result count and the pager) shows at all. */
  showFooter: boolean;
  resultCount?: string;
  pager?: ReactNode;
}

export function CaseworkInbox({
  viewsLabel,
  views,
  activeView,
  onViewClick,
  queueFilterId,
  queueTriggerLabel,
  allQueuesLabel,
  queues,
  selectedQueueId,
  onSelectQueue,
  filterChips,
  loading,
  error,
  renderError,
  items,
  caption,
  heading,
  itemHref,
  emptyTitle,
  emptyBody,
  emptyContent,
  shortfall,
  showFooter,
  resultCount,
  pager,
}: CaseworkInboxProps) {
  // The queue menu opens inside the toolbar, and so inside the main landmark.
  const menuLayer = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="casework-toolbar" ref={menuLayer}>
        <Tabs value={activeView}>
          <TabsList variant="line" aria-label={viewsLabel}>
            {views.map((view) => (
              <TabsTrigger
                key={view.value}
                value={view.value}
                render={<a href={view.href} onClick={onViewClick} />}
              >
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button id={queueFilterId} variant="outline" size="sm" />}
          >
            {queueTriggerLabel}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent container={menuLayer}>
            <DropdownMenuRadioGroup
              value={selectedQueueId}
              onValueChange={onSelectQueue}
            >
              <DropdownMenuRadioItem value="">
                {allQueuesLabel}
              </DropdownMenuRadioItem>
              {queues.map((queue) => (
                <DropdownMenuRadioItem key={queue.id} value={queue.id}>
                  {queue.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {filterChips}
      {error != null ? (
        renderError(error)
      ) : loading ? (
        <Loading />
      ) : (
        <div className="casework-list">
          <CaseworkItemsTable
            items={items}
            caption={caption}
            heading={heading}
            itemHref={itemHref}
            emptyTitle={emptyTitle}
            emptyBody={emptyBody}
            emptyContent={emptyContent}
          />
        </div>
      )}
      {shortfall && <p className="muted">{shortfall}</p>}
      {showFooter && (
        <div className="casework-footer">
          {resultCount && <p className="result-count">{resultCount}</p>}
          {pager}
        </div>
      )}
    </>
  );
}
