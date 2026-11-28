/**
 * Shared Sulam Bibit Class options (Opsi 1A: 8 CR specs + 7 SC specs)
 * and normalization helpers for Excel/DB spec variants.
 */

export const DROP_KELAS_BIBIT_OPTIONS: string[] = [
  'CR - No. 0+ Panjang',
  'CR - No. 0 Pangkas 60cm',
  'CR - No. 1 Panjang',
  'CR - No. 1 Pangkas Prod',
  'CR - No. 2 Panjang',
  'CR - No. 2 Pangkas Prod',
  'CR - No. 3 Pangkas Prod',
  'CR - No. 2 / 3 Crown',
  'SC - No. 0+ Panjang',
  'SC - No. 0 Pangkas 60cm',
  'SC - No. 1 Panjang',
  'SC - No. 1 Pangkas Prod',
  'SC - No. 2 Panjang',
  'SC - No. 2 Pangkas Prod',
  'SC - No. 3 Pangkas Prod',
];

const CANONICAL_SPEK_MAP = new Map<string, string>([
  ['no. 0+ panjang', 'No. 0+ Panjang'],
  ['no. 0 pangkas 60cm', 'No. 0 Pangkas 60cm'],
  ['no. 1 panjang', 'No. 1 Panjang'],
  ['no. 1 pangkas prod', 'No. 1 Pangkas Prod'],
  ['no. 2 panjang', 'No. 2 Panjang'],
  ['no. 2 pangkas prod', 'No. 2 Pangkas Prod'],
  ['no. 3 pangkas prod', 'No. 3 Pangkas Prod'],
  ['no. 2 / 3 crown', 'No. 2 / 3 Crown'],
  // Normalized variants (Digabung -> No. 2 / 3 Crown)
  ['crown no 3', 'No. 2 / 3 Crown'],
  ['crown no. 3', 'No. 2 / 3 Crown'],
  ['crown 3', 'No. 2 / 3 Crown'],
]);

/**
 * Split an optional leading "CR - " or "SC - " prefix from a class/spec string.
 */
export function splitJenisSpekPrefix(value?: string | null): { jenis: string; spek: string } {
  const raw = (value || '').trim();
  if (!raw || raw === '-') return { jenis: '', spek: '-' };
  const match = raw.match(/^(CR|SC)\s*-\s*(.+)$/i);
  if (match) {
    return {
      jenis: match[1].toUpperCase(),
      spek: match[2].trim(),
    };
  }
  return { jenis: '', spek: raw };
}

/**
 * Normalize raw Spek BB strings (merging "Crown No 3" / "Crown 3" into "No. 2 / 3 Crown").
 */
export function normalizeSpekBibitLabel(spek?: string | null): string {
  const { spek: cleanSpek } = splitJenisSpekPrefix(spek);
  if (!cleanSpek || cleanSpek === '-') return '-';
  const collapsed = cleanSpek.replace(/\s+/g, ' ').trim();
  const mapped = CANONICAL_SPEK_MAP.get(collapsed.toLowerCase());
  return mapped || collapsed;
}

/**
 * Format the display class label ("CR - <Spek>" / "SC - <Spek>", or normalized "<Spek>" if jenis is missing).
 */
export function formatSulamClassLabel(
  jenisBibit?: string | null,
  spekBibit?: string | null,
  fallbackKelas?: string | null
): string {
  const parsed = splitJenisSpekPrefix(spekBibit);
  const rawJenis = (jenisBibit || parsed.jenis || '').trim().toUpperCase();
  const normSpek = normalizeSpekBibitLabel(parsed.spek);

  if (rawJenis === 'CR' || rawJenis === 'SC') {
    if (normSpek !== '-') {
      return `${rawJenis} - ${normSpek}`;
    }
    return rawJenis;
  }

  if (normSpek !== '-') {
    return normSpek;
  }

  const cleanKelas = (fallbackKelas || '').trim();
  return cleanKelas && cleanKelas !== '-' ? cleanKelas : 'Lainnya';
}

/**
 * Check whether the selected drop class matches the registered order class/spec.
 */
export function isSulamClassMismatch(
  selectedClass?: string | null,
  orderSpek?: string | null,
  locationJenis?: string | null
): boolean {
  const cleanSelected = (selectedClass || '').trim();
  const cleanOrder = (orderSpek || '').trim();
  if (!cleanSelected || !cleanOrder || cleanOrder === '-') return false;

  const selParsed = splitJenisSpekPrefix(cleanSelected);
  const ordParsed = splitJenisSpekPrefix(cleanOrder);

  const selNormSpek = normalizeSpekBibitLabel(selParsed.spek);
  const ordNormSpek = normalizeSpekBibitLabel(ordParsed.spek);
  if (selNormSpek.toLowerCase() !== ordNormSpek.toLowerCase()) {
    return true;
  }

  const expectedJenis = (ordParsed.jenis || locationJenis || '').trim().toUpperCase();
  if (selParsed.jenis && expectedJenis && expectedJenis !== '-' && selParsed.jenis !== expectedJenis) {
    return true;
  }

  return false;
}

