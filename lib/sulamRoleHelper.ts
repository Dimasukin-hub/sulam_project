import { NextRequest } from 'next/server';
import { AllowedMenusMap, sanitizeAllowedMenus } from './menuAccess';

export interface SessionUserLite {
  role: string;
  allowedMenus: AllowedMenusMap | null;
}

/**
 * Extract authenticated user info (`role` & `allowedMenus`) from the `ggf_session` cookie.
 */
export function extractSessionUser(request: NextRequest): SessionUserLite | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/ggf_session=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    const sessUser = JSON.parse(decoded);
    if (!sessUser || typeof sessUser !== 'object') return null;
    return {
      role: typeof sessUser.role === 'string' ? sessUser.role : '',
      allowedMenus: sanitizeAllowedMenus(sessUser.allowedMenus),
    };
  } catch {
    return null;
  }
}

export function extractSessionRole(request: NextRequest): string {
  return extractSessionUser(request)?.role || '';
}
