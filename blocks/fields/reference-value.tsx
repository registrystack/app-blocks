import { createContext, useContext, type ReactNode } from "react";
import type { EntityModel } from "@registrystack/app-runtime";
import { entityTitle } from "@registrystack/app-runtime";
import { useModel, useRecord } from "@registrystack/app-runtime/react";
import { useBlockContent } from "@/blocks/lib/content";
import type { FieldValueProps } from "@/blocks/fields/renderers";

/** A record's title: its entity's title template or field, as a record page titles it. */
export function recordTitle(
  entity: EntityModel,
  values: Readonly<Record<string, unknown>>,
): string | undefined {
  return entityTitle(entity, (field) => values[field.id]);
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

/**
 * A value that names a register record, shown as that record's title. The
 * record is read under the caller's own session, so a record the caller may
 * not read, an entity the model does not carry and a field that names no
 * target all read as the content's unavailable wording, never as the id. The
 * title links to the target's page when a `ReferenceHrefProvider` gives one.
 */
export function ReferenceValue({ field, value }: FieldValueProps) {
  const c = useBlockContent(),
    hrefOf = useReferenceHref();
  const model = useModel();
  const entity = model.data?.entities.find(
    (e) => e.id === field.reference?.entity,
  );
  const id = typeof value === "string" ? value : "";
  // A read with no entity or id is never enabled, so it never settles.
  const record = useRecord(entity?.id ?? "", entity ? id : "");
  const unavailable = c.referenceUnavailable ?? "A record that could not be read";
  if (model.isPending) return <>{c.loading}</>;
  if (!entity || !id) return <>{unavailable}</>;
  if (record.isPending) return <>{c.loading}</>;
  if (record.error || !record.data) return <>{unavailable}</>;
  const title = recordTitle(entity, record.data.values) ?? id;
  const href = hrefOf(entity.id, id);
  return href ? <a href={href}>{title}</a> : <>{title}</>;
}
