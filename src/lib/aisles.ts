/** Store sections, in the order most stores are walked. */
export const AISLES = ["Produce", "Meat & Seafood", "Deli", "Dairy & Eggs", "Bakery & Bread", "Canned & Dry Goods", "Spices, Oils & Sauces", "Frozen", "Snacks & Drinks", "Other"] as const;
export type Aisle = (typeof AISLES)[number];

// Checked in this order: the first match wins, so "frozen corn" is Frozen, "canned tomatoes" is Canned,
// "black pepper" is Spices (not the bell pepper in Produce) and "peanut butter" isn't Dairy.
const RULES: [Aisle, RegExp][] = [
  ["Frozen", /\bfrozen\b|ice cream|tater tots|popsicle|cauliflower rice/],
  ["Spices, Oils & Sauces", /\b(salt|black pepper|white pepper|ground pepper|peppercorns?|pepper flakes|chill?i flakes|chili powder|garlic powder|onion powder|paprika|cumin|oregano|thyme|dried (basil|oregano|thyme|rosemary|dill|parsley)|cinnamon|nutmeg|cayenne|curry powder|seasoning|spices?|bay lea(f|ves)|laurel leaf|vanilla|extract|oil|vinegar|soy sauce|tamari|fish sauce|oyster sauce|hoisin|sriracha|hot sauce|chili sauce|worcestershire|ketchup|mustard|mayo(nnaise)?|bbq sauce|barbecue sauce|teriyaki|dressing|honey|syrup|molasses|liquid smoke|bouillon|cooking spray|adobo|saz[oó]n|sofrito|mirin|sake|sweetener|ground chile|chile piqu[ií]n)\b/],
  ["Deli", /\bdeli\b|lunch meat|cold cuts|rotisserie|salami|pepperoni|prosciutto|sliced turkey|hummus|sushi/],
  ["Bakery & Bread", /\b(bread|buns?|rolls?|bagels?|tortillas?|pitas?|naan|flatbreads?|english muffins?|croissants?|tostadas?|taco shells|pizza dough|cornbread|baguette)\b/],
  ["Canned & Dry Goods", /\b(canned|cans?|\(\d+ oz\) (can|jar)|jars?|broth|stock|beans|chickpeas|lentils|hominy|tomato (sauce|paste)|crushed tomato(es)?|diced tomato(es)?|marinara|pasta sauce|pizza sauce|enchilada sauce|salsa|rice|pasta|spaghetti|penne|macaroni|noodles|fettuccine|ziti|shells|elbow|oats|cereal|cornflakes|granola|flour|cornmeal|sugar|baking (soda|powder)|cornstarch|breadcrumbs|panko|peanut butter|jam|jelly|coconut milk|tuna|dried \w* ?chiles?|chiles?|chile de [aá]rbol|ramen|crackers|tortilla chips|chips|gravy|tahini|olives|pickles|pancake|waffle mix|sesame seeds|bonito|almonds|pecans|walnuts|peanuts|nuts|cranberries|raisins)\b/],
  ["Meat & Seafood", /\b(chicken|beef|steaks?|ribeye|strip|pork|sausages?|bacon|ham|turkey|ribs|chuck|brisket|roast|lamb|chorizo|kielbasa|hot dogs?|meatballs?|shrimp|salmon|fish|tilapia|cod|halibut|crab|scallops)\b/],
  ["Dairy & Eggs", /\b(milk|cheese|cheddar|mozzarella|parmesan|pecorino|romano|provolone|swiss|gouda|jack|colby|feta|cotija|queso|ricotta|butter|cream|half-and-half|yogh?urt|sour cream|eggs?|egg whites)\b/],
  ["Produce", /\b(onions?|shallots?|garlic|scallions?|green onions?|leeks?|chives|bell peppers?|peppers?|jalapenos?|poblanos?|serranos?|tomato(es)?|potato(es)?|sweet potato(es)?|carrots?|celery|lettuce|spinach|kale|cabbage|coleslaw mix|slaw|broccoli|cauliflower|zucchini|squash|cucumbers?|mushrooms?|asparagus|green beans|corn|radish(es)?|avocados?|limes?|lemons?|oranges?|apples?|bananas?|berries|strawberries|blueberries|grapes|pineapple|mango|peach(es)?|fruit|cilantro|parsley|basil|rosemary|mint|dill|ginger|herbs?|salad|tofu)\b/],
  ["Snacks & Drinks", /\b(juice|soda|sparkling water|bottled water|coffee|tea|snacks?|cookies|candy|popcorn|pretzels|bars?)\b/],
];

// Not bought: water, skewers, cooking drippings.
const NOT_BOUGHT = /^(warm |hot |cold |large pot of |about \d+ cups )?water\b|skewers|drippings|as the box says/;

/** Lines that aren't groceries (water from the tap, skewers, pan drippings). */
export const notBought = (item: string) => NOT_BOUGHT.test(item.toLowerCase().trim());

/** Which store section an item is in. */
export function aisleOf(item: string): Aisle {
  const t = item.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, (m) => (/\d+ oz/.test(m) ? m : " "));
  // Look at the item itself first ("garlic, minced"), then the whole line.
  const head = t.split(/,|;| for /)[0];
  for (const text of [head, t]) {
    const hit = RULES.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return "Other";
}
