import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CART_COOKIE_NAME } from '@/lib/cart/server';
import {
  CART_TERMS_COOKIE_NAME,
  buildCartTermsCookieValue,
} from '@/lib/cart/terms';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  accepted: z.boolean(),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const cartId = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (!cartId) {
    return NextResponse.json({ ok: false, error: 'Carrito no encontrado.' }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, accepted: parsed.data.accepted });
  if (parsed.data.accepted) {
    response.cookies.set(CART_TERMS_COOKIE_NAME, buildCartTermsCookieValue(cartId), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  } else {
    response.cookies.set(CART_TERMS_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
