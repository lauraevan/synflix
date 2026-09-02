import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, timeout: 30000 });

export const getHome = () => http.get("/home").then((r) => r.data);
export const searchAll = (q, page = 1) =>
    http.get("/search", { params: { q, page } }).then((r) => r.data);
export const getDetails = (mediaType, id) =>
    http.get(`/details/${mediaType}/${id}`).then((r) => r.data);
export const getSeason = (id, season) =>
    http.get(`/tv/${id}/season/${season}`).then((r) => r.data);
export const getGenres = (mediaType) =>
    http.get(`/genre/${mediaType}`).then((r) => r.data);
export const discover = (mediaType, params) =>
    http.get(`/discover/${mediaType}`, { params }).then((r) => r.data);
export const getSources = (type, id, season, episode) =>
    http.get("/sources", { params: { type, id, season, episode } }).then((r) => r.data);
export const scrapeToken = (type, id, season, episode) =>
    http.get("/scrape/token", { params: { type, id, season, episode } }).then((r) => r.data);
export const resolveStream = (type, id, season, episode, signal) =>
    http.get("/resolve", { params: { type, id, season, episode }, signal, timeout: 45000 })
        .then((r) => r.data);

// image helpers
const IMG = "https://image.tmdb.org/t/p";
export const img = (path, size = "w500") =>
    path ? `${IMG}/${size}${path}` : null;
export const backdrop = (path, size = "original") =>
    path ? `${IMG}/${size}${path}` : null;

export const hlsProxyUrl = (playUrl) =>
    playUrl?.startsWith("http") ? playUrl : `${BACKEND_URL}${playUrl}`;
