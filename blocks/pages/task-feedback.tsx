import {
  TaskFeedback as TaskFeedbackBlock,
  type TaskFeedbackState,
} from "@/blocks/lib/task-outcome";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";

export type { TaskFeedbackState };

/**
 * `TaskFeedback` with the register's routes supplied: "Check current
 * records" points at the register's own requests list unless the page names
 * another place.
 */
export function TaskFeedback({
  reconcileHref,
  ...rest
}: Omit<Parameters<typeof TaskFeedbackBlock>[0], "reconcileHref"> & {
  /** Where "Check current records" points; the register's own requests list by default. */
  reconcileHref?: string;
}) {
  const routes = useRegisterRoutes();
  return (
    <TaskFeedbackBlock
      {...rest}
      reconcileHref={reconcileHref ?? `#${routes.requests}`}
    />
  );
}
