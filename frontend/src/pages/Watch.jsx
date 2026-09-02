import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDetails, getSeason } from "@/lib/api";
import { titleOf } from "@/lib/format";
import { SynapsePlayer } from "@/components/SynapsePlayer";
import { Spinner } from "@/components/Spinner";

export default function Watch() {
    const { mediaType, id } = useParams();
    const [sp, setSp] = useSearchParams();
    const navigate = useNavigate();
    const season = Number(sp.get("season") || 1);
    const episode = Number(sp.get("episode") || 1);

    useEffect(() => { window.scrollTo(0, 0); }, []);

    const { data: details, isLoading } = useQuery({
        queryKey: ["details", mediaType, id],
        queryFn: () => getDetails(mediaType, id),
    });
    const { data: seasonData } = useQuery({
        queryKey: ["season", id, season],
        queryFn: () => getSeason(id, season),
        enabled: mediaType === "tv",
    });

    const epCount = seasonData?.episodes?.length || 0;
    const hasNext = mediaType === "tv" && episode < epCount;
    const currentEp = useMemo(
        () => seasonData?.episodes?.find((e) => e.episode_number === episode),
        [seasonData, episode]
    );

    const nextEpisode = () => {
        if (hasNext) setSp({ season: String(season), episode: String(episode + 1) });
    };

    if (isLoading || !details) return <div className="pt-16"><Spinner label="Preparing playback…" /></div>;

    const meta = {
        title: titleOf(details),
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
    };

    return (
        <div data-testid="watch-page" className="pt-20 pb-16 px-3 md:px-8 max-w-7xl mx-auto">
            <SynapsePlayer
                key={`${mediaType}-${id}-${season}-${episode}`}
                mediaType={mediaType}
                id={id}
                meta={meta}
                season={season}
                episode={episode}
                hasNext={hasNext}
                onNextEpisode={nextEpisode}
                onBack={() => navigate(`/title/${mediaType}/${id}`)}
            />

            <div className="mt-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h1 className="font-display text-3xl md:text-4xl leading-none mb-1">{meta.title}</h1>
                    {mediaType === "tv" && currentEp && (
                        <p className="text-amber-glow text-sm mb-2">S{season} · E{episode} — {currentEp.name}</p>
                    )}
                    <p className="text-sm text-zinc-400 max-w-2xl">
                        {mediaType === "tv" ? currentEp?.overview || details.overview : details.overview}
                    </p>
                </div>
            </div>

            {mediaType === "tv" && seasonData?.episodes?.length > 0 && (
                <div className="mt-8" data-testid="watch-episode-strip">
                    <h2 className="text-lg font-bold mb-3">Season {season}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {seasonData.episodes.map((ep) => (
                            <button
                                key={ep.id}
                                data-testid={`watch-ep-${ep.episode_number}`}
                                onClick={() => setSp({ season: String(season), episode: String(ep.episode_number) })}
                                className={`text-left p-3 rounded-lg border text-sm transition-all ${
                                    ep.episode_number === episode
                                        ? "bg-crimson/20 border-crimson"
                                        : "bg-surface/60 border-white/5 hover:border-white/20"
                                }`}
                            >
                                <span className="font-mono text-xs text-zinc-500">EP {ep.episode_number}</span>
                                <p className="truncate font-medium">{ep.name}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
