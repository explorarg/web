export const CART_TERMS_COOKIE_NAME = 'exploarg_cart_terms';

function normalizeCartId(cartId: string | null | undefined): string {
  return String(cartId ?? '').trim();
}

export function buildCartTermsCookieValue(cartId: string | null | undefined): string {
  const normalizedCartId = normalizeCartId(cartId);
  if (!normalizedCartId) return '';
  return `${normalizedCartId}:accepted`;
}

export function hasAcceptedCartTerms(cookieValue: string | null | undefined, cartId: string | null | undefined): boolean {
  const expected = buildCartTermsCookieValue(cartId);
  if (!expected) return false;
  return String(cookieValue ?? '').trim() === expected;
}
