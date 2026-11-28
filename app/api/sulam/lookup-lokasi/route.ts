import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatSulamClassLabel, normalizeSpekBibitLabel } from '@/lib/sulamClassOptions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lokasiParam = searchParams.get('lokasi');

    // Jika dipanggil untuk mengambil seluruh daftar lokasi untuk dropdown
    if (!lokasiParam) {
      const [statusLokasi, listSulam, spekBibit] = await Promise.all([
        prisma.masterStatusLokasi.findMany({
          select: { lokasi: true, strucPlant: true, status: true },
          orderBy: { lokasi: 'asc' },
        }),
        prisma.listSulam.findMany({
          select: { lokasi: true, wilayah: true, spekBibit: true, tglFMax: true },
        }),
        prisma.masterSpekBibitSulam.findMany({
          orderBy: { spekBBSulamBtg: 'asc' },
        }),
      ]);

      const lokasiMap = new Map<string, { lokasi: string; wilayah: string | null }>();
      for (const s of statusLokasi) {
        lokasiMap.set(s.lokasi.trim().toUpperCase(), {
          lokasi: s.lokasi.trim().toUpperCase(),
          wilayah: s.strucPlant ? s.strucPlant.trim().toUpperCase() : null,
        });
      }
      for (const l of listSulam) {
        const k = l.lokasi.trim().toUpperCase();
        if (!lokasiMap.has(k)) {
          lokasiMap.set(k, { lokasi: k, wilayah: l.wilayah ? l.wilayah.trim().toUpperCase() : null });
        }
      }

      return NextResponse.json({
        success: true,
        lokasiList: Array.from(lokasiMap.values()).sort((a, b) => a.lokasi.localeCompare(b.lokasi)),
        spekBibitList: spekBibit,
      });
    }

    const cleanLokasi = lokasiParam.trim().toUpperCase();

    // Ambil data dari MasterStatusLokasi, ListSulam, MasterDataOrderSulam, dan MasterSpekBibitSulam
    const [statusLokasi, listSulam, latestOrder, allSpek] = await Promise.all([
      prisma.masterStatusLokasi.findFirst({
        where: { lokasi: cleanLokasi },
      }),
      prisma.listSulam.findFirst({
        where: { lokasi: cleanLokasi },
      }),
      prisma.masterDataOrderSulam.findFirst({
        where: { lokasi: cleanLokasi },
        orderBy: [{ tanggalOrder: 'desc' }, { id: 'desc' }],
      }),
      prisma.masterSpekBibitSulam.findMany({}),
    ]);

    const wilayah = statusLokasi?.strucPlant || listSulam?.wilayah || null;
    const tglFMax = listSulam?.tglFMax || null;

    let usia: number | null = statusLokasi?.umurFProd ?? listSulam?.umurForcing ?? null;
    if (usia === null) {
      const tglFProdDate = statusLokasi?.forcingGabungan || statusLokasi?.forcing2027 || statusLokasi?.forcingProd2026 || listSulam?.tglFProd;
      if (tglFProdDate) {
        const today = new Date();
        const diffMs = today.getTime() - new Date(tglFProdDate).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        usia = Math.round(diffDays / 30.4);
      }
    }
    const usiaDetailStr = usia !== null && usia !== undefined ? `${usia} Bulan` : '-';

    const jenisBibit = statusLokasi?.jenis || listSulam?.jenisBibit || null;
    const spekBB = listSulam?.spekBibit || latestOrder?.spekBibit || null;
    const formattedKelasBibit = spekBB && spekBB.trim() !== '-'
      ? formatSulamClassLabel(jenisBibit, spekBB)
      : null;
    const keterangan =
      listSulam?.keteranganProses ||
      latestOrder?.keteranganProses ||
      (spekBB?.toLowerCase().includes('pangkas prod') ? 'Pangkas Produksi' : null);

    let stdRitCD = 0;
    let stdRitFuso = 0;
    if (spekBB) {
      const normalizedSpek = normalizeSpekBibitLabel(spekBB);
      const matchedSpek = allSpek.find(
        (s) =>
          s.spekBBSulamBtg.toLowerCase().trim() === spekBB.toLowerCase().trim() ||
          s.spekBBSulamBtg.toLowerCase().trim() === normalizedSpek.toLowerCase().trim()
      );
      if (matchedSpek) {
        stdRitCD = matchedSpek.cd;
        stdRitFuso = matchedSpek.fuso;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lokasi: cleanLokasi,
        wilayah,
        jenisBibit,
        tanggalForcingMax: tglFMax ? new Date(tglFMax).toISOString().slice(0, 10) : null,
        usia,
        usiaDisplay: usiaDetailStr,
        kelasBibit: spekBB || 'Sucker No. 2',
        formattedKelasBibit,
        spekBB,
        keterangan: keterangan || 'Pangkas Produksi',
        ritCD: listSulam?.permintaanRit || latestOrder?.rit || 0,
        ritFuso: 0,
        permintaanRitaseBtg: listSulam?.permintaanJumlah || latestOrder?.jumlah || 0,
        stdRitCD,
        stdRitFuso,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/sulam/lookup-lokasi:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil referensi data sulam.' },
      { status: 500 }
    );
  }
}
