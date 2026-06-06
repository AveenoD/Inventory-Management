/** Run async tasks in small parallel batches to avoid exhausting DB pool connections. */
export async function poolBatch<T>(tasks: Array<() => Promise<T>>, size = 1): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    results.push(...(await Promise.all(chunk.map((fn) => fn()))));
  }
  return results;
}
