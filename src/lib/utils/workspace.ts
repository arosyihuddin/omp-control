export type PreviewKind = 'image' | 'pdf' | 'audio' | 'video';

const previewExtensions: Record<string, PreviewKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', ico: 'image', svg: 'image', avif: 'image',
  pdf: 'pdf',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video',
};

export function previewKindFor(name: string): PreviewKind | null {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? '';
  return previewExtensions[extension] ?? null;
}

export const isPreviewable = (name: string) => previewKindFor(name) !== null;

/** Relative paths are home-scoped; absolute paths address the filesystem root. */
export const joinPath = (base: string, name: string) => base === '.' ? name : base === '/' ? `/${name}` : `${base}/${name}`;
export const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path;
export const dirname = (path: string) => {
  if (path === '/') return '/';
  const parent = path.split('/').slice(0, -1).join('/');
  return parent || (path.startsWith('/') ? '/' : '.');
};
export const displayPath = (path: string) => path.startsWith('/') ? path : path === '.' ? '/home' : `/home/${path}`;
export const isHidden = (name: string) => name.startsWith('.');
