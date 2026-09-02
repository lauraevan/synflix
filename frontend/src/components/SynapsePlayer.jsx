import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
    Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward,
    RotateCcw, RotateCw, Settings, Subtitles, Gauge, PictureInPicture2,
    Keyboard, ChevronLeft, Zap, ServerCog, X, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { getStreams, hlsProxyUrl } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { saveProgress, getProgress } from "@/lib/storage";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SHORTCUTS = [
    ["Space / K", "Play / Pause"], ["F", "Fullscreen"], ["M", "Mute"],
    ["← / →", "Seek ∓5s"], ["J / L", "Seek ∓10s"], ["↑ / ↓", "Volume"],
    ["N", "Next Episode"], ["C", "Subtitles"], ["?", "This help"],
];
const STEPS = [
    "Fetching VidUp embed…",
    "Extracting session token ✓",
    "Scraping mirror servers…",
    "Relaying HLS through Synapse proxy…",
];

const Popover = ({ open, children }) =>
    open ? (
        <div className="absolute bottom-12 right-0 min-w-[180px] max-h-64 overflow-y-auto scrollbar-none rounded-xl bg-[#0a0a10]/95 backdrop-blur-xl border border-white/10 p-1.5 shadow-2xl z-30">
            {children}
        </div>
    ) : null;

const MenuItem = ({ active, onClick, children, testId }) => (
    <button
        data-testid={testId}
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
            active ? "bg-crimson text-white" : "hover:bg-white/10 text-zinc-200"
        }`}
    >
        {children}
    </button>
);

export const SynapsePlayer = ({ mediaType, id, meta = {}, season, episode, onNextEpisode, hasNext, onBack }) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const hideTimer = useRef(null);

    const [servers, setServers] = useState([]);
    const [serverId, setServerId] = useState(null);
    const [mode, setMode] = useState("loading"); // loading | ready | error
    const [stepIdx, setStepIdx] = useState(0);
    const [error, setError] = useState(null);

    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [levels, setLevels] = useState([]);
    const [level, setLevel] = useState(-1);
    const [subs, setSubs] = useState([]);
    const [sub, setSub] = useState(-1);
    const [rate, setRate] = useState(1);
    const [fs, setFs] = useState(false);
    const [buffering, setBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [menu, setMenu] = useState(null);
    const [help, setHelp] = useState(false);
    const [ripple, setRipple] = useState(null);

    const activeServer = servers.find((s) => s.id === serverId);

    const playServer = useCallback((server) => {
        const video = videoRef.current;
        if (!video || !server) return;
        setBuffering(true);
        setLevels([]); setLevel(-1); setSubs([]); setSub(-1);
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const url = hlsProxyUrl(server.play_url);
        if (server.type === "hls" && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => { setLevels(hls.levels || []); video.play().catch(() => {}); });
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => setSubs(d.subtitleTracks || []));
            hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setLevel(hls.autoLevelEnabled ? -1 : d.level));
            hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryNext(server.id); });
        } else {
            video.src = url;
            video.play().catch(() => {});
        }
    }, [servers]); // eslint-disable-line

    const tryNext = useCallback((failedId) => {
        const idx = servers.findIndex((s) => s.id === failedId);
        const next = servers[idx + 1];
        if (next) { setServerId(next.id); playServer(next); }
        else setError("All scraped servers failed to play. Try another title.");
    }, [servers, playServer]);

    // scrape servers
    useEffect(() => {
        let alive = true;
        setMode("loading"); setStepIdx(0); setError(null);
        const tick = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 900);
        getStreams(mediaType, id, season, episode)
            .then((d) => {
                if (!alive) return;
                clearInterval(tick);
                const list = d.servers || [];
                setServers(list);
                if (list.length) {
                    setServerId(list[0].id);
                    setMode("ready");
                } else {
                    setMode("error");
                    setError("No streams could be scraped for this title yet.");
                }
            })
            .catch(() => { if (alive) { clearInterval(tick); setMode("error"); setError("Scraper request failed."); } });
        return () => { alive = false; clearInterval(tick); };
    }, [mediaType, id, season, episode]);

    // when ready + server chosen, start playback
    useEffect(() => {
        if (mode === "ready" && activeServer && videoRef.current) playServer(activeServer);
        // eslint-disable-next-line
    }, [mode, serverId, servers.length]);

    const selectServer = (s) => { setMenu(null); setServerId(s.id); playServer(s); };

    // video wiring
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onTime = () => { setCurrent(v.currentTime); if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); };
        const onMeta = () => {
            setDuration(v.duration);
            const p = getProgress(mediaType, id, season, episode);
            if (p && p.position && p.position < v.duration - 10) v.currentTime = p.position;
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onVol = () => { setVolume(v.volume); setMuted(v.muted); };
        const onWait = () => setBuffering(true);
        const onPlaying = () => setBuffering(false);
        v.addEventListener("timeupdate", onTime);
        v.addEventListener("loadedmetadata", onMeta);
        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        v.addEventListener("volumechange", onVol);
        v.addEventListener("waiting", onWait);
        v.addEventListener("playing", onPlaying);
        v.addEventListener("canplay", onPlaying);
        return () => {
            v.removeEventListener("timeupdate", onTime); v.removeEventListener("loadedmetadata", onMeta);
            v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause);
            v.removeEventListener("volumechange", onVol); v.removeEventListener("waiting", onWait);
            v.removeEventListener("playing", onPlaying); v.removeEventListener("canplay", onPlaying);
        };
    }, [mode, mediaType, id, season, episode]);

    useEffect(() => {
        if (!duration) return;
        const t = setInterval(() => {
            const v = videoRef.current; if (!v) return;
            saveProgress({ media_type: mediaType, id, title: meta.title, poster_path: meta.poster_path,
                backdrop_path: meta.backdrop_path, season, episode, position: v.currentTime, duration: v.duration });
        }, 5000);
        return () => clearInterval(t);
    }, [duration, mediaType, id, season, episode, meta]);

    useEffect(() => {
        const onFs = () => setFs(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFs);
        return () => document.removeEventListener("fullscreenchange", onFs);
    }, []);
    useEffect(() => () => { if (hlsRef.current) hlsRef.current.destroy(); }, []);

    const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); };
    const seekBy = (d) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); showRipple(d > 0 ? "fwd" : "back"); };
    const seekTo = (val) => { const v = videoRef.current; if (v && duration) v.currentTime = (val / 100) * duration; };
    const setVol = (val) => { const v = videoRef.current; if (v) { v.volume = val; v.muted = val === 0; } };
    const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted; };
    const changeLevel = (i) => { if (hlsRef.current) { hlsRef.current.currentLevel = i; } setLevel(i); setMenu(null); };
    const changeSub = (i) => { if (hlsRef.current) hlsRef.current.subtitleTrack = i; setSub(i); setMenu(null); };
    const changeRate = (r) => { const v = videoRef.current; if (v) v.playbackRate = r; setRate(r); setMenu(null); };
    const togglePip = async () => { const v = videoRef.current; if (!v) return; try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); } catch { /* noop */ } };
    const toggleFs = () => { const el = containerRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => {}); };
    const showRipple = (dir) => { setRipple(dir); setTimeout(() => setRipple(null), 500); };

    const wake = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => { if (playing) { setShowControls(false); setMenu(null); } }, 3200);
    }, [playing]);

    useEffect(() => {
        if (mode !== "ready") return;
        const onKey = (e) => {
            if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
            const k = e.key.toLowerCase();
            const map = {
                " ": togglePlay, k: togglePlay, f: toggleFs, m: toggleMute,
                arrowleft: () => seekBy(-5), arrowright: () => seekBy(5),
                j: () => seekBy(-10), l: () => seekBy(10),
                arrowup: () => setVol(Math.min(1, (videoRef.current?.volume || 0) + 0.1)),
                arrowdown: () => setVol(Math.max(0, (videoRef.current?.volume || 0) - 0.1)),
                c: () => changeSub(sub >= 0 ? -1 : (subs[0] ? 0 : -1)),
                n: () => hasNext && onNextEpisode?.(),
                "?": () => setHelp((v) => !v),
            };
            if (map[k]) { e.preventDefault(); map[k](); wake(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [mode, sub, subs, hasNext, wake]); // eslint-disable-line

    const pct = duration ? (current / duration) * 100 : 0;
    const bufPct = duration ? (buffered / duration) * 100 : 0;
    const srcName = activeServer?.name || "VidUp";

    return (
        <div
            ref={containerRef}
            data-testid="synapse-player-container"
            onMouseMove={wake}
            onClick={() => menu && setMenu(null)}
            className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(229,9,20,0.12)] border border-white/5 select-none"
        >
            <video
                ref={videoRef}
                data-testid="synapse-video-element"
                className="w-full h-full bg-black"
                onClick={(e) => { e.stopPropagation(); togglePlay(); wake(); }}
                onDoubleClick={toggleFs}
                playsInline
                crossOrigin="anonymous"
            />

            {/* buffering spinner */}
            {mode === "ready" && buffering && !menu && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="relative w-16 h-16">
                        <span className="absolute inset-0 rounded-full border-2 border-crimson syn-radar-ring" />
                        <div className="absolute inset-0 flex items-center justify-center"><Zap className="w-6 h-6 text-crimson" /></div>
                    </div>
                </div>
            )}

            {/* scraping overlay */}
            {mode === "loading" && (
                <div data-testid="synapse-resolving" className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian/90 backdrop-blur-sm z-20 px-6">
                    <div className="relative w-20 h-20 mb-6">
                        <span className="absolute inset-0 rounded-full border-2 border-crimson syn-radar-ring" />
                        <span className="absolute inset-0 rounded-full border-2 border-crimson syn-radar-ring" style={{ animationDelay: "0.5s" }} />
                        <div className="absolute inset-0 flex items-center justify-center"><Zap className="w-8 h-8 text-crimson" /></div>
                    </div>
                    <p className="font-display text-2xl tracking-wide mb-1">SYNAPSE ENGINE</p>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-glow mb-5">Scraping streams</p>
                    <div className="w-full max-w-md space-y-1.5 font-mono text-xs text-zinc-400">
                        {STEPS.slice(0, stepIdx + 1).map((s, i) => (
                            <div key={i} className="flex items-center gap-2 syn-fade-up">
                                {i < stepIdx ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-crimson">›</span>} {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* error */}
            {mode === "error" && (
                <div data-testid="synapse-error" className="absolute inset-0 flex flex-col items-center justify-center bg-obsidian/90 z-20 px-6 text-center">
                    <AlertTriangle className="w-10 h-10 text-amber-glow mb-3" />
                    <p className="font-semibold mb-1">Couldn't scrape a stream</p>
                    <p className="text-sm text-zinc-400 max-w-sm">{error}</p>
                    <button onClick={onBack} className="mt-5 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm">Go back</button>
                </div>
            )}

            {ripple && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${ripple === "fwd" ? "right-16" : "left-16"} z-20 pointer-events-none`}>
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center syn-fade-up">
                        {ripple === "fwd" ? <RotateCw className="w-7 h-7" /> : <RotateCcw className="w-7 h-7" />}
                    </div>
                </div>
            )}

            {/* TOP CHROME */}
            <div className={`absolute top-0 left-0 right-0 z-20 p-4 md:p-5 bg-gradient-to-b from-black/80 to-transparent flex items-start gap-3 transition-opacity duration-300 ${showControls || mode !== "ready" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <button data-testid="synapse-back-btn" onClick={onBack} className="w-10 h-10 shrink-0 rounded-full bg-black/40 border border-white/10 flex items-center justify-center hover:bg-crimson transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                    <p className="font-bold text-base md:text-lg leading-tight truncate">{meta.title}</p>
                    <p className="text-xs text-zinc-400">
                        {mediaType === "tv" ? `S${season} · E${episode}` : "Movie"} · via <span className="text-amber-glow">{srcName}</span>
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end max-w-[60%]">
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400"><ServerCog className="w-3.5 h-3.5" /> {servers.length} servers</span>
                    <div data-testid="synapse-source-selector" className="flex items-center gap-1.5 flex-wrap justify-end">
                        {servers.map((s) => (
                            <button
                                key={s.id}
                                data-testid={`synapse-source-${s.id}`}
                                onClick={(e) => { e.stopPropagation(); selectServer(s); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                                    serverId === s.id ? "bg-crimson border-crimson text-white" : "bg-black/40 border-white/10 text-zinc-300 hover:border-white/40"
                                }`}
                                title={s.primary ? "Primary source" : "Mirror"}
                            >
                                {s.name}{s.primary ? " ⚡" : ""}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* BOTTOM CONTROL BAR */}
            {mode === "ready" && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute bottom-0 left-0 right-0 z-20 px-4 md:px-6 pb-3 pt-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                    <div className="group/seek relative mb-3">
                        <div className="relative h-1.5 rounded-full bg-white/20 overflow-hidden">
                            <div className="absolute h-full bg-white/25" style={{ width: `${bufPct}%` }} />
                            <div className="absolute h-full bg-crimson" style={{ width: `${pct}%` }} />
                        </div>
                        <input
                            data-testid="synapse-seek-bar"
                            type="range" min="0" max="100" step="0.1" value={pct}
                            onChange={(e) => seekTo(parseFloat(e.target.value))}
                            className="syn-range absolute inset-0 w-full h-1.5" style={{ opacity: 0 }} aria-label="Seek"
                        />
                        <div className="absolute -top-1 w-3 h-3 rounded-full bg-crimson shadow-[0_0_10px_rgba(229,9,20,0.9)] -translate-x-1/2 pointer-events-none" style={{ left: `${pct}%` }} />
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <button data-testid="synapse-play-pause-btn" onClick={togglePlay} className="hover:text-crimson transition-colors active:scale-90">
                            {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                        </button>
                        <button onClick={() => seekBy(-10)} className="hover:text-crimson transition-colors active:scale-90" aria-label="Back 10s"><RotateCcw className="w-5 h-5" /></button>
                        <button onClick={() => seekBy(10)} className="hover:text-crimson transition-colors active:scale-90" aria-label="Forward 10s"><RotateCw className="w-5 h-5" /></button>

                        <div className="flex items-center group/vol">
                            <button data-testid="synapse-mute-btn" onClick={toggleMute} className="hover:text-crimson transition-colors active:scale-90">
                                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <input data-testid="synapse-volume-slider" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                                onChange={(e) => setVol(parseFloat(e.target.value))}
                                className="syn-range w-0 group-hover/vol:w-20 transition-all duration-300 ml-1 h-1" aria-label="Volume" />
                        </div>

                        <span data-testid="synapse-time" className="font-mono text-xs text-zinc-300 ml-1">
                            {fmtTime(current)} <span className="text-zinc-600">/</span> {fmtTime(duration)}
                        </span>

                        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
                            {hasNext && (
                                <button data-testid="synapse-next-episode-btn" onClick={onNextEpisode} className="flex items-center gap-1 text-xs hover:text-crimson transition-colors px-2 active:scale-95" title="Next episode (N)">
                                    <SkipForward className="w-5 h-5" /> <span className="hidden md:inline">Next</span>
                                </button>
                            )}
                            <div className="relative">
                                <button data-testid="synapse-subtitles-menu" onClick={() => setMenu(menu === "subs" ? null : "subs")} className={`hover:text-crimson transition-colors active:scale-90 ${sub >= 0 ? "text-crimson" : ""}`} title="Subtitles (C)"><Subtitles className="w-5 h-5" /></button>
                                <Popover open={menu === "subs"}>
                                    <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500">Subtitles</p>
                                    <MenuItem active={sub === -1} onClick={() => changeSub(-1)} testId="sub-off">Off</MenuItem>
                                    {subs.map((t, i) => (<MenuItem key={i} active={sub === i} onClick={() => changeSub(i)}>{t.name || t.lang || `Track ${i + 1}`}</MenuItem>))}
                                    {!subs.length && <p className="px-3 py-2 text-xs text-zinc-500">No tracks in this stream</p>}
                                </Popover>
                            </div>
                            <div className="relative">
                                <button data-testid="synapse-quality-menu" onClick={() => setMenu(menu === "quality" ? null : "quality")} className="hover:text-crimson transition-colors active:scale-90" title="Quality"><Settings className="w-5 h-5" /></button>
                                <Popover open={menu === "quality"}>
                                    <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500">Quality</p>
                                    <MenuItem active={level === -1} onClick={() => changeLevel(-1)} testId="quality-auto">Auto</MenuItem>
                                    {levels.map((l, i) => (<MenuItem key={i} active={level === i} onClick={() => changeLevel(i)}>{l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`}</MenuItem>))}
                                    {!levels.length && <p className="px-3 py-2 text-xs text-zinc-500">Single quality · switch server</p>}
                                </Popover>
                            </div>
                            <div className="relative">
                                <button data-testid="synapse-speed-menu" onClick={() => setMenu(menu === "speed" ? null : "speed")} className="hover:text-crimson transition-colors active:scale-90" title="Playback speed"><Gauge className="w-5 h-5" /></button>
                                <Popover open={menu === "speed"}>
                                    <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500">Speed</p>
                                    {SPEEDS.map((r) => (<MenuItem key={r} active={rate === r} onClick={() => changeRate(r)}>{r === 1 ? "Normal" : `${r}x`}</MenuItem>))}
                                </Popover>
                            </div>
                            <button onClick={togglePip} className="hidden md:block hover:text-crimson transition-colors active:scale-90" title="Picture in Picture"><PictureInPicture2 className="w-5 h-5" /></button>
                            <button data-testid="synapse-help-btn" onClick={() => setHelp(true)} className="hidden md:block hover:text-crimson transition-colors active:scale-90" title="Shortcuts (?)"><Keyboard className="w-5 h-5" /></button>
                            <button data-testid="synapse-fullscreen-btn" onClick={toggleFs} className="hover:text-crimson transition-colors active:scale-90" title="Fullscreen (F)">
                                {fs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {help && (
                <div className="absolute inset-0 z-30 bg-obsidian/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setHelp(false)}>
                    <div className="bg-[#0f0f14] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-display text-2xl">KEYBOARD SHORTCUTS</h3>
                            <button onClick={() => setHelp(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {SHORTCUTS.map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-400">{v}</span>
                                    <kbd className="font-mono text-xs bg-white/10 border border-white/10 rounded px-2 py-1">{k}</kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
