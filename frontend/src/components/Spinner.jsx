import { Loader2 } from "lucide-react";

export const Spinner = ({ label }) => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-crimson" />
        {label && <p className="text-sm">{label}</p>}
    </div>
);
