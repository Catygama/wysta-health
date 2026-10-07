// Attachment rules, shared by the app (picker checks) and the server (the
// authority: it checks the stored file's real type and size).
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf', ...IMAGE_MIME_TYPES] as const;

export function isAllowedImage(mimeType: string | undefined): boolean {
  return !!mimeType && (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export function isAllowedDocument(mimeType: string | undefined): boolean {
  return !!mimeType && (DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

export const ATTACHMENT_TYPE_ERROR = 'Só podes enviar imagens (JPG, PNG, WebP, HEIC) ou PDF.';
export const ATTACHMENT_SIZE_ERROR = 'O ficheiro tem mais de 10 MB. Escolhe um ficheiro mais pequeno.';

// The server's verdict on a stored file (from the _storage system table):
// null if it can be attached as `kind`, else the message to show.
export function storedAttachmentError(
  meta: { size: number; contentType?: string },
  kind: 'image' | 'document',
): string | null {
  if (meta.size > MAX_ATTACHMENT_BYTES) return ATTACHMENT_SIZE_ERROR;
  const allowed = kind === 'image' ? isAllowedImage(meta.contentType) : isAllowedDocument(meta.contentType);
  return allowed ? null : ATTACHMENT_TYPE_ERROR;
}
