import { CalendarDays, Cloud, Edit3, Heart, LogOut, RefreshCw, Search, Sparkles, Trash2, UploadCloud, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSettings, Category, CloudSession, CulturalItem, FamilyItem, Friendship, SocialProfile } from "../types";
import { categoryLabels } from "../data/catalog";
import { deleteFriendship, fetchFriendships, fetchMyItems, fetchMyProfile, fetchSocialItems, respondFriendRequest, searchProfiles, sendFriendRequest, syncMyItems, updateMyProfile } from "../services/supabaseCloud";
import { uploadStoredImage } from "../services/storage";
import { getGenres, getRating, getTitle, getYear, isCompleted, isInProgress, isWishlist } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { ItemDetails } from "./ItemDetails";
import { AuthGate } from "./AuthGate";

interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  profile?: SocialProfile;
  entries: FamilyItem[];
}

const SOCIAL_REFRESH_INTERVAL_MS = 30_000;

export function FamilyView({
  settings,
  session,
  localItems,
  onMergeItems,
  onLogout,
  onAuthenticated,
  onUpdateSettings,
  socialTab,
  onSocialTabChange,
}: {
  settings: AppSettings;
  session: CloudSession | null;
  localItems: CulturalItem[];
  onMergeItems: (items: CulturalItem[]) => void;
  onLogout: () => void;
  onAuthenticated: (session: CloudSession) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  socialTab: "profile" | "friends";
  onSocialTabChange: (tab: "profile" | "friends") => void;
}) {
  const [socialItems, setSocialItems] = useState<FamilyItem[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoaded, setSocialLoaded] = useState(false);
  const socialLoadedRef = useRef(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [sortMode, setSortMode] = useState<"ratingDesc" | "ratingAsc" | "recent">("ratingDesc");
  const [memberProfileSection, setMemberProfileSection] = useState<"summary" | "favorites" | "current" | "recent" | "drawers" | "stats">("summary");
  const [activeEntry, setActiveEntry] = useState<FamilyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SocialProfile[]>([]);
  const [profileDraft, setProfileDraft] = useState(() => profileToDraft(session?.profile));
  const [profileEditing, setProfileEditing] = useState(false);

  const acceptedFriends = friendships.filter((friendship) => friendship.status === "accepted");
  const pendingReceived = friendships.filter((friendship) => friendship.status === "pending" && friendship.direction === "received");
  const pendingSent = friendships.filter((friendship) => friendship.status === "pending" && friendship.direction === "sent");

  const groups = useMemo<OwnerGroup[]>(() => {
    if (!session) return [];

    const byOwner = socialItems.reduce<Record<string, OwnerGroup>>((acc, item) => {
      acc[item.ownerId] = acc[item.ownerId] ?? {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        profile: item.ownerId === session.user.id ? session.profile : acceptedFriends.find((friendship) => friendship.profile.id === item.ownerId)?.profile,
        entries: [],
      };
      acc[item.ownerId].entries.push(item);
      return acc;
    }, {});

    byOwner[session.user.id] = byOwner[session.user.id] ?? {
      ownerId: session.user.id,
      ownerName: session.profile?.displayName || session.user.email || "Você",
      profile: session.profile,
      entries: [],
    };

    acceptedFriends.forEach((friendship) => {
      byOwner[friendship.profile.id] = byOwner[friendship.profile.id] ?? {
        ownerId: friendship.profile.id,
        ownerName: friendship.profile.displayName,
        profile: friendship.profile,
        entries: [],
      };
    });

    return Object.values(byOwner).sort((a, b) => {
      if (a.ownerId === session.user.id) return -1;
      if (b.ownerId === session.user.id) return 1;
      return a.ownerName.localeCompare(b.ownerName);
    });
  }, [acceptedFriends, session, socialItems]);

  const myGroup = useMemo(() => groups.find((group) => group.ownerId === session?.user.id) ?? groups[0], [groups, session?.user.id]);
  const friendGroups = useMemo(() => groups.filter((group) => group.ownerId !== session?.user.id), [groups, session?.user.id]);
  const selectedGroup = socialTab === "profile"
    ? myGroup
    : friendGroups.find((group) => group.ownerId === selectedOwnerId) ?? friendGroups[0];
  const selectedFriendship = selectedGroup && socialTab === "friends"
    ? acceptedFriends.find((friendship) => friendship.profile.id === selectedGroup.ownerId)
    : undefined;
  const selectedProfile = selectedGroup ? buildMemberProfile(selectedGroup) : null;
  const groupedByCategory = selectedGroup ? groupEntriesByCategory(selectedGroup.entries, sortMode) : [];

  useEffect(() => {
    setProfileDraft(profileToDraft(session?.profile));
  }, [session?.profile]);

  useEffect(() => {
    if (socialTab !== "friends") return;

    if (!friendGroups.length && selectedOwnerId) {
      setSelectedOwnerId("");
    }

    if (friendGroups.length && !friendGroups.some((group) => group.ownerId === selectedOwnerId)) {
      setSelectedOwnerId(friendGroups[0].ownerId);
    }
  }, [friendGroups, selectedOwnerId, socialTab]);

  useEffect(() => {
    setMemberProfileSection("summary");
  }, [selectedGroup?.ownerId, socialTab]);

  useEffect(() => {
    if (!session) return;

    socialLoadedRef.current = false;
    setSocialLoaded(false);
    refreshSocial(true);
    const intervalId = window.setInterval(() => refreshSocial(true), SOCIAL_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [session?.user.id]);

  async function uploadLocal() {
    if (!session) {
      setMessage("Entre para enviar seus itens para a nuvem.");
      return;
    }

    setLoading(true);
    setMessage("");

    setLoading(true);
    try {
      await syncMyItems(settings, session, localItems);
      setMessage("Sua gaveteira foi enviada para a nuvem.");
      await refreshSocial(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui enviar suas fichas para a nuvem.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadMine() {
    if (!session) {
      setMessage("Entre para baixar os itens da sua conta.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const items = await fetchMyItems(settings, session);
      onMergeItems(items);
      setMessage("Fichas da sua conta foram mescladas neste navegador.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui baixar suas fichas da nuvem.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSocial(silent = false) {
    if (!session) return;
    const showBusy = !silent || !socialLoadedRef.current;

    if (showBusy) {
      setLoading(true);
      setMessage("");
    }

    try {
      const [nextFriendships, nextItems, freshProfile] = await Promise.all([
        fetchFriendships(settings, session),
        fetchSocialItems(settings, session),
        fetchMyProfile(settings, session),
      ]);
      setFriendships(nextFriendships);
      setSocialItems(nextItems);
      socialLoadedRef.current = true;
      setSocialLoaded(true);
      if (JSON.stringify(freshProfile) !== JSON.stringify(session.profile)) {
        onAuthenticated({ ...session, profile: freshProfile });
      }
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Não consegui abrir o arquivo social.");
      }
    } finally {
      if (showBusy) {
        setLoading(false);
      }
    }
  }

  async function saveProfile() {
    if (!session) return;

    setLoading(true);
    setMessage("");

    try {
      const profile = await updateMyProfile(settings, session, {
        displayName: profileDraft.displayName,
        username: profileDraft.username,
        bio: profileDraft.bio,
        avatarUrl: profileDraft.avatarUrl,
        favoriteCategories: profileDraft.favoriteCategories,
      });
      onAuthenticated({ ...session, profile });
      setMessage("Perfil atualizado.");
      setProfileEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui atualizar sua ficha pessoal.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatarFile(file?: File) {
    if (!file) return;

    setMessage("");
    setLoading(true);
    try {
      const avatarUrl = await uploadStoredImage(settings, session ?? undefined, file, "avatars");
      setProfileDraft((current) => ({ ...current, avatarUrl }));
      setMessage(session ? "Foto enviada. Salve o perfil para sincronizar." : "Foto carregada neste navegador. Salve o perfil para manter.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui preparar essa foto para o perfil.");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    if (!session || !searchQuery.trim()) return;

    setLoading(true);
    setMessage("");

    try {
      setSearchResults(await searchProfiles(settings, session, searchQuery));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui procurar pessoas agora.");
    } finally {
      setLoading(false);
    }
  }

  async function addFriend(profile: SocialProfile) {
    if (!session) return;

    setLoading(true);
    setMessage("");

    try {
      await sendFriendRequest(settings, session, profile.id);
      setMessage(`Convite enviado para ${profile.displayName}.`);
      setSearchResults((current) => current.filter((entry) => entry.id !== profile.id));
      await refreshSocial(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui enviar o convite.");
    } finally {
      setLoading(false);
    }
  }

  async function respond(friendship: Friendship, status: "accepted" | "rejected") {
    if (!session) return;

    setLoading(true);
    setMessage("");

    try {
      await respondFriendRequest(settings, session, friendship.id, status);
      setMessage(status === "accepted" ? `${friendship.profile.displayName} agora está nos seus amigos.` : "Convite recusado.");
      await refreshSocial(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui responder ao convite.");
    } finally {
      setLoading(false);
    }
  }

  async function removeFriend(friendship: Friendship) {
    if (!session) return;
    const confirmed = window.confirm(`Remover ${friendship.profile.displayName} dos seus amigos?`);
    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      await deleteFriendship(settings, session, friendship.id);
      setMessage(`${friendship.profile.displayName} foi removido dos seus amigos.`);
      setSelectedOwnerId("");
      await refreshSocial(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui remover esse amigo.");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <main className="page">
        <section className="list-header">
          <div>
            <p className="eyebrow">Opcional</p>
            <h1>Social</h1>
            <p>Você pode usar a Gaveteira inteira no modo local. Conecte uma conta quando quiser adicionar amigos e visitar outros perfis.</p>
          </div>
          <Cloud size={38} />
        </section>

        <section className="setting-panel cloud-toolbar">
          <div>
            <h2>Modo local ativo</h2>
            <p>{localItems.length} fichas salvas neste navegador. Nada será enviado para a nuvem até você entrar.</p>
          </div>
        </section>

        <AuthGate settings={settings} onUpdateSettings={onUpdateSettings} onAuthenticated={onAuthenticated} layout="panel" />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">{socialTab === "profile" ? "Perfil social" : "Rede social"}</p>
          <h1>{socialTab === "profile" ? "Meu perfil" : "Amigos"}</h1>
          <p>
            {socialTab === "profile"
              ? "Sua ficha pessoal, resumo cultural e favoritos dentro da Gaveteira."
              : "Procure pessoas, aceite convites e abra a gaveteira dos seus amigos."}
          </p>
        </div>
        {socialTab === "profile" ? <UserCheck size={38} /> : <Users size={38} />}
      </section>

      <nav className="social-mobile-switch" aria-label="Alternar área social">
        <button type="button" className={socialTab === "profile" ? "active" : ""} onClick={() => onSocialTabChange("profile")}>
          <UserCheck size={17} />
          Meu perfil
        </button>
        <button type="button" className={socialTab === "friends" ? "active" : ""} onClick={() => onSocialTabChange("friends")}>
          <Users size={17} />
          Amigos
        </button>
      </nav>

      <section className="setting-panel cloud-toolbar">
        <div>
          <h2>{session.profile?.displayName || session.user.email}</h2>
          <p>Código de convite: <strong>{session.profile?.inviteCode || "gerado pelo Supabase"}</strong></p>
        </div>
        <div className="button-row">
          <button className="primary" onClick={uploadLocal} disabled={loading}><UploadCloud size={16} /> Enviar meus itens</button>
          <button className="ghost" onClick={downloadMine} disabled={loading}><Cloud size={16} /> Baixar minha conta</button>
          <button className="ghost" onClick={() => refreshSocial()} disabled={loading}><RefreshCw size={16} /> Atualizar social</button>
          <button className="danger" onClick={onLogout}><LogOut size={16} /> Sair</button>
        </div>
        {message ? <p className="form-note">{message}</p> : null}
      </section>

      {socialTab === "profile" ? (
      <>
      <div className="profile-action-strip">
        <button className="primary" type="button" onClick={() => setProfileEditing(true)}>
          <Edit3 size={16} />
          Editar
        </button>
      </div>
      <section className="social-top-grid social-profile-tab">
        <section className="profile-showcase">
          <div className="profile-showcase-paper">
            <div className="profile-showcase-cover">
              <Avatar name={profileDraft.displayName} avatarUrl={profileDraft.avatarUrl} large />
              <span className="profile-stamp">Meu arquivo</span>
            </div>
            <div className="profile-showcase-body">
              <div className="profile-showcase-heading">
                <p className="eyebrow">Ficha pessoal</p>
              </div>
              <h2>{session.profile?.displayName || session.user.email || "Meu perfil"}</h2>
              <p className="profile-handle">@{session.profile?.username || session.profile?.inviteCode || "gaveteira"}</p>
              <p className="profile-bio">{session.profile?.bio || "Escreva uma bio curta para dar rosto ao seu arquivo pessoal."}</p>
              <div className="profile-chip-row">
                {(session.profile?.favoriteCategories?.length ? session.profile.favoriteCategories : []).map((category) => (
                  <span key={category}>{categoryLabels[category]}</span>
                ))}
                {!session.profile?.favoriteCategories?.length ? <span>Nenhuma gaveta favorita marcada</span> : null}
              </div>
            </div>
            <div className="profile-showcase-side">
              <span>Código</span>
              <strong>{session.profile?.inviteCode || "--"}</strong>
            </div>
          </div>

          {profileEditing ? (
            <div className="setting-panel social-profile-editor">
              <div className="section-heading split">
                <div className="section-heading">
                  <UserCheck size={20} />
                  <h2>Editar perfil</h2>
                </div>
                <button className="ghost compact" type="button" onClick={() => { setProfileEditing(false); setProfileDraft(profileToDraft(session.profile)); }}>
                  <X size={15} />
                  Cancelar
                </button>
              </div>
              <div className="profile-editor-grid">
                <Avatar name={profileDraft.displayName} avatarUrl={profileDraft.avatarUrl} large />
                <div className="form-grid">
                  <label className="field">
                    <span>Nome público</span>
                    <input value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Username</span>
                    <input value={profileDraft.username} onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value })} placeholder="arthur" />
                  </label>
                  <label className="field wide">
                    <span>Bio curta</span>
                    <textarea value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} placeholder="O que você costuma jogar, ler, ouvir ou assistir?" />
                  </label>
                  <label className="field wide">
                    <span>Avatar por URL</span>
                    <input value={profileDraft.avatarUrl} onChange={(event) => setProfileDraft({ ...profileDraft, avatarUrl: event.target.value })} placeholder="Opcional" />
                  </label>
                  <label className="field wide avatar-upload-field">
                    <span>Enviar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => uploadAvatarFile(event.target.files?.[0])}
                    />
                    <small>A imagem será reduzida antes de salvar no perfil.</small>
                  </label>
                  <div className="field wide favorite-drawers-field">
                    <span>Gavetas favoritas</span>
                    <div className="category-chip-editor">
                      {(Object.keys(categoryLabels) as Category[]).map((category) => (
                        <button
                          type="button"
                          key={category}
                          className={profileDraft.favoriteCategories.includes(category) ? "active" : ""}
                          onClick={() => setProfileDraft({ ...profileDraft, favoriteCategories: toggleCategory(profileDraft.favoriteCategories, category) })}
                        >
                          {categoryLabels[category]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="profile-save-row">
                <button className="primary" onClick={saveProfile} disabled={loading || !profileDraft.displayName.trim()}>Salvar perfil</button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
      </>
      ) : null}

      {socialTab === "friends" ? (
      <>
      <section className="social-top-grid">
        <section className="setting-panel social-search-panel">
          <div className="section-heading">
            <Search size={20} />
            <h2>Adicionar amigo</h2>
          </div>
          <div className="social-search-row">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? runSearch() : undefined} placeholder="email, username, nome ou código" />
            <button className="primary" onClick={runSearch} disabled={loading || !searchQuery.trim()}>Buscar</button>
          </div>
          <div className="social-result-list">
            {loading && searchQuery.trim() && !searchResults.length ? <SocialPeopleSkeleton compact /> : searchResults.length ? searchResults.map((profile) => (
              <ProfileRowCard
                key={profile.id}
                profile={profile}
                actionLabel="Adicionar"
                onAction={() => addFriend(profile)}
                disabled={loading || friendships.some((friendship) => friendship.profile.id === profile.id && friendship.status !== "rejected")}
              />
            )) : <p className="empty">Digite email, username, nome ou código para encontrar uma pessoa.</p>}
          </div>
        </section>
        <section className="setting-panel social-rule-card">
          <div className="section-heading">
            <UserPlus size={20} />
            <h2>Como a rede funciona</h2>
          </div>
          <p>A Gaveteira mostra fichas por amizade aceita e respeita a privacidade escolhida em cada ficha.</p>
          <div className="social-rule-steps">
            <span>Enviar convite</span>
            <span>Aceitar amizade</span>
            <span>Ver fichas visíveis</span>
          </div>
        </section>
      </section>

      <section className="social-invites-grid">
        <section className="setting-panel">
          <h2>Convites recebidos</h2>
          <div className="social-result-list">
            {loading && !socialLoaded ? <SocialPeopleSkeleton compact /> : pendingReceived.length ? pendingReceived.map((friendship) => (
              <div className="social-person-row" key={friendship.id}>
                <PersonIdentity profile={friendship.profile} />
                <div className="button-row">
                  <button className="primary compact" onClick={() => respond(friendship, "accepted")} disabled={loading}>Aceitar</button>
                  <button className="ghost compact" onClick={() => respond(friendship, "rejected")} disabled={loading}>Recusar</button>
                </div>
              </div>
            )) : <p className="empty">Nenhum convite na caixa de entrada.</p>}
          </div>
        </section>

        <section className="setting-panel">
          <h2>Convites enviados</h2>
          <div className="social-result-list">
            {loading && !socialLoaded ? <SocialPeopleSkeleton compact /> : pendingSent.length ? pendingSent.map((friendship) => (
              <ProfileRowCard key={friendship.id} profile={friendship.profile} actionLabel="Pendente" disabled />
            )) : <p className="empty">Nenhum convite esperando resposta.</p>}
          </div>
        </section>
      </section>
      </>
      ) : null}

      {socialTab === "friends" ? (
      <section className="section">
        <h2>Perfis dos amigos</h2>
        {loading && !socialLoaded ? <SocialPeopleSkeleton /> : selectedGroup ? (
          <>
            <div className="family-owners">
              {friendGroups.map((group) => (
                <button
                  key={group.ownerId}
                  className={group.ownerId === selectedGroup?.ownerId ? "active" : ""}
                  onClick={() => setSelectedOwnerId(group.ownerId)}
                >
                  <Avatar name={group.ownerId === session.user.id ? "Eu" : group.ownerName} avatarUrl={group.profile?.avatarUrl} />
                  <span>
                    <strong>{group.ownerId === session.user.id ? "Meu perfil" : group.ownerName}</strong>
                    <small>{group.entries.length} itens</small>
                  </span>
                </button>
              ))}
            </div>

            {selectedGroup ? (
              <div className="family-group">
                {selectedProfile ? (
                  <section className="member-profile-card">
                    <div className="member-profile-header">
                      <div className="member-profile-title">
                        <Avatar name={selectedGroup.ownerName} avatarUrl={selectedGroup.profile?.avatarUrl} large />
                        <div>
                          <p className="eyebrow">@{selectedGroup.profile?.username || selectedGroup.profile?.inviteCode || "gaveteira"}</p>
                          <h2>{selectedGroup.ownerId === session.user.id ? "Seu perfil" : selectedGroup.ownerName}</h2>
                          <p className="member-profile-bio">{selectedGroup.profile?.bio || "Este perfil ainda não escreveu uma bio."}</p>
                        </div>
                      </div>
                      <div className="member-profile-actions">
                        <div className="member-profile-stamp">
                          <strong>{selectedProfile.total}</strong>
                          <span>itens</span>
                        </div>
                        {selectedFriendship ? (
                          <button className="danger compact" type="button" onClick={() => removeFriend(selectedFriendship)} disabled={loading}>
                            <Trash2 size={15} />
                            Remover amigo
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="member-profile-tabs" aria-label="Conteúdo do perfil">
                      <button type="button" className={memberProfileSection === "summary" ? "active" : ""} onClick={() => setMemberProfileSection("summary")}>Resumo</button>
                      <button type="button" className={memberProfileSection === "favorites" ? "active" : ""} onClick={() => setMemberProfileSection("favorites")}>Favoritos</button>
                      <button type="button" className={memberProfileSection === "current" ? "active" : ""} onClick={() => setMemberProfileSection("current")}>Em andamento</button>
                      <button type="button" className={memberProfileSection === "recent" ? "active" : ""} onClick={() => setMemberProfileSection("recent")}>Últimas adições</button>
                      <button type="button" className={memberProfileSection === "drawers" ? "active" : ""} onClick={() => setMemberProfileSection("drawers")}>Gavetas</button>
                      <button type="button" className={memberProfileSection === "stats" ? "active" : ""} onClick={() => setMemberProfileSection("stats")}>Mais</button>
                    </div>

                    {memberProfileSection === "summary" ? (
                      <div className="member-profile-summary">
                        <p>{selectedProfile.summary}</p>
                        <div className="member-profile-quick-actions" aria-label="Abrir recortes do perfil">
                          <button type="button" onClick={() => setMemberProfileSection("favorites")}>
                            <Heart size={16} />
                            <span>Favoritos</span>
                            <strong>{selectedProfile.favorites.length}</strong>
                          </button>
                          <button type="button" onClick={() => setMemberProfileSection("current")}>
                            <Sparkles size={16} />
                            <span>Em andamento</span>
                            <strong>{selectedProfile.currently.length}</strong>
                          </button>
                          <button type="button" onClick={() => setMemberProfileSection("recent")}>
                            <CalendarDays size={16} />
                            <span>Últimas adições</span>
                            <strong>{selectedProfile.recent.length}</strong>
                          </button>
                        </div>
                        <div className="member-category-row">
                          {selectedProfile.categoryCards.filter((card) => card.count > 0).map((card) => (
                            <span key={card.category}>
                              <strong>{card.count}</strong>
                              {categoryLabels[card.category]}
                            </span>
                          ))}
                          {!selectedProfile.categoryCards.some((card) => card.count > 0) ? <p className="empty">Este perfil ainda não colocou fichas na nuvem.</p> : null}
                        </div>
                      </div>
                    ) : null}

                    {memberProfileSection === "stats" ? (
                      <>
                        <div className="member-profile-metrics">
                          <ProfileMetric label="Média geral" value={selectedProfile.average ? selectedProfile.average.toFixed(1) : "--"} />
                          <ProfileMetric label="Concluídos" value={selectedProfile.completed} />
                          <ProfileMetric label="Em andamento" value={selectedProfile.inProgress} />
                          <ProfileMetric label="Wishlist" value={selectedProfile.wishlist} />
                          <ProfileMetric label="Catégoria favorita" value={selectedProfile.topCategory} />
                          <ProfileMetric label="Gênero recorrente" value={selectedProfile.topGenre || "--"} />
                        </div>

                        <div className="member-category-row">
                          {selectedProfile.categoryCards.map((card) => (
                            <span key={card.category}>
                              <strong>{card.count}</strong>
                              {categoryLabels[card.category]}
                              <small>{card.average ? `média ${card.average.toFixed(1)}` : "sem nota arquivada"}</small>
                            </span>
                          ))}
                        </div>

                        <GenreCloud title="Gêneros mais recorrentes" genres={selectedProfile.topGenres} />
                      </>
                    ) : null}

                    {memberProfileSection === "favorites" ? (
                      <div className="member-profile-sections single">
                        <section>
                          <h3><Heart size={18} /> Favoritos fixados</h3>
                          <div className="member-highlight-list">
                            {selectedProfile.favorites.length ? selectedProfile.favorites.map((entry) => (
                              <button key={`fav-${entry.ownerId}-${entry.id}`} className="member-highlight-item" onClick={() => setActiveEntry(entry)}>
                                <Cover item={entry.item} compact />
                                <span>
                                  <strong>{getTitle(entry.item)}</strong>
                                  <small>{categoryLabels[entry.item.category]} / {entry.item.status}</small>
                                  <Stars value={entry.item.rating} />
                                </span>
                              </button>
                            )) : <p className="empty">Nenhum favorito fixado nesta prateleira.</p>}
                          </div>
                        </section>
                      </div>
                    ) : null}

                    {memberProfileSection === "current" ? (
                      <div className="member-profile-sections single">
                        <section>
                          <h3><Sparkles size={18} /> Atualmente consumindo</h3>
                          <div className="member-recent-list">
                            {selectedProfile.currently.length ? selectedProfile.currently.map((entry) => (
                              <button key={`current-${entry.ownerId}-${entry.id}`} className="member-recent-item" onClick={() => setActiveEntry(entry)}>
                                <Sparkles size={16} />
                                <span>
                                  <strong>{getTitle(entry.item)}</strong>
                                  <small>{categoryLabels[entry.item.category]} / {entry.item.status}</small>
                                </span>
                              </button>
                            )) : <p className="empty">Nenhuma ficha aberta agora.</p>}
                          </div>
                        </section>
                      </div>
                    ) : null}

                    {memberProfileSection === "recent" ? (
                      <div className="member-profile-sections single">
                        <section>
                          <h3><CalendarDays size={18} /> Últimas adições</h3>
                          <div className="member-recent-list">
                            {selectedProfile.recent.length ? selectedProfile.recent.map((entry) => (
                              <button key={`recent-${entry.ownerId}-${entry.id}`} className="member-recent-item" onClick={() => setActiveEntry(entry)}>
                                <CalendarDays size={16} />
                                <span>
                                  <strong>{getTitle(entry.item)}</strong>
                                  <small>{categoryLabels[entry.item.category]} / {formatDate(entry.updatedAt)}</small>
                                </span>
                              </button>
                            )) : <p className="empty">Nenhuma ficha sincronizada ainda.</p>}
                          </div>
                        </section>
                      </div>
                    ) : null}

                    {memberProfileSection === "drawers" ? (
                      <>
                        <div className="family-sort compact-sort">
                          <span>Ordenar gavetas</span>
                          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                            <option value="ratingDesc">Maior nota</option>
                            <option value="ratingAsc">Menor nota</option>
                            <option value="recent">Mais recentes</option>
                          </select>
                        </div>
                        <div className="family-category-stack">
                          {groupedByCategory.map(([category, entries]) => (
                            <section key={category} className={`family-category family-category-${category}`}>
                              <h4>{categoryLabels[category]}</h4>
                              <div className="family-grid">
                                {entries.map((entry) => (
                                  <button key={`${entry.ownerId}-${entry.id}`} className="family-card" onClick={() => setActiveEntry(entry)}>
                                    <Cover item={entry.item} compact />
                                    <div>
                                      <strong>{getTitle(entry.item)}</strong>
                                      <small>{entry.item.status}{getYear(entry.item) ? ` / ${getYear(entry.item)}` : ""}</small>
                                      <Stars value={entry.item.rating} />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </section>
                          ))}
                          {!groupedByCategory.length ? <p className="empty">Nenhuma gaveta enviada para a nuvem ainda.</p> : null}
                        </div>
                      </>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="social-empty-state">
            <Users size={28} />
            <h3>Nenhum amigo na mesa ainda</h3>
            <p>Busque alguém por email, username ou código de convite. Quando a pessoa aceitar, o perfil dela aparece aqui com favoritos, últimas adições e gavetas visíveis.</p>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => document.querySelector<HTMLInputElement>(".social-search-row input")?.focus()}>
                <UserPlus size={16} />
                Adicionar amigo
              </button>
              <button type="button" className="ghost" onClick={() => refreshSocial()}>
                <RefreshCw size={16} />
                Atualizar social
              </button>
            </div>
          </div>
        )}
      </section>
      ) : null}
      {activeEntry ? (
        <ItemDetails
          item={activeEntry.item}
          ownerName={activeEntry.ownerName}
          onClose={() => setActiveEntry(null)}
        />
      ) : null}
    </main>
  );
}

function SocialPeopleSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`social-skeleton-stack${compact ? " compact" : ""}`} aria-label="Carregando pessoas">
      {[0, 1, 2].slice(0, compact ? 2 : 3).map((item) => (
        <div className="social-person-row social-person-skeleton" key={item}>
          <span className="avatar skeleton-block" />
          <span>
            <strong className="skeleton-line skeleton-line-title" />
            <small className="skeleton-line skeleton-line-short" />
          </span>
          {!compact ? <i className="skeleton-pill" /> : null}
        </div>
      ))}
    </div>
  );
}

function ProfileRowCard({
  profile,
  actionLabel,
  disabled,
  onAction,
}: {
  profile: SocialProfile;
  actionLabel: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="social-person-row">
      <PersonIdentity profile={profile} />
      <button className="ghost compact" onClick={onAction} disabled={disabled || !onAction}>
        <UserPlus size={15} />
        {actionLabel}
      </button>
    </div>
  );
}

function PersonIdentity({ profile }: { profile: SocialProfile }) {
  return (
    <div className="social-person-identity">
      <Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} />
      <span>
        <strong>{profile.displayName}</strong>
        <small>{profile.username ? `@${profile.username}` : profile.inviteCode ? `código ${profile.inviteCode}` : profile.email || "perfil Gaveteira"}</small>
      </span>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function GenreCloud({ title, genres }: { title: string; genres: string[] }) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="tag-row">
        {genres.length ? genres.map((genre) => <span key={genre}>{genre}</span>) : <p className="empty">Ainda sem gêneros recorrentes.</p>}
      </div>
    </section>
  );
}

function groupEntriesByCategory(entries: FamilyItem[], sortMode: "ratingDesc" | "ratingAsc" | "recent"): Array<[Category, FamilyItem[]]> {
  const categories = Object.keys(categoryLabels) as Category[];
  return categories
    .map((category) => [
      category,
      entries
        .filter((entry) => entry.item.category === category)
        .sort((a, b) => sortEntries(a, b, sortMode)),
    ] as [Category, FamilyItem[]])
    .filter(([, categoryEntries]) => categoryEntries.length);
}

function sortEntries(a: FamilyItem, b: FamilyItem, sortMode: "ratingDesc" | "ratingAsc" | "recent") {
  if (sortMode === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  const diff = getRating(a.item) - getRating(b.item);
  if (sortMode === "ratingAsc") return diff || getTitle(a.item).localeCompare(getTitle(b.item));
  return -diff || getTitle(a.item).localeCompare(getTitle(b.item));
}

function buildMemberProfile(group: OwnerGroup) {
  const entries = group.entries;
  const total = entries.length;
  const ratings = entries.map((entry) => getRating(entry.item)).filter((rating) => rating > 0);
  const average = ratings.length ? ratings.reduce<number>((sum, rating) => sum + rating, 0) / ratings.length : 0;
  const categoryCards = (Object.keys(categoryLabels) as Category[]).map((category) => {
    const categoryEntries = entries.filter((entry) => entry.item.category === category);
    const categoryRatings = categoryEntries.map((entry) => getRating(entry.item)).filter((rating) => rating > 0);
    return {
      category,
      count: categoryEntries.length,
      average: categoryRatings.length ? categoryRatings.reduce<number>((sum, rating) => sum + rating, 0) / categoryRatings.length : 0,
    };
  });
  const favoriteCategories = group.profile?.favoriteCategories?.length
    ? group.profile.favoriteCategories.map((category) => categoryLabels[category]).join(", ")
    : "";
  const topCategoryEntry = [...categoryCards].sort((a, b) => b.count - a.count)[0];
  const topGenre = topEntry(entries.flatMap((entry) => getGenres(entry.item)));
  const completed = entries.filter((entry) => isCompleted(entry.item)).length;
  const inProgress = entries.filter((entry) => isInProgress(entry.item)).length;
  const wishlist = entries.filter((entry) => isWishlist(entry.item)).length;
  const favorites = [...entries]
    .filter((entry) => getRating(entry.item) >= 4.5)
    .sort((a, b) => getRating(b.item) - getRating(a.item) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
  const recent = [...entries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const currently = [...entries]
    .filter((entry) => isInProgress(entry.item))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const topCategory = favoriteCategories || (topCategoryEntry?.count ? categoryLabels[topCategoryEntry.category] : "--");
  const topGenres = topEntries(entries.flatMap((entry) => getGenres(entry.item)), 8);
  const summaryParts = [
    group.profile?.bio,
    favoriteCategories ? `categorias favoritas: ${favoriteCategories}` : "",
    topGenre ? `gênero recorrente: ${topGenre}` : "",
    inProgress ? `${inProgress} em andamento` : "",
  ].filter(Boolean);

  return {
    total,
    average,
    completed,
    inProgress,
    wishlist,
    topCategory,
    topGenre,
    topGenres,
    categoryCards,
    favorites,
    recent,
    currently,
    summary: summaryParts.length ? summaryParts.join(" / ") : "Um resumo aparece aqui conforme a gaveteira ganha novas fichas.",
  };
}

function topEntry(values: string[]) {
  return topEntries(values, 1)[0] ?? "";
}

function topEntries(values: string[], limit: number) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function profileToDraft(profile?: SocialProfile) {
  return {
    displayName: profile?.displayName || "",
    username: profile?.username || "",
    bio: profile?.bio || "",
    avatarUrl: profile?.avatarUrl || "",
    favoriteCategories: profile?.favoriteCategories || [] as Category[],
  };
}

function toggleCategory(categories: Category[], category: Category) {
  return categories.includes(category)
    ? categories.filter((entry) => entry !== category)
    : [...categories, category];
}

function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Escolha um arquivo de imagem."));
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não consegui preparar essa imagem."));
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Seu navegador não conseguiu preparar a foto."));
          return;
        }

        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;

        canvas.width = size;
        canvas.height = size;
        context.fillStyle = "#fffaf1";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function Avatar({ name, avatarUrl, large = false }: { name: string; avatarUrl?: string; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl && !imageFailed);

  return (
    <span className={`family-owner-avatar member-profile-avatar${large ? " large-avatar" : ""}`}>
      {showImage ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : avatarText(name)}
    </span>
  );
}

function avatarText(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";
}
