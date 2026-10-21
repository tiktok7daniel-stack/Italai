/** Glowing glass medallion used for empty states and celebrations. */
export function Emblem({ children }: { children: React.ReactNode }) {
  return (
    <div className="emblem" aria-hidden>
      <span className="emblem-glow" />
      <span className="emblem-core">{children}</span>
    </div>
  );
}
