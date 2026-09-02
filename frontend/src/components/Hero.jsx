import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Info, Plus, Check, Star } from "lucide-react";
import { backdrop } from "@/lib/api";
import { mediaTypeOf, titleOf, yearOf, ratingStr } from "@/lib/format";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";

export const Hero = ({ items = [] }) => {
    const navigate = useNavigate();
    const [idx, setIdx] = useState(0);
    const [saved, setSaved] = useState(false);
    const featured = items.slice(0, 6);
    const item = featured[idx];
    const mt = item ? mediaTypeOf(item) : "movie";

    useEffect(() => {
        if (featured.length < 2) return;
        const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 8000);
        return () => clearInterval(t);
    }, [featured.length]);

    useEffect(() => {
        if (item) setSaved(inWatchlist({ media_type: mt, id: item.id }));
    }, [item, mt]);

    if (!featured.length) return <div className="h-[60vh]" />;

    const save = () => {
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
            data-testid="hero-banner"
            className="relative h-[80vh] min-h-[520px] max-h-[820px] w-full"
        >
            {featured.map((f, i) => (
                <div
                    key={f.id}
                    className="absolute inset-0 transition-opacity duration-1000"
                    style={{ opacity: i === idx ? 1 : 0 }}
                >
                    <img
                        src={backdrop(f.backdrop_path, "original")}
                        alt={titleOf(f)}
                        className="w-full h-full object-cover object-top"
                    />
                </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/70 to-transparent" />

            <div className="relative h-full flex flex-col justify-end pb-20 md:pb-28 px-4 md:px-12 max-w-3xl syn-fade-up" key={item.id}>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-glow mb-3">
                    {mt === "tv" ? "Featured Series" : "Featured Film"}
                </span>
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-none mb-4">
                    {titleOf(item)}
                </h1>
                <div className="flex items-center gap-3 text-sm text-zinc-300 mb-4">
                    <span className="flex items-center gap-1 text-amber-glow font-mono">
                        <Star className="w-4 h-4 fill-amber-glow" /> {ratingStr(item.vote_average)}
                    </span>
                    <span>{yearOf(item)}</span>
                    <span className="px-2 py-0.5 rounded border border-white/20 text-xs uppercase">
                        {mt === "tv" ? "Series" : "Movie"}
                    </span>
                </div>
                <p className="text-zinc-300 text-sm md:text-base line-clamp-3 mb-6 max-w-xl">
                    {item.overview}
                </p>
                <div className="flex items-center gap-3">
                    <button
                        data-testid="hero-play-button"
                        onClick={() => navigate(`/watch/${mt}/${item.id}`)}
                        className="flex items-center gap-2 px-7 py-3 rounded-full bg-white text-black font-bold hover:bg-white/85 active:scale-95 transition-all"
                    >
                        <Play className="w-5 h-5 fill-black" /> Play
                    </button>
                    <button
                        data-testid="hero-info-button"
                        onClick={() => navigate(`/title/${mt}/${item.id}`)}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 active:scale-95 transition-all font-semibold"
                    >
                        <Info className="w-5 h-5" /> More Info
                    </button>
                    <button
                        data-testid="hero-watchlist-button"
                        onClick={save}
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 active:scale-95 transition-all"
                        aria-label="Add to list"
                    >
                        {saved ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex gap-1.5 mt-8">
                    {featured.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIdx(i)}
                            className={`h-1 rounded-full transition-all ${
                                i === idx ? "w-8 bg-crimson" : "w-4 bg-white/25"
                            }`}
                            aria-label={`Slide ${i + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
