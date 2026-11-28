import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  applyListSulamDelta,
  extractRecordId,
  isAuthorizedForSulamForm,
  resolveSulamSpekRit,
} from '@/lib/sulamFormSync';

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
    const { allowed } = isAuthorizedForSulamForm(request, 'form_drop_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak. Anda tidak memiliki hak akses untuk menginput Form Drop Sulam.',
        },
        { status: 403 }
      );
    }

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
      const { stdRitCD: stdRit, stdRitFuso: fusoRit } = await resolveSulamSpekRit(kelasBibit);
      const btgTotal = nCD * stdRit + nFuso * fusoRit;
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
      await applyListSulamDelta({
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        dropRitDelta: totalRit,
        spekBibit: kelasBibit?.trim() || undefined,
      });
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

// PUT: Edit data transaksi Form Drop Sulam dan sinkronkan ke MasterDataDropBibitSulam & ListSulam
export async function PUT(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_drop_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk mengubah Form Drop Sulam.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, lokasi, wilayah, tanggal, cd, fuso, kelasBibit } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID drop wajib disertakan!' }, { status: 400 });
    }
    if (!lokasi || !String(lokasi).trim()) {
      return NextResponse.json({ success: false, message: 'Lokasi wajib dipilih!' }, { status: 400 });
    }

    const nCD = Math.max(0, parseInt(cd, 10) || 0);
    const nFuso = Math.max(0, parseInt(fuso, 10) || 0);
    const newTotalRit = nCD + nFuso;
    if (newTotalRit <= 0) {
      return NextResponse.json(
        { success: false, message: 'Minimal salah satu jenis rit (CD atau Fuso) harus lebih dari 0!' },
        { status: 400 }
      );
    }

    const existing = await prisma.formDropSulam.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Data form drop sulam tidak ditemukan.' }, { status: 404 });
    }

    const cleanLokasi = String(lokasi).trim().toUpperCase();
    const cleanWilayah = wilayah ? String(wilayah).trim().toUpperCase() : null;
    const newDropDate = tanggal ? new Date(tanggal) : existing.tanggal || new Date();
    const cleanKelas = kelasBibit?.trim() || null;

    const oldTotalRit = (existing.cd || 0) + (existing.fuso || 0);
    const oldJenisUnit =
      existing.cd > 0 && existing.fuso > 0 ? 'CD + FUSO' : existing.fuso > 0 ? 'FUSO' : 'CD';
    const newJenisUnit = nCD > 0 && nFuso > 0 ? 'CD + FUSO' : nFuso > 0 ? 'FUSO' : 'CD';

    const { stdRitCD: newStdRit, stdRitFuso: newFusoRit } = await resolveSulamSpekRit(cleanKelas);
    const newBtgTotal = nCD * newStdRit + nFuso * newFusoRit;

    const updated = await prisma.formDropSulam.update({
      where: { id: existing.id },
      data: {
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        tanggal: newDropDate,
        cd: nCD,
        fuso: nFuso,
        kelasBibit: cleanKelas,
      },
    });

    try {
      let masterRow = await prisma.masterDataDropBibitSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          jumlahRit: oldTotalRit,
          jenisUnit: oldJenisUnit,
          ...(existing.tanggal ? { tanggal: existing.tanggal } : {}),
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataDropBibitSulam.findFirst({
          where: { lokasi: existing.lokasi, jumlahRit: oldTotalRit },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataDropBibitSulam.update({
          where: { id: masterRow.id },
          data: {
            lokasi: cleanLokasi,
            tanggal: newDropDate,
            bibitOrdered: cleanKelas,
            stdRit: newStdRit,
            jumlahRit: newTotalRit,
            hasilBtg: newBtgTotal,
            jenisUnit: newJenisUnit,
            statusDrop: 'V',
          },
        });
      } else {
        await prisma.masterDataDropBibitSulam.create({
          data: {
            lokasi: cleanLokasi,
            tanggal: newDropDate,
            bibitOrdered: cleanKelas,
            stdRit: newStdRit,
            jumlahRit: newTotalRit,
            hasilBtg: newBtgTotal,
            jenisUnit: newJenisUnit,
            statusDrop: 'V',
          },
        });
      }
    } catch (e) {
      console.warn('Sync edit to MasterDataDropBibitSulam error:', e);
    }

    try {
      if (cleanLokasi === existing.lokasi) {
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          dropRitDelta: newTotalRit - oldTotalRit,
        });
      } else {
        await applyListSulamDelta({
          lokasi: existing.lokasi,
          dropRitDelta: -oldTotalRit,
        });
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          dropRitDelta: newTotalRit,
        });
      }
    } catch (e) {
      console.warn('Sync edit drop to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Data Form Drop Sulam lokasi ${cleanLokasi} berhasil diperbarui (${newTotalRit} Rit).`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/sulam/form-drop:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data form drop sulam.' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus transaksi Form Drop Sulam dan sinkronkan ulang MasterDataDropBibitSulam & ListSulam
export async function DELETE(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_drop_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk menghapus Form Drop Sulam.' },
        { status: 403 }
      );
    }

    const id = await extractRecordId(request);
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID drop wajib disertakan!' }, { status: 400 });
    }

    const existing = await prisma.formDropSulam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Data form drop sulam tidak ditemukan.' }, { status: 404 });
    }

    const oldTotalRit = (existing.cd || 0) + (existing.fuso || 0);
    const oldJenisUnit =
      existing.cd > 0 && existing.fuso > 0 ? 'CD + FUSO' : existing.fuso > 0 ? 'FUSO' : 'CD';

    await prisma.formDropSulam.delete({ where: { id } });

    try {
      let masterRow = await prisma.masterDataDropBibitSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          jumlahRit: oldTotalRit,
          jenisUnit: oldJenisUnit,
          ...(existing.tanggal ? { tanggal: existing.tanggal } : {}),
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataDropBibitSulam.findFirst({
          where: { lokasi: existing.lokasi, jumlahRit: oldTotalRit },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataDropBibitSulam.delete({ where: { id: masterRow.id } });
      }
    } catch (e) {
      console.warn('Sync delete to MasterDataDropBibitSulam error:', e);
    }

    try {
      await applyListSulamDelta({
        lokasi: existing.lokasi,
        dropRitDelta: -oldTotalRit,
      });
    } catch (e) {
      console.warn('Sync delete drop to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Data Form Drop Sulam lokasi ${existing.lokasi} (${oldTotalRit} Rit) berhasil dihapus dan ListSulam disinkronkan.`,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/sulam/form-drop:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data form drop sulam.' },
      { status: 500 }
    );
  }
}

