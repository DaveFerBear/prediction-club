import { clearAppSessionCookie } from '@/lib/app-session';
import { apiResponse } from '@/lib/api';

export async function POST() {
  const response = apiResponse({ success: true });
  clearAppSessionCookie(response);
  return response;
}
