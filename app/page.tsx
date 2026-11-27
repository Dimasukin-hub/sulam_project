import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDefaultPortalRoute, sanitizeAllowedMenus } from '@/lib/menuAccess';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('ggf_session');

  // Jika belum login, arahkan ke halaman login Portal Sulam
  if (!session || !session.value) {
    redirect('/login?callbackUrl=/sulam');
  }

  let sessionUser: { role?: string; allowedMenus?: ReturnType<typeof sanitizeAllowedMenus> } | null = null;
  try {
    const parsed = JSON.parse(decodeURIComponent(session.value));
    sessionUser = {
      role: parsed?.role || '',
      allowedMenus: sanitizeAllowedMenus(parsed?.allowedMenus),
    };
  } catch {
    redirect('/login?callbackUrl=/sulam');
  }

  const dest = getDefaultPortalRoute(sessionUser, 'sulam');
  if (dest) {
    redirect(dest);
  }

  redirect('/login?error=unauthorized');
}

