/**
 * Traite une liste d'éléments avec un nombre de workers concurrents borné,
 * au lieu d'un traitement strictement séquentiel. Utilisé par les hooks de
 * traduction en arrière-plan (useLocalizedFeeds/Incidents/Agenda) : avec un
 * traitement séquentiel, le volume réel de flux dépasse largement ce qui
 * peut être traduit avant que l'utilisateur ne change de page, laissant la
 * majorité du contenu non traduit indéfiniment.
 */
export async function processWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
  isCancelled: () => boolean,
): Promise<void> {
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      if (isCancelled()) return;
      const item = items[index++];
      await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
}
