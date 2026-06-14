import { AdminAuditLog, AdminOverview, AppSettings, Category, CloudSession, CulturalItem, CuratedRecommendation, FamilyItem, Friendship, FriendshipStatus, SocialProfile } from "../types";
import { isLegacyDemoItem } from "../utils/legacyDemoItems";

const SESSION_KEY = "gaveteira-cloud-session:v1";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const LEGACY_SOCIAL_CODE = "social";
const PROFILE_SELECT = "id,display_name,email,username,bio,avatar_url,favorite_categories,invite_code,family_code,role";
const PROFILE_SELECT_WITHOUT_ROLE = "id,display_name,email,username,bio,avatar_url,favorite_categories,invite_code,family_code";
const LEGACY_PROFILE_SELECT = "id,display_name,family_code";

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  error?: string;
  msg?: string;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
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
  role?: string | null;
}

interface ItemRow {
  id: string;
  owner_id: string;
  owner_name?: string;
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

interface AdminItemOwnerRow {
  owner_id: string;
  updated_at?: string | null;
}

interface AdminOverviewRpcRow {
  profile_id: string;
  display_name: string;
  email?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  favorite_categories?: Category[] | null;
  invite_code?: string | null;
  family_code?: string | null;
  role?: string | null;
  item_count?: number | string | null;
  last_activity?: string | null;
}

interface AdminAuditLogRow {
  id: string;
  actor_id: string;
  actor_name?: string | null;
  target_user_id?: string | null;
  target_name?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  created_at: string;
}

interface CuratedRecommendationRow {
  id: string;
  item_id: string;
  owner_id: string;
  curator_id: string;
  note?: string | null;
  created_at: string;
}

interface CuratedRecommendationRpcRow extends ItemRow {
  recommendation_id: string;
  item_id: string;
  curator_id: string;
  curator_name?: string | null;
  note?: string | null;
  created_at: string;
}

export type CloudSocialEventKind = "added" | "updated" | "finished" | "abandoned" | "favorite" | "wishlist" | "diary";

export interface CloudSocialFeedEvent {
  eventId: string;
  eventType: CloudSocialEventKind;
  actorId: string;
  actorName: string;
  itemOwnerId: string;
  itemId: string;
  item: CulturalItem;
  diaryId?: string;
  createdAt: string;
}

interface SocialFeedRpcRow {
  event_id: string;
  event_type: CloudSocialEventKind;
  actor_id: string;
  actor_name: string;
  item_owner_id: string;
  item_id: string;
  item: CulturalItem;
  diary_id?: string | null;
  created_at: string;
}

export type CloudReadinessStatus = "ready" | "attention" | "unknown";

export interface CloudReadinessCheck {
  id: "schema" | "rpc" | "storage" | "metadata-search";
  title: string;
  status: CloudReadinessStatus;
  message: string;
  detail?: string;
}

export interface CloudReadinessReport {
  status: CloudReadinessStatus;
  message: string;
  checkedAt: string;
  checks: CloudReadinessCheck[];
}

export function isCloudConfigured(settings: AppSettings) {
  return Boolean(settings.cloud?.supabaseUrl && settings.cloud?.supabaseAnonKey);
}

export async function checkCloudReadiness(settings: AppSettings, session: CloudSession | null): Promise<CloudReadinessReport> {
  const checkedAt = new Date().toISOString();

  try {
    const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);

    if (!session?.accessToken) {
      const checks = cloudReadinessIds().map((id) => ({
        id,
        title: cloudReadinessTitle(id),
        status: "unknown" as const,
        message: "Entre na sua conta para eu testar esta parte por dentro.",
        detail: "A URL e a anon key existem, mas os testes seguros precisam de uma sessão ativa.",
      }));

      return {
        status: "unknown",
        message: "A conexão básica está preenchida. Falta entrar na conta para conferir o restante.",
        checkedAt,
        checks,
      };
    }

    await ensureFreshSession(settings, session);

    const checks = await Promise.all([
      checkSchemaReadiness(supabaseUrl, supabaseAnonKey, session),
      checkRpcReadiness(supabaseUrl, supabaseAnonKey, session),
      checkStorageReadiness(supabaseUrl, supabaseAnonKey, session),
      checkMetadataSearchReadiness(supabaseUrl, supabaseAnonKey, session),
    ]);
    const readyCount = checks.filter((check) => check.status === "ready").length;
    const needsAttention = checks.some((check) => check.status === "attention");
    const hasUnknown = checks.some((check) => check.status === "unknown");

    return {
      status: needsAttention ? "attention" : hasUnknown ? "unknown" : "ready",
      message: needsAttention
        ? `${readyCount}/${checks.length} partes prontas. Veja abaixo o que precisa de atenção.`
        : hasUnknown
          ? `${readyCount}/${checks.length} partes prontas. Uma parte não respondeu com clareza.`
          : "Nuvem pronta para sincronizar fichas, imagens e buscas automáticas.",
      checkedAt,
      checks,
    };
  } catch (error) {
    return {
      status: "attention",
      message: error instanceof Error ? error.message : "Não consegui verificar a nuvem agora.",
      checkedAt,
      checks: cloudReadinessIds().map((id) => ({
        id,
        title: cloudReadinessTitle(id),
        status: "unknown",
        message: "Não testado.",
        detail: "Corrija a conexão da nuvem e tente novamente.",
      })),
    };
  }
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

  return normalized.includes("sessão expirou")
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

export async function requestPasswordRecovery(settings: AppSettings, email: string) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({ redirect_to: redirectTo });
  await authRequest(settings, `/recover?${params.toString()}`, {
    email,
  });
}

export async function consumePasswordRecoverySession(settings: AppSettings): Promise<CloudSession | null> {
  const params = authParamsFromLocation();
  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? undefined;
  const expiresIn = Number(params.get("expires_in") ?? "");
  const error = params.get("error_description") || params.get("error");

  cleanAuthParamsFromUrl();

  if (error) {
    throw new Error(decodeURIComponent(error));
  }

  if (!accessToken) {
    throw new Error("O link de recuperação expirou ou está incompleto. Peça um novo email para redefinir a senha.");
  }

  const user = await fetchAuthUser(settings, accessToken);
  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

export async function updatePasswordAfterRecovery(settings: AppSettings, session: CloudSession, password: string): Promise<CloudSession> {
  const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);
  await ensureFreshSession(settings, session);

  const response = await safeFetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(json, "Não consegui salvar a nova senha."));

  const user = json as SupabaseUserResponse;
  const updatedSession: CloudSession = {
    ...session,
    user: {
      id: user.id || session.user.id,
      email: user.email ?? session.user.email,
    },
  };
  const profile = await getOrCreateProfile(settings, updatedSession);
  return { ...updatedSession, profile };
}

export function startGoogleSignIn(settings: AppSettings) {
  const { supabaseUrl } = requireCloudSettings(settings);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirectTo,
  });

  window.location.href = `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}

export async function consumeOAuthRedirectSession(settings: AppSettings): Promise<CloudSession | null> {
  const params = authParamsFromLocation();
  if (params.get("type") === "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? undefined;
  const expiresIn = Number(params.get("expires_in") ?? "");
  const error = params.get("error_description") || params.get("error");

  if (error) {
    cleanAuthParamsFromUrl();
    throw new Error(decodeURIComponent(error));
  }

  if (!accessToken) return null;

  const user = await fetchAuthUser(settings, accessToken);
  const session: CloudSession = {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    user: {
      id: user.id,
      email: user.email,
    },
  };
  const profile = await upsertProfile(settings, session, {
    displayName: displayNameFromUser(user),
    email: user.email,
  });

  cleanAuthParamsFromUrl();
  return { ...session, profile };
}

export async function refreshCloudSession(settings: AppSettings, session: CloudSession): Promise<CloudSession> {
  if (!session.refreshToken) {
    throw new Error("Sua sessão expirou. Entre novamente para renovar o acesso.");
  }

  const response = await authRequest(settings, "/token?grant_type=refresh_token", {
    refresh_token: session.refreshToken,
  });

  if (!response.access_token) {
    throw new Error("Não consegui renovar a sessão. Entre novamente para reabrir a nuvem.");
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
  await upsertProfile(settings, session, {
    ...session.profile,
    displayName: session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da Gaveteira",
    email: session.user.email,
  });
  const rows = items.filter((item) => !isLegacyDemoItem(item.id)).map((item) => ({
    id: item.id,
    owner_id: session.user.id,
    family_code: LEGACY_SOCIAL_CODE,
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

export async function upsertMyItem(settings: AppSettings, session: CloudSession, item: CulturalItem, clientChangeId?: string) {
  if (isLegacyDemoItem(item.id)) return;

  await upsertProfile(settings, session, {
    ...session.profile,
    displayName: session.profile?.displayName || session.user.email?.split("@")[0] || "Pessoa da Gaveteira",
    email: session.user.email,
  });

  try {
    await rpcRequest(settings, session, "apply_item_change", {
      requested_operation: "upsert",
      requested_item_id: item.id,
      requested_payload: item,
      requested_local_updated_at: item.updatedAt,
      requested_client_change_id: clientChangeId || `upsert:${item.id}`,
    });
    return;
  } catch (error) {
    if (!isMissingSyncRpc(error)) throw error;
  }

  await restRequest(settings, session, "/rest/v1/cultural_items?on_conflict=id,owner_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: item.id,
      owner_id: session.user.id,
      family_code: LEGACY_SOCIAL_CODE,
      item,
      updated_at: item.updatedAt,
    }),
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

export async function deleteMyItem(settings: AppSettings, session: CloudSession, itemId: string, clientChangeId?: string) {
  try {
    await rpcRequest(settings, session, "apply_item_change", {
      requested_operation: "delete",
      requested_item_id: itemId,
      requested_payload: null,
      requested_local_updated_at: new Date().toISOString(),
      requested_client_change_id: clientChangeId || `delete:${itemId}`,
    });
    return;
  } catch (error) {
    if (!isMissingSyncRpc(error)) throw error;
  }

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
  const visibleRows = rows.filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id) && isVisibleSocialRow(row, session.user.id));
  const ownerIds = [...new Set(visibleRows.map((row) => row.owner_id))];
  const profiles = ownerIds.length ? await fetchProfiles(settings, session, ownerIds) : {};

  return visibleRows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === session.user.id ? "Você" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  }));
}

export async function fetchSocialItems(settings: AppSettings, session: CloudSession): Promise<FamilyItem[]> {
  try {
    const rows = await rpcRequest<ItemRow[]>(settings, session, "get_social_items");
    return rows
      .filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id))
      .map((row) => familyItemFromRpcRow(row, session.user.id));
  } catch (error) {
    if (!isMissingSocialRpc(error)) throw error;
  }

  const friendships = await fetchFriendships(settings, session);
  const friendIds = friendships
    .filter((friendship) => friendship.status === "accepted")
    .map((friendship) => friendship.profile.id);
  const ownerIds = [session.user.id, ...friendIds];
  const rows = await restRequest<ItemRow[]>(settings, session, `/rest/v1/cultural_items?select=id,owner_id,family_code,item,updated_at&owner_id=in.(${ownerIds.join(",")})&order=updated_at.desc`, {
    method: "GET",
  });
  const visibleRows = rows.filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id) && isVisibleSocialRow(row, session.user.id));
  const profiles = await fetchProfiles(settings, session, [...new Set(visibleRows.map((row) => row.owner_id))]);

  return visibleRows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === session.user.id ? "Você" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  }));
}

export async function fetchSocialFeed(settings: AppSettings, session: CloudSession): Promise<CloudSocialFeedEvent[]> {
  const rows = await rpcRequest<SocialFeedRpcRow[]>(settings, session, "get_social_feed", { feed_limit: 80 });
  return rows
    .filter((row) => !isLegacyDemoItem(row.item_id) && !isLegacyDemoItem(row.item.id))
    .map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorName: row.actor_name,
      itemOwnerId: row.item_owner_id,
      itemId: row.item_id,
      item: row.item,
      diaryId: row.diary_id || undefined,
      createdAt: row.created_at,
    }));
}

export async function fetchAdminCuratableItems(settings: AppSettings, session: CloudSession): Promise<FamilyItem[]> {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta nÃ£o tem permissÃµes de administrador.");
  }

  try {
    const rows = await rpcRequest<ItemRow[]>(settings, session, "get_admin_curatable_items");
    return rows
      .filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id))
      .map((row) => familyItemFromRpcRow(row, session.user.id));
  } catch (error) {
    if (!isMissingSocialRpc(error)) throw error;
  }

  const rows = await restRequest<ItemRow[]>(settings, session, "/rest/v1/cultural_items?select=id,owner_id,family_code,item,updated_at&order=updated_at.desc&limit=120", {
    method: "GET",
  });
  const visibleRows = rows.filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id) && isVisibleSocialRow(row, session.user.id));
  const profiles = await fetchProfiles(settings, session, [...new Set(visibleRows.map((row) => row.owner_id))]);

  return visibleRows.map((row) => familyItemFromRow(row, profiles, session.user.id));
}

export async function fetchCuratedRecommendations(settings: AppSettings, session: CloudSession): Promise<CuratedRecommendation[]> {
  try {
    const rows = await rpcRequest<CuratedRecommendationRpcRow[]>(settings, session, "get_curated_recommendations");
    return rows
      .filter((row) => !isLegacyDemoItem(row.id) && !isLegacyDemoItem(row.item.id))
      .map((row) => ({
        ...familyItemFromRpcRow(row, session.user.id),
        recommendationId: row.recommendation_id,
        itemId: row.item_id,
        curatorId: row.curator_id,
        curatorName: row.curator_name || "Curadoria Gaveteira",
        note: row.note || undefined,
        createdAt: row.created_at,
      }));
  } catch (error) {
    if (isMissingCurationTable(error)) return [];
    if (!isMissingSocialRpc(error)) throw error;
  }

  let rows: CuratedRecommendationRow[];

  try {
    rows = await restRequest<CuratedRecommendationRow[]>(settings, session, "/rest/v1/curated_recommendations?select=id,item_id,owner_id,curator_id,note,created_at&order=created_at.desc", {
      method: "GET",
    });
  } catch (error) {
    if (isMissingCurationTable(error)) return [];
    throw error;
  }

  if (!rows.length) return [];

  const itemRows = await fetchItemRowsForRecommendations(settings, session, rows);
  const profiles = await fetchProfiles(settings, session, [...new Set([
    ...rows.map((row) => row.owner_id),
    ...rows.map((row) => row.curator_id),
  ])]);
  const itemRowsByKey = new Map(itemRows.map((row) => [curationPairKey(row.owner_id, row.id), row]));

  return rows
    .map((row) => {
      const itemRow = itemRowsByKey.get(curationPairKey(row.owner_id, row.item_id));
      if (!itemRow || isLegacyDemoItem(itemRow.id) || isLegacyDemoItem(itemRow.item.id) || itemRow.item.visibility === "private") return null;
      const familyItem = familyItemFromRow(itemRow, profiles, session.user.id);
      return {
        ...familyItem,
        recommendationId: row.id,
        itemId: row.item_id,
        curatorId: row.curator_id,
        curatorName: profiles[row.curator_id]?.display_name || "Curadoria Gaveteira",
        note: row.note || undefined,
        createdAt: row.created_at,
      };
    })
    .filter(Boolean) as CuratedRecommendation[];
}

export async function upsertCuratedRecommendation(settings: AppSettings, session: CloudSession, entry: FamilyItem, note: string): Promise<CuratedRecommendation> {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta nÃ£o tem permissÃµes de administrador.");
  }
  if (entry.ownerId === session.user.id) {
    throw new Error("A curadoria deve destacar fichas de outras pessoas.");
  }
  if (entry.item.visibility === "private") {
    throw new Error("Fichas privadas nÃ£o podem entrar na curadoria.");
  }

  const recommendationId = curationPairKey(entry.ownerId, entry.id);
  const createdAt = new Date().toISOString();
  const rows = await restRequest<CuratedRecommendationRow[]>(settings, session, "/rest/v1/curated_recommendations?on_conflict=id&select=id,item_id,owner_id,curator_id,note,created_at", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: recommendationId,
      item_id: entry.id,
      owner_id: entry.ownerId,
      curator_id: session.user.id,
      note: note.trim() || null,
      created_at: createdAt,
    }),
  });
  const row = rows[0];

  return {
    ...entry,
    recommendationId: row.id,
    itemId: row.item_id,
    curatorId: row.curator_id,
    curatorName: session.profile?.displayName || session.user.email || "Curadoria Gaveteira",
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

export async function deleteCuratedRecommendation(settings: AppSettings, session: CloudSession, recommendationId: string) {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta nÃ£o tem permissÃµes de administrador.");
  }

  await restRequest(settings, session, `/rest/v1/curated_recommendations?id=eq.${encodeURIComponent(recommendationId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function searchProfiles(settings: AppSettings, session: CloudSession, query: string): Promise<SocialProfile[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const safeQuery = normalized.replace(/[(),]/g, " ").trim();
  const filter = encodeURIComponent(`display_name.ilike.*${safeQuery}*,username.ilike.*${safeQuery}*,email.ilike.*${safeQuery}*,invite_code.eq.${safeQuery.toUpperCase()}`);
  let rows: ProfileRow[];

  try {
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${PROFILE_SELECT}&or=(${filter})&limit=8`, {
      method: "GET",
    });
  } catch (error) {
    if (!isMissingProfileSocialColumns(error)) throw error;
    rows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${PROFILE_SELECT_WITHOUT_ROLE}&or=(${filter})&limit=8`, {
      method: "GET",
    });
  }

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
    throw new Error("Você não precisa adicionar a si mesmo.");
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

export async function deleteFriendship(settings: AppSettings, session: CloudSession, friendshipId: string) {
  await restRequest(settings, session, `/rest/v1/friend_requests?id=eq.${encodeURIComponent(friendshipId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function fetchAdminOverview(settings: AppSettings, session: CloudSession): Promise<AdminOverview> {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta não tem permissões de administrador.");
  }

  try {
    const rows = await rpcRequest<AdminOverviewRpcRow[]>(settings, session, "get_admin_overview");
    const profiles = rows.map((row) => ({
      profile: profileFromRow({
        id: row.profile_id,
        display_name: row.display_name,
        email: row.email,
        username: row.username,
        bio: row.bio,
        avatar_url: row.avatar_url,
        favorite_categories: row.favorite_categories,
        invite_code: row.invite_code,
        family_code: row.family_code,
        role: row.role,
      }),
      itemCount: Number(row.item_count ?? 0),
      lastActivity: row.last_activity || undefined,
    }));

    return {
      profiles,
      totalProfiles: profiles.length,
      totalItems: profiles.reduce((total, row) => total + row.itemCount, 0),
    };
  } catch (error) {
    if (!isMissingSocialRpc(error)) throw error;
  }

  const profileRows = await restRequest<ProfileRow[]>(settings, session, `/rest/v1/profiles?select=${PROFILE_SELECT}&order=display_name.asc`, {
    method: "GET",
  });
  const itemRows = await restRequest<AdminItemOwnerRow[]>(settings, session, "/rest/v1/cultural_items?select=owner_id,updated_at&order=updated_at.desc", {
    method: "GET",
  });

  const statsByOwner = itemRows.reduce<Record<string, { itemCount: number; lastActivity?: string }>>((acc, row) => {
    const stats = acc[row.owner_id] ?? { itemCount: 0 };
    stats.itemCount += 1;
    if (row.updated_at && (!stats.lastActivity || new Date(row.updated_at).getTime() > new Date(stats.lastActivity).getTime())) {
      stats.lastActivity = row.updated_at;
    }
    acc[row.owner_id] = stats;
    return acc;
  }, {});

  const profiles = profileRows.map((row) => {
    const stats = statsByOwner[row.id] ?? { itemCount: 0 };
    return {
      profile: profileFromRow(row),
      itemCount: stats.itemCount,
      lastActivity: stats.lastActivity,
    };
  });

  return {
    profiles,
    totalProfiles: profiles.length,
    totalItems: itemRows.length,
  };
}

export async function setProfileRole(settings: AppSettings, session: CloudSession, profileId: string, role: "user" | "admin"): Promise<SocialProfile> {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta não tem permissões de administrador.");
  }

  await rpcRequest(settings, session, "set_profile_role", {
    target_profile_id: profileId,
    next_role: role,
  });

  const profiles = await fetchProfiles(settings, session, [profileId]);
  return profileFromRow(profiles[profileId] ?? { id: profileId, display_name: "Pessoa da Gaveteira", role });
}

export async function fetchAdminLogs(settings: AppSettings, session: CloudSession): Promise<AdminAuditLog[]> {
  if (session.profile?.role !== "admin") {
    throw new Error("Sua conta não tem permissões de administrador.");
  }

  try {
    const rows = await rpcRequest<AdminAuditLogRow[]>(settings, session, "get_admin_logs", { log_limit: 40 });
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorName: row.actor_name || "Admin",
      targetUserId: row.target_user_id || undefined,
      targetName: row.target_name || undefined,
      action: row.action,
      details: row.details || {},
      createdAt: row.created_at,
    }));
  } catch (error) {
    if (isMissingSocialRpc(error)) return [];
    throw error;
  }
}

async function fetchProfiles(settings: AppSettings, session: CloudSession, ownerIds: string[]): Promise<Record<string, ProfileRow>> {
  if (!ownerIds.length) return {};

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

async function fetchItemRowsForRecommendations(settings: AppSettings, session: CloudSession, rows: CuratedRecommendationRow[]) {
  const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
  const itemIds = [...new Set(rows.map((row) => row.item_id))];
  if (!ownerIds.length || !itemIds.length) return [];

  return restRequest<ItemRow[]>(
    settings,
    session,
    `/rest/v1/cultural_items?select=id,owner_id,family_code,item,updated_at&owner_id=in.(${ownerIds.join(",")})&id=in.(${encodeURIComponent(postgrestStringList(itemIds))})`,
    { method: "GET" },
  );
}

function familyItemFromRpcRow(row: ItemRow, viewerId: string): FamilyItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || (row.owner_id === viewerId ? "Você" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  };
}

function familyItemFromRow(row: ItemRow, profiles: Record<string, ProfileRow>, viewerId: string): FamilyItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: profiles[row.owner_id]?.display_name || (row.owner_id === viewerId ? "Você" : "Pessoa da Gaveteira"),
    familyCode: row.family_code,
    item: row.item,
    updatedAt: row.updated_at,
  };
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

export async function fetchMyProfile(settings: AppSettings, session: CloudSession): Promise<SocialProfile> {
  return getOrCreateProfile(settings, session);
}

async function upsertProfile(settings: AppSettings, session: CloudSession, profile: Partial<SocialProfile> & { displayName: string }): Promise<SocialProfile> {
  const row: Record<string, unknown> = {
    id: session.user.id,
    display_name: profile.displayName,
    email: profile.email || session.user.email || null,
    family_code: LEGACY_SOCIAL_CODE,
  };

  if ("username" in profile) row.username = cleanUsername(profile.username);
  if ("bio" in profile) row.bio = profile.bio || null;
  if ("avatarUrl" in profile) row.avatar_url = profile.avatarUrl || null;
  if ("favoriteCategories" in profile) row.favorite_categories = profile.favoriteCategories || [];

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

async function checkSchemaReadiness(supabaseUrl: string, supabaseAnonKey: string, session: CloudSession): Promise<CloudReadinessCheck> {
  const probes = [
    "/rest/v1/profiles?select=id,email,username,role&limit=1",
    "/rest/v1/cultural_items?select=id,owner_id,item,updated_at&limit=1",
    "/rest/v1/friend_requests?select=id,status&limit=1",
    "/rest/v1/sync_changes?select=id,status&limit=1",
  ];
  const results = await Promise.all(probes.map((path) => readinessRequest(supabaseUrl, supabaseAnonKey, session, path, { method: "GET" })));
  const missing = results.find((result) => !result.response.ok && isMissingCloudPart(result.message));

  if (missing) {
    return {
      id: "schema",
      title: cloudReadinessTitle("schema"),
      status: "attention",
      message: "O banco ainda não parece com a versão 0.6.7.",
      detail: "Abra o Supabase SQL Editor e rode o conteúdo de supabase/schema.sql. Depois volte aqui e teste de novo.",
    };
  }

  const blocked = results.find((result) => !result.response.ok);
  if (blocked) {
    return {
      id: "schema",
      title: cloudReadinessTitle("schema"),
      status: "unknown",
      message: "Encontrei o banco, mas ele não deixou conferir todas as tabelas.",
      detail: friendlyReadinessMessage(blocked.message),
    };
  }

  return {
    id: "schema",
    title: cloudReadinessTitle("schema"),
    status: "ready",
    message: "As tabelas principais responderam.",
    detail: "Perfis, fichas, amizades e fila de envio parecem criados.",
  };
}

async function checkRpcReadiness(supabaseUrl: string, supabaseAnonKey: string, session: CloudSession): Promise<CloudReadinessCheck> {
  const probes = [
    { name: "get_social_items", body: {} },
    { name: "get_curated_recommendations", body: {} },
    { name: "get_social_feed", body: { feed_limit: 1 } },
    { name: "get_admin_overview", body: {} },
  ];
  const results = await Promise.all(probes.map((probe) => readinessRequest(
    supabaseUrl,
    supabaseAnonKey,
    session,
    `/rest/v1/rpc/${probe.name}`,
    {
      method: "POST",
      body: JSON.stringify(probe.body),
    },
  ).then((result) => ({ ...result, name: probe.name }))));
  const missing = results.filter((result) => !result.response.ok && isMissingCloudPart(result.message));

  if (missing.length) {
    return {
      id: "rpc",
      title: cloudReadinessTitle("rpc"),
      status: "attention",
      message: "Algumas ações internas da nuvem não foram encontradas.",
      detail: `Não encontrei: ${missing.map((result) => result.name).join(", ")}. Se você já rodou o schema.sql, rode notify pgrst, 'reload schema'; no SQL Editor e teste de novo.`,
    };
  }

  return {
    id: "rpc",
    title: cloudReadinessTitle("rpc"),
    status: "ready",
    message: "As ações internas da nuvem responderam.",
    detail: "Feed social, curadoria e visão de admin parecem instalados. A sincronização avançada é conferida quando uma ficha é enviada.",
  };
}

async function checkStorageReadiness(supabaseUrl: string, supabaseAnonKey: string, session: CloudSession): Promise<CloudReadinessCheck> {
  const result = await readinessRequest(supabaseUrl, supabaseAnonKey, session, "/storage/v1/object/list/gaveteira-images", {
    method: "POST",
    body: JSON.stringify({
      limit: 1,
      offset: 0,
      prefix: session.user.id,
    }),
  });

  if (result.response.ok) {
    return {
      id: "storage",
      title: cloudReadinessTitle("storage"),
      status: "ready",
      message: "O espaço de imagens foi encontrado.",
      detail: "O bucket gaveteira-images respondeu ao app.",
    };
  }

  if (result.response.status === 404 || isMissingCloudPart(result.message)) {
    return {
      id: "storage",
      title: cloudReadinessTitle("storage"),
      status: "attention",
      message: "Não encontrei o espaço de imagens.",
      detail: "Confira se existe um bucket público chamado gaveteira-images no Supabase Storage.",
    };
  }

  return {
    id: "storage",
    title: cloudReadinessTitle("storage"),
    status: "unknown",
    message: "Não deu para confirmar o espaço de imagens.",
    detail: friendlyReadinessMessage(result.message),
  };
}

async function checkMetadataSearchReadiness(supabaseUrl: string, supabaseAnonKey: string, session: CloudSession): Promise<CloudReadinessCheck> {
  const result = await readinessRequest(supabaseUrl, supabaseAnonKey, session, "/functions/v1/metadata-search", {
    method: "POST",
    body: JSON.stringify({ category: "books", query: "gaveteira readiness" }),
  });

  if (result.response.ok) {
    return {
      id: "metadata-search",
      title: cloudReadinessTitle("metadata-search"),
      status: "ready",
      message: "A busca automática respondeu.",
      detail: "A Edge Function metadata-search está publicada e aceitando chamadas do app.",
    };
  }

  if (result.response.status === 404 || isMissingCloudPart(result.message)) {
    return {
      id: "metadata-search",
      title: cloudReadinessTitle("metadata-search"),
      status: "attention",
      message: "A busca automática da nuvem não foi encontrada.",
      detail: "Publique supabase/functions/metadata-search no Supabase e confira as chaves de APIs usadas por ela.",
    };
  }

  return {
    id: "metadata-search",
    title: cloudReadinessTitle("metadata-search"),
    status: "unknown",
    message: "A busca automática existe, mas respondeu com erro.",
    detail: friendlyReadinessMessage(result.message),
  };
}

async function readinessRequest(
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
  return { response, json, message: errorMessage(json, response.statusText || "Não consegui verificar essa parte.") };
}

function cloudReadinessIds(): Array<CloudReadinessCheck["id"]> {
  return ["schema", "rpc", "storage", "metadata-search"];
}

function cloudReadinessTitle(id: CloudReadinessCheck["id"]) {
  const labels: Record<CloudReadinessCheck["id"], string> = {
    schema: "Banco de dados",
    rpc: "Ações da nuvem",
    storage: "Imagens",
    "metadata-search": "Busca automática",
  };

  return labels[id];
}

function isMissingCloudPart(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("schema cache")
    || normalized.includes("could not find")
    || normalized.includes("does not exist")
    || normalized.includes("not found")
    || normalized.includes("not exist")
    || normalized.includes("relation ")
    || normalized.includes("function ");
}

function friendlyReadinessMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("jwt") || normalized.includes("token") || normalized.includes("sess")) {
    return "Sua sessão pode ter expirado. Saia da conta, entre de novo e teste novamente.";
  }

  if (normalized.includes("permission") || normalized.includes("row-level security") || normalized.includes("not allowed")) {
    return "O Supabase respondeu, mas bloqueou a consulta. Confira as permissões criadas pelo schema.sql.";
  }

  if (message && message !== "OK") return message;
  return "Tente novamente em instantes. Se repetir, confira o painel do Supabase.";
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
  if (!response.ok) throw new Error(errorMessage(json, "Não consegui autenticar sua conta."));
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
  if (!result.response.ok) throw new Error(errorMessage(result.json, "Não consegui sincronizar com a nuvem."));
  return result.json as T;
}

async function rpcRequest<T>(settings: AppSettings, session: CloudSession, functionName: string, body: Record<string, unknown> = {}): Promise<T> {
  return restRequest<T>(settings, session, `/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
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
      throw new Error("Sem conexão com a internet. Suas alterações ficaram salvas neste navegador e serão reenviadas quando a conexão voltar.");
    }

    throw new Error("Não consegui falar com a nuvem. Verifique se o projeto Supabase está ativo, se a Project URL está correta e se a rede não está bloqueando supabase.co.");
  }
}

async function fetchAuthUser(settings: AppSettings, accessToken: string): Promise<SupabaseUserResponse> {
  const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);
  const response = await safeFetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(json, "Não consegui abrir sua conta Google."));
  return json as SupabaseUserResponse;
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
    throw new Error("Configure a URL e a anon key do Supabase em Configurações.");
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
    throw new Error("A Supabase URL precisa começar com https:// e parecer com https://seu-projeto.supabase.co.");
  }

  if (url.hostname === "supabase.com" || url.pathname.includes("/dashboard/")) {
    throw new Error("Use a Project URL do Supabase, não o link do dashboard. Ela parece com https://seu-projeto.supabase.co.");
  }

  if (!url.hostname.endsWith(".supabase.co") && !url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
    throw new Error("A Supabase URL parece incorreta. No Supabase, copie Project Settings > API > Project URL.");
  }

  return url.origin;
}

function requireFamilyCode(_settings: AppSettings) {
  return LEGACY_SOCIAL_CODE;
}

function postgrestStringList(values: string[]) {
  return values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",");
}

function curationPairKey(ownerId: string, itemId: string) {
  return `${ownerId}:${itemId}`;
}

function authResponseToSession(response: SupabaseAuthResponse): CloudSession {
  if (!response.access_token || !response.user) {
    throw new Error("Login criado, mas o Supabase não retornou uma sessão. Verifique se confirmação por email está ativa.");
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
    role: row.role === "admin" ? "admin" : "user",
  };
}

function authParamsFromLocation() {
  const params = new URLSearchParams();
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const search = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;

  for (const [key, value] of new URLSearchParams(hash)) params.set(key, value);
  for (const [key, value] of new URLSearchParams(search)) {
    if (!params.has(key)) params.set(key, value);
  }

  return params;
}

function cleanAuthParamsFromUrl() {
  if (!window.location.hash && !window.location.search.includes("access_token") && !window.location.search.includes("error")) return;

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search.replace(/[?&](access_token|refresh_token|expires_in|token_type|type|error|error_description)=[^&]*/g, "").replace(/^&/, "?")}`);
  if (window.location.hash) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }
}

function displayNameFromUser(user: SupabaseUserResponse) {
  const metadata = user.user_metadata ?? {};
  const displayName = metadata.full_name || metadata.name || metadata.preferred_username || user.email?.split("@")[0];
  return String(displayName || "Pessoa da Gaveteira");
}

function isVisibleSocialRow(row: ItemRow, viewerId: string) {
  if (row.owner_id === viewerId) return true;
  return (row.item.visibility ?? "friends") !== "private";
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
  const mentionsSocialColumn = ["email", "username", "bio", "avatar_url", "favorite_categories", "invite_code", "role"]
    .some((column) => normalized.includes(column));

  return normalized.includes("column profiles.email does not exist")
    || normalized.includes("column profiles.username does not exist")
    || normalized.includes("column profiles.bio does not exist")
    || normalized.includes("column profiles.avatar_url does not exist")
    || normalized.includes("column profiles.favorite_categories does not exist")
    || normalized.includes("column profiles.invite_code does not exist")
    || normalized.includes("column profiles.role does not exist")
    || (mentionsProfilesCache && mentionsSocialColumn)
    || normalized.includes("atualização social da tabela profiles");
}

function isMissingCurationTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("tabela de curadoria")
    || (normalized.includes("curated_recommendations")
      && (normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("could not find")));
}

function isMissingSocialRpc(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return normalized.includes("schema cache")
    || normalized.includes("could not find")
    || normalized.includes("does not exist")
    || normalized.includes("get_social_items")
    || normalized.includes("get_admin_curatable_items")
    || normalized.includes("get_curated_recommendations")
    || normalized.includes("get_admin_overview")
    || normalized.includes("get_social_feed");
}

function isMissingSyncRpc(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return normalized.includes("schema cache")
    || normalized.includes("could not find")
    || normalized.includes("does not exist")
    || normalized.includes("apply_item_change");
}

function errorMessage(value: unknown, fallback: string) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const raw = String(record.error_description || record.message || record.msg || record.error || fallback);
  const normalized = raw.toLowerCase();

  if (normalized.includes("jwt expired") || normalized.includes("invalid refresh token") || normalized.includes("refresh token")) {
    return "Sua sessão expirou. Entre novamente para continuar sincronizando.";
  }

  if (normalized.includes("failed to fetch")) {
    return "Não consegui falar com a nuvem agora. Suas fichas ficaram pendentes neste navegador.";
  }

  if (normalized.includes("email rate limit exceeded")) {
    return "O limite de emails do Supabase foi atingido. Tente entrar com uma conta já criada ou aguarde antes de enviar outro email.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "O Supabase bloqueou essa operação pelas regras de segurança. Confira as políticas RLS do projeto.";
  }

  if (normalized.includes("column profiles.") && normalized.includes("does not exist")) {
    return "Seu Supabase ainda não recebeu a atualização social da tabela profiles. Rode o SQL novo em supabase/schema.sql para ativar perfis e amigos.";
  }

  if (normalized.includes("profiles") && normalized.includes("schema cache")) {
    return "O Supabase ainda não reconheceu os novos campos sociais da tabela profiles. Rode o SQL novo ou aguarde o cache do schema atualizar.";
  }

  if (normalized.includes("relation") && normalized.includes("friend_requests") && normalized.includes("does not exist")) {
    return "Seu Supabase ainda não tem a tabela de amizades. Rode o SQL novo em supabase/schema.sql para ativar amigos.";
  }

  if (normalized.includes("curated_recommendations") && (normalized.includes("does not exist") || normalized.includes("schema cache") || normalized.includes("could not find"))) {
    return "Seu Supabase ainda nÃ£o tem a tabela de curadoria. Rode o SQL novo em supabase/schema.sql para ativar recomendaÃ§Ãµes destacadas.";
  }

  if (isUniqueFriendshipError(raw)) {
    return "Esse convite de amizade já existe.";
  }

  return raw;
}
