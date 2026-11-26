import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Ambil daftar riwayat input form drop sulam
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
        { kelasBibit: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (wilayah && wilayah !== 'ALL') {
      where.wilayah = wilayah;
    }

    const [total, data] = await Promise.all([
      prisma.formDropSulam.count({ where }),
      prisma.formDropSulam.findMany({
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
    console.error('Error in GET /api/sulam/form-drop:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data form drop sulam.' },
      { status: 500 }
    );
  }
}

// POST: Simpan transaksi drop sulam baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lokasi, wilayah, tanggal, cd, fuso, kelasBibit } = body;

    if (!lokasi || !lokasi.trim()) {
      return NextResponse.json(
        { success: false, message: 'Lokasi petak wajib dipilih!' },
        { status: 400 }
      );
    }

    const nCD = Math.max(0, parseInt(cd, 10) || 0);
    const nFuso = Math.max(0, parseInt(fuso, 10) || 0);
    const totalRit = nCD + nFuso;

    if (totalRit <= 0) {
      return NextResponse.json(
        { success: false, message: 'Minimal salah satu jenis rit (CD atau Fuso) harus lebih dari 0!' },
        { status: 400 }
      );
    }

    const cleanLokasi = lokasi.trim().toUpperCase();
    const cleanWilayah = wilayah ? wilayah.trim().toUpperCase() : null;
    const dropDate = tanggal ? new Date(tanggal) : new Date();

    // 1. Simpan baris baru ke tabel FormDropSulam
    const createdForm = await prisma.formDropSulam.create({
      data: {
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        tanggal: dropDate,
        cd: nCD,
        fuso: nFuso,
        kelasBibit: kelasBibit?.trim() || null,
      },
    });

    // 2. Simpan baris baru ke MasterDataDropBibitSulam (menambah record baru)
    try {
      let stdRit = 2000;
      let fusoRit = 3500;
      if (kelasBibit && kelasBibit.trim()) {
        const spek = await prisma.masterSpekBibitSulam.findFirst({
          where: { spekBBSulamBtg: { equals: kelasBibit.trim(), mode: 'insensitive' } },
        });
        if (spek) {
          if (spek.cd > 0) stdRit = spek.cd;
          if (spek.fuso > 0) fusoRit = spek.fuso;
        }
      }
      const btgTotal = (nCD * stdRit) + (nFuso * fusoRit);
      const jenisUnit = nCD > 0 && nFuso > 0 ? 'CD + FUSO' : nFuso > 0 ? 'FUSO' : 'CD';

      await prisma.masterDataDropBibitSulam.create({
        data: {
          lokasi: cleanLokasi,
          tanggal: dropDate,
          bibitOrdered: kelasBibit?.trim() || null,
          stdRit,
          jumlahRit: totalRit,
          hasilBtg: btgTotal,
          jenisUnit,
          statusDrop: 'V',
        },
      });
    } catch (e) {
      console.warn('Sync to MasterDataDropBibitSulam error:', e);
    }

    // 3. Update kolom dropReal, dropTotal, dropDev, dropPct di tabel ListSulam
    try {
      const existingList = await prisma.listSulam.findUnique({
        where: { lokasi: cleanLokasi },
      });

      if (existingList) {
        const newDropReal = (existingList.dropReal || 0) + totalRit;
        const newDropTotal = (existingList.permintaanRealRit || 0) + newDropReal;
        const permintaanRit = existingList.permintaanRit || 0;
        const dropDev = permintaanRit - newDropTotal;
        const dropPct = permintaanRit > 0 ? Number(((newDropTotal / permintaanRit) * 100).toFixed(1)) : 0;

        await prisma.listSulam.update({
          where: { lokasi: cleanLokasi },
          data: {
            wilayah: cleanWilayah || existingList.wilayah,
            dropReal: newDropReal,
            dropTotal: newDropTotal,
            dropDev,
            dropPct,
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
            dropReal: totalRit,
            dropTotal: totalRit,
            dropDev: -totalRit,
            dropPct: 0,
            spekBibit: kelasBibit?.trim() || null,
          },
        });
      }
    } catch (e) {
      console.warn('Sync to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Form Drop Sulam untuk lokasi ${cleanLokasi} berhasil disimpan (${totalRit} Rit). Data drop di ListSulam telah diperbarui.`,
      data: createdForm,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sulam/form-drop:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan form drop sulam.' },
      { status: 500 }
    );
  }
}

