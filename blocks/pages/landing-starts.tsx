import type { RecordActionReference } from "@registrystack/app-runtime";
import { useStarts } from "@registrystack/app-runtime/react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/blocks/lib/content";
import { createWords, usePagesContent } from "@/blocks/pages/pages-content";
import { formRoute } from "@/blocks/pages/record-route-query";
import { useRegisterRoutes } from "@/blocks/pages/register-routes";
import { entityRoutes, type RegisterEntities } from "@/blocks/pages/record";

/**
 * What a landing page offers to start: the creates and immediate actions the
 * UI model names by record type or action id, kept to those the session's own
 * BReg profile may invoke. A start is offered once, and only where the app has
 * a page for it, and not again where the page already links it (`shown`);
 * BReg still decides the call when it is made. Nothing is shown while the
 * starts are unread or refused, since the landing page does not depend on them.
 * A start opened from the page at `from` leads back there.
 */
export function LandingStarts({
  entities,
  ids,
  shown = [],
  from,
}: {
  entities: RegisterEntities;
  ids: readonly string[];
  /** The links the page already offers, as `#` routes. */
  shown?: readonly string[];
  /** The route of the page that offers the starts, its query included. */
  from?: string;
}) {
  const pages = usePagesContent(),
    locale = useLocale(),
    routes = useRegisterRoutes(),
    starts = useStarts();
  if (!routes || !starts.data) return null;
  const seen = new Set<string>();
  const links = starts.data.flatMap((start: RecordActionReference) => {
    const key = start.name === "invoke" ? start.actionId : start.entity;
    // An action and a create may share an id, so each kind is kept apart.
    const kept = `${start.name}:${key}`;
    if (!key || !ids.includes(key) || seen.has(kept)) return [];
    const at = entityRoutes(routes, entities, start.entity);
    const path =
      start.name === "invoke"
        ? start.actionId && at?.recordAction?.(start.actionId)
        : at?.createRecord;
    if (!path || shown.includes(`#${path}`)) return [];
    seen.add(kept);
    // A create the registry left unlabelled is worded as the record list words it.
    const created = [entities.record, ...(entities.records ?? [])].find(
      (entity) => entity.id === start.entity,
    );
    const label =
      start.name === "invoke" || !created
        ? (start.label ?? key)
        : createWords(
            pages,
            created.id === entities.record.id ? "createRecord" : "addRecord",
            start.label,
            created.label,
            locale,
          );
    return [{ key: kept, label, href: `#${formRoute(path, {}, undefined, from)}` }];
  });
  if (links.length === 0) return null;
  return (
    <section className="landing-starts" aria-labelledby="landing-starts">
      <h2 id="landing-starts">{pages.startsHeading}</h2>
      <div className="actions">
        {links.map((link) => (
          <Button key={link.key} variant="outline" render={<a href={link.href} />}>
            {link.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
