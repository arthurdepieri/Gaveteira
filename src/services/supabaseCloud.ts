import { AppSettings, CloudSession, CulturalItem, FamilyItem, SocialProfile } from "../types";
import { isLegacyDemoItem } from "../utils/legacyDemoItems";

const SESSION_KEY = "gaveteira-cloud-session:v1";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

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
  family_code: string;
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

export function isCloudConfigured(settings: AppSettings) {
  return Boolean(settings.cloud?.supabaseUrl && settings.cloud?.supabaseAnonKey && settings.cloud?.familyCode);
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

export async function signUp(settings: AppSettings, email: string, password: string, displayName: string): Promise<CloudSession> {
  const familyCode = requireFamilyCode(settings);
  const response = await authRequest(settings, "/signup", {
    email,
    password,
    data: {
      display_name: displayName,
      family_code: familyCode,
    },
  });

  const session = authResponseToSession(response);
  const profile = await upsertProfile(settings, session, displayName, familyCode);
  return { ...session, profile };
}

export async function signIn(settings: AppSettings, email: string, password: string): Promise<CloudSession> {
  const response = await authRequest(settings, "/token?grant_type=password", { email, password });
  const session = authResponseToSession(response);
  const profile = await getOrCreateProfile(settings, session);
  return { ...session, profile };
}

export async function changeFamilyCode(settings: AppSettings, session: CloudSession, familyCode: string): Promise<SocialProfile> {
  const displayName = session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da familia";
  return upsertProfile(settings, session, displayName, familyCode);
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
  const familyCode = requireFamilyCode(settings);
  await upsertProfile(settings, session, session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da familia", familyCode);
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
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === session.user.id ? "Voce" : "Pessoa da familia"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  }));
}

async function fetchProfiles(settings: AppSettings, session: CloudSession, ownerIds: string[]): Promise<Record<string, ProfileRow>> {
  const quotedIds = ownerIds.map((id) => `"${id}"`).join(",");
  const rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=id,display_name,family_code&id=in.(${quotedIds})`, {
    method: "GET",
  });

  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

async function getOrCreateProfile(settings: AppSettings, session: CloudSession): Promise<SocialProfile> {
  const familyCode = requireFamilyCode(settings);
  const rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=id,display_name,family_code&id=eq.${session.user.id}`, {
    method: "GET",
  });

  if (rows[0]) {
    if (rows[0].family_code !== familyCode) {
      return upsertProfile(settings, session, rows[0].display_name, familyCode);
    }

    return profileFromRow(rows[0], session.user.email);
  }

  return upsertProfile(settings, session, session.user.email?.split("@")[0] || "Pessoa da familia", familyCode);
}

async function upsertProfile(settings: AppSettings, session: CloudSession, displayName: string, familyCode: string): Promise<SocialProfile> {
  const row = {
    id: session.user.id,
    display_name: displayName,
    family_code: familyCode,
  };

  const rows = await restRequest<ProfileRow[]>(settings, session, "/rest/v1/profiles?on_conflict=id&select=id,display_name,family_code", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });

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
  const familyCode = settings.cloud?.familyCode?.trim();
  if (!familyCode) throw new Error("Configure um codigo de familia em Configuracoes.");
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
    familyCode: row.family_code,
    email,
  };
}

function errorMessage(value: unknown, fallback: string) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return String(record.error_description || record.message || record.msg || record.error || fallback);
}
