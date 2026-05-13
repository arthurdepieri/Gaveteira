import { Category } from "../types";

export const categoryLabels: Record<Category, string> = {
  games: "Jogos",
  books: "Livros",
  albums: "Albuns",
  movies: "Filmes",
  series: "Series",
};

export const categorySingular: Record<Category, string> = {
  games: "jogo",
  books: "livro",
  albums: "album",
  movies: "filme",
  series: "serie",
};

export const defaultStatuses: Record<Category, string[]> = {
  games: ["Quero jogar", "Jogando", "Zerado", "Abandonado"],
  books: ["Quero ler", "Lendo", "Lido", "Abandonado"],
  albums: ["Quero ouvir", "Ouvindo", "Ouvido", "Abandonado"],
  movies: ["Quero assistir", "Assistindo", "Assistido", "Abandonado"],
  series: ["Quero assistir", "Acompanhando", "Em dia", "Concluida", "Abandonada"],
};

export const wishlistStatuses = [
  "Quero jogar",
  "Quero ler",
  "Quero ouvir",
  "Quero assistir",
];

export const progressStatuses = [
  "Jogando",
  "Lendo",
  "Ouvindo",
  "Assistindo",
  "Acompanhando",
  "Em dia",
];

export const completedStatuses = [
  "Zerado",
  "Lido",
  "Ouvido",
  "Assistido",
  "Concluida",
  "Em dia",
];

export const abandonedStatuses = ["Abandonado", "Abandonada"];

export const apiProviderHints: Record<Category, string[]> = {
  games: ["IGDB", "Steam", "RAWG", "HowLongToBeat"],
  books: ["Google Books", "Open Library"],
  albums: ["Spotify", "MusicBrainz", "Last.fm"],
  movies: ["TMDB"],
  series: ["TMDB"],
};
