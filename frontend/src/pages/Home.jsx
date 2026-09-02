import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { getHome, backdrop } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { Row } from "@/components/Row";
import { Spinner } from "@/components/Spinner";
import { getContinue, removeContinue } from "@/lib/storage";
import { Play, X } from "lucide-react";
import { titleOf } from "@/lib/format";

const ContinueRow = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState(() => getContinue());
    if (!items.length) return null;
    return (
        <section className="px-4 md:px-12 py-4" data-testid="continue-watching-row">
            <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight mb-3">Continue Watching</h2>
            <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none pb-2">
                {items.map((it) => {
                    const pct = it.duration ? (it.position / it.duration) * 100 : 0;
                    const go = () =>
                        navigate(`/watch/${it.media_type}/${it.id}${it.media_type === "tv" ? `?season=${it.season}&episode=${it.episode}` : ""}`);
                    return (
                        <div key={`${it.media_type}-${it.id}`} data-testid={`continue-card-${it.id}`} onClick={go}
                            className="group relative shrink-0 w-[220px] md:w-[300px] aspect-video rounded-xl overflow-hidden bg-surface cursor-pointer border border-transparent hover:border-white/20 transition-all">
                            {it.backdrop_path && <img src={backdrop(it.backdrop_path, "w780")} alt={it.title} className="w-full h-full object-cover" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                            <button onClick={(e) => { e.stopPropagation(); removeContinue(it.media_type, it.id); setItems(getContinue()); }}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-crimson">
                                <X className="w-4 h-4" />
                            </button>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 rounded-full bg-crimson/90 flex items-center justify-center"><Play className="w-6 h-6 fill-white" /></div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="text-sm font-semibold truncate">{titleOf(it)}{it.media_type === "tv" ? ` · S${it.season}E${it.episode}` : ""}</p>
                                <div className="h-1 rounded-full bg-white/20 mt-2 overflow-hidden">
                                    <div className="h-full bg-crimson" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default function Home() {
    const { data, isLoading } = useQuery({ queryKey: ["home"], queryFn: getHome });
    if (isLoading || !data) return <div className="pt-16"><Spinner label="Loading Synflix…" /></div>;

    return (
        <div data-testid="home-page">
            <Hero items={data.trending} />
            <div className="relative z-10 -mt-16 space-y-2 pb-16">
                <ContinueRow />
                <Row title="Trending Now" items={data.trending} testId="row-trending" />
                <Row title="Popular Movies" items={data.popular_movies} fallbackType="movie" testId="row-popular-movies" />
                <Row title="Popular Series" items={data.popular_tv} fallbackType="tv" testId="row-popular-tv" />
                <Row title="Top Rated Films" items={data.top_rated_movies} fallbackType="movie" testId="row-top-movies" />
                <Row title="Now Playing" items={data.now_playing} fallbackType="movie" testId="row-now-playing" />
                <Row title="Top Rated Series" items={data.top_rated_tv} fallbackType="tv" testId="row-top-tv" />
                <Row title="Coming Soon" items={data.upcoming} fallbackType="movie" testId="row-upcoming" />
            </div>
        </div>
    );
}
