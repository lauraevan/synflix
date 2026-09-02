// localStorage helpers for watchlist + continue watching (no login)
const WATCHLIST = "synflix_watchlist";
const CONTINUE = "synflix_continue_watching";

const read = (k) => {
    try {
        return JSON.parse(localStorage.getItem(k) || "[]");
    } catch {
        return [];
    }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const keyOf = (item) => `${item.media_type}:${item.id}`;

// ---- Watchlist ----
export const getWatchlist = () => read(WATCHLIST);
export const inWatchlist = (item) =>
    read(WATCHLIST).some((x) => keyOf(x) === keyOf(item));
export const toggleWatchlist = (item) => {
    const list = read(WATCHLIST);
    const idx = list.findIndex((x) => keyOf(x) === keyOf(item));
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift({ ...item, added_at: Date.now() });
    write(WATCHLIST, list);
    return idx < 0; // true if now added
};

// ---- Continue watching ----
export const getContinue = () =>
    read(CONTINUE).sort((a, b) => b.updated_at - a.updated_at);

export const getProgress = (media_type, id, season, episode) => {
    const list = read(CONTINUE);
    return list.find(
        (x) =>
            x.media_type === media_type &&
            String(x.id) === String(id) &&
            (media_type === "movie" ||
                (String(x.season) === String(season) && String(x.episode) === String(episode)))
    );
};

export const saveProgress = (entry) => {
    // entry: {media_type,id,title,poster_path,backdrop_path,season,episode,position,duration}
    const list = read(CONTINUE);
    const match = (x) =>
        x.media_type === entry.media_type && String(x.id) === String(entry.id);
    const filtered = list.filter((x) => !match(x));
    const pct = entry.duration ? entry.position / entry.duration : 0;
    if (pct > 0.95) {
        // finished — drop from continue watching
        write(CONTINUE, filtered);
        return;
    }
    filtered.unshift({ ...entry, updated_at: Date.now() });
    write(CONTINUE, filtered.slice(0, 30));
};

export const removeContinue = (media_type, id) => {
    const list = read(CONTINUE).filter(
        (x) => !(x.media_type === media_type && String(x.id) === String(id))
    );
    write(CONTINUE, list);
};
