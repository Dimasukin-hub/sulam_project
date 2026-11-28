import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractSessionUser } from '@/lib/sulamRoleHelper';
import { hasCustomMenuOverride, hasMenuAccess } from '@/lib/menuAccess';
import { normalizeSpekBibitLabel } from '@/lib/sulamClassOptions';

export type SulamFormMenuId = 'form_order_sulam' | 'form_drop_sulam' | 'form_realisasi_sulam';

/**
 * Verify whether the request's session cookie allows access to the target Sulam form menu.
 * Preserves legacy default role permissions when no custom menu override is configured.
 */
export function isAuthorizedForSulamForm(
  request: NextRequest,
  menuId: SulamFormMenuId,
  defaultAllowedRoles: string[],
  fallbackBodyRole?: string | null
): { allowed: boolean; role: string } {
  const sessionUser = extractSessionUser(request);
  if (sessionUser) {
    if (hasCustomMenuOverride(sessionUser, 'sulam')) {
      return {
        allowed: hasMenuAccess(sessionUser, 'sulam', menuId),
        role: sessionUser.role,
      };
    }
    const allowed =
      defaultAllowedRoles.includes(sessionUser.role) ||
      hasMenuAccess(sessionUser, 'sulam', menuId);
    return { allowed, role: sessionUser.role };
  }

  if (fallbackBodyRole) {
    return {
      allowed: defaultAllowedRoles.includes(fallbackBodyRole),
      role: fallbackBodyRole,
    };
  }

  return { allowed: true, role: '' };
}

/**
 * Look up standard CD and Fuso capacity (batang/rit) from MasterSpekBibitSulam.
 * Falls back to 2000 (CD) and 3500 (Fuso) when no matching spec exists.
 */
export async function resolveSulamSpekRit(
  kelasBibit?: string | null
): Promise<{ stdRitCD: number; stdRitFuso: number }> {
  let stdRitCD = 2000;
  let stdRitFuso = 3500;
  if (kelasBibit && kelasBibit.trim()) {
    const normalizedSpek = normalizeSpekBibitLabel(kelasBibit);
    const spek = await prisma.masterSpekBibitSulam.findFirst({
      where: {
        OR: [
          { spekBBSulamBtg: { equals: kelasBibit.trim(), mode: 'insensitive' } },
          ...(normalizedSpek !== '-'
            ? [{ spekBBSulamBtg: { equals: normalizedSpek, mode: 'insensitive' as const } }]
            : []),
        ],
      },
    });
    if (spek) {
      if (spek.cd > 0) stdRitCD = spek.cd;
      if (spek.fuso > 0) stdRitFuso = spek.fuso;
    }
  }
  return { stdRitCD, stdRitFuso };
}

/**
 * Look up the active bibit spec & standard CD capacity for a location from ListSulam.
 */
export async function resolveLocationRealSpec(
  lokasi: string
): Promise<{ bibitOrdered: string; stdRit: number }> {
  let bibitOrdered = '-';
  let stdRit = 2000;
  const ls = await prisma.listSulam.findUnique({ where: { lokasi } });
  if (ls?.spekBibit) {
    bibitOrdered = ls.spekBibit;
    const { stdRitCD } = await resolveSulamSpekRit(bibitOrdered);
    stdRit = stdRitCD;
  }
  return { bibitOrdered, stdRit };
}

export interface ListSulamDeltaInput {
  lokasi: string;
  wilayah?: string | null;
  orderRitDelta?: number;
  orderJumlahDelta?: number;
  dropRitDelta?: number;
  sulamRealDelta?: number;
  spekBibit?: string | null;
  keteranganProses?: string | null;
  tglOrder?: Date | null;
  recomputeOrderDate?: boolean;
  recomputeLastSulamDate?: boolean;
}

/**
 * Apply incremental deltas to ListSulam and recompute derived percentages/balances safely.
 */
export async function applyListSulamDelta(input: ListSulamDeltaInput): Promise<void> {
  const {
    lokasi,
    wilayah,
    orderRitDelta = 0,
    orderJumlahDelta = 0,
    dropRitDelta = 0,
    sulamRealDelta = 0,
    spekBibit,
    keteranganProses,
    tglOrder,
    recomputeOrderDate = false,
    recomputeLastSulamDate = false,
  } = input;

  const existing = await prisma.listSulam.findUnique({ where: { lokasi } });

  if (existing) {
    const newJumlah = Math.max(0, (existing.permintaanJumlah || 0) + orderJumlahDelta);
    const newRit = Math.max(0, (existing.permintaanRit || 0) + orderRitDelta);
    const newDropReal = Math.max(0, (existing.dropReal || 0) + dropRitDelta);
    const newDropTotal = (existing.permintaanRealRit || 0) + newDropReal;
    const dropDev = newRit - newDropTotal;
    const dropPct = newRit > 0 ? Number(((newDropTotal / newRit) * 100).toFixed(1)) : 0;

    const newSulamReal = Math.max(0, (existing.sulamReal || 0) + sulamRealDelta);
    const sulamManual = existing.sulamManual || 0;
    const newSulamSaldo = Math.max(0, newDropTotal - newSulamReal - sulamManual);
    const sulamPct =
      newDropTotal > 0 ? Number((((newSulamReal + sulamManual) / newDropTotal) * 100).toFixed(1)) : 0;

    let nextTglOrder = tglOrder !== undefined ? tglOrder : existing.tglOrder;
    if (recomputeOrderDate) {
      const latestOrder = await prisma.masterDataOrderSulam.findFirst({
        where: { lokasi },
        orderBy: [{ tanggalOrder: 'desc' }, { id: 'desc' }],
        select: { tanggalOrder: true },
      });
      nextTglOrder = latestOrder?.tanggalOrder ?? null;
    }

    let nextSulamLastDate = existing.sulamLastDate;
    if (recomputeLastSulamDate) {
      const latestReal = await prisma.formRealisasiSulam.findFirst({
        where: { lokasi },
        orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
        select: { tanggal: true },
      });
      nextSulamLastDate = latestReal?.tanggal ?? null;
    }

    await prisma.listSulam.update({
      where: { lokasi },
      data: {
        wilayah: wilayah || existing.wilayah,
        tglOrder: nextTglOrder,
        permintaanJumlah: newJumlah,
        permintaanRit: newRit,
        dropReal: newDropReal,
        dropTotal: newDropTotal,
        dropDev,
        dropPct,
        sulamReal: newSulamReal,
        sulamSaldo: newSulamSaldo,
        sulamPct,
        sulamLastDate: nextSulamLastDate,
        ...(spekBibit !== undefined ? { spekBibit: spekBibit || existing.spekBibit } : {}),
        ...(keteranganProses !== undefined
          ? { keteranganProses: keteranganProses || existing.keteranganProses }
          : {}),
      },
    });
    return;
  }

  // Only create a new ListSulam row when positive quantities are being added
  const positiveRit = Math.max(0, orderRitDelta);
  const positiveJumlah = Math.max(0, orderJumlahDelta);
  const positiveDrop = Math.max(0, dropRitDelta);
  const positiveSulam = Math.max(0, sulamRealDelta);
  if (positiveRit === 0 && positiveDrop === 0 && positiveSulam === 0) return;

  const mLoc = await prisma.masterStatusLokasi.findUnique({ where: { lokasi } });
  const dropDev = positiveRit - positiveDrop;
  const dropPct = positiveRit > 0 ? Number(((positiveDrop / positiveRit) * 100).toFixed(1)) : 0;
  const sulamSaldo = Math.max(0, positiveDrop - positiveSulam);
  const sulamPct = positiveDrop > 0 ? Number(((positiveSulam / positiveDrop) * 100).toFixed(1)) : 0;

  let nextSulamLastDate: Date | null = null;
  if (recomputeLastSulamDate && positiveSulam > 0) {
    const latestReal = await prisma.formRealisasiSulam.findFirst({
      where: { lokasi },
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      select: { tanggal: true },
    });
    nextSulamLastDate = latestReal?.tanggal ?? null;
  }

  await prisma.listSulam.create({
    data: {
      lokasi,
      wilayah: wilayah || mLoc?.strucPlant,
      jenisBibit: mLoc?.jenis,
      kelasBibit: mLoc?.kelas,
      tglRawat: mLoc?.tglRawat,
      tglStdForcing: mLoc?.forcingStd,
      tglFProd: mLoc?.forcingGabungan || mLoc?.forcing2027 || mLoc?.forcingProd2026,
      tglOrder: tglOrder ?? null,
      umurForcing: mLoc?.umurFProd,
      permintaanJumlah: positiveJumlah,
      permintaanRit: positiveRit,
      dropReal: positiveDrop,
      dropTotal: positiveDrop,
      dropDev,
      dropPct,
      sulamReal: positiveSulam,
      sulamSaldo,
      sulamPct,
      sulamLastDate: nextSulamLastDate,
      spekBibit: spekBibit ?? null,
      keteranganProses: keteranganProses ?? null,
    },
  });
}

/**
 * Parse a numeric ID from either URL query param `?id=...` or request JSON body `{ id }`.
 */
export async function extractRecordId(request: NextRequest): Promise<number | null> {
  const { searchParams } = new URL(request.url);
  const qId = searchParams.get('id');
  if (qId && !isNaN(Number(qId))) return Number(qId);
  try {
    const body = await request.json();
    if (body && body.id && !isNaN(Number(body.id))) return Number(body.id);
  } catch {
    // ignore empty/non-JSON DELETE body
  }
  return null;
}

