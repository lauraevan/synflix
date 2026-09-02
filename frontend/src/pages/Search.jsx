import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchAll } from "@/lib/api";
import { MovieCard } from "@/components/MovieCard";
import { Spinner } from "@/components/Spinner";
import { SearchX } from "lucide-react";

export default function Search() {
    const [sp] = useSearchParams();
    const q = sp.get("q") || "";
    const { data, isLoading } = useQuery({
        queryKey: ["search", q],
        queryFn: () => searchAll(q),
        enabled: !!q,
    });

    const results = data?.results || [];

    return (
        <div data-testid="search-page" className="pt-24 px-4 md:px-12 pb-16 min-h-screen">
            <h1 className="text-2xl md:text-3xl font-extrabold mb-1">
                Results for <span className="text-crimson">“{q}”</span>
            </h1>
            <p className="text-sm text-zinc-500 mb-6">{results.length} titles</p>

            {isLoading ? (
                <Spinner />
            ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-3">
                    <SearchX className="w-10 h-10" />
                    <p>No titles found. Try another search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                    {results.map((it) => (
                        <MovieCard key={`${it.id}-${it.media_type}`} item={it} />
                    ))}
                </div>
            )}
        </div>
    );
}
