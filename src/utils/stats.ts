import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { getEndDate, getGenres, getRating, isCompleted, isInProgress, isWishlist } from "./itemHelpers";

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildStats(items: CulturalItem[]) {
  const byCategory = (category: Category) => items.filter((item) => item.category === category);
  const completed = items.filter(isCompleted);
  const ratedByCategory = (category: Category) => byCategory(category).filter((item) => getRating(item) > 0);
  const average = (category: Category) => {
    const values: number[] = ratedByCategory(category).map(getRating);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    completed,
    inProgress: items.filter(isInProgress),
    wishlist: items.filter(isWishlist),
    categoryTotals: {
      games: byCategory("games").length,
      books: byCategory("books").length,
      albums: byCategory("albums").length,
      movies: byCategory("movies").length,
      series: byCategory("series").length,
    },
    headline: {
      gamesCompleted: byCategory("games").filter((item) => item.status === "Zerado").length,
      gamesAbandoned: byCategory("games").filter((item) => item.status === "Abandonado").length,
      booksRead: byCategory("books").filter((item) => item.status === "Lido").length,
      albumsHeard: byCategory("albums").filter((item) => item.status === "Ouvido").length,
      moviesWatched: byCategory("movies").filter((item) => item.status === "Assistido").length,
      seriesTracked: byCategory("series").filter((item) => ["Acompanhando", "Em dia", "Concluida"].includes(item.status)).length,
    },
    completedByYear: countBy(completed.map((item) => (getEndDate(item) ?? "").slice(0, 4)).filter(Boolean)),
    completedByMonth: countBy(completed.map((item) => (getEndDate(item) ?? "").slice(0, 7)).filter(Boolean)),
    averages: Object.fromEntries((Object.keys(categoryLabels) as Category[]).map((category) => [category, average(category)])),
    genres: countBy(items.flatMap(getGenres)),
    tags: countBy(items.flatMap((item) => item.tags)),
    favorites: [...items].filter((item) => getRating(item) > 0).sort((a, b) => getRating(b) - getRating(a)).slice(0, 8),
  };
}
