import { Link } from "wouter";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header() {
  return (
    <header className="border-b bg-card text-card-foreground shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer" data-testid="link-home">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-bold rounded">
            Q
          </div>
          <span className="font-serif font-bold text-xl tracking-tight group-hover:text-primary transition-colors">
            QuantTerminal
          </span>
        </Link>
      </div>
      <div className="text-sm font-mono text-muted-foreground flex gap-4">
        <span>SYS: ONLINE</span>
        <span className="text-up">DATA: REALTIME</span>
      </div>
    </header>
  );
}
