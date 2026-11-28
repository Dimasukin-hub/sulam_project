import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  applyListSulamDelta,
  extractRecordId,
  isAuthorizedForSulamForm,
  resolveLocationRealSpec,
} from '@/lib/sulamFormSync';

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
    const { allowed } = isAuthorizedForSulamForm(request, 'form_realisasi_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak. Anda tidak memiliki hak akses untuk menginput Form Realisasi Sulam.',
        },
        { status: 403 }
      );
    }

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
    const { bibitOrdered, stdRit } = await resolveLocationRealSpec(cleanLokasi);
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
      await applyListSulamDelta({
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        sulamRealDelta: ritPlanted,
        recomputeLastSulamDate: true,
      });
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

// PUT: Edit transaksi Form Realisasi Sulam dan sinkronkan ke MasterDataRealSulam & ListSulam
export async function PUT(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_realisasi_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk mengubah Form Realisasi Sulam.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, lokasi, wilayah, tanggal, jumlahTk, jumlahBibit } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID realisasi wajib disertakan!' }, { status: 400 });
    }
    if (!lokasi || !String(lokasi).trim()) {
      return NextResponse.json({ success: false, message: 'Lokasi wajib dipilih!' }, { status: 400 });
    }

    const nBibit = Math.max(0, parseInt(jumlahBibit, 10) || 0);
    const nTK = Math.max(0, parseInt(jumlahTk, 10) || 0);
    if (nBibit <= 0) {
      return NextResponse.json({ success: false, message: 'Jumlah bibit harus lebih dari 0!' }, { status: 400 });
    }

    const existing = await prisma.formRealisasiSulam.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Data form realisasi sulam tidak ditemukan.' },
        { status: 404 }
      );
    }

    const cleanLokasi = String(lokasi).trim().toUpperCase();
    const cleanWilayah = wilayah ? String(wilayah).trim().toUpperCase() : null;
    const newRealDate = tanggal ? new Date(tanggal) : existing.tanggal || new Date();

    const oldSpec = await resolveLocationRealSpec(existing.lokasi);
    const oldRitPlanted = Math.max(1, Math.ceil((existing.jumlahBibit || 0) / oldSpec.stdRit));

    const newSpec = await resolveLocationRealSpec(cleanLokasi);
    const newRitPlanted = Math.max(1, Math.ceil(nBibit / newSpec.stdRit));

    const updated = await prisma.formRealisasiSulam.update({
      where: { id: existing.id },
      data: {
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        tanggal: newRealDate,
        jumlahTk: nTK,
        jumlahBibit: nBibit,
      },
    });

    try {
      let masterRow = await prisma.masterDataRealSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          hasilBtg: existing.jumlahBibit,
          ...(existing.tanggal ? { tanggal: existing.tanggal } : {}),
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataRealSulam.findFirst({
          where: { lokasi: existing.lokasi, hasilBtg: existing.jumlahBibit },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataRealSulam.update({
          where: { id: masterRow.id },
          data: {
            lokasi: cleanLokasi,
            tanggal: newRealDate,
            hasilBtg: nBibit,
            bibitOrdered: newSpec.bibitOrdered,
            stdRit: newSpec.stdRit,
            ritPlanted: newRitPlanted,
            keterangan: `Realisasi Sulam (TK: ${nTK}, Bibit: ${nBibit})`,
          },
        });
      } else {
        await prisma.masterDataRealSulam.create({
          data: {
            lokasi: cleanLokasi,
            tanggal: newRealDate,
            hasilBtg: nBibit,
            bibitOrdered: newSpec.bibitOrdered,
            stdRit: newSpec.stdRit,
            ritPlanted: newRitPlanted,
            keterangan: `Realisasi Sulam (TK: ${nTK}, Bibit: ${nBibit})`,
          },
        });
      }
    } catch (e) {
      console.warn('Sync edit to MasterDataRealSulam error:', e);
    }

    try {
      if (cleanLokasi === existing.lokasi) {
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          sulamRealDelta: newRitPlanted - oldRitPlanted,
          recomputeLastSulamDate: true,
        });
      } else {
        await applyListSulamDelta({
          lokasi: existing.lokasi,
          sulamRealDelta: -oldRitPlanted,
          recomputeLastSulamDate: true,
        });
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          sulamRealDelta: newRitPlanted,
          recomputeLastSulamDate: true,
        });
      }
    } catch (e) {
      console.warn('Sync edit realisasi to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Data Form Realisasi Sulam lokasi ${cleanLokasi} berhasil diperbarui (${nBibit.toLocaleString('id-ID')} btg / ~${newRitPlanted} Rit).`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/sulam/form-realisasi:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data form realisasi sulam.' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus transaksi Form Realisasi Sulam dan sinkronkan ulang MasterDataRealSulam & ListSulam
export async function DELETE(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_realisasi_sulam', [
      'admin',
      'super_admin',
      'kepala_wilayah',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk menghapus Form Realisasi Sulam.' },
        { status: 403 }
      );
    }

    const id = await extractRecordId(request);
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID realisasi wajib disertakan!' }, { status: 400 });
    }

    const existing = await prisma.formRealisasiSulam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Data form realisasi sulam tidak ditemukan.' },
        { status: 404 }
      );
    }

    const oldSpec = await resolveLocationRealSpec(existing.lokasi);
    const oldRitPlanted = Math.max(1, Math.ceil((existing.jumlahBibit || 0) / oldSpec.stdRit));

    await prisma.formRealisasiSulam.delete({ where: { id } });

    try {
      let masterRow = await prisma.masterDataRealSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          hasilBtg: existing.jumlahBibit,
          ...(existing.tanggal ? { tanggal: existing.tanggal } : {}),
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataRealSulam.findFirst({
          where: { lokasi: existing.lokasi, hasilBtg: existing.jumlahBibit },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataRealSulam.delete({ where: { id: masterRow.id } });
      }
    } catch (e) {
      console.warn('Sync delete to MasterDataRealSulam error:', e);
    }

    try {
      await applyListSulamDelta({
        lokasi: existing.lokasi,
        sulamRealDelta: -oldRitPlanted,
        recomputeLastSulamDate: true,
      });
    } catch (e) {
      console.warn('Sync delete realisasi to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Data Form Realisasi Sulam lokasi ${existing.lokasi} (${existing.jumlahBibit.toLocaleString('id-ID')} btg) berhasil dihapus dan ListSulam disinkronkan.`,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/sulam/form-realisasi:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data form realisasi sulam.' },
      { status: 500 }
    );
  }
}

