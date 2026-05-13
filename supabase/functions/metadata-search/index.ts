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

async function searchMovies(query: string) {
  const results: MetadataResult[] = [];
  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  const omdbKey = Deno.env.get("OMDB_API_KEY");

  if (tmdbKey) {
    const tmdbUrl = new URL("https://api.themoviedb.org/3/search/movie");
    tmdbUrl.searchParams.set("api_key", tmdbKey);
    tmdbUrl.searchParams.set("query", query);
    tmdbUrl.searchParams.set("language", "pt-BR");
    tmdbUrl.searchParams.set("include_adult", "false");

    const tmdb = await fetchJson(tmdbUrl).catch(() => ({}));
    results.push(...arrayOfRecords(tmdb.results).slice(0, 8).map((movie) => {
      const title = stringValue(movie.title);
      const releaseDate = stringValue(movie.release_date);
      const posterPath = stringValue(movie.poster_path);
      const id = stringValue(movie.id);
      const coverUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";

      return {
        id: `tmdb-movie-${id || title}`,
        provider: "TMDB",
        title,
        subtitle: [releaseDate?.slice(0, 4), stringValue(movie.original_title)].filter(Boolean).join(" / "),
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
    }));
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

function link(label: string, url: string) {
  return { id: crypto.randomUUID(), label, url };
}

function cleanPatch(patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== "" && value !== undefined && value !== null));
}

function rankedResults(query: string, results: MetadataResult[], limit = 8) {
  const seen = new Set<string>();
  const unique = results.filter((result) => {
    const key = `${result.provider}:${result.title}:${result.year ?? ""}`.toLowerCase();
    if (seen.has(key) || !result.title) return false;
    seen.add(key);
    return true;
  });

  return unique
    .sort((a, b) => titleRank(query, a.title) - titleRank(query, b.title) || Number(Boolean(b.coverUrl)) - Number(Boolean(a.coverUrl)))
    .slice(0, limit);
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
