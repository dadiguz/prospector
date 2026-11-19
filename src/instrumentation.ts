/** Al arrancar el servidor: retomar búsquedas que quedaron a medias (sección 3.6). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumeJobs } = await import("./lib/search/engine");
    resumeJobs();
  }
}
