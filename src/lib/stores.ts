/** Kroger-family grocery chains (all on the same Kroger API, prices and cart). */
const BANNERS: { re: RegExp; name: string; site: string }[] = [
  { re: /fry'?s/i, name: "Fry's", site: "https://www.frysfood.com" },
  { re: /ralphs/i, name: "Ralphs", site: "https://www.ralphs.com" },
  { re: /king ?soopers/i, name: "King Soopers", site: "https://www.kingsoopers.com" },
  { re: /smith'?s/i, name: "Smith's", site: "https://www.smithsfoodanddrug.com" },
  { re: /fred ?meyer/i, name: "Fred Meyer", site: "https://www.fredmeyer.com" },
  { re: /\bqfc\b|quality food/i, name: "QFC", site: "https://www.qfc.com" },
  { re: /dillons/i, name: "Dillons", site: "https://www.dillons.com" },
  { re: /city ?market/i, name: "City Market", site: "https://www.citymarket.com" },
  { re: /baker'?s/i, name: "Baker's", site: "https://www.bakersplus.com" },
  { re: /gerbes/i, name: "Gerbes", site: "https://www.gerbes.com" },
  { re: /jay ?c\b/i, name: "Jay C", site: "https://www.jaycfoods.com" },
  { re: /pay ?less/i, name: "Pay Less", site: "https://www.pay-less.com" },
  { re: /mariano'?s/i, name: "Mariano's", site: "https://www.marianos.com" },
  { re: /pick ?'?n'? ?save/i, name: "Pick 'n Save", site: "https://www.picknsave.com" },
  { re: /metro ?market/i, name: "Metro Market", site: "https://www.metromarket.net" },
  { re: /foods ?co/i, name: "Foods Co", site: "https://www.foodsco.net" },
  { re: /food ?4 ?less/i, name: "Food 4 Less", site: "https://www.food4less.com" },
  { re: /harris ?teeter/i, name: "Harris Teeter", site: "https://www.harristeeter.com" },
  { re: /ruler/i, name: "Ruler Foods", site: "https://www.rulerfoods.com" },
  { re: /kroger/i, name: "Kroger", site: "https://www.kroger.com" },
];

export type StoreBrand = { name: string | null; site: string };

/** Which chain a store belongs to, from its name (and the API's chain code when we have it). */
export function storeBrand(storeName?: string | null, chain?: string | null): StoreBrand {
  const text = `${storeName ?? ""} ${chain ?? ""}`;
  const hit = BANNERS.find((b) => b.re.test(text));
  return hit ? { name: hit.name, site: hit.site } : { name: null, site: "https://www.kroger.com" };
}

/** "your Fry's", "your Ralphs", or "your store" when we don't know yet. */
export const yourStore = (b: StoreBrand) => `your ${b.name ?? "store"}`;
/** "Fry's", "Ralphs", or "the store". */
export const storeWord = (b: StoreBrand) => b.name ?? "the store";

export const CHAIN_LIST = "Kroger, Fry's, Ralphs, King Soopers, Smith's, Fred Meyer, QFC, Dillons, Harris Teeter, Mariano's and more";
