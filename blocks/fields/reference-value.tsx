import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EntityModel } from "@registrystack/app-runtime";
import { entityTitle } from "@registrystack/app-runtime";
import { useModel, useRecord } from "@registrystack/app-runtime/react";
import {
  blockContent,
  useBlockContent,
  useLocale,
} from "@/blocks/lib/content";
import type { FieldValueProps } from "@/blocks/fields/renderers";

/**
 * A record's title: its entity's title template or field, as a record page
 * titles it, with a calendar date in `locale`.
 */
export function recordTitle(
  entity: EntityModel,
  values: Readonly<Record<string, unknown>>,
  locale: string,
): string | undefined {
  return entityTitle(entity, (field) => values[field.id], locale);
}

/** Makes the href of a record's page, or null when it has none. */
export type ReferenceHref = (entity: string, id: string) => string | null;

const ReferenceHrefContext = createContext<ReferenceHref>(() => null);

/** The link maker the blocks inside use for a shown reference; none without a provider. */
export function useReferenceHref(): ReferenceHref {
  return useContext(ReferenceHrefContext);
}

/**
 * Gives the blocks inside a way to link a shown reference to its target's
 * page. A block does not know the app's routes, so the app supplies `href`,
 * which returns a full `#/...` href or null for a record with no page.
 */
export function ReferenceHrefProvider({
  href,
  children,
}: {
  href: ReferenceHref;
  children?: ReactNode;
}) {
  return (
    <ReferenceHrefContext.Provider value={href}>
      {children}
    </ReferenceHrefContext.Provider>
  );
}

/** A record chosen on a form from an authorized list read, with the title it was listed under. */
export interface ChosenReference {
  entity: string;
  id: string;
  title: string;
}

interface ChosenReferences {
  titleOf(entity: string, id: string): string | undefined;
  remember(chosen: ChosenReference): void;
}

const ChosenReferencesContext = createContext<ChosenReferences | null>(null);
const chosenKey = (entity: string, id: string) => JSON.stringify([entity, id]);

/** The records chosen on the form inside; none without a provider. */
export function useChosenReferences(): ChosenReferences | null {
  return useContext(ChosenReferencesContext);
}

/**
 * Holds the records chosen on the form inside, so a step that shows an answer
 * after its control is gone can still name a record the session may list but
 * not open. `initial` holds records already chosen.
 */
export function ChosenReferencesProvider({
  initial = [],
  children,
}: {
  initial?: readonly ChosenReference[];
  children?: ReactNode;
}) {
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(
    () =>
      new Map(
        initial.map((chosen) => [
          chosenKey(chosen.entity, chosen.id),
          chosen.title,
        ]),
      ),
  );
  const value = useMemo<ChosenReferences>(
    () => ({
      titleOf: (entity, id) => titles.get(chosenKey(entity, id)),
      remember: ({ entity, id, title }) =>
        setTitles((held) => {
          const key = chosenKey(entity, id);
          return held.get(key) === title ? held : new Map(held).set(key, title);
        }),
    }),
    [titles],
  );
  return (
    <ChosenReferencesContext.Provider value={value}>
      {children}
    </ChosenReferencesContext.Provider>
  );
}

/**
 * A value that names a register record, shown as that record's title. The
 * record is read under the caller's own session, so a record the caller may
 * not read, an entity the model does not carry and a field that names no
 * target all read as the content's unavailable wording, never as the id. The
 * title links to the target's page when a `ReferenceHrefProvider` gives one.
 * A record chosen on this form, held by a `ChosenReferencesProvider`, is shown
 * by the title it was chosen under, as text, since the session may not open it.
 */
export function ReferenceValue({ field, value }: FieldValueProps) {
  const c = useBlockContent(),
    locale = useLocale(),
    hrefOf = useReferenceHref(),
    chosen = useChosenReferences();
  const model = useModel();
  const entity = model.data?.entities.find(
    (e) => e.id === field.reference?.entity,
  );
  const id = typeof value === "string" ? value : "";
  const canRead = entity?.operations.get === true;
  // A read with no advertised exact-read operation is never enabled. List
  // authority does not imply authority to retrieve a chosen reference by id.
  const record = useRecord(entity?.id ?? "", canRead ? id : "");
  const unavailable =
    c.referenceUnavailable ?? blockContent.referenceUnavailable;
  if (model.isPending) return <>{c.loading}</>;
  const chosenTitle = entity && id ? chosen?.titleOf(entity.id, id) : undefined;
  if (chosenTitle !== undefined) return <>{chosenTitle}</>;
  if (!entity || !id || !canRead) return <>{unavailable}</>;
  if (record.isPending) return <>{c.loading}</>;
  if (record.error || !record.data) return <>{unavailable}</>;
  const title = recordTitle(entity, record.data.values, locale) ?? id;
  const href = hrefOf(entity.id, id);
  return href ? <a href={href}>{title}</a> : <>{title}</>;
}
