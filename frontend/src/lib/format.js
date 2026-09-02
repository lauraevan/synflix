export const mediaTypeOf = (item, fallback = "movie") =>
    item?.media_type || (item?.title ? "movie" : item?.name ? "tv" : fallback);

export const titleOf = (item) => item?.title || item?.name || "Untitled";

export const yearOf = (item) => {
    const d = item?.release_date || item?.first_air_date;
    return d ? d.slice(0, 4) : "";
};

export const runtimeStr = (mins) => {
    if (!mins) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
};

export const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const total = Math.floor(s);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

export const ratingStr = (v) => (v ? v.toFixed(1) : "—");
