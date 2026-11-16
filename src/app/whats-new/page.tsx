import Link from "next/link";
import { requireUserId } from "@/auth";

export const metadata = { title: "What's new · Ladle" };

type Item = { icon: string; title: string; text: string; href?: string; where?: string };

// Newest first. Each one says where to find it.
const NEW: { when: string; items: Item[] }[] = [
  {
    when: "November 2026",
    items: [
      { icon: "🎉", title: "Plan a party", text: "Birthday, graduation, celebration of life, Christmas, a shower, game day or a picnic: pick the party and how many are coming. Ladle suggests boards, trays, bites, sweets and drinks, sizes them for the crowd, checks them against your food rules, and makes the shopping list and a timeline.", href: "/party" },
      { icon: "🏷️", title: "What's on sale in each recipe", text: "Every recipe shows how many of its ingredients are on sale this week, the pricey ones first, and when the sale ends if the store says.", href: "/recipes" },
      { icon: "🐾", title: "Pet food", text: "Add your pet's food and treats to Snacks & more: food when you're running low, treats when they're on sale.", href: "/extras?c=pets" },
      { icon: "🤝", title: "Plan for a parent", text: "Caring for Mom or Grandpa? Give them their own plan, grocery list, pantry and Fry's cart, run from your phone. A bar at the top always says whose week you're planning, and one tap takes you back to your family.", href: "/household#care" },
      { icon: "🎯", title: "Modes: Normal, Cost Cutting, Workout", text: "Pick one goal for the week from the banner on Home. Cost Cutting picks the cheapest dinners and products and shows what it saved compared with your family's typical week. Workout leans toward high-protein dinners. Your food rules apply in every mode.", where: "Home, the banner at the top" },
      { icon: "📷", title: "Snap my fridge", text: "Take a photo of the fridge or pantry and Ladle lists the foods it can see, then shows dinners that use them.", href: "/recipes?f=have" },
      { icon: "🤖", title: "A grocery list for your AI shopper", text: "Copy the list with shopping instructions, your food rules and budget, ready to paste into the AI assistant you already use to shop any store.", where: "Home, Grocery list" },
      { icon: "🏠", title: "Everything starts on Home", text: "Big tiles for this week, the grocery list, planning, recipes, food creators, athlete mode, using up what you have, and Settings. New families get a short Getting started list that ticks itself off.", href: "/" },
      { icon: "🗓", title: "Plan my week, with a quick check-in", text: "Before planning, four quick questions about this week: which nights you cook (or are busy, or off), who's around, the budget, anything to use up, and what you're in the mood for. Your Settings stay as they are.", href: "/plan" },
      { icon: "⚡", title: "A quicker start", text: "Setting up Ladle is now five short screens: who's eating, food rules, your store, your budget, and your recipes. The rest can wait.", where: "Sign-up" },
      { icon: "✨", title: "Recipes from your favorite food creators", text: "Follow the food bloggers and creators you love (Half Baked Harvest, RecipeTin Eats, Pinch of Yum, or paste any site). Ladle watches for their new dinners and works them into your week, especially when the ingredients are on sale, and skips anything that breaks your food rules.", href: "/recipes?tab=cooks" },
      { icon: "💪", title: "Athlete mode", text: "Pick each person's sport (CrossFit, strongman, lifting, running…), goal and phase. Ladle sizes their portions, raises the protein, adds the right snacks and shakes, and gives simple tips, while everyone else eats as usual.", href: "/athletes" },
      { icon: "🦃", title: "Thanksgiving and Christmas dinners", text: "On the holiday's card, plan the feast: how many people and which dishes. The turkey or ham is sized for the table, the groceries get their own section, and a countdown says when to thaw, what to make the day before, and when it goes in the oven.", where: "Home, on the holiday" },
      { icon: "👥", title: "Who's eating tonight?", text: "Company coming, or someone away? Before you approve the week, change who's at dinner on any night and its groceries follow.", where: "Home, Swap on any night" },
      { icon: "🔀", title: "Move a dinner to another night", text: "Soccer ran late? Trade two nights' dinners, even after shopping. Leftovers nights move with their dinner.", where: "Home, Move on any night" },
      { icon: "✅", title: "Shared grocery list", text: "Ticks show up on every phone in the household within seconds, so two people can split up the store. Add your own things (paper towels, birthday candles) and they go in the cart too.", where: "Home, Grocery list" },
      { icon: "🥫", title: "What can I make with what I have?", text: "Type what's in the fridge and see the dinners that use the most of it, with what's still needed.", href: "/recipes?f=have" },
      { icon: "👩‍🍳", title: "Cooking help", text: "Start cooking from tonight's card, amounts sized for your family (double for a leftovers night), your own notes on any recipe, the per-serving nutrition and cost, and Share to text a recipe to someone.", href: "/recipes" },
      { icon: "📷", title: "Read my receipt", text: "Snap the receipt and Ladle fills in what the week cost. History also adds up what sales saved you.", href: "/history" },
      { icon: "🖨️", title: "Fridge menu and calendar", text: "Print the week's menu for the fridge, or add the week (and the holiday countdown) to your phone's calendar.", where: "Home, under the week" },
      { icon: "🗓", title: "Start now", text: "Starting mid-week? Plan the rest of this week right away instead of waiting for shopping day.", where: "Home, before the first plan" },
      { icon: "🌱", title: "More recipes for strict diets", text: "Fourteen new vegetarian, gluten-free dinners (most of them vegan), and a first recipe box that fits your food rules and kitchen.", href: "/recipes?tab=browse" },
      { icon: "🛡️", title: "Allergy-safe store picks", text: "A store product whose name breaks one of your food rules is never picked for the cart, and it's marked so it can't slip in.", where: "Cart" },
      { icon: "🏷️", title: "Aisle numbers", text: "When Fry's says where an item is, the grocery list and cart show the aisle.", where: "Grocery list, after matching the cart" },
    ],
  },
];

/** A short tour of what's new, for the family and anyone trying Ladle out. */
export default async function WhatsNewPage() {
  await requireUserId();
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Fresh from the kitchen</p>
        <h1 className="text-4xl font-semibold">What&apos;s new</h1>
      </div>
      {NEW.map((group) => (
        <section key={group.when} aria-labelledby={`new-${group.when}`} className="space-y-3">
          <h2 id={`new-${group.when}`} className="text-xl font-semibold text-olive-dark">{group.when}</h2>
          <ul className="space-y-3">
            {group.items.map((it) => (
              <li key={it.title} className="card flex gap-3 p-4">
                <span className="text-2xl" aria-hidden="true">{it.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold">{it.href ? <Link href={it.href} className="hover:underline">{it.title}</Link> : it.title}</p>
                  <p className="text-muted">{it.text}</p>
                  {it.where && <p className="mt-1 text-sm font-bold text-terracotta-dark">Where: {it.where}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
