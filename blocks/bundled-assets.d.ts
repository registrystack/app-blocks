/** The bundler turns a worker asset import into a browser Worker constructor. */
declare module "*?worker" {
  const WorkerConstructor: new (options?: WorkerOptions) => Worker;
  export default WorkerConstructor;
}

/** The bundler copies a file imported this way into the build and returns its URL. */
declare module "*?url&no-inline" {
  const href: string;
  export default href;
}
