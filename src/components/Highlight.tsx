/** Bold the numbers that matter ("57% off", "$62") so the planner's reasons can be skimmed. */
export function Highlight({ text, className = "font-extrabold text-terracotta-dark" }: { text: string; className?: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?% off|\$\d+(?:,\d{3})*(?:\.\d{2})?)/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i} className={className}>{p}</strong> : p))}</>;
}
