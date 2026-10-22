import "server-only";
type Product = { id: string; category: string; price: number; stock: number };
type Activity = { id: string; name: string; type: string; threshold?: number; discount?: number; category?: string; rate?: number; enabled: boolean };
type Coupon = { id: string; name: string; threshold: number; discount: number; category?: string; enabled: boolean; stackable: boolean };
export function calculateStudioPrice(products: Product[], activities: Activity[], coupons: Coupon[]) {
  const cents = products.map((product) => Math.round(product.price * 100));
  const subtotal = cents.reduce((sum, amount) => sum + amount, 0);
  const candidates: { activity: Activity | null; amounts: number[] }[] = [{ activity: null, amounts: cents }];
  for (const activity of activities.filter((item) => item.enabled)) {
    if (activity.type === "threshold_reduction" && subtotal >= Math.round((activity.threshold ?? Infinity) * 100)) {
      const discount = Math.min(subtotal, Math.round((activity.discount || 0) * 100));
      let remainder = discount;
      const amounts = cents.map((amount, index) => { const deduction = index === cents.length - 1 ? remainder : Math.floor(discount * amount / Math.max(1, subtotal)); remainder -= deduction; return amount - deduction; });
      candidates.push({ activity, amounts });
    } else if (activity.type === "category_discount" && products.some((product) => product.category === activity.category)) candidates.push({ activity, amounts: cents.map((amount, index) => products[index].category === activity.category ? Math.round(amount * (activity.rate ?? 1)) : amount) });
  }
  let best = { total: subtotal, activity: null as Activity | null, coupon: null as Coupon | null, discount: 0 };
  for (const candidate of candidates) {
    const afterActivity = candidate.amounts.reduce((sum, amount) => sum + amount, 0);
    if (afterActivity < best.total) best = { total: afterActivity, activity: candidate.activity, coupon: null, discount: 0 };
    for (const coupon of coupons.filter((coupon) => coupon.enabled && !/新人|新客/.test(coupon.name) && (!candidate.activity || coupon.stackable))) {
      const eligible = candidate.amounts.reduce((sum, amount, index) => sum + (!coupon.category || coupon.category === products[index].category ? amount : 0), 0);
      if (eligible === 0 || eligible < Math.round(coupon.threshold * 100)) continue;
      const discount = Math.min(eligible, Math.round(coupon.discount * 100));
      if (afterActivity - discount < best.total) best = { total: afterActivity - discount, activity: candidate.activity, coupon, discount };
    }
  }
  return { subtotal: subtotal / 100, activityApplied: best.activity ? { id: best.activity.id, name: best.activity.name } : null, couponApplied: best.coupon ? { id: best.coupon.id, name: best.coupon.name, discount: best.discount / 100 } : null, savings: (subtotal - best.total) / 100, finalPrice: best.total / 100, note: "按推荐商品各 1 件试算，不含运费；未核实新客资格，不自动使用新人券。" };
}
