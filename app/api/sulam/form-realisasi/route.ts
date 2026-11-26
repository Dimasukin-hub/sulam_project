import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Ambil daftar riwayat input form realisasi sulam
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const wilayah = searchParams.get('wilayah')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { lokasi: { contains: search, mode: 'insensitive' } },
        { wilayah: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (wilayah && wilayah !== 'ALL') {
      where.wilayah = wilayah;
    }

    const [total, data] = await Promise.all([
      prisma.formRealisasiSulam.count({ where }),
      prisma.formRealisasiSulam.findMany({
        where,
        orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/sulam/form-realisasi:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data form realisasi sulam.' },
      { status: 500 }
    );
  }
}

// POST: Simpan transaksi realisasi sulam baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lokasi, wilayah, tanggal, jumlahTk, jumlahBibit } = body;

    if (!lokasi || !lokasi.trim()) {
      return NextResponse.json(
        { success: false, message: 'Lokasi petak wajib dipilih!' },
        { status: 400 }
      );
    }

    const nBibit = Math.max(0, parseInt(jumlahBibit, 10) || 0);
    const nTK = Math.max(0, parseInt(jumlahTk, 10) || 0);

    if (nBibit <= 0) {
      return NextResponse.json(
        { success: false, message: 'Jumlah bibit harus lebih dari 0!' },
        { status: 400 }
      );
    }

    const cleanLokasi = lokasi.trim().toUpperCase();
    const cleanWilayah = wilayah ? wilayah.trim().toUpperCase() : null;
    const realDate = tanggal ? new Date(tanggal) : new Date();

    // 1. Simpan baris baru ke tabel FormRealisasiSulam
    const createdForm = await prisma.formRealisasiSulam.create({
      data: {
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        tanggal: realDate,
        jumlahTk: nTK,
        jumlahBibit: nBibit,
      },
    });

    // 2. Simpan baris baru ke tabel MasterDataRealSulam secara otomatis
    let bibitOrdered = '-';
    let stdRit = 2000;
    try {
      const ls = await prisma.listSulam.findUnique({
        where: { lokasi: cleanLokasi },
      });
      if (ls && ls.spekBibit) {
        bibitOrdered = ls.spekBibit;
        const spek = await prisma.masterSpekBibitSulam.findFirst({
          where: { spekBBSulamBtg: { equals: bibitOrdered.trim(), mode: 'insensitive' } },
        });
        if (spek && spek.cd > 0) stdRit = spek.cd;
      }
    } catch (e) {
      console.warn('Lookup spek bibit for real sulam error:', e);
    }

    // Hitung rit planted: dibulatkan ke atas jika ada sisa (CEILING)
    const ritPlanted = Math.max(1, Math.ceil(nBibit / stdRit));

    try {
      await prisma.masterDataRealSulam.create({
        data: {
          lokasi: cleanLokasi,
          tanggal: realDate,
          hasilBtg: nBibit,
          bibitOrdered,
          stdRit,
          ritPlanted,
          keterangan: `Realisasi Sulam (TK: ${nTK}, Bibit: ${nBibit})`,
        },
      });
    } catch (e) {
      console.warn('Sync to MasterDataRealSulam error:', e);
    }

    // 3. Update tabel ListSulam: menambah sulamReal dan mengurangi sulamSaldo
    try {
      const existingList = await prisma.listSulam.findUnique({
        where: { lokasi: cleanLokasi },
      });

      if (existingList) {
        const newSulamReal = (existingList.sulamReal || 0) + ritPlanted;
        const dropTotal = existingList.dropTotal || 0;
        const sulamManual = existingList.sulamManual || 0;
        const newSulamSaldo = Math.max(0, dropTotal - newSulamReal - sulamManual);
        const sulamPct = dropTotal > 0 ? Number((((newSulamReal + sulamManual) / dropTotal) * 100).toFixed(1)) : 0;

        await prisma.listSulam.update({
          where: { lokasi: cleanLokasi },
          data: {
            wilayah: cleanWilayah || existingList.wilayah,
            sulamReal: newSulamReal,
            sulamSaldo: newSulamSaldo,
            sulamPct,
            sulamLastDate: realDate,
          },
        });
      } else {
        const mLoc = await prisma.masterStatusLokasi.findUnique({
          where: { lokasi: cleanLokasi },
        });
        await prisma.listSulam.create({
          data: {
            lokasi: cleanLokasi,
            wilayah: cleanWilayah || mLoc?.strucPlant,
            jenisBibit: mLoc?.jenis,
            kelasBibit: mLoc?.kelas,
            tglRawat: mLoc?.tglRawat,
            tglStdForcing: mLoc?.forcingStd,
            tglFProd: mLoc?.forcingGabungan || mLoc?.forcing2027 || mLoc?.forcingProd2026,
            umurForcing: mLoc?.umurFProd,
            sulamReal: ritPlanted,
            sulamSaldo: 0,
            sulamPct: 0,
            sulamLastDate: realDate,
          },
        });
      }
    } catch (e) {
      console.warn('Sync to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Form Realisasi Sulam untuk lokasi ${cleanLokasi} berhasil disimpan (${nBibit.toLocaleString('id-ID')} btg / ~${ritPlanted} Rit). Kolom sulamReal bertambah dan sulamSaldo berkurang di ListSulam.`,
      data: createdForm,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sulam/form-realisasi:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan form realisasi sulam.' },
      { status: 500 }
    );
  }
}
