// Title folding shared by search, A-Z order and the import scripts' copy of it
// (scripts/lib/db.mjs): lower case, accents dropped, punctuation turned to spaces,
// so "Re:Zero", "re zero" and "Pokémon"/"pokemon" find each other.
export function searchKey(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** What a search is matched against: the title and every alternative title. */
export function buildSearchText(title: string, alternativeTitles: string[]) {
  return [title, ...alternativeTitles].map(searchKey).filter(Boolean).join(' | ');
}

/**
 * A-Z order ignores punctuation, so "[Oshi no Ko]" files under O. Titles made only of
 * symbols ("......", "∞") sort after Z rather than ahead of A.
 */
export function sortTitleOf(title: string) {
  return searchKey(title) || `~${title.toLowerCase()}`;
}
