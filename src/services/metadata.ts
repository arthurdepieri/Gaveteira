import { AppSettings, Category, CloudSession, CulturalItem, ExternalLink } from "../types";
import { apiProviderHints } from "../data/catalog";
import { getTitle, uid } from "../utils/itemHelpers";

export interface MetadataProvider {
  id: string;
  name: string;
  category: Category;
  requiresKey: boolean;
  configured: boolean;
}

export function getMetadataProviders(settings: AppSettings): MetadataProvider[] {
  return [
    { id: "igdb", name: "IGDB", category: "games", requiresKey: true, configured: Boolean(settings.apiKeys.igdb) },
    { id: "steam", name: "Steam", category: "games", requiresKey: false, configured: true },
    { id: "rawg", name: "RAWG", category: "games", requiresKey: true, configured: Boolean(settings.apiKeys.rawg) },
    { id: "hltb", name: "HowLongToBeat", category: "games", requiresKey: false, configured: true },
    { id: "googleBooks", name: "Google Books", category: "books", requiresKey: false, configured: true },
    { id: "openLibrary", name: "Open Library", category: "books", requiresKey: false, configured: true },
    { id: "spotify", name: "Spotify", category: "albums", requiresKey: true, configured: Boolean(settings.apiKeys.spotify) },
    { id: "musicbrainz", name: "MusicBrainz", category: "albums", requiresKey: false, configured: true },
    { id: "lastfm", name: "Last.fm", category: "albums", requiresKey: true, configured: Boolean(settings.apiKeys.lastfm) },
    { id: "tmdb", name: "TMDB", category: "movies", requiresKey: true, configured: Boolean(settings.apiKeys.tmdb) },
    { id: "tmdb-series", name: "TMDB", category: "series", requiresKey: true, configured: Boolean(settings.apiKeys.tmdb) },
    { id: "omdb", name: "OMDb", category: "movies", requiresKey: true, configured: Boolean(settings.apiKeys.omdb) },
  ];
}

export function getProviderHint(category: Category) {
  return apiProviderHints[category].join(", ");
}

export interface MetadataResult {
  id: string;
  provider: string;
  title: string;
  subtitle?: string;
  year?: number;
  coverUrl?: string;
  patch: Partial<CulturalItem>;
  links?: ExternalLink[];
}

type JsonRecord = Record<string, unknown>;

const requestHeaders = {
  Accept: "application/json",
};

export async function searchMetadata(item: CulturalItem, settings: AppSettings, query = getTitle(item), session?: CloudSession): Promise<MetadataResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const cloudResults = await searchCloudMetadata(item.category, normalizedQuery, settings, session);
  if (cloudResults.length) return cloudResults;

  const searches: Record<Category, () => Promise<MetadataResult[]>> = {
    games: () => searchGames(normalizedQuery, settings),
    books: () => searchBooks(normalizedQuery),
    albums: () => searchAlbums(normalizedQuery),
    movies: () => searchMovies(normalizedQuery, settings),
    series: () => searchSeries(normalizedQuery, settings),
  };

  return searches[item.category]();
}

async function searchCloudMetadata(category: Category, query: string, settings: AppSettings, session?: CloudSession): Promise<MetadataResult[]> {
  const supabaseUrl = settings.cloud?.supabaseUrl?.replace(/\/$/, "");
  const supabaseAnonKey = settings.cloud?.supabaseAnonKey;

  if (!supabaseUrl || !supabaseAnonKey || !session?.accessToken) return [];

  return fetch(`${supabaseUrl}/functions/v1/metadata-search`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category, query }),
  })
    .then(async (response) => {
      if (!response.ok) return [];
      const json = await response.json();
      return Array.isArray(json.results) ? json.results as MetadataResult[] : [];
    })
    .catch(() => []);
}

async function searchGames(query: string, settings: AppSettings): Promise<MetadataResult[]> {
  const results: MetadataResult[] = [];

  if (settings.apiKeys.rawg) {
    const rawgUrl = new URL("https://api.rawg.io/api/games");
    rawgUrl.searchParams.set("key", settings.apiKeys.rawg);
    rawgUrl.searchParams.set("search", query);
    rawgUrl.searchParams.set("page_size", "5");

    const json = await fetchJson(rawgUrl);
    const rawgResults = arrayOfRecords(json.results).map((game) => {
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
        subtitle: [released?.slice(0, 4), genres].filter(Boolean).join(" · "),
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
      } satisfies MetadataResult;
    });
    results.push(...rawgResults);
  }

  const steamUrl = new URL(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`);
  const steamResults = await fetchJson(steamUrl)
    .then((json) => arrayOfRecords(json).slice(0, 5).map((game) => {
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
      } satisfies MetadataResult;
    }))
    .catch(() => []);

  const wikidataResults = await searchWikidataMedia(query, "games");

  return rankedResults(query, [...results, ...steamResults, ...wikidataResults]);
}

async function searchBooks(query: string): Promise<MetadataResult[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("langRestrict", "pt");

  const googleResults = await fetchJson(url)
    .then((json) => arrayOfRecords(json.items).map((entry) => {
      const info = recordValue(entry.volumeInfo);
      const title = stringValue(info.title);
      const authors = arrayOfStrings(info.authors).join(", ");
      const categories = arrayOfStrings(info.categories).join(", ");
      const publishedDate = stringValue(info.publishedDate);
      const imageLinks = recordValue(info.imageLinks);
      const isbn = bestIsbn(info.industryIdentifiers);
      const coverUrl = bestGoogleBookCover(imageLinks) || openLibraryCoverByIsbn(isbn);

      return {
        id: `google-${stringValue(entry.id) || title}`,
        provider: "Google Books",
        title,
        subtitle: [authors, publishedDate?.slice(0, 4)].filter(Boolean).join(" · "),
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
        links: stringValue(info.infoLink) ? [link("Google Books", stringValue(info.infoLink))] : [],
      } satisfies MetadataResult;
    }))
    .catch(() => []);

  const openLibraryUrl = new URL("https://openlibrary.org/search.json");
  openLibraryUrl.searchParams.set("title", query);
  openLibraryUrl.searchParams.set("limit", "10");

  const openLibraryResults = await fetchJson(openLibraryUrl)
    .then((json) => arrayOfRecords(json.docs).map((book) => {
      const title = stringValue(book.title);
      const author = arrayOfStrings(book.author_name).join(", ");
      const coverId = stringValue(book.cover_i);
      const isbn = arrayOfStrings(book.isbn)[0];
      const coverUrl = openLibraryCoverById(coverId) || openLibraryCoverByIsbn(isbn);
      const key = stringValue(book.key);

      return {
        id: `openlibrary-${key || title}`,
        provider: "Open Library",
        title,
        subtitle: [author, stringValue(book.first_publish_year)].filter(Boolean).join(" · "),
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
      } satisfies MetadataResult;
    }))
    .catch(() => []);

  return rankedResults(query, [...googleResults, ...openLibraryResults]);
}

async function searchAlbums(query: string): Promise<MetadataResult[]> {
  const url = new URL("https://musicbrainz.org/ws/2/release-group/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "6");

  return fetchJson(url)
    .then((json) => arrayOfRecords(json["release-groups"]).map((album) => {
      const id = stringValue(album.id);
      const title = stringValue(album.title);
      const artists = arrayOfRecords(album["artist-credit"])
        .map((artistCredit) => stringValue(recordValue(artistCredit.artist).name))
        .filter(Boolean)
        .join(", ");
      const tags = arrayOfRecords(album.tags).map((tag) => stringValue(tag.name)).filter(Boolean).slice(0, 3).join(", ");
      const firstRelease = stringValue(album["first-release-date"]);
      const coverUrl = id ? `https://coverartarchive.org/release-group/${id}/front-500` : "";

      return {
        id: `musicbrainz-${id || title}`,
        provider: "MusicBrainz",
        title,
        subtitle: [artists, firstRelease?.slice(0, 4), tags].filter(Boolean).join(" · "),
        year: yearFromDate(firstRelease),
        coverUrl,
        patch: cleanPatch({
          category: "albums",
          name: title,
          artist: artists,
          releaseYear: yearFromDate(firstRelease),
          genre: tags,
          coverUrl,
        }),
        links: id ? [link("MusicBrainz", `https://musicbrainz.org/release-group/${id}`)] : [],
      } satisfies MetadataResult;
    }))
    .then((results) => rankedResults(query, results))
    .catch(() => []);
}

async function searchMovies(query: string, settings: AppSettings): Promise<MetadataResult[]> {
  const allResults: MetadataResult[] = [];

  if (settings.apiKeys.tmdb) {
    const tmdbUrl = new URL("https://api.themoviedb.org/3/search/movie");
    tmdbUrl.searchParams.set("api_key", settings.apiKeys.tmdb);
    tmdbUrl.searchParams.set("query", query);
    tmdbUrl.searchParams.set("language", "pt-BR");
    tmdbUrl.searchParams.set("include_adult", "false");

    const tmdbResults = await fetchJson(tmdbUrl)
      .then((json) => arrayOfRecords(json.results).slice(0, 6).map((movie) => {
        const title = stringValue(movie.title);
        const releaseDate = stringValue(movie.release_date);
        const posterPath = stringValue(movie.poster_path);
        const id = stringValue(movie.id);
        const coverUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";

        return {
          id: `tmdb-movie-${id || title}`,
          provider: "TMDB",
          title,
          subtitle: [releaseDate?.slice(0, 4), stringValue(movie.original_title)].filter(Boolean).join(" · "),
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
        } satisfies MetadataResult;
      }))
      .catch(() => []);

    allResults.push(...tmdbResults);
  }

  if (settings.apiKeys.omdb) {
    const omdbUrl = new URL("https://www.omdbapi.com/");
    omdbUrl.searchParams.set("apikey", settings.apiKeys.omdb);
    omdbUrl.searchParams.set("s", query);
    omdbUrl.searchParams.set("type", "movie");

    const omdbResults = await fetchJson(omdbUrl)
      .then((json) => arrayOfRecords(json.Search).slice(0, 8).map((movie) => {
        const title = stringValue(movie.Title);
        const year = numberValue(stringValue(movie.Year).slice(0, 4));
        const poster = normalizePosterUrl(stringValue(movie.Poster));
        const imdbId = stringValue(movie.imdbID);

        return {
          id: `omdb-movie-${imdbId || title}`,
          provider: "OMDb",
          title,
          subtitle: [year, imdbId].filter(Boolean).join(" · "),
          year,
          coverUrl: poster,
          patch: cleanPatch({
            category: "movies",
            title,
            year,
            coverUrl: poster,
          }),
          links: imdbId ? [link("IMDb", `https://www.imdb.com/title/${imdbId}`)] : [],
        } satisfies MetadataResult;
      }))
      .catch(() => []);

    allResults.push(...omdbResults);
  }

  const itunesUrl = new URL("https://itunes.apple.com/search");
  itunesUrl.searchParams.set("term", query);
  itunesUrl.searchParams.set("media", "movie");
  itunesUrl.searchParams.set("entity", "movie");
  itunesUrl.searchParams.set("limit", "6");
  itunesUrl.searchParams.set("country", "BR");

  const itunesResults = await fetchJson(itunesUrl)
    .then((json) => arrayOfRecords(json.results).map((movie) => {
      const title = stringValue(movie.trackName);
      const releaseDate = stringValue(movie.releaseDate);
      const poster = stringValue(movie.artworkUrl100).replace("100x100bb", "600x600bb");
      const url = stringValue(movie.trackViewUrl);

      return {
        id: `itunes-movie-${stringValue(movie.trackId) || title}`,
        provider: "iTunes",
        title,
        subtitle: [releaseDate?.slice(0, 4), stringValue(movie.primaryGenreName)].filter(Boolean).join(" · "),
        year: yearFromDate(releaseDate),
        coverUrl: poster,
        patch: cleanPatch({
          category: "movies",
          title,
          year: yearFromDate(releaseDate),
          genre: stringValue(movie.primaryGenreName),
          runtimeMinutes: minutesFromMillis(numberValue(movie.trackTimeMillis)),
          coverUrl: poster,
        }),
        links: url ? [link("iTunes", url)] : [],
      } satisfies MetadataResult;
    }))
    .catch(() => []);

  allResults.push(...itunesResults);

  const wikidataResults = await searchWikidataMedia(query, "movies");
  allResults.push(...wikidataResults);

  return rankedResults(query, allResults);
}

async function searchSeries(query: string, settings: AppSettings): Promise<MetadataResult[]> {
  if (settings.apiKeys.tmdb) {
    const tmdbUrl = new URL("https://api.themoviedb.org/3/search/tv");
    tmdbUrl.searchParams.set("api_key", settings.apiKeys.tmdb);
    tmdbUrl.searchParams.set("query", query);
    tmdbUrl.searchParams.set("language", "pt-BR");

    const tmdbResults = await fetchJson(tmdbUrl)
      .then((json) => arrayOfRecords(json.results).slice(0, 6).map((show) => {
        const title = stringValue(show.name);
        const firstAirDate = stringValue(show.first_air_date);
        const posterPath = stringValue(show.poster_path);
        const id = stringValue(show.id);
        const coverUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";

        return {
          id: `tmdb-series-${id || title}`,
          provider: "TMDB",
          title,
          subtitle: [firstAirDate?.slice(0, 4), stringValue(show.original_name)].filter(Boolean).join(" · "),
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
        } satisfies MetadataResult;
      }))
      .catch(() => []);

    if (tmdbResults.length) return rankedResults(query, tmdbResults);
  }

  const tvMazeUrl = new URL("https://api.tvmaze.com/search/shows");
  tvMazeUrl.searchParams.set("q", query);

  return fetchJson(tvMazeUrl)
    .then((json) => arrayOfRecords(json).slice(0, 6).map((entry) => {
      const show = recordValue(entry.show);
      const title = stringValue(show.name);
      const premiered = stringValue(show.premiered);
      const image = recordValue(show.image);
      const coverUrl = stringValue(image.original) || stringValue(image.medium);
      const genres = arrayOfStrings(show.genres).join(", ");
      const url = stringValue(show.url);

      return {
        id: `tvmaze-${stringValue(show.id) || title}`,
        provider: "TVMaze",
        title,
        subtitle: [premiered?.slice(0, 4), genres].filter(Boolean).join(" · "),
        year: yearFromDate(premiered),
        coverUrl,
        patch: cleanPatch({
          category: "series",
          title,
          year: yearFromDate(premiered),
          genre: genres,
          coverUrl,
          comments: stripHtml(stringValue(show.summary)),
        }),
        links: url ? [link("TVMaze", url)] : [],
      } satisfies MetadataResult;
    }))
    .then((results) => rankedResults(query, results))
    .catch(() => []);
}

async function fetchJson(url: URL): Promise<JsonRecord> {
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) throw new Error(`Falha ao buscar em ${url.hostname}`);
  return response.json();
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function arrayOfRecords(value: unknown): JsonRecord[] {
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

function minutesFromMillis(value?: number) {
  return value ? Math.round(value / 60000) : undefined;
}

function bestGoogleBookCover(imageLinks: JsonRecord) {
  const cover =
    stringValue(imageLinks.extraLarge) ||
    stringValue(imageLinks.large) ||
    stringValue(imageLinks.medium) ||
    stringValue(imageLinks.small) ||
    stringValue(imageLinks.thumbnail) ||
    stringValue(imageLinks.smallThumbnail);

  return normalizeCoverUrl(cover);
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

function normalizeCoverUrl(url: string) {
  if (!url) return "";
  return url.replace("http://", "https://").replace("&edge=curl", "");
}

function normalizePosterUrl(url: string) {
  if (!url || url === "N/A") return "";
  return normalizeCoverUrl(url);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function link(label: string, url: string): ExternalLink {
  return { id: uid("link"), label, url };
}

async function searchWikidataMedia(query: string, category: "games" | "movies"): Promise<MetadataResult[]> {
  const searchUrl = new URL("https://www.wikidata.org/w/api.php");
  searchUrl.searchParams.set("action", "wbsearchentities");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("language", "pt");
  searchUrl.searchParams.set("uselang", "pt");
  searchUrl.searchParams.set("search", query);
  searchUrl.searchParams.set("limit", "8");

  const searchJson = recordValue(await fetchJson(searchUrl).catch(() => ({})));
  const words = category === "movies" ? ["filme", "film", "movie", "cinema"] : ["jogo", "videogame", "video game", "computer game"];
  const hits = arrayOfRecords(searchJson.search)
    .filter((hit) => {
      const description = stringValue(hit.description).toLowerCase();
      return words.some((word) => description.includes(word));
    })
    .slice(0, 6);

  const ids = hits.map((hit) => stringValue(hit.id)).filter(Boolean);
  if (!ids.length) return [];

  const entityUrl = new URL("https://www.wikidata.org/w/api.php");
  entityUrl.searchParams.set("action", "wbgetentities");
  entityUrl.searchParams.set("format", "json");
  entityUrl.searchParams.set("origin", "*");
  entityUrl.searchParams.set("props", "claims|labels");
  entityUrl.searchParams.set("languages", "pt|en");
  entityUrl.searchParams.set("ids", ids.join("|"));

  const entitiesJson = recordValue(await fetchJson(entityUrl).catch(() => ({})));
  const entities = recordValue(entitiesJson.entities);
  const neededLabels = new Set<string>();

  ids.forEach((id) => {
    const claims = recordValue(recordValue(entities[id]).claims);
    ["P57", "P136", "P178", "P123", "P400"].forEach((prop) => {
      claimEntityIds(claims, prop).forEach((entityId) => neededLabels.add(entityId));
    });
  });

  const labels = neededLabels.size ? await fetchWikidataLabels([...neededLabels]) : {};

  return ids.map((id) => {
    const entity = recordValue(entities[id]);
    const labelsRecord = recordValue(entity.labels);
    const title = stringValue(recordValue(labelsRecord.pt).value) || stringValue(recordValue(labelsRecord.en).value) || id;
    const claims = recordValue(entity.claims);
    const imageName = claimString(claims, "P18");
    const coverUrl = imageName ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=500` : "";
    const year = yearFromDate(claimDate(claims, "P577"));
    const genres = claimEntityIds(claims, "P136").map((genreId) => labels[genreId]).filter(Boolean).join(", ");

    if (category === "movies") {
      const director = claimEntityIds(claims, "P57").map((directorId) => labels[directorId]).filter(Boolean).join(", ");
      return {
        id: `wikidata-movie-${id}`,
        provider: "Wikidata",
        title,
        subtitle: [year, director].filter(Boolean).join(" · "),
        year,
        coverUrl,
        patch: cleanPatch({
          category: "movies",
          title,
          year,
          genre: genres,
          director,
          coverUrl,
        }),
        links: [link("Wikidata", `https://www.wikidata.org/wiki/${id}`)],
      } satisfies MetadataResult;
    }

    const developer = claimEntityIds(claims, "P178").map((developerId) => labels[developerId]).filter(Boolean).join(", ");
    const publisher = claimEntityIds(claims, "P123").map((publisherId) => labels[publisherId]).filter(Boolean).join(", ");
    const platform = claimEntityIds(claims, "P400").map((platformId) => labels[platformId]).filter(Boolean).slice(0, 5).join(", ");

    return {
      id: `wikidata-game-${id}`,
      provider: "Wikidata",
      title,
      subtitle: [year, developer || publisher].filter(Boolean).join(" · "),
      year,
      coverUrl,
      patch: cleanPatch({
        category: "games",
        name: title,
        releaseYear: year,
        genre: genres,
        developer,
        publisher,
        platform,
        coverUrl,
      }),
      links: [link("Wikidata", `https://www.wikidata.org/wiki/${id}`)],
    } satisfies MetadataResult;
  });
}

async function fetchWikidataLabels(ids: string[]): Promise<Record<string, string>> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("props", "labels");
  url.searchParams.set("languages", "pt|en");
  url.searchParams.set("ids", ids.join("|"));

  const json = recordValue(await fetchJson(url).catch(() => ({})));
  const entities = recordValue(json.entities);

  return Object.fromEntries(ids.map((id) => {
    const labels = recordValue(recordValue(entities[id]).labels);
    const value = stringValue(recordValue(labels.pt).value) || stringValue(recordValue(labels.en).value) || id;
    return [id, value];
  }));
}

function claimString(claims: JsonRecord, property: string) {
  const claim = arrayOfRecords(claims[property])[0];
  if (!claim) return "";
  const mainsnak = recordValue(claim.mainsnak);
  const datavalue = recordValue(mainsnak.datavalue);
  return stringValue(datavalue.value);
}

function claimDate(claims: JsonRecord, property: string) {
  const claim = arrayOfRecords(claims[property])[0];
  if (!claim) return "";
  const mainsnak = recordValue(claim.mainsnak);
  const datavalue = recordValue(mainsnak.datavalue);
  return stringValue(recordValue(datavalue.value).time).replace("+", "");
}

function claimEntityIds(claims: JsonRecord, property: string) {
  return arrayOfRecords(claims[property])
    .map((claim) => recordValue(claim.mainsnak))
    .map((mainsnak) => recordValue(mainsnak.datavalue))
    .map((datavalue) => recordValue(datavalue.value))
    .map((value) => stringValue(value.id))
    .filter(Boolean);
}

function cleanPatch<T extends Partial<CulturalItem>>(patch: T): T {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== "" && value !== undefined && value !== null)) as T;
}

function uniqueResults(results: MetadataResult[], limit = 8) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.provider}:${result.title}:${result.year ?? ""}`.toLowerCase();
    if (seen.has(key) || !result.title) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function rankedResults(query: string, results: MetadataResult[], limit = 8) {
  const unique = uniqueResults(results, 50);
  const buckets = new Map<number, MetadataResult[]>();

  unique.forEach((result) => {
    const rank = titleRank(query, result.title);
    buckets.set(rank, [...(buckets.get(rank) ?? []), result]);
  });

  const ranked: MetadataResult[] = [];
  [...buckets.keys()].sort((a, b) => a - b).forEach((rank) => {
    const bucket = buckets.get(rank) ?? [];
    ranked.push(...roundRobinProviders(bucket));
  });

  return ranked.slice(0, limit);
}

function roundRobinProviders(results: MetadataResult[]) {
  const providerOrder = [...new Set(results.map((result) => result.provider))].sort((a, b) => providerPriority(a) - providerPriority(b));
  const pool = [...results].sort((a, b) => {
    const coverScore = Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl));
    if (coverScore) return coverScore;
    return (b.year ?? 0) - (a.year ?? 0);
  });
  const output: MetadataResult[] = [];

  while (pool.length) {
    let moved = false;

    providerOrder.forEach((provider) => {
      const index = pool.findIndex((result) => result.provider === provider);
      if (index >= 0) {
        output.push(pool.splice(index, 1)[0]);
        moved = true;
      }
    });

    if (!moved) output.push(pool.shift()!);
  }

  return output;
}

function titleRank(query: string, title: string) {
  const normalizedQuery = normalizeTitle(query);
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedQuery || !normalizedTitle) return 5;
  if (normalizedTitle === normalizedQuery) return 0;
  if (stripEdition(normalizedTitle) === stripEdition(normalizedQuery)) return 1;
  if (normalizedTitle.startsWith(normalizedQuery)) return 2;
  if (normalizedTitle.includes(normalizedQuery)) return 3;

  const queryWords = normalizedQuery.split(" ").filter((word) => word.length > 2);
  if (queryWords.length && queryWords.every((word) => normalizedTitle.includes(word))) return 4;
  return 5;
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

function stripEdition(value: string) {
  return value
    .replace(/\b(remaster(ed)?|definitive|deluxe|ultimate|complete|goty|game of the year|edition|versao|version)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function providerPriority(provider: string) {
  const priorities: Record<string, number> = {
    RAWG: 1,
    Steam: 2,
    IGDB: 3,
    HowLongToBeat: 4,
    "Google Books": 1,
    "Open Library": 2,
    TMDB: 1,
    OMDb: 2,
    iTunes: 3,
    TVMaze: 2,
    MusicBrainz: 1,
    Wikidata: 9,
  };

  return priorities[provider] ?? 5;
}
