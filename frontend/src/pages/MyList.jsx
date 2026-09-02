import { useState } from "react";
import { getWatchlist } from "@/lib/storage";
import { MovieCard } from "@/components/MovieCard";
import { Bookmark } from "lucide-react";

export default function MyList() {
    const [items] = useState(() => getWatchlist());

    return (
        <div data-testid="my-list-page" className="pt-24 px-4 md:px-12 pb-16 min-h-screen">
            <h1 className="font-display text-4xl md:text-5xl mb-6 flex items-center gap-3">
                <Bookmark className="w-8 h-8 text-crimson" /> MY LIST
            </h1>
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-3">
                    <Bookmark className="w-10 h-10" />
                    <p>Your list is empty. Add films & shows to watch later.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                    {items.map((it) => (
                        <MovieCard key={`${it.media_type}-${it.id}`} item={it} fallbackType={it.media_type} />
                    ))}
                </div>
            )}
        </div>
    );
}
