import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Plus, Check, Star, ChevronLeft } from "lucide-react";
import { getDetails, getSeason, backdrop, img } from "@/lib/api";
import { titleOf, yearOf, runtimeStr, ratingStr } from "@/lib/format";
import { Row } from "@/components/Row";
import { Spinner } from "@/components/Spinner";
import { inWatchlist, toggleWatchlist } from "@/lib/storage";

const SeasonPicker = ({ id, seasons }) => {
    const navigate = useNavigate();
    const valid = seasons.filter((s) => s.season_number > 0);
    const [sel, setSel] = useState(valid[0]?.season_number || 1);
    const { data } = useQuery({
        queryKey: ["season", id, sel],
        queryFn: () => getSeason(id, sel),
        enabled: !!sel,
    });

    return (
        <div className="px-4 md:px-12 py-6" data-testid="season-picker">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-xl md:text-2xl font-extrabold">Episodes</h2>
                <select
                    data-testid="season-select"
                    value={sel}
                    onChange={(e) => setSel(Number(e.target.value))}
                    className="bg-surface border border-white/15 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-crimson"
                >
                    {valid.map((s) => (
                        <option key={s.id} value={s.season_number}>{s.name}</option>
                    ))}
                </select>
            </div>
            <div className="grid gap-3">
                {(data?.episodes || []).map((ep) => (
                    <div
                        key={ep.id}
                        data-testid={`episode-${ep.episode_number}`}
                        onClick={() => navigate(`/watch/tv/${id}?season=${sel}&episode=${ep.episode_number}`)}
                        className="group flex gap-4 p-3 rounded-xl bg-surface/60 hover:bg-surface border border-transparent hover:border-white/10 cursor-pointer transition-all"
                    >
                        <div className="relative w-32 md:w-44 aspect-video rounded-lg overflow-hidden shrink-0 bg-black">
                            {ep.still_path && <img src={img(ep.still_path, "w300")} alt="" className="w-full h-full object-cover" />}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                <Play className="w-8 h-8 fill-white" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm md:text-base">{ep.episode_number}. {ep.name}</p>
                            <p className="text-xs text-zinc-500 mb-1">{ep.runtime ? `${ep.runtime}m` : ""} {ep.air_date ? `· ${ep.air_date}` : ""}</p>
                            <p className="text-xs md:text-sm text-zinc-400 line-clamp-2">{ep.overview}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function Title() {
    const { mediaType, id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({
        queryKey: ["details", mediaType, id],
        queryFn: () => getDetails(mediaType, id),
    });
    const [saved, setSaved] = useState(false);
    useEffect(() => { setSaved(inWatchlist({ media_type: mediaType, id: Number(id) })); }, [id, mediaType]);
    useEffect(() => { window.scrollTo(0, 0); }, [id]);

    if (isLoading || !data) return <div className="pt-16"><Spinner /></div>;

    const genres = (data.genres || []).map((g) => g.name);
    const cast = (data.credits?.cast || []).slice(0, 12);
    const similar = (data.similar?.results || data.recommendations?.results || []);
    const save = () => {
        const now = toggleWatchlist({
            media_type: mediaType, id: Number(id), title: titleOf(data),
            poster_path: data.poster_path, backdrop_path: data.backdrop_path,
            vote_average: data.vote_average, release_date: data.release_date, first_air_date: data.first_air_date,
        });
        setSaved(now);
    };

    return (
        <div data-testid="title-page">
            <div className="relative h-[68vh] min-h-[440px]">
                <img src={backdrop(data.backdrop_path, "original")} alt={titleOf(data)} className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-obsidian/90 to-transparent" />
                <button onClick={() => navigate(-1)} className="absolute top-20 left-4 md:left-12 w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center hover:bg-crimson transition-colors z-10">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-4 md:px-12 pb-8 max-w-3xl">
                    <h1 className="font-display text-5xl md:text-6xl leading-none mb-3">{titleOf(data)}</h1>
                    <div className="flex items-center gap-3 text-sm text-zinc-300 mb-4 flex-wrap">
                        <span className="flex items-center gap-1 text-amber-glow font-mono"><Star className="w-4 h-4 fill-amber-glow" />{ratingStr(data.vote_average)}</span>
                        <span>{yearOf(data)}</span>
                        {mediaType === "movie" && data.runtime ? <span>{runtimeStr(data.runtime)}</span> : null}
                        {mediaType === "tv" && data.number_of_seasons ? <span>{data.number_of_seasons} Season{data.number_of_seasons > 1 ? "s" : ""}</span> : null}
                        <div className="flex gap-2">{genres.slice(0, 3).map((g) => <span key={g} className="px-2 py-0.5 rounded border border-white/20 text-xs">{g}</span>)}</div>
                    </div>
                    <p className="text-sm md:text-base text-zinc-300 line-clamp-3 mb-6">{data.overview}</p>
                    <div className="flex items-center gap-3">
                        <button
                            data-testid="title-play-button"
                            onClick={() => navigate(`/watch/${mediaType}/${id}${mediaType === "tv" ? "?season=1&episode=1" : ""}`)}
                            className="flex items-center gap-2 px-7 py-3 rounded-full bg-white text-black font-bold hover:bg-white/85 active:scale-95 transition-all"
                        >
                            <Play className="w-5 h-5 fill-black" /> Play
                        </button>
                        <button data-testid="title-watchlist-button" onClick={save} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 active:scale-95 transition-all font-semibold">
                            {saved ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {saved ? "In My List" : "My List"}
                        </button>
                    </div>
                </div>
            </div>

            {mediaType === "tv" && data.seasons && <SeasonPicker id={id} seasons={data.seasons} />}

            {cast.length > 0 && (
                <div className="px-4 md:px-12 py-6">
                    <h2 className="text-xl md:text-2xl font-extrabold mb-4">Cast</h2>
                    <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
                        {cast.map((c) => (
                            <div key={c.id} className="shrink-0 w-24 text-center">
                                <div className="w-24 h-24 rounded-full overflow-hidden bg-surface mb-2 mx-auto border border-white/10">
                                    {c.profile_path ? <img src={img(c.profile_path, "w185")} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-display text-zinc-600">{c.name?.[0]}</div>}
                                </div>
                                <p className="text-xs font-semibold truncate">{c.name}</p>
                                <p className="text-[11px] text-zinc-500 truncate">{c.character}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {similar.length > 0 && <Row title="More Like This" items={similar} fallbackType={mediaType} testId="row-similar" />}
            <div className="pb-16" />
        </div>
    );
}
