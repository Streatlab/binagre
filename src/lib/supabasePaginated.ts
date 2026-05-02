const PAGE_SIZE = 1000;

export async function fetchAllPaginated<T>(
  builderFn: () => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    // CRITICAL: ORDER BY garantiza orden estable entre llamadas paginadas.
    // Sin orden estable, Postgres puede devolver filas duplicadas/faltantes
    // entre páginas y romper el cálculo de agregados.
    const { data, error } = await builderFn()
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
