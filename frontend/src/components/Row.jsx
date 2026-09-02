import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";

export const Row = ({ title, items = [], fallbackType, testId }) => {
    const ref = useRef(null);
    if (!items.length) return null;

    const scroll = (dir) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
    };

    return (
        <section className="px-4 md:px-12 py-4 group/row" data-testid={testId}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight">
                    {title}
                </h2>
                <div className="hidden md:flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                        onClick={() => scroll(-1)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-crimson border border-white/10 flex items-center justify-center transition-colors"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scroll(1)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-crimson border border-white/10 flex items-center justify-center transition-colors"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div
                ref={ref}
                className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2"
            >
                {items.map((it) => (
                    <MovieCard key={`${it.id}-${it.media_type || ""}`} item={it} fallbackType={fallbackType} />
                ))}
            </div>
        </section>
    );
};
