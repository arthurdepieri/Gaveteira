import { AppSettings, Category, CloudSession, CulturalItem, FamilyItem, Friendship, FriendshipStatus, SocialProfile } from "../types";
import { isLegacyDemoItem } from "../utils/legacyDemoItems";

const SESSION_KEY = "gaveteira-cloud-session:v1";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const PROFILE_SELECT = "id,display_name,email,username,bio,avatar_url,favorite_categories,invite_code,family_code";
const LEGACY_PROFILE_SELECT = "id,display_name,family_code";

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
  msg?: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  email?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  favorite_categories?: Category[] | null;
  invite_code?: string | null;
  family_code?: string | null;
}

interface ItemRow {
  id: string;
  owner_id: string;
  family_code: string;
  item: CulturalItem;
  updated_at: string;
  profiles?: {
    display_name?: string;
  };
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export function isCloudConfigured(settings: AppSettings) {
  return Boolean(settings.cloud?.supabaseUrl && settings.cloud?.supabaseAnonKey);
}

export function loadCloudSession(): CloudSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CloudSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveCloudSession(session: CloudSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isSessionExpiredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return normalized.includes("sessao expirou")
    || normalized.includes("sessão expirou")
    || normalized.includes("entre novamente")
    || normalized.includes("jwt expired")
    || normalized.includes("invalid refresh token")
    || normalized.includes("refresh token")
    || normalized.includes("token expir");
}

export async function signUp(settings: AppSettings, email: string, password: string, displayName: string): Promise<CloudSession> {
  const response = await authRequest(settings, "/signup", {
    email,
    password,
    data: {
      display_name: displayName,
    },
  });

  const session = authResponseToSession(response);
  const profile = await upsertProfile(settings, session, { displayName, email });
  return { ...session, profile };
}

export async function signIn(settings: AppSettings, email: string, password: string): Promise<CloudSession> {
  const response = await authRequest(settings, "/token?grant_type=password", { email, password });
  const session = authResponseToSession(response);
  const profile = await getOrCreateProfile(settings, session);
  return { ...session, profile };
}

export async function changeFamilyCode(settings: AppSettings, session: CloudSession, familyCode: string): Promise<SocialProfile> {
  const displayName = session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da Gaveteira";
  return upsertProfile(settings, session, { displayName, familyCode, email: session.user.email });
}

export async function refreshCloudSession(settings: AppSettings, session: CloudSession): Promise<CloudSession> {
  if (!session.refreshToken) {
    throw new Error("Sua sessao expirou. Entre novamente para renovar o acesso.");
  }

  const response = await authRequest(settings, "/token?grant_type=refresh_token", {
    refresh_token: session.refreshToken,
  });

  if (!response.access_token) {
    throw new Error("Nao foi possivel renovar a sessao. Entre novamente.");
  }

  session.accessToken = response.access_token;
  session.refreshToken = response.refresh_token ?? session.refreshToken;
  session.expiresAt = response.expires_in ? Date.now() + response.expires_in * 1000 : session.expiresAt;
  session.user = {
    id: response.user?.id ?? session.user.id,
    email: response.user?.email ?? session.user.email,
  };

  saveCloudSession(session);
  return session;
}

export async function syncMyItems(settings: AppSettings, session: CloudSession, items: CulturalItem[]) {
  const familyCode = session.profile?.familyCode || settings.cloud?.familyCode?.trim() || "social";
  await upsertProfile(settings, session, {
    displayName: session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da Gaveteira",
    email: session.user.email,
    familyCode,
  });
  const rows = items.filter((item) => !isLegacyDemoItem(item.id)).map((item) => ({
    id: item.id,
    owner_id: session.user.id,
    family_code: familyCode,
    item,
    updated_at: item.updatedAt,
  }));

  await deleteMyItemsExcept(settings, session, rows.map((row) => row.id));
  if (!rows.length) return;

  await restRequest(settings, session, "/rest/v1/cultural_items?on_conflict=id,owner_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
}

async function deleteMyItemsExcept(settings: AppSettings, session: CloudSession, itemIds: string[]) {
  const filters = [`owner_id=eq.${encodeURIComponent(session.user.id)}`];

  if (itemIds.length) {
    filters.push(`id=not.in.(${encodeURIComponent(postgrestStringList(itemIds))})`);
  }

  await restRequest(settings, session, `/rest/v1/cultural_items?${filters.join("&")}`, {
    method: "DELETE",
  });
}

export async function deleteMyItem(settings: AppSettings, session: CloudSession, itemId: string) {
  await restRequest(settings, session, `/rest/v1/cultural_items?id=eq.${encodeURIComponent(itemId)}&owner_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: "DELETE",
  });
}

export async function fetchMyItems(settings: AppSettings, session: CloudSession): Promise<CulturalItem[]> {
  const rows = await restRequest<ItemRow[]>(settings, session, "/rest/v1/cultural_items?select=item&owner_id=eq." + encodeURIComponent(session.user.id), {
    method: "GET",
  });

  return rows.map((row) => row.item).filter((item) => !isLegacyDemoItem(item.id));
}

export async function fetchFamilyItems(settings: AppSettings, session: CloudSession): Promise<FamilyItem[]> {
  const familyCode = requireFamilyCode(settings);
  const path = `/rest/v1/cultural_items?select=id,owner_id,family_code,item,updated_at&family_code=eq.${encodeURIComponent(familyCode)}&order=updated_at.desc`;
  const rows = await restRequest<ItemRow[]>(settings, session, path, { method: "GET" });
  const visibleRows = rows.filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id));
  const ownerIds = [...new Set(visibleRows.map((row) => row.owner_id))];
  const profiles = ownerIds.length ? await fetchProfiles(settings, session, ownerIds) : {};

  return visibleRows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === session.user.id ? "Voce" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  }));
}

export async function fetchSocialItems(settings: AppSettings, session: CloudSession): Promise<FamilyItem[]> {
  const friendships = await fetchFriendships(settings, session);
  const friendIds = friendships
    .filter((friendship) => friendship.status === "accepted")
    .map((friendship) => friendship.profile.id);
  const ownerIds = [session.user.id, ...friendIds];
  const rows = await restRequest<ItemRow[]>(settings, session, `/rest/v1/cultural_items?select=id,owner_id,family_code,item,updated_at&owner_id=in.(${ownerIds.join(",")})&order=updated_at.desc`, {
    method: "GET",
  });
  const visibleRows = rows.filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id));
  const profiles = await fetchProfiles(settings, session, [...new Set(visibleRows.map((row) => row.owner_id))]);

  return visibleRows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === session.user.id ? "Voce" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  }));
}

export async function searchProfiles(settings: AppSettings, session: CloudSession, query: string): Promise<SocialProfile[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const safeQuery = normalized.replace(/[(),]/g, " ").trim();
  const filter = encodeURIComponent(`display_name.ilike.*${safeQuery}*,username.ilike.*${safeQuery}*,email.ilike.*${safeQuery}*,invite_code.eq.${safeQuery.toUpperCase()}`);
  const rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=id,display_name,email,username,bio,avatar_url,favorite_categories,invite_code,family_code&or=(${filter})&limit=8`, {
    method: "GET",
  });

  return rows
    .filter((row) => row.id !== session.user.id)
    .map((row) => profileFromRow(row));
}

export async function fetchFriendships(settings: AppSettings, session: CloudSession): Promise<Friendship[]> {
  const filter = encodeURIComponent(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);
  const rows = await restRequest<FriendshipRow[]>(settings, session, `/rest/v1/friend_requests?select=id,requester_id,addressee_id,status,created_at,updated_at&or=(${filter})&order=updated_at.desc`, {
    method: "GET",
  });
  const otherIds = [...new Set(rows.map((row) => row.requester_id === session.user.id ? row.addressee_id : row.requester_id))];
  const profiles = otherIds.length ? await fetchProfiles(settings, session, otherIds) : {};

  return rows.map((row) => {
    const otherId = row.requester_id === session.user.id ? row.addressee_id : row.requester_id;
    const direction = row.status === "accepted" ? "friend" : row.requester_id === session.user.id ? "sent" : "received";
    return {
      id: row.id,
      requesterId: row.requester_id,
      addresseeId: row.addressee_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      profile: profileFromRow(profiles[otherId] ?? { id: otherId, display_name: "Pessoa da Gaveteira" }),
      direction,
    };
  });
}

export async function sendFriendRequest(settings: AppSettings, session: CloudSession, addresseeId: string): Promise<Friendship> {
  if (addresseeId === session.user.id) {
    throw new Error("Voce nao precisa adicionar a si mesmo.");
  }

  const rows = await restRequest<FriendshipRow[]>(settings, session, "/rest/v1/friend_requests?select=id,requester_id,addressee_id,status,created_at,updated_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      requester_id: session.user.id,
      addressee_id: addresseeId,
      status: "pending",
    }),
  });
  const profileRows = await fetchProfiles(settings, session, [addresseeId]);
  const row = rows[0];

  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: profileFromRow(profileRows[addresseeId] ?? { id: addresseeId, display_name: "Pessoa da Gaveteira" }),
    direction: "sent",
  };
}

export async function respondFriendRequest(settings: AppSettings, session: CloudSession, friendshipId: string, status: "accepted" | "rejected") {
  await restRequest(settings, session, `/rest/v1/friend_requests?id=eq.${encodeURIComponent(friendshipId)}&addressee_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  });
}

async function fetchProfiles(settings: AppSettings, session: CloudSession, ownerIds: string[]): Promise<Record<string, ProfileRow>> {
  const quotedIds = ownerIds.map((id) => `"${id}"`).join(",");
  let rows: ProfileRow[];

  try {
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${PROFILE_SELECT}&id=in.(${quotedIds})`, {
      method: "GET",
    });
  } catch (error) {
    if (!isMissingProfileSocialColumns(error)) throw error;
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${LEGACY_PROFILE_SELECT}&id=in.(${quotedIds})`, {
      method: "GET",
    });
  }

  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

async function getOrCreateProfile(settings: AppSettings, session: CloudSession): Promise<SocialProfile> {
  let rows: ProfileRow[];

  try {
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${PROFILE_SELECT}&id=eq.${session.user.id}`, {
      method: "GET",
    });
  } catch (error) {
    if (!isMissingProfileSocialColumns(error)) throw error;
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${LEGACY_PROFILE_SELECT}&id=eq.${session.user.id}`, {
      method: "GET",
    });
  }

  if (rows[0]) {
    if (!rows[0].email && session.user.email) {
      return upsertProfile(settings, session, { ...profileFromRow(rows[0], session.user.email), email: session.user.email });
    }
    return profileFromRow(rows[0], session.user.email);
  }

  return upsertProfile(settings, session, {
    displayName: session.user.email?.split("@")[0] || "Pessoa da Gaveteira",
    email: session.user.email,
    familyCode: settings.cloud?.familyCode?.trim() || "social",
  });
}

export async function updateMyProfile(settings: AppSettings, session: CloudSession, patch: Partial<SocialProfile>): Promise<SocialProfile> {
  return upsertProfile(settings, session, {
    ...session.profile,
    ...patch,
    displayName: patch.displayName || session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da Gaveteira",
    email: session.user.email,
  });
}

async function upsertProfile(settings: AppSettings, session: CloudSession, profile: Partial<SocialProfile> & { displayName: string }): Promise<SocialProfile> {
  const row = {
    id: session.user.id,
    display_name: profile.displayName,
    email: profile.email || session.user.email || null,
    username: cleanUsername(profile.username),
    bio: profile.bio || null,
    avatar_url: profile.avatarUrl || null,
    favorite_categories: profile.favoriteCategories || [],
    family_code: profile.familyCode || settings.cloud?.familyCode?.trim() || "social",
  };

  let rows: ProfileRow[];

  try {
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?on_conflict=id&select=${PROFILE_SELECT}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row),
    });
  } catch (error) {
    if (!isMissingProfileSocialColumns(error)) throw error;
    const legacyRow = {
      id: row.id,
      display_name: row.display_name,
      family_code: row.family_code,
    };
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?on_conflict=id&select=${LEGACY_PROFILE_SELECT}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(legacyRow),
    });
  }

  return profileFromRow(rows[0] ?? row, session.user.email);
}

async function authRequest(settings: AppSettings, path: string, body: unknown): Promise<SupabaseAuthResponse> {
  const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);
  const response = await safeFetch(`${supabaseUrl}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(json, "Falha na autenticacao."));
  return json as SupabaseAuthResponse;
}

async function restRequest<T>(settings: AppSettings, session: CloudSession, path: string, init: RequestInit): Promise<T> {
  const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);

  await ensureFreshSession(settings, session);

  let result = await sendRestRequest(supabaseUrl, supabaseAnonKey, session, path, init);
  if (!result.response.ok && shouldRefreshToken(result.response.status, result.json)) {
    await refreshCloudSession(settings, session);
    result = await sendRestRequest(supabaseUrl, supabaseAnonKey, session, path, init);
  }

  if (result.response.status === 204) return undefined as T;
  if (!result.response.ok) throw new Error(errorMessage(result.json, "Falha ao sincronizar com a nuvem."));
  return result.json as T;
}

async function sendRestRequest(
  supabaseUrl: string,
  supabaseAnonKey: string,
  session: CloudSession,
  path: string,
  init: RequestInit,
) {
  const response = await safeFetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function safeFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Sem conexao com a internet. Suas alteracoes ficaram salvas neste navegador e serao reenviadas quando a conexao voltar.");
    }

    throw new Error("Nao foi possivel conectar ao Supabase. Verifique se o projeto esta ativo, se a Project URL esta correta e se a rede nao esta bloqueando supabase.co.");
  }
}

async function ensureFreshSession(settings: AppSettings, session: CloudSession) {
  if (!session.expiresAt) return;
  if (Date.now() + TOKEN_REFRESH_MARGIN_MS < session.expiresAt) return;
  await refreshCloudSession(settings, session);
}

function shouldRefreshToken(status: number, value: unknown) {
  if (status !== 401) return false;
  const message = errorMessage(value, "").toLowerCase();
  return message.includes("jwt") || message.includes("token") || message.includes("expired");
}

function requireCloudSettings(settings: AppSettings) {
  const supabaseUrl = normalizeSupabaseUrl(settings.cloud?.supabaseUrl);
  const supabaseAnonKey = settings.cloud?.supabaseAnonKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure a URL e a anon key do Supabase em Configuracoes.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function normalizeSupabaseUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("A Supabase URL precisa comecar com https:// e parecer com https://seu-projeto.supabase.co.");
  }

  if (url.hostname === "supabase.com" || url.pathname.includes("/dashboard/")) {
    throw new Error("Use a Project URL do Supabase, nao o link do dashboard. Ela parece com https://seu-projeto.supabase.co.");
  }

  if (!url.hostname.endsWith(".supabase.co") && !url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
    throw new Error("A Supabase URL parece incorreta. No Supabase, copie Project Settings > API > Project URL.");
  }

  return url.origin;
}

function requireFamilyCode(settings: AppSettings) {
  const familyCode = settings.cloud?.familyCode?.trim() || "social";
  return familyCode;
}

function postgrestStringList(values: string[]) {
  return values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",");
}

function authResponseToSession(response: SupabaseAuthResponse): CloudSession {
  if (!response.access_token || !response.user) {
    throw new Error("Login criado, mas o Supabase nao retornou uma sessao. Verifique se confirmacao por email esta ativa.");
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: response.expires_in ? Date.now() + response.expires_in * 1000 : undefined,
    user: {
      id: response.user.id,
      email: response.user.email,
    },
  };
}

function profileFromRow(row: ProfileRow, email?: string): SocialProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email || email,
    username: row.username || undefined,
    bio: row.bio || undefined,
    avatarUrl: row.avatar_url || undefined,
    favoriteCategories: row.favorite_categories || [],
    inviteCode: row.invite_code || undefined,
    familyCode: row.family_code || undefined,
  };
}

function cleanUsername(value?: string) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return normalized || null;
}

function isUniqueFriendshipError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("duplicate key") || normalized.includes("friend_requests_pair_unique");
}

function isMissingProfileSocialColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  const mentionsProfilesCache = normalized.includes("profiles") && normalized.includes("schema cache");
  const mentionsSocialColumn = ["email", "username", "bio", "avatar_url", "favorite_categories", "invite_code"]
    .some((column) => normalized.includes(column));

  return normalized.includes("column profiles.email does not exist")
    || normalized.includes("column profiles.username does not exist")
    || normalized.includes("column profiles.bio does not exist")
    || normalized.includes("column profiles.avatar_url does not exist")
    || normalized.includes("column profiles.favorite_categories does not exist")
    || normalized.includes("column profiles.invite_code does not exist")
    || (mentionsProfilesCache && mentionsSocialColumn)
    || normalized.includes("atualizacao social da tabela profiles");
}

function errorMessage(value: unknown, fallback: string) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const raw = String(record.error_description || record.message || record.msg || record.error || fallback);
  const normalized = raw.toLowerCase();

  if (normalized.includes("jwt expired") || normalized.includes("invalid refresh token") || normalized.includes("refresh token")) {
    return "Sua sessao expirou. Entre novamente para continuar sincronizando.";
  }

  if (normalized.includes("failed to fetch")) {
    return "Nao foi possivel conectar ao Supabase agora. Suas alteracoes ficaram pendentes neste navegador.";
  }

  if (normalized.includes("email rate limit exceeded")) {
    return "O limite de emails do Supabase foi atingido. Tente entrar com uma conta ja criada ou aguarde antes de enviar outro email.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "O Supabase bloqueou essa operacao pelas regras de seguranca. Confira as politicas RLS do projeto.";
  }

  if (normalized.includes("column profiles.") && normalized.includes("does not exist")) {
    return "Seu Supabase ainda nao recebeu a atualizacao social da tabela profiles. Rode o SQL novo em supabase/schema.sql para ativar perfis e amigos.";
  }

  if (normalized.includes("profiles") && normalized.includes("schema cache")) {
    return "O Supabase ainda nao reconheceu os novos campos sociais da tabela profiles. Rode o SQL novo ou aguarde o cache do schema atualizar.";
  }

  if (normalized.includes("relation") && normalized.includes("friend_requests") && normalized.includes("does not exist")) {
    return "Seu Supabase ainda nao tem a tabela de amizades. Rode o SQL novo em supabase/schema.sql para ativar amigos.";
  }

  if (isUniqueFriendshipError(raw)) {
    return "Esse convite de amizade ja existe.";
  }

  return raw;
}
