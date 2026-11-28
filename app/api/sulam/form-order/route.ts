import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractSessionRole } from '@/lib/sulamRoleHelper';
import {
  applyListSulamDelta,
  extractRecordId,
  isAuthorizedForSulamForm,
  resolveSulamSpekRit,
} from '@/lib/sulamFormSync';

export const dynamic = 'force-dynamic';

// Helper untuk format nomor tiket SLM-YYYYMM-XXXX
async function generateNomorTiket(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SLM-${yearMonth}-`;

  const lastTicket = await prisma.formTiketOrderSulam.findFirst({
    where: { nomorTiket: { startsWith: prefix } },
    orderBy: { id: 'desc' },
  });

  let nextNum = 1;
  if (lastTicket && lastTicket.nomorTiket) {
    const parts = lastTicket.nomorTiket.split('-');
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// GET: Ambil daftar tiket order sulam (dengan pencarian, filter status, filter wilayah)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const wilayah = searchParams.get('wilayah')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { nomorTiket: { contains: search, mode: 'insensitive' } },
        { lokasi: { contains: search, mode: 'insensitive' } },
        { pemohonName: { contains: search, mode: 'insensitive' } },
        { kelasBibit: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (wilayah && wilayah !== 'ALL') {
      where.wilayah = wilayah;
    }

    const [total, data] = await Promise.all([
      prisma.formTiketOrderSulam.count({ where }),
      prisma.formTiketOrderSulam.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Summary stats per status
    const allStatuses = await prisma.formTiketOrderSulam.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats = {
      total: await prisma.formTiketOrderSulam.count(),
      diajukan: allStatuses.find((s) => s.status === 'DIAJUKAN')?._count.id || 0,
      approved: allStatuses.find((s) => s.status === 'APPROVED')?._count.id || 0,
      antrian: allStatuses.find((s) => s.status === 'ANTRIAN')?._count.id || 0,
      realDrop: allStatuses.find((s) => s.status === 'REAL_DROP')?._count.id || 0,
      realTanam: allStatuses.find((s) => s.status === 'REAL_TANAM')?._count.id || 0,
      close: allStatuses.find((s) => s.status === 'CLOSE')?._count.id || 0,
    };

    return NextResponse.json({
      success: true,
      data,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/sulam/form-order:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat data formulir order sulam.' },
      { status: 500 }
    );
  }
}

// POST: Buat form order sulam baru oleh User Wilayah
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lokasi, wilayah, usia, kelasBibit, ritFuso, ritCD, keterangan, pemohonName, pemohonRole } = body;

    const { allowed } = isAuthorizedForSulamForm(
      request,
      'form_order_sulam',
      ['user_wilayah', 'user', 'admin', 'super_admin'],
      pemohonRole
    );
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak. Anda tidak memiliki hak akses mengajukan Form Order Sulam.',
        },
        { status: 403 }
      );
    }

    if (!lokasi || !lokasi.trim()) {
      return NextResponse.json(
        { success: false, message: 'Lokasi petak wajib dipilih!' },
        { status: 400 }
      );
    }

    if (!kelasBibit || !kelasBibit.trim()) {
      return NextResponse.json(
        { success: false, message: 'Kelas bibit wajib diisi!' },
        { status: 400 }
      );
    }

    const cleanLokasi = lokasi.trim().toUpperCase();
    const cleanWilayah = wilayah ? wilayah.trim().toUpperCase() : null;
    const nomorTiket = await generateNomorTiket();
    const nRitCD = Number(ritCD) || 0;
    const nRitFuso = Number(ritFuso) || 0;

    const created = await prisma.formTiketOrderSulam.create({
      data: {
        nomorTiket,
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        usia: usia !== null && usia !== undefined ? Number(usia) : null,
        kelasBibit: kelasBibit.trim(),
        ritFuso: nRitFuso,
        ritCD: nRitCD,
        keterangan: keterangan?.trim() || null,
        status: 'DIAJUKAN',
        pemohonName: pemohonName || 'User Wilayah',
        pemohonRole: pemohonRole || 'user_wilayah',
      },
    });

    // 1. Ambil spesifikasi kapasitas rit CD & Fuso dari MasterSpekBibitSulam
    const { stdRitCD, stdRitFuso } = await resolveSulamSpekRit(kelasBibit);
    const totalRit = nRitCD + nRitFuso;
    const btgPerRit = nRitCD * stdRitCD + nRitFuso * stdRitFuso;
    const orderDate = new Date();

    // 2. Tambah baris baru di MasterDataOrderSulam (menambah record baru, bukan menimpa)
    try {
      await prisma.masterDataOrderSulam.create({
        data: {
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          tanggalOrder: orderDate,
          spekBibit: kelasBibit.trim(),
          jumlah: btgPerRit,
          rit: totalRit,
          realRit: 0,
          manual: 0,
          keteranganProses: keterangan?.trim() || null,
        },
      });
    } catch (e) {
      console.warn('Sync to MasterDataOrderSulam error:', e);
    }

    // 3. Update / Sinkronisasi ke tabel database ListSulam
    try {
      await applyListSulamDelta({
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        orderRitDelta: totalRit,
        orderJumlahDelta: btgPerRit,
        spekBibit: kelasBibit.trim(),
        keteranganProses: keterangan?.trim() || null,
        tglOrder: orderDate,
      });
    } catch (e) {
      console.warn('Sync to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Form Order Sulam ${nomorTiket} berhasil diajukan dan sedang menunggu persetujuan (Approval) User Planting.`,
      data: created,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sulam/form-order:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat tiket form order sulam.' },
      { status: 500 }
    );
  }
}

// PATCH: Update status formulir / Approval oleh User Planting & Admin
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, approverName, approverRole, catatan } = body;

    // Verifikasi Hak Akses: Hanya User Planting dan Administrator yang berhak melakukan approval / workflow update
    const sessionRole = extractSessionRole(request);

    const effectiveRole = sessionRole || approverRole || '';
    const allowedRoles = ['user_planting', 'admin', 'super_admin'];
    if (effectiveRole && !allowedRoles.includes(effectiveRole)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses ditolak. Hanya User Planting dan Administrator yang berhak menyetujui atau memperbarui status alur kerja order sulam.',
        },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID formulir wajib disertakan!' },
        { status: 400 }
      );
    }

    const validStatuses = ['DIAJUKAN', 'APPROVED', 'ANTRIAN', 'REAL_DROP', 'REAL_TANAM', 'CLOSE'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      catatan: catatan !== undefined ? catatan : undefined,
    };

    if (status === 'APPROVED') {
      updateData.approvedByName = approverName || 'User Planting';
      updateData.approvedAt = new Date();
    }

    const updated = await prisma.formTiketOrderSulam.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Status formulir ${updated.nomorTiket} berhasil diubah menjadi ${status}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/sulam/form-order:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui status formulir order sulam.' },
      { status: 500 }
    );
  }
}

// PUT: Edit data tiket Form Order Sulam dan sinkronkan ke MasterDataOrderSulam & ListSulam
export async function PUT(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_order_sulam', [
      'user_wilayah',
      'user',
      'admin',
      'super_admin',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk mengubah Form Order Sulam.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, lokasi, wilayah, usia, kelasBibit, ritFuso, ritCD, keterangan } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID tiket wajib disertakan!' }, { status: 400 });
    }
    if (!lokasi || !String(lokasi).trim()) {
      return NextResponse.json({ success: false, message: 'Lokasi wajib dipilih!' }, { status: 400 });
    }
    if (!kelasBibit || !String(kelasBibit).trim()) {
      return NextResponse.json({ success: false, message: 'Kelas bibit wajib diisi!' }, { status: 400 });
    }

    const existing = await prisma.formTiketOrderSulam.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Tiket order sulam tidak ditemukan.' }, { status: 404 });
    }

    const cleanLokasi = String(lokasi).trim().toUpperCase();
    const cleanWilayah = wilayah ? String(wilayah).trim().toUpperCase() : null;
    const cleanKelas = String(kelasBibit).trim();
    const cleanKet = keterangan ? String(keterangan).trim() : null;
    const nRitCD = Math.max(0, Number(ritCD) || 0);
    const nRitFuso = Math.max(0, Number(ritFuso) || 0);

    const oldSpec = await resolveSulamSpekRit(existing.kelasBibit);
    const oldRit = (existing.ritCD || 0) + (existing.ritFuso || 0);
    const oldBtg = (existing.ritCD || 0) * oldSpec.stdRitCD + (existing.ritFuso || 0) * oldSpec.stdRitFuso;

    const newSpec = await resolveSulamSpekRit(cleanKelas);
    const newRit = nRitCD + nRitFuso;
    const newBtg = nRitCD * newSpec.stdRitCD + nRitFuso * newSpec.stdRitFuso;

    const updated = await prisma.formTiketOrderSulam.update({
      where: { id: existing.id },
      data: {
        lokasi: cleanLokasi,
        wilayah: cleanWilayah,
        usia: usia !== null && usia !== undefined ? Number(usia) : null,
        kelasBibit: cleanKelas,
        ritCD: nRitCD,
        ritFuso: nRitFuso,
        keterangan: cleanKet,
      },
    });

    // Sinkronkan baris pasangan di MasterDataOrderSulam
    try {
      let masterRow = await prisma.masterDataOrderSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          rit: oldRit,
          jumlah: oldBtg,
          spekBibit: existing.kelasBibit,
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataOrderSulam.findFirst({
          where: { lokasi: existing.lokasi, rit: oldRit, jumlah: oldBtg },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataOrderSulam.update({
          where: { id: masterRow.id },
          data: {
            lokasi: cleanLokasi,
            wilayah: cleanWilayah,
            spekBibit: cleanKelas,
            rit: newRit,
            jumlah: newBtg,
            keteranganProses: cleanKet,
          },
        });
      } else {
        await prisma.masterDataOrderSulam.create({
          data: {
            lokasi: cleanLokasi,
            wilayah: cleanWilayah,
            tanggalOrder: existing.createdAt,
            spekBibit: cleanKelas,
            jumlah: newBtg,
            rit: newRit,
            realRit: 0,
            manual: 0,
            keteranganProses: cleanKet,
          },
        });
      }
    } catch (e) {
      console.warn('Sync edit to MasterDataOrderSulam error:', e);
    }

    // Sinkronkan delta ke ListSulam
    try {
      if (cleanLokasi === existing.lokasi) {
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          orderRitDelta: newRit - oldRit,
          orderJumlahDelta: newBtg - oldBtg,
          spekBibit: cleanKelas,
          keteranganProses: cleanKet,
        });
      } else {
        await applyListSulamDelta({
          lokasi: existing.lokasi,
          orderRitDelta: -oldRit,
          orderJumlahDelta: -oldBtg,
          recomputeOrderDate: true,
        });
        await applyListSulamDelta({
          lokasi: cleanLokasi,
          wilayah: cleanWilayah,
          orderRitDelta: newRit,
          orderJumlahDelta: newBtg,
          spekBibit: cleanKelas,
          keteranganProses: cleanKet,
          tglOrder: existing.createdAt,
        });
      }
    } catch (e) {
      console.warn('Sync edit to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Tiket ${updated.nomorTiket} berhasil diperbarui.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/sulam/form-order:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui tiket form order sulam.' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus tiket Form Order Sulam dan sinkronkan ke MasterDataOrderSulam & ListSulam
export async function DELETE(request: NextRequest) {
  try {
    const { allowed } = isAuthorizedForSulamForm(request, 'form_order_sulam', [
      'user_wilayah',
      'user',
      'admin',
      'super_admin',
    ]);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak untuk menghapus Form Order Sulam.' },
        { status: 403 }
      );
    }

    const id = await extractRecordId(request);
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID tiket wajib disertakan!' }, { status: 400 });
    }

    const existing = await prisma.formTiketOrderSulam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Tiket order sulam tidak ditemukan.' }, { status: 404 });
    }

    const oldSpec = await resolveSulamSpekRit(existing.kelasBibit);
    const oldRit = (existing.ritCD || 0) + (existing.ritFuso || 0);
    const oldBtg = (existing.ritCD || 0) * oldSpec.stdRitCD + (existing.ritFuso || 0) * oldSpec.stdRitFuso;

    await prisma.formTiketOrderSulam.delete({ where: { id } });

    try {
      let masterRow = await prisma.masterDataOrderSulam.findFirst({
        where: {
          lokasi: existing.lokasi,
          rit: oldRit,
          jumlah: oldBtg,
          spekBibit: existing.kelasBibit,
        },
        orderBy: { id: 'desc' },
      });
      if (!masterRow) {
        masterRow = await prisma.masterDataOrderSulam.findFirst({
          where: { lokasi: existing.lokasi, rit: oldRit, jumlah: oldBtg },
          orderBy: { id: 'desc' },
        });
      }
      if (masterRow) {
        await prisma.masterDataOrderSulam.delete({ where: { id: masterRow.id } });
      }
    } catch (e) {
      console.warn('Sync delete to MasterDataOrderSulam error:', e);
    }

    try {
      await applyListSulamDelta({
        lokasi: existing.lokasi,
        orderRitDelta: -oldRit,
        orderJumlahDelta: -oldBtg,
        recomputeOrderDate: true,
      });
    } catch (e) {
      console.warn('Sync delete to ListSulam error:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Tiket ${existing.nomorTiket} berhasil dihapus dan data Master Order serta ListSulam telah disinkronkan.`,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/sulam/form-order:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus tiket form order sulam.' },
      { status: 500 }
    );
  }
}

