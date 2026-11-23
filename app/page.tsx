import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('ggf_session');

  // Jika belum login, langsung tampilkan login Super Admin
  if (!session || !session.value) {
    redirect('/login?role=super_admin&callbackUrl=/sulam/monitor-sulam');
  }

  try {
    const user = JSON.parse(decodeURIComponent(session.value));
    if (user.role !== 'super_admin') {
      redirect('/login?role=super_admin&error=unauthorized');
    }
  } catch {
    redirect('/login?role=super_admin&callbackUrl=/sulam/monitor-sulam');
  }

  // Jika sudah login sebagai Super Admin, langsung masuk ke Dashboard Sulam
  redirect('/sulam/monitor-sulam');
}

