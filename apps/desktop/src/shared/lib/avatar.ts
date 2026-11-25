const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("La photo ne doit pas dépasser 2 Mo.");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Choisissez une image.");
  }
  const bitmap = await createImageBitmap(file);
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de lire l'image.");
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2;
  const sy = (bitmap.height - min) / 2;
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
