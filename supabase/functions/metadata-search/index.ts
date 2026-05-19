type Category = "games" | "books" | "albums" | "movies" | "series";

interface MetadataResult {
  id: string;
  provider: string;
  title: string;
  subtitle?: string;
  year?: number;
  coverUrl?: string;
  patch: Record<string, unknown>;
  links?: Array<{ id: string; label: string; url: string }>;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  try {
    const { category, query } = await request.json() as { category?: Category; query?: string };
    const normalizedQuery = query?.trim();

    if (!category || !normalizedQuery) {
      return json({ error: "Informe category e query." }, 400);
    }

    const results = await search(category, normalizedQuery);
    return json({ results: rankedResults(normalizedQuery, results) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha na busca." }, 500);
  }
});

async function search(category: Category, query: string): Promise<MetadataResult[]> {
  if (category === "games") return searchGames(query);
  if (category === "books") return searchBooks(query);
  if (category === "albums") return searchAlbums(query);
  if (category === "movies") return searchMovies(query);
  if (category === "series") return searchSeries(query);
  return [];
}

async function searchGames(query: string) {
  const results: MetadataResult[] = [];
  const rawgKey = Deno.env.get("RAWG_API_KEY");

  if (rawgKey) {
    const rawgUrl = new URL("https://api.rawg.io/api/games");
    rawgUrl.searchParams.set("key", rawgKey);
    rawgUrl.searchParams.set("search", query);
    rawgUrl.searchParams.set("page_size", "8");

    const rawg = await fetchJson(rawgUrl).catch(() => ({}));
    results.push(...arrayOfRecords(rawg.results).map((game) => {
      const name = stringValue(game.name);
      const released = stringValue(game.released);
      const genres = arrayOfRecords(game.genres).map((genre) => stringValue(genre.name)).filter(Boolean).join(", ");
      const platforms = arrayOfRecords(game.platforms)
        .map((entry) => recordValue(entry.platform))
        .map((platform) => stringValue(platform.name))
        .filter(Boolean)
        .slice(0, 4)
        .join(", ");
      const image = stringValue(game.background_image);
      const id = stringValue(game.id);

      return {
        id: `rawg-${id || name}`,
        provider: "RAWG",
        title: name,
        subtitle: [released?.slice(0, 4), genres].filter(Boolean).join(" / "),
        year: yearFromDate(released),
        coverUrl: image,
        patch: cleanPatch({
          category: "games",
          name,
          releaseYear: yearFromDate(released),
          genre: genres,
          platform: platforms,
          coverUrl: image,
        }),
        links: id ? [link("RAWG", `https://rawg.io/games/${stringValue(game.slug) || id}`)] : [],
      };
    }));
  }

  const steamUrl = new URL(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`);
  const steam = await fetchJson(steamUrl).catch(() => []);
  results.push(...arrayOfRecords(steam).slice(0, 8).map((game) => {
    const appId = stringValue(game.appid);
    const name = stringValue(game.name);
    const logo = stringValue(game.logo);

    return {
      id: `steam-${appId}`,
      provider: "Steam",
      title: name,
      subtitle: appId ? `App ${appId}` : undefined,
      coverUrl: logo,
      patch: cleanPatch({
        category: "games",
        name,
        coverUrl: logo,
      }),
      links: appId ? [link("Steam", `https://store.steampowered.com/app/${appId}`)] : [],
    };
  }));

  return results;
}

async function searchBooks(query: string) {
  const variants = queryVariants(query);
  const results = await Promise.all(variants.flatMap((variant) => [
    searchGoogleBooks(variant),
    searchGoogleBooks(`intitle:"${variant}"`),
    searchOpenLibraryBooks(variant, "q"),
    searchOpenLibraryBooks(variant, "title"),
  ]));

  return results.flat();
}

async function searchGoogleBooks(googleQuery: string): Promise<MetadataResult[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", googleQuery);
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("printType", "books");
  url.searchParams.set("projection", "full");

  const google = await fetchJson(url).catch(() => ({}));
  return arrayOfRecords(recordValue(google).items).map((entry) => {
    const info = recordValue(entry.volumeInfo);
    const title = stringValue(info.title);
    const authors = arrayOfStrings(info.authors).join(", ");
    const categories = arrayOfStrings(info.categories).join(", ");
    const publishedDate = stringValue(info.publishedDate);
    const imageLinks = recordValue(info.imageLinks);
    const isbn = bestIsbn(info.industryIdentifiers);
    const volumeId = stringValue(entry.id);
    const coverUrl = bestGoogleBookCover(imageLinks, volumeId) || openLibraryCoverByIsbn(isbn);
    const previewLink = stringValue(info.previewLink);
    const infoLink = stringValue(info.infoLink);

    return {
      id: `google-${volumeId || title}-${googleQuery}`,
      provider: "Google Books",
      title,
      subtitle: [authors, publishedDate?.slice(0, 4)].filter(Boolean).join(" / "),
      year: yearFromDate(publishedDate),
      coverUrl,
      patch: cleanPatch({
        category: "books",
        title,
        author: authors,
        genre: categories,
        publisher: stringValue(info.publisher),
        publicationYear: yearFromDate(publishedDate),
        pages: numberValue(info.pageCount),
        coverUrl,
      }),
      links: (previewLink || infoLink) ? [link("Google Books", previewLink || infoLink)] : [],
    };
  });
}

async function searchOpenLibraryBooks(query: string, mode: "q" | "title"): Promise<MetadataResult[]> {
  const openLibraryUrl = new URL("https://openlibrary.org/search.json");
  openLibraryUrl.searchParams.set(mode, query);
  openLibraryUrl.searchParams.set("limit", "10");

  const openLibrary = await fetchJson(openLibraryUrl).catch(() => ({}));
  return arrayOfRecords(recordValue(openLibrary).docs).map((book) => {
    const title = stringValue(book.title);
    const author = arrayOfStrings(book.author_name).join(", ");
    const coverId = stringValue(book.cover_i);
    const coverEdition = stringValue(book.cover_edition_key);
    const isbn = arrayOfStrings(book.isbn)[0];
    const coverUrl = openLibraryCoverById(coverId) || openLibraryCoverByOlid(coverEdition) || openLibraryCoverByIsbn(isbn);
    const key = stringValue(book.key);

    return {
      id: `openlibrary-${key || title}-${mode}`,
      provider: "Open Library",
      title,
      subtitle: [author, stringValue(book.first_publish_year)].filter(Boolean).join(" / "),
      year: numberValue(book.first_publish_year),
      coverUrl,
      patch: cleanPatch({
        category: "books",
        title,
        author,
        publicationYear: numberValue(book.first_publish_year),
        coverUrl,
      }),
      links: key ? [link("Open Library", `https://openlibrary.org${key}`)] : [],
    };
  });
}

async function searchMovies(query: string) {
  const results: MetadataResult[] = [];
  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  const omdbKey = Deno.env.get("OMDB_API_KEY");

  if (tmdbKey) {
    const tmdbResults = await Promise.all(queryVariants(query).flatMap((variant) => [
      searchTmdbMovies(variant, tmdbKey, "pt-BR"),
      searchTmdbMovies(variant, tmdbKey, "en-US"),
    ]));
    results.push(...tmdbResults.flat());
  }

  if (omdbKey) {
    const omdbUrl = new URL("https://www.omdbapi.com/");
    omdbUrl.searchParams.set("apikey", omdbKey);
    omdbUrl.searchParams.set("s", query);
    omdbUrl.searchParams.set("type", "movie");

    const omdb = await fetchJson(omdbUrl).catch(() => ({}));
    results.push(...arrayOfRecords(omdb.Search).slice(0, 8).map((movie) => {
      const title = stringValue(movie.Title);
      const year = numberValue(stringValue(movie.Year).slice(0, 4));
      const poster = normalizePosterUrl(stringValue(movie.Poster));
      const imdbId = stringValue(movie.imdbID);

      return {
        id: `omdb-movie-${imdbId || title}`,
        provider: "OMDb",
        title,
        subtitle: [year, imdbId].filter(Boolean).join(" / "),
        year,
        coverUrl: poster,
        patch: cleanPatch({
          category: "movies",
          title,
          year,
          coverUrl: poster,
        }),
        links: imdbId ? [link("IMDb", `https://www.imdb.com/title/${imdbId}`)] : [],
      };
    }));
  }

  return results;
}

async function searchTmdbMovies(query: string, apiKey: string, language: "pt-BR" | "en-US"): Promise<MetadataResult[]> {
  const tmdbUrl = new URL("https://api.themoviedb.org/3/search/movie");
  tmdbUrl.searchParams.set("api_key", apiKey);
  tmdbUrl.searchParams.set("query", query);
  tmdbUrl.searchParams.set("language", language);
  tmdbUrl.searchParams.set("include_adult", "false");

  const tmdb = await fetchJson(tmdbUrl).catch(() => ({}));
  return arrayOfRecords(recordValue(tmdb).results).slice(0, 8).map((movie) => {
    const title = stringValue(movie.title);
    const releaseDate = stringValue(movie.release_date);
    const posterPath = stringValue(movie.poster_path);
    const backdropPath = stringValue(movie.backdrop_path);
    const id = stringValue(movie.id);
    const coverUrl = tmdbImageUrl(posterPath, "w500") || tmdbImageUrl(backdropPath, "w780");

    return {
      id: `tmdb-movie-${id || title}-${language}`,
      provider: "TMDB",
      title,
      subtitle: [releaseDate?.slice(0, 4), stringValue(movie.original_title), language === "en-US" ? "resultado em ingles" : undefined].filter(Boolean).join(" / "),
      year: yearFromDate(releaseDate),
      coverUrl,
      patch: cleanPatch({
        category: "movies",
        title,
        year: yearFromDate(releaseDate),
        coverUrl,
        comments: stringValue(movie.overview),
      }),
      links: id ? [link("TMDB", `https://www.themoviedb.org/movie/${id}`)] : [],
    };
  });
}

async function searchAlbums(query: string) {
  const results: MetadataResult[] = [];
  const lastfmKey = Deno.env.get("LASTFM_API_KEY");

  if (lastfmKey) {
    const lastfmUrl = new URL("https://ws.audioscrobbler.com/2.0/");
    lastfmUrl.searchParams.set("method", "album.search");
    lastfmUrl.searchParams.set("album", query);
    lastfmUrl.searchParams.set("api_key", lastfmKey);
    lastfmUrl.searchParams.set("format", "json");
    lastfmUrl.searchParams.set("limit", "8");

    const lastfm = await fetchJson(lastfmUrl).catch(() => ({}));
    const matches = recordValue(recordValue(lastfm.results).albummatches);

    results.push(...arrayOfRecords(matches.album).map((album) => {
      const title = stringValue(album.name);
      const artist = stringValue(album.artist);
      const images = arrayOfRecords(album.image);
      const coverUrl = stringValue(images.reverse().find((image) => stringValue(image["#text"]))?.["#text"]);
      const url = stringValue(album.url);

      return {
        id: `lastfm-album-${artist}-${title}`,
        provider: "Last.fm",
        title,
        subtitle: artist,
        coverUrl,
        patch: cleanPatch({
          category: "albums",
          name: title,
          artist,
          coverUrl,
        }),
        links: url ? [link("Last.fm", url)] : [],
      };
    }));
  }

  return results;
}

async function searchSeries(query: string) {
  const results: MetadataResult[] = [];
  const tmdbKey = Deno.env.get("TMDB_API_KEY");

  if (tmdbKey) {
    const tmdbUrl = new URL("https://api.themoviedb.org/3/search/tv");
    tmdbUrl.searchParams.set("api_key", tmdbKey);
    tmdbUrl.searchParams.set("query", query);
    tmdbUrl.searchParams.set("language", "pt-BR");

    const tmdb = await fetchJson(tmdbUrl).catch(() => ({}));
    results.push(...arrayOfRecords(tmdb.results).slice(0, 8).map((show) => {
      const title = stringValue(show.name);
      const firstAirDate = stringValue(show.first_air_date);
      const posterPath = stringValue(show.poster_path);
      const id = stringValue(show.id);
      const coverUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";

      return {
        id: `tmdb-series-${id || title}`,
        provider: "TMDB",
        title,
        subtitle: [firstAirDate?.slice(0, 4), stringValue(show.original_name)].filter(Boolean).join(" / "),
        year: yearFromDate(firstAirDate),
        coverUrl,
        patch: cleanPatch({
          category: "series",
          title,
          year: yearFromDate(firstAirDate),
          coverUrl,
          comments: stringValue(show.overview),
        }),
        links: id ? [link("TMDB", `https://www.themoviedb.org/tv/${id}`)] : [],
      };
    }));
  }

  return results;
}

async function fetchJson(url: URL): Promise<Record<string, unknown> | unknown[]> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Falha ao buscar em ${url.hostname}`);
  return response.json();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(recordValue).filter((entry) => Object.keys(entry).length) : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function yearFromDate(value: string) {
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

function normalizePosterUrl(url: string) {
  if (!url || url === "N/A") return "";
  return url.replace("http://", "https://");
}

function normalizeCoverUrl(url: string) {
  if (!url) return "";
  return url.replace("http://", "https://").replace("&edge=curl", "");
}

function bestGoogleBookCover(imageLinks: Record<string, unknown>, volumeId = "") {
  const cover =
    stringValue(imageLinks.extraLarge) ||
    stringValue(imageLinks.large) ||
    stringValue(imageLinks.medium) ||
    stringValue(imageLinks.small) ||
    stringValue(imageLinks.thumbnail) ||
    stringValue(imageLinks.smallThumbnail);

  return upgradeGoogleBookCover(cover) || googleBookCoverByVolumeId(volumeId);
}

function bestIsbn(value: unknown) {
  const identifiers = arrayOfRecords(value);
  const isbn13 = identifiers.find((identifier) => stringValue(identifier.type) === "ISBN_13");
  const isbn10 = identifiers.find((identifier) => stringValue(identifier.type) === "ISBN_10");
  return stringValue((isbn13 ?? isbn10 ?? identifiers[0])?.identifier);
}

function openLibraryCoverByIsbn(isbn: string) {
  return isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false` : "";
}

function openLibraryCoverById(id: string) {
  return id ? `https://covers.openlibrary.org/b/id/${encodeURIComponent(id)}-L.jpg?default=false` : "";
}

function openLibraryCoverByOlid(id: string) {
  return id ? `https://covers.openlibrary.org/b/olid/${encodeURIComponent(id)}-L.jpg?default=false` : "";
}

function googleBookCoverByVolumeId(id: string) {
  return id ? `https://books.google.com/books/publisher/content/images/frontcover/${encodeURIComponent(id)}?fife=w800-h1200&source=gbs_api` : "";
}

function upgradeGoogleBookCover(url: string) {
  return normalizeCoverUrl(url)
    .replace("zoom=1", "zoom=3")
    .replace("zoom=2", "zoom=3");
}

function tmdbImageUrl(path: string, size: "w500" | "w780") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

function link(label: string, url: string) {
  return { id: crypto.randomUUID(), label, url };
}

function cleanPatch(patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== "" && value !== undefined && value !== null));
}

function rankedResults(query: string, results: MetadataResult[], limit = 8) {
  const seen = new Set<string>();
  const unique = hydrateMissingCovers(results).filter((result) => {
    const key = `${result.provider}:${result.title}:${result.year ?? ""}`.toLowerCase();
    if (seen.has(key) || !result.title) return false;
    seen.add(key);
    return true;
  });

  return unique
    .sort((a, b) => titleRank(query, a.title) - titleRank(query, b.title) || Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)))
    .slice(0, limit);
}

function hydrateMissingCovers(results: MetadataResult[]) {
  return results.map((result) => {
    if (result.coverUrl) return result;
    const sibling = results.find((candidate) => candidate.coverUrl && sameWork(result, candidate));
    if (!sibling?.coverUrl) return result;

    return {
      ...result,
      coverUrl: sibling.coverUrl,
      patch: cleanPatch({
        ...result.patch,
        coverUrl: sibling.coverUrl,
      }),
    };
  });
}

function sameWork(left: MetadataResult, right: MetadataResult) {
  if (left === right) return false;
  const sameTitle = titleRank(left.title, right.title) <= 1 || titleRank(right.title, left.title) <= 1;
  if (!sameTitle) return false;
  if (left.year && right.year) return left.year === right.year;
  return true;
}

function titleRank(query: string, title: string) {
  const normalizedQuery = normalizeTitle(query);
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedQuery || !normalizedTitle) return 5;
  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (normalizedTitle.includes(normalizedQuery)) return 2;
  return 3;
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function queryVariants(query: string) {
  const variants = [
    query,
    query.replace(/\([^)]*\)/g, " "),
    query.replace(/\[[^\]]*\]/g, " "),
    query.replace(/\b(edi[cç][aã]o|edition|volume|vol\.?|livro|book)\b.*$/i, " "),
  ]
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => value.length >= 2);

  return [...new Set(variants)].slice(0, 3);
}
