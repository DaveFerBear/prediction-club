import { NextResponse } from 'next/server';
import type { ApiResponse } from '@prediction-club/shared';

/**
 * Standard API response helper
 */
export function apiResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Standard API error response helper
 */
export function apiError(
  code: string,
  message: string,
  status = 400
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

/**
 * Validation error response
 */
export function validationError(message: string): NextResponse<ApiResponse<never>> {
  return apiError('VALIDATION_ERROR', message, 400);
}

/**
 * Not found error response
 */
export function notFoundError(resource: string): NextResponse<ApiResponse<never>> {
  return apiError('NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Unauthorized error response
 */
export function unauthorizedError(message = 'Unauthorized'): NextResponse<ApiResponse<never>> {
  return apiError('UNAUTHORIZED', message, 401);
}

/**
 * Forbidden error response
 */
export function forbiddenError(message = 'Forbidden'): NextResponse<ApiResponse<never>> {
  return apiError('FORBIDDEN', message, 403);
}

/**
 * Internal server error response
 */
export function serverError(message = 'Internal server error'): NextResponse<ApiResponse<never>> {
  return apiError('INTERNAL_ERROR', message, 500);
}
