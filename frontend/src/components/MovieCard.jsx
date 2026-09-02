import { useNavigate } from "react-router-dom";
import { Play, Plus, Star, Check } from "lucide-react";
import { img } from "@/lib/api";
import { mediaTypeOf, titleOf, yearOf, ratingStr } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";
import { useState } from "react";

export const MovieCard = ({ item, fallbackType }) => {
    const navigate = useNavigate();
    const mt = mediaTypeOf(item, fallbackType);
    const poster = img(item.poster_path, "w342");
    const [saved, setSaved] = useState(() =>
        inWatchlist({ media_type: mt, id: item.id })
    );

    const go = () => navigate(`/title/${mt}/${item.id}`);
    const play = (e) => {
        e.stopPropagation();
        navigate(`/watch/${mt}/${item.id}`);
    };
    const save = (e) => {
        e.stopPropagation();
        const now = toggleWatchlist({
            media_type: mt,
            id: item.id,
            title: titleOf(item),
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            vote_average: item.vote_average,
            release_date: item.release_date,
            first_air_date: item.first_air_date,
        });
        setSaved(now);
    };

    return (
        <div
            data-testid={`movie-card-${item.id}`}
            onClick={go}
            className="group relative shrink-0 w-[150px] sm:w-[172px] md:w-[200px] snap-start cursor-pointer no-tap"
        >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-transparent group-hover:border-white/15 transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
                {poster ? (
                    <img
                        src={poster}
                        alt={titleOf(item)}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs p-3 text-center">
                        {titleOf(item)}
                    </div>
                )}

                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono">
                    <Star className="w-3 h-3 text-amber-glow fill-amber-glow" />
                    {ratingStr(item.vote_average)}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <p className="text-sm font-bold leading-tight line-clamp-2">{titleOf(item)}</p>
                    <p className="text-[11px] text-zinc-400 mb-2">
                        {yearOf(item)} · {mt === "tv" ? "Series" : "Film"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            data-testid={`movie-card-play-btn-${item.id}`}
                            onClick={play}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-crimson hover:bg-crimson/80 active:scale-95 transition-all"
                            aria-label="Play"
                        >
                            <Play className="w-4 h-4 fill-white text-white" />
                        </button>
                        <button
                            data-testid={`movie-card-save-btn-${item.id}`}
                            onClick={save}
                            className="flex items-center justify-center w-8 h-8 rounded-full border border-white/40 hover:border-white bg-black/40 active:scale-95 transition-all"
                            aria-label="Add to list"
                        >
                            {saved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
