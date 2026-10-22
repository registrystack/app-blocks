/** Read a file the app's build emitted, such as a font or CMap the PDF reader
 * needs. Blocks read such files here rather than calling fetch, so the page
 * contract holds without exceptions. The read stays on the page's own origin,
 * follows no redirect, and sends no credentials, so it never acts for the
 * signed-in user. `origin` is the page's own origin, supplied by the caller as
 * for `readDocument`.
 */
export async function readBundledAsset(
  origin: string,
  href: string,
): Promise<Uint8Array> {
  const url = new URL(href, origin);
  if (url.origin !== origin) throw new Error("Bundled asset is unavailable.");
  const response = await fetch(url, {
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok) throw new Error("Bundled asset is unavailable.");
  return new Uint8Array(await response.arrayBuffer());
}
