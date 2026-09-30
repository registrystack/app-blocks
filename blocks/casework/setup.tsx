import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  CaseworkDirectory,
  CaseworkSetupInput,
  CaseworkTeam,
} from "@registrystack/app-runtime";
import {
  useCaseworkDirectory,
  useCaseworkSetup,
} from "@registrystack/app-runtime/react";
import { fill } from "@/blocks/lib/format";
import { useBlockContent } from "@/blocks/lib/content";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useCaseworkContent, type CaseworkContent } from "@/blocks/casework/casework-content";
import { QueueTable, type QueueColumn } from "@/blocks/lib/queue-parts";
import { ErrorSummary, Loading } from "@/blocks/casework/shared";
import { LiveAnnouncer, useAnnouncement } from "@/blocks/casework/announce";

/** How a page renders an error: with a retry when the write or read can be sent
    again, without one for a refusal, which is answered once and stands. */
type RenderError = (error: unknown, retry?: () => void) => ReactNode;

/** The four field names, shared by the labels, the errors and the summary links. */
export const teamNameField = "team-name",
  staffField = "staff-ids",
  leaderField = "team-leader",
  queueField = "queue";

/** What the administrator has typed. Kept exactly as typed so Back restores it;
    the wire values are derived from it and trimmed. */
interface SetupDraft {
  teamId: string;
  staffText: string;
  supervisorSubject: string;
  queueId: string;
}
const emptyDraft: SetupDraft = {
  teamId: "",
  staffText: "",
  supervisorSubject: "",
  queueId: "",
};

/** The frozen `CaseworkSetupInput` the host receives, built from what was typed. */
export function wireValues(draft: SetupDraft): CaseworkSetupInput {
  return {
    teamId: draft.teamId.trim(),
    staffSubjects: draft.staffText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    supervisorSubject: draft.supervisorSubject.trim(),
    queueId: draft.queueId.trim(),
  };
}

/** The checks the administrator can be told about before anything is sent. */
export function setupErrors(
  input: CaseworkSetupInput,
  directory: CaseworkDirectory | undefined,
  c: CaseworkContent,
): Record<string, string> {
  const found: Record<string, string> = {};
  if (!input.teamId) found[teamNameField] = c.setupTeamNameRequired;
  else if (directory?.teams.some((team) => team.id === input.teamId))
    found[teamNameField] = fill(c.setupTeamNameTaken, { name: input.teamId });
  if (!input.staffSubjects.length) found[staffField] = c.setupStaffRequired;
  if (!input.supervisorSubject) found[leaderField] = c.setupLeaderRequired;
  if (!input.queueId) found[queueField] = c.setupQueueRequired;
  return found;
}

/** The queue as the administrator reads it, falling back to the identifier
    they typed when the directory carries no label for it. */
export function queueLabel(directory: CaseworkDirectory | undefined, id: string) {
  return directory?.queues.find((queue) => queue.id === id)?.label ?? id;
}

/**
 * A step's own heading. Each step of this wizard replaces the page outright
 * rather than updating one mounted view, so the heading remounts with it and
 * takes focus the way a freshly routed page would.
 */
function Heading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="page-heading">
      <div>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && <p className="lead">{description}</p>}
      </div>
    </div>
  );
}

/**
 * A setup field: the label, a one-line hint, one example value and the error,
 * all wired into the control's accessible description.
 */
function SetupField({
  name,
  label,
  hint,
  example,
  error,
  value,
  onChange,
  multiline = false,
  queues,
}: {
  name: string;
  label: string;
  hint: string;
  example?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  /** Present only when the directory read succeeded; renders a select. */
  queues?: CaseworkDirectory["queues"];
}) {
  const c = useBlockContent();
  const props = {
    id: name,
    name,
    value,
    onChange: (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(event.target.value),
    "aria-invalid": !!error,
    "aria-describedby": [
      `${name}-hint`,
      example ? `${name}-example` : "",
      error ? `${name}-error` : "",
    ]
      .filter(Boolean)
      .join(" "),
    required: true,
  };
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <p className="field-hint" id={`${name}-hint`}>
        {hint}
      </p>
      {example && (
        <p className="field-hint setup-example" id={`${name}-example`}>
          {example}
        </p>
      )}
      {error && (
        <p className="field-error-message" id={`${name}-error`}>
          <span className="sr-only">{c.errorPrefix} </span>
          {error}
        </p>
      )}
      {queues ? (
        <select {...props}>
          <option value="">{c.selectOption}</option>
          {queues.map((queue) => (
            <option key={queue.id} value={queue.id}>
              {queue.label}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <Textarea {...props} rows={4} />
      ) : (
        <Input {...props} />
      )}
    </div>
  );
}

/** The teams Casework already holds, so the administrator is not guessing. */
export function ExistingTeams({ directory }: { directory: CaseworkDirectory }) {
  const c = useCaseworkContent();
  if (!directory.teams.length) return <p className="muted">{c.setupNoTeams}</p>;
  const columns: QueueColumn<CaseworkTeam>[] = [
    {
      key: "team",
      header: c.setupTeamColumn,
      rowHeader: true,
      cell: (team) => team.id,
    },
    {
      key: "staff",
      header: c.setupStaffColumn,
      cell: (team) => team.staff.length,
    },
    {
      key: "leaders",
      header: c.setupLeadersColumn,
      cell: (team) => team.supervisors.length,
    },
    {
      key: "queues",
      header: c.setupQueuesColumn,
      cell: (team) =>
        team.queues.map((id) => queueLabel(directory, id)).join(", "),
    },
  ];
  return (
    <section className="setup-teams">
      <h2>{c.setupExistingTeams}</h2>
      <QueueTable
        caption={c.setupTeamsCaption}
        columns={columns}
        rows={directory.teams}
        rowKey={(team) => team.id}
      />
    </section>
  );
}

/** The confirmation step: nothing is created until the administrator confirms it here. */
export function SetupCheck({
  input,
  directory,
  pending,
  error,
  onChangeAnswer,
  onCreate,
  onBack,
  renderError,
}: {
  input: CaseworkSetupInput;
  directory: CaseworkDirectory | undefined;
  pending: boolean;
  error: unknown;
  onChangeAnswer: (field: string) => void;
  onCreate: () => void;
  onBack: () => void;
  renderError: RenderError;
}) {
  const c = useCaseworkContent();
  return (
    <>
      <Heading title={c.setupCheckTitle} description={c.setupCheckDescription} />
      <section className="card setup-check">
        <dl className="confirmation-context">
          <div>
            <dt>{c.setupTeamName}</dt>
            <dd>
              <div>{input.teamId}</div>
              <Button
                variant="ghost"
                className="change-answer"
                disabled={pending}
                onClick={() => onChangeAnswer(teamNameField)}
              >
                {c.setupChangeAnswer(c.setupTeamName)}
              </Button>
            </dd>
          </div>
          <div>
            <dt>{c.setupCheckStaff}</dt>
            <dd>
              <ul className="setup-staff">
                {input.staffSubjects.map((subject) => (
                  <li key={subject}>{subject}</li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="change-answer"
                disabled={pending}
                onClick={() => onChangeAnswer(staffField)}
              >
                {c.setupChangeAnswer(c.setupCheckStaff)}
              </Button>
            </dd>
          </div>
          <div>
            <dt>{c.setupCheckLeader}</dt>
            <dd>
              <div>{input.supervisorSubject}</div>
              <Button
                variant="ghost"
                className="change-answer"
                disabled={pending}
                onClick={() => onChangeAnswer(leaderField)}
              >
                {c.setupChangeAnswer(c.setupCheckLeader)}
              </Button>
            </dd>
          </div>
          <div>
            <dt>{c.setupCheckQueue}</dt>
            <dd>
              <div>{queueLabel(directory, input.queueId)}</div>
              <Button
                variant="ghost"
                className="change-answer"
                disabled={pending}
                onClick={() => onChangeAnswer(queueField)}
              >
                {c.setupChangeAnswer(c.setupCheckQueue)}
              </Button>
            </dd>
          </div>
        </dl>
        <div className="actions">
          <Button onClick={onCreate} disabled={pending}>
            {c.setupCreate}
          </Button>
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            {c.setupBack}
          </Button>
        </div>
      </section>
      {!!error && renderError(error)}
    </>
  );
}

/** The final step: the team is created, and its staff take work from the queue themselves. */
export function SetupDone({
  created,
  directory,
  announcement,
  onReset,
}: {
  created: CaseworkSetupInput;
  directory: CaseworkDirectory | undefined;
  announcement: string;
  onReset: () => void;
}) {
  const c = useCaseworkContent();
  return (
    <>
      <LiveAnnouncer message={announcement} />
      <Heading
        title={fill(c.setupDoneTitle, { name: created.teamId })}
        description={c.setupDoneNext}
      />
      <section className="card setup-check">
        <p>
          {fill(c.setupDoneQueue, {
            queue: queueLabel(directory, created.queueId),
          })}
        </p>
        <div className="actions">
          <Button onClick={onReset}>{c.setupAnother}</Button>
        </div>
      </section>
    </>
  );
}

/** The administrator's one-time bootstrap of a team, its people and its queue. */
export function CaseworkSetup({ renderError }: { renderError: RenderError }) {
  const c = useCaseworkContent();
  const directory = useCaseworkDirectory();
  const { setup, pending, error } = useCaseworkSetup();
  const [draft, setDraft] = useState(emptyDraft);
  const [step, setStep] = useState<"form" | "check" | "done">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CaseworkSetupInput | null>(null);
  const [announcement, announce] = useAnnouncement();
  const editField = useRef<string | null>(null);
  const input = wireValues(draft);
  useEffect(() => {
    if (step !== "form" || !editField.current) return;
    const field = editField.current;
    editField.current = null;
    document.getElementById(field)?.focus({ preventScroll: true });
  }, [step]);
  if (directory.isPending) return <Loading />;

  function changeAnswer(field: string) {
    editField.current = field;
    setStep("form");
  }

  function check(event: FormEvent) {
    event.preventDefault();
    const found = setupErrors(input, directory.data, c);
    setErrors(found);
    if (!Object.keys(found).length) setStep("check");
  }

  async function create() {
    if (!(await setup(input))) return;
    setCreated(input);
    setStep("done");
    announce(fill(c.setupDoneTitle, { name: input.teamId }));
    void directory.refetch();
  }

  if (step === "done" && created)
    return (
      <SetupDone
        created={created}
        directory={directory.data}
        announcement={announcement}
        onReset={() => {
          setDraft(emptyDraft);
          setCreated(null);
          setErrors({});
          setStep("form");
        }}
      />
    );

  if (step === "check")
    return (
      <SetupCheck
        input={input}
        directory={directory.data}
        pending={pending}
        error={error}
        onChangeAnswer={changeAnswer}
        onCreate={() => void create()}
        onBack={() => setStep("form")}
        renderError={renderError}
      />
    );

  return (
    <>
      <Heading title={c.setupHeading} description={c.setupHeadingDescription} />
      {/* A directory that cannot be read costs the administrator the team list
          and the queue names, never the form itself. */}
      {directory.error || !directory.data ? (
        renderError(directory.error, () => void directory.refetch())
      ) : (
        <ExistingTeams directory={directory.data} />
      )}
      <form className="card form-card setup-form" noValidate onSubmit={check}>
        <h2>{c.setupCreateHeading}</h2>
        <ErrorSummary errors={errors} />
        <SetupField
          name={teamNameField}
          label={c.setupTeamName}
          hint={c.setupTeamNameHint}
          example={c.setupTeamNameExample}
          error={errors[teamNameField]}
          value={draft.teamId}
          onChange={(teamId) => setDraft({ ...draft, teamId })}
        />
        <SetupField
          name={staffField}
          label={c.setupStaff}
          hint={c.setupStaffHint}
          example={c.setupStaffExample}
          error={errors[staffField]}
          value={draft.staffText}
          onChange={(staffText) => setDraft({ ...draft, staffText })}
          multiline
        />
        <SetupField
          name={leaderField}
          label={c.setupLeader}
          hint={c.setupLeaderHint}
          example={c.setupLeaderExample}
          error={errors[leaderField]}
          value={draft.supervisorSubject}
          onChange={(supervisorSubject) =>
            setDraft({ ...draft, supervisorSubject })
          }
        />
        <SetupField
          name={queueField}
          label={c.setupQueue}
          hint={directory.data ? c.setupQueueHint : c.setupQueueTypedHint}
          example={directory.data ? undefined : c.setupQueueExample}
          error={errors[queueField]}
          value={draft.queueId}
          onChange={(queueId) => setDraft({ ...draft, queueId })}
          queues={directory.data?.queues}
        />
        <div className="actions">
          <Button type="submit">{c.setupContinue}</Button>
        </div>
      </form>
    </>
  );
}
