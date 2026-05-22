export type Category = "games" | "books" | "albums" | "movies" | "series";
export type ViewKey = Category | "home" | "wishlist" | "progress" | "feed" | "stats" | "family" | "settings";
export type SocialVisibility = "private" | "friends" | "group" | "public";
export type ProfileRole = "user" | "admin";

export type Rating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface TimelineEvent {
  id: string;
  date: string;
  type: "Comecei" | "Pausei" | "Voltei" | "Terminei" | "Abandonei" | "Revi" | "Reli" | "Rejoguei" | "Reouvi" | "Outro";
  note?: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  text: string;
  visibility?: "private" | "friends";
  type?: "Impressão" | "Citação" | "Teoria" | "Progresso" | "Memória" | "Revisita" | "Opinião final";
}

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
}

export interface SharedFields {
  id: string;
  category: Category;
  visibility?: SocialVisibility;
  tags: string[];
  coverUrl?: string;
  links: ExternalLink[];
  timeline: TimelineEvent[];
  diary: DiaryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface GameItem extends SharedFields {
  category: "games";
  name: string;
  platform: string;
  status: string;
  startDate?: string;
  endDate?: string;
  rating?: Rating;
  timePlayed?: string;
  developer?: string;
  publisher?: string;
  releaseYear?: number;
  genre?: string;
  perceivedDifficulty?: string;
  completionType?: "Zerou" | "Platinou" | "Terminou a história" | "Não terminou";
  abandonmentReason?: string;
  notes?: string;
}

export interface BookItem extends SharedFields {
  category: "books";
  title: string;
  author?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  pages?: number;
  currentPage?: number;
  format?: "Físico" | "Kindle" | "Audiobook" | "PDF" | "Outro";
  rating?: Rating;
  genre?: string;
  publisher?: string;
  publicationYear?: number;
  favoriteQuotes?: string;
  personalSummary?: string;
  finalOpinion?: string;
  abandonmentReason?: string;
}

export interface AlbumItem extends SharedFields {
  category: "albums";
  name: string;
  artist?: string;
  status: string;
  releaseYear?: number;
  genre?: string;
  listenedDate?: string;
  rating?: Rating;
  favoriteTracks?: string;
  skippedTracks?: string;
  listenCount?: number;
  comments?: string;
  listenMode?: "Inteiro" | "Parcialmente";
}

export interface MovieItem extends SharedFields {
  category: "movies";
  title: string;
  status: string;
  year?: number;
  genre?: string;
  rating?: Rating;
  startDate?: string;
  endDate?: string;
  director?: string;
  runtimeMinutes?: number;
  comments?: string;
}

export interface SeriesItem extends SharedFields {
  category: "series";
  title: string;
  status: string;
  year?: number;
  genre?: string;
  rating?: Rating;
  startDate?: string;
  endDate?: string;
  currentSeason?: number;
  currentEpisode?: number;
  trackingStatus?: "Em dia" | "Atrasado" | "Pausado" | "Finalizada";
  comments?: string;
}

export type CulturalItem = GameItem | BookItem | AlbumItem | MovieItem | SeriesItem;

export interface AppSettings {
  apiKeys: {
    igdb?: string;
    steam?: string;
    rawg?: string;
    googleBooks?: string;
    spotify?: string;
    lastfm?: string;
    tmdb?: string;
    omdb?: string;
  };
  cloud?: CloudSettings;
}

export interface CloudSettings {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  familyCode?: string;
}

export interface SocialProfile {
  id: string;
  displayName: string;
  email?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  favoriteCategories?: Category[];
  inviteCode?: string;
  familyCode?: string;
  role?: ProfileRole;
}

export interface CloudSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: {
    id: string;
    email?: string;
  };
  profile?: SocialProfile;
}

export interface FamilyItem {
  id: string;
  ownerId: string;
  ownerName: string;
  familyCode: string;
  item: CulturalItem;
  updatedAt: string;
}

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  profile: SocialProfile;
  direction: "sent" | "received" | "friend";
}

export interface AdminProfileSummary {
  profile: SocialProfile;
  itemCount: number;
  lastActivity?: string;
}

export interface AdminOverview {
  profiles: AdminProfileSummary[];
  totalProfiles: number;
  totalItems: number;
}

export interface AppData {
  version: number;
  items: CulturalItem[];
  statuses: Record<Category, string[]>;
  settings: AppSettings;
}
