import { AppSettings, CloudSession } from "../types";
import { refreshCloudSession } from "./supabaseCloud";

const IMAGE_BUCKET = "gaveteira-images";
const MAX_AVATAR_SIZE = 512;
const MAX_COVER_SIZE = 1200;

export type StoredImageKind = "avatars" | "covers";

export async function uploadStoredImage(
  settings: AppSettings,
  session: CloudSession | undefined,
  file: File,
  kind: StoredImageKind,
  itemId?: string,
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  if (!session) {
    return imageFileToDataUrl(file, kind === "avatars" ? { maxSize: MAX_AVATAR_SIZE, square: true } : { maxSize: MAX_COVER_SIZE });
  }

  const { supabaseUrl, supabaseAnonKey } = requireCloudSettings(settings);
  if (session.expiresAt && session.refreshToken && Date.now() + 60_000 >= session.expiresAt) {
    await refreshCloudSession(settings, session);
  }

  const prepared = await imageFileToBlob(file, kind === "avatars" ? { maxSize: MAX_AVATAR_SIZE, square: true } : { maxSize: MAX_COVER_SIZE });
  const extension = prepared.type === "image/png" ? "png" : "jpg";
  const safeId = (itemId || "profile").replace(/[^a-zA-Z0-9_.-]/g, "-");
  const path = `${session.user.id}/${kind}/${safeId}.${extension}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": prepared.type,
      "x-upsert": "true",
    },
    body: prepared,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(json.message || json.error || "Não consegui enviar a imagem para o Storage.");
    throw new Error(message);
  }

  return `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${encodeStoragePath(path)}?v=${Date.now()}`;
}

export function imageFileToDataUrl(file: File, options: { maxSize: number; square?: boolean }) {
  return imageFileToBlob(file, options).then((blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  }));
}

function imageFileToBlob(file: File, options: { maxSize: number; square?: boolean }) {
  return new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não consegui ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não consegui preparar essa imagem."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Seu navegador não conseguiu preparar a imagem."));
          return;
        }

        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        const sourceSize = options.square ? Math.min(sourceWidth, sourceHeight) : Math.max(sourceWidth, sourceHeight);
        const scale = Math.min(1, options.maxSize / sourceSize);
        const targetWidth = options.square ? options.maxSize : Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = options.square ? options.maxSize : Math.max(1, Math.round(sourceHeight * scale));
        const cropSize = Math.min(sourceWidth, sourceHeight);
        const sourceX = options.square ? (sourceWidth - cropSize) / 2 : 0;
        const sourceY = options.square ? (sourceHeight - cropSize) / 2 : 0;
        const drawWidth = options.square ? cropSize : sourceWidth;
        const drawHeight = options.square ? cropSize : sourceHeight;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.fillStyle = "#fffaf1";
        context.fillRect(0, 0, targetWidth, targetHeight);
        context.drawImage(image, sourceX, sourceY, drawWidth, drawHeight, 0, 0, targetWidth, targetHeight);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Não consegui compactar essa imagem."));
            return;
          }
          resolve(blob);
        }, "image/jpeg", 0.84);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function requireCloudSettings(settings: AppSettings) {
  const supabaseUrl = settings.cloud?.supabaseUrl?.replace(/\/$/, "");
  const supabaseAnonKey = settings.cloud?.supabaseAnonKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configure a URL e a anon key do Supabase antes de enviar imagens.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}
