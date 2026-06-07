/** Run async tasks in small parallel batches to avoid exhausting DB pool connections. */
export async function poolBatch(
  tasks: Array<() => Promise<unknown>>,
  size = 3,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    results.push(...(await Promise.all(chunk.map((fn) => fn()))));
  }
  return results;
}
