import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_API_URL = process.env.WCA_API_URL || "https://wca-rest-api.robiningelbrecht.be";
const BASE_API_KEY = process.env.WCA_API_KEY || "";
const BASE_BEARER_TOKEN = process.env.WCA_ACCESS_TOKEN || "";
const DEFAULT_COUNTRY = "CH";
const PER_PAGE = 100;
const DATA_BASE_URL =
    process.env.WCA_GITHUB_BASE_URL ||
    "https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api";
const DEFAULT_COUNTRY = "CH";
const PER_PAGE = 100;
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const RESULT_CACHE_TTL_MS = 2 * 60 * 1000;

const pageCache = new Map();
const resultCache = { key: null, expiresAt: 0, data: null };

app.use(express.static("public"));

function toISODate(date) {
    return date.toISOString().split("T")[0];
}

function getLastMonthRange() {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return { start: toISODate(start), end: toISODate(end) };
}

function isPersonalRecord(result) {
    if (result.is_personal_record === true || result.personal_record === true) return true;
    if (typeof result.record_tag === "string" && result.record_tag.toUpperCase().includes("PR")) return true;
    if (Array.isArray(result.tags) && result.tags.some((tag) => `${tag}`.toUpperCase() === "PR")) return true;
    return false;
}

function normalizeRecord(result) {
    const person = result.person || result.competitor || {};
    const event = result.event || {};
    const competition = result.competition || {};

    const bestSingle = result.single_formatted || result.best_single_formatted || result.single || result.best_single;
    const bestAverage = result.average_formatted || result.best_average_formatted || result.average || result.best_average;

    return {
        name: person.name || result.person_name || result.name || "Unknown competitor",
        wcaId: person.wca_id || result.wca_id || person.id || "Unknown ID",
        eventId: event.id || result.event_id || event.event_id || "Unknown event",
        eventName: event.name || result.event || result.event_name || event.id || "Unknown event",
        single: bestSingle || null,
        average: bestAverage || null,
        date: competition.start_date || competition.date || result.date || result.result_date || null
    };
}

function buildApiClient() {
    const headers = {
        "User-Agent": "wca-swiss-prs/1.0"
    };

    if (BASE_API_KEY) headers["x-api-key"] = BASE_API_KEY;
    if (BASE_BEARER_TOKEN) headers.Authorization = `Bearer ${BASE_BEARER_TOKEN}`;

    return axios.create({
        baseURL: BASE_API_URL,
        headers,
        validateStatus: (status) => status >= 200 && status < 300
    });
}

const apiClient = buildApiClient();

async function fetchSwissPersonalRecords() {
    const { start, end } = getLastMonthRange();
    let page = 1;
    const collected = [];

    while (true) {
        const { data } = await apiClient.get(`/results`, {
            params: {
                country_iso2: DEFAULT_COUNTRY,
                page,
                per_page: PER_PAGE,
                date_from: start,
                date_to: end,
                is_personal_record: true,
                sort: "-date"
            }
        });

        const items = data?.results || data?.data || data || [];
        const filtered = items.filter((item) => isPersonalRecord(item));
        collected.push(...filtered.map(normalizeRecord));

        if (!Array.isArray(items) || items.length < PER_PAGE) break;
        page++;
    }

    return collected.filter((item) => item.date !== null);
}

app.get("/api/swiss-prs", async (req, res) => {
    try {
        const records = await fetchSwissPersonalRecords();

        const grouped = records.reduce((acc, record) => {
            if (!acc[record.date]) acc[record.date] = [];
            acc[record.date].push(record);
            return acc;
        }, {});

        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
        res.json({
            dateRange: getLastMonthRange(),
            dates: sortedDates.map((date) => ({ date, records: grouped[date] }))
        });
    } catch (error) {
        const status = error.response?.status;
        const detail = error.response?.data || error.message;
        console.error("Failed to fetch Swiss PRs", status, detail);

        let friendlyDetails = status ? `Upstream error ${status}` : error.message;

        if (status === 401 || status === 403) {
            friendlyDetails +=
                ". Check that your upstream credentials are configured via WCA_API_KEY (for wca-rest-api) or " +
                "WCA_ACCESS_TOKEN (for the official WCA API).";

function getLastMonthRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return { start: toISODate(start), end: toISODate(end) };
}

function isPersonalRecord(result) {
    if (result.is_personal_record === true || result.personal_record === true) return true;
    if (typeof result.record_tag === "string" && result.record_tag.toUpperCase().includes("PR")) return true;
    if (Array.isArray(result.tags) && result.tags.some((tag) => `${tag}`.toUpperCase() === "PR")) return true;
    return false;
}

function normalizeRecord(result, normalizedDate = null) {
    const person = result.person || result.competitor || {};
    const event = result.event || {};
    const competition = result.competition || {};

    const bestSingle = result.single_formatted || result.best_single_formatted || result.single || result.best_single;
    const bestAverage = result.average_formatted || result.best_average_formatted || result.average || result.best_average;

    return {
        name: person.name || result.person_name || result.name || "Unknown competitor",
        wcaId: person.wca_id || result.wca_id || person.id || "Unknown ID",
        eventId: event.id || result.event_id || event.event_id || "Unknown event",
        eventName: event.name || result.event || result.event_name || event.id || "Unknown event",
        single: bestSingle || null,
        average: bestAverage || null,
        date:
            normalizedDate || competition.start_date || competition.date || result.date || result.result_date || null
    };
}

class GitHubUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = "GitHubUnavailableError";
    }
}

function getPageCacheKey(page, start, end) {
    return `${start}:${end}:${page}`;
}

function getCachedPage(cacheKey) {
    const cached = pageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    pageCache.delete(cacheKey);
    return null;
}

function setCachedPage(cacheKey, data) {
    pageCache.set(cacheKey, { data, expiresAt: Date.now() + PAGE_CACHE_TTL_MS });
}

function getCachedResult(key) {
    if (resultCache.key === key && resultCache.expiresAt > Date.now()) {
        return resultCache.data;
    }
    resultCache.key = null;
    resultCache.data = null;
    resultCache.expiresAt = 0;
    return null;
}

function setCachedResult(key, data) {
    resultCache.key = key;
    resultCache.data = data;
    resultCache.expiresAt = Date.now() + RESULT_CACHE_TTL_MS;
}

async function fetchSwissPersonalRecords() {
    const { start, end } = getLastMonthRange();
    const cacheKey = `${start}:${end}`;
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) return cachedResult;

    let page = 1;

    while (true) {
        const pageCacheKey = getPageCacheKey(page, start, end);
        let data = getCachedPage(pageCacheKey);

        if (!data) {
            try {
                const response = await axios.get(`${BASE_API_URL}/results`, {
                    params: {
                        country_iso2: DEFAULT_COUNTRY,
                        page,
                        per_page: PER_PAGE,
                        date_from: start,
                        date_to: end,
                        is_personal_record: true,
                        sort: "-date"
                    }
                });
                data = response.data;
                setCachedPage(pageCacheKey, data);
            } catch (error) {
                const status = error.response?.status;
                const isNetworkIssue = !status && error.code;
                if (status === 404) {
                    break;
                }
                if (status === 429 || status === 403 || isNetworkIssue) {
                    throw new GitHubUnavailableError(
                        "GitHub API is unreachable or rate limited. Please try again shortly."
                    );
                }
                throw error;
            }
        }

        const items = data?.results || data?.data || data || [];
        const filtered = items.filter((item) => isPersonalRecord(item));
        collected.push(...filtered.map(normalizeRecord));

    const today = toISODate(new Date());
    const records = [];

    for (const competition of competitions) {
        const competitionId = competition.id || competition.competition_id || competition.competitionId;
        if (!competitionId) continue;

        try {
            const { data } = await axios.get(`${DATA_BASE_URL}/results/${competitionId}.json`);
            const items = data?.results || data || [];

            items.forEach((result) => {
                if (result.country_iso2 !== DEFAULT_COUNTRY) return;
                if (!isPersonalRecord(result)) return;
                records.push(normalizeRecord({ ...result, competition }, today));
            });
        } catch (error) {
            if (error.response?.status === 404) continue;
            throw error;
        }
    }

    const normalized = collected.filter((item) => item.date !== null);
    setCachedResult(cacheKey, normalized);
    return normalized;
}

        res.status(502).json({
            error: "Unable to load Swiss personal records right now.",
            details: friendlyDetails
app.get("/api/swiss-prs", async (req, res) => {
    try {
        const records = await fetchSwissPersonalRecords();

        const grouped = records.reduce((acc, record) => {
            if (!acc[record.date]) acc[record.date] = [];
            acc[record.date].push(record);
            return acc;
        }, {});

        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
        res.json({
            dateRange: getLastMonthRange(),
            dates: sortedDates.map((date) => ({ date, records: grouped[date] }))
        });
    } catch (error) {
        console.error("Failed to fetch Swiss PRs", error.message);
        const statusCode = error instanceof GitHubUnavailableError ? 502 : 500;
        const message =
            error instanceof GitHubUnavailableError
                ? "GitHub API is temporarily unavailable or rate limited. Please try again later."
                : "Unable to load Swiss personal records right now.";

        res.status(statusCode).json({
            error: message,
            details: error.message
        });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
