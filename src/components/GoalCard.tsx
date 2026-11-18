import Link from "next/link";

/** A full-width card that leads somewhere: icon, a question, one line of why, and a real button to tap. */
export function GoalCard({ icon, title, text, href, button, tone = "olive", note }: { icon: string; title: string; text: string; href?: string; button: string; tone?: "olive" | "ochre"; note?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center ${tone === "olive" ? "bg-olive-soft/70" : "bg-ochre-soft"}`}>
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-2xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight">{title}</p>
        <p className="text-muted">{text}</p>
      </div>
      {href ? (
        <Link href={href} className="btn-primary shrink-0 whitespace-nowrap text-center">{button}</Link>
      ) : (
        <p className="shrink-0 text-sm font-semibold text-muted">{note}</p>
      )}
    </div>
  );
}
