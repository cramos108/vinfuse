import { Card } from "@/components/ui";
import { TERM_DEFS, TERMS } from "@/lib/terms";

export function TermGlossary({ className = "" }: { className?: string }) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan">How the two lists work</p>
      <div>
        <p className="font-black">{TERMS.dmsMasterList}</p>
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">{TERM_DEFS.dmsMasterList}</p>
      </div>
      <div>
        <p className="font-black">
          {TERMS.scanList} / {TERMS.walkReport}
        </p>
        <p className="text-sm font-semibold text-muted sunlight:text-slate-600">{TERM_DEFS.scanList}</p>
      </div>
    </Card>
  );
}
