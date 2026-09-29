/** Allocates one server-calculated discount over package base amounts using largest remainders. */
export function distributeCommunityDiscount<T extends { baseSubtotalAmount: number; subtotalAmount: number }>(items: T[], discountCents: number) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Math.floor(item.baseSubtotalAmount)), 0);
  const discount = Math.min(total, Math.max(0, Math.floor(discountCents)));
  const allocations = items.map((item, index) => {
    const exact = total > 0 ? discount * Math.max(0, Math.floor(item.baseSubtotalAmount)) / total : 0;
    return { index, amount: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = discount - allocations.reduce((sum, item) => sum + item.amount, 0);
  for (const item of [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (remaining <= 0) break;
    if (items[item.index].baseSubtotalAmount > 0) {
      item.amount += 1;
      remaining -= 1;
    }
  }
  return items.map((item, index) => {
    const allocatedDiscount = allocations[index].amount;
    return {
      ...item,
      originalBaseSubtotalAmount: item.baseSubtotalAmount,
      originalSubtotalAmount: item.subtotalAmount,
      communityDiscountAmount: allocatedDiscount,
      baseSubtotalAmount: Math.max(0, item.baseSubtotalAmount - allocatedDiscount),
      subtotalAmount: Math.max(0, item.subtotalAmount - allocatedDiscount),
    };
  });
}
