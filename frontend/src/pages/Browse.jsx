import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getGenres, discover } from "@/lib/api";
import { MovieCard } from "@/components/MovieCard";
import { Spinner } from "@/components/Spinner";

export default function Browse() {
    const { mediaType } = useParams();
    const [genre, setGenre] = useState(null);
    const { data: genresData } = useQuery({
        queryKey: ["genres", mediaType],
        queryFn: () => getGenres(mediaType),
    });
    const { data, isLoading } = useQuery({
        queryKey: ["discover", mediaType, genre],
        queryFn: () => discover(mediaType, genre ? { with_genres: genre, sort_by: "popularity.desc" } : { sort_by: "popularity.desc" }),
    });

    const genres = genresData?.genres || [];
    const results = data?.results || [];
    const label = mediaType === "tv" ? "TV Shows" : "Movies";

    return (
        <div data-testid="browse-page" className="pt-24 px-4 md:px-12 pb-16 min-h-screen">
            <h1 className="font-display text-4xl md:text-5xl mb-5">{label}</h1>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-4 mb-2">
                <button
                    onClick={() => setGenre(null)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition-all ${!genre ? "bg-crimson border-crimson" : "bg-surface border-white/10 hover:border-white/30"}`}
                >
                    All
                </button>
                {genres.map((g) => (
                    <button
                        key={g.id}
                        data-testid={`genre-${g.id}`}
                        onClick={() => setGenre(g.id)}
                        className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition-all ${genre === g.id ? "bg-crimson border-crimson" : "bg-surface border-white/10 hover:border-white/30"}`}
                    >
                        {g.name}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <Spinner />
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 md:gap-4">
                    {results.map((it) => (
                        <MovieCard key={it.id} item={it} fallbackType={mediaType} />
                    ))}
                </div>
            )}
        </div>
    );
}
