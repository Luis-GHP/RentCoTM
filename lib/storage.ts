import { supabase } from './supabase';

const STORAGE_REF_PREFIX = 'storage://';
const SIGNED_URL_TTL_SECONDS = 15 * 60;

export type StorageRef = {
  bucket: string;
  path: string;
};

export function createStorageRef(bucket: string, path: string) {
  return `${STORAGE_REF_PREFIX}${bucket}/${path}`;
}

export function parseStorageRef(value: string | null | undefined): StorageRef | null {
  if (!value?.startsWith(STORAGE_REF_PREFIX)) return null;
  const rest = value.slice(STORAGE_REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return {
    bucket: rest.slice(0, slash),
    path: rest.slice(slash + 1),
  };
}

function parseSupabaseStorageUrl(value: string): StorageRef | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  let url: URL;
  let projectUrl: URL;
  try {
    url = new URL(value);
    projectUrl = new URL(supabaseUrl);
  } catch {
    return null;
  }

  if (url.origin !== projectUrl.origin) return null;

  const publicPrefix = '/storage/v1/object/public/';
  const signPrefix = '/storage/v1/object/sign/';
  const prefix = url.pathname.startsWith(publicPrefix)
    ? publicPrefix
    : url.pathname.startsWith(signPrefix)
      ? signPrefix
      : null;
  if (!prefix) return null;

  const rest = decodeURIComponent(url.pathname.slice(prefix.length));
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return {
    bucket: rest.slice(0, slash),
    path: rest.slice(slash + 1),
  };
}

export function parseStorageLocation(value: string | null | undefined): StorageRef | null {
  if (!value) return null;
  return parseStorageRef(value) ?? parseSupabaseStorageUrl(value);
}

export async function resolveStorageUrl(value: string | null | undefined) {
  if (!value) return value ?? null;
  const ref = parseStorageLocation(value);
  if (!ref) return value;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('Could not create signed storage URL', error);
    return value;
  }
  return data.signedUrl;
}

export function storagePathFromRef(value: string | null | undefined) {
  return parseStorageLocation(value)?.path ?? null;
}
