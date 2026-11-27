#!/bin/bash
set -e

echo "============================================="
echo "  🚀 Updating Dashboard Sulam (Field Establishment)"
echo "============================================="

# 1. Tarik pembaruan dari repository (data database VPS TIDAK di-reset)
echo "📥 [1/4] Mengambil kode terbaru dari Git..."
git pull origin main

# 2. Generate Prisma Client (AMAN: tidak menjalankan db push --accept-data-loss)
echo "🗄️  [2/4] Generate Prisma Client..."
npx prisma generate

# 3. Build aplikasi untuk produksi
echo "🏗️  [3/4] Melakukan build aplikasi Next.js (Sulam)..."
npm run build

# 4. Restart khusus layanan sulam-project di PM2 (tidak mengganggu app lain)
echo "🔄 [4/4] Me-restart layanan sulam-project di PM2..."
if command -v pm2 &> /dev/null; then
    if pm2 describe sulam-project > /dev/null 2>&1; then
        pm2 restart sulam-project --update-env
        pm2 save
        echo "✅ PM2 (sulam-project) berhasil di-restart!"
    else
        echo "⚠️ Proses PM2 'sulam-project' tidak ditemukan. Cek nama proses via 'pm2 list' lalu jalankan: pm2 restart <nama-atau-id> --update-env"
    fi
else
    echo "⚠️ PM2 tidak terdeteksi. Silakan jalankan 'npm run start' secara manual."
fi

echo "============================================="
echo "🎉 Update Dashboard Sulam selesai!"
echo "============================================="

