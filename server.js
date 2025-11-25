import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_BASE_URL =
    process.env.WCA_GITHUB_BASE_URL ||
    "https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api";
const DEFAULT_COUNTRY = "CH";

app.use(express.static("public"));

function toISODate(date) {
    return date.toISOString().split("T")[0];
}

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

async function fetchSwissPersonalRecords() {
    const { start, end } = getLastMonthRange();
    const competitions = [];
    let page = 1;

    while (true) {
        try {
            const { data } = await axios.get(`${DATA_BASE_URL}/competitions-page-${page}.json`);
            if (!Array.isArray(data) || data.length === 0) break;

            const pageCompetitions = data.filter((competition) => {
                const startDate = competition.start_date || competition.startDate;
                if (!startDate) return false;
                return startDate >= start && startDate <= end;
            });

            competitions.push(...pageCompetitions);
            page++;
        } catch (error) {
            if (error.response?.status === 404) break;
            throw error;
        }
    }

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

    return records.filter((item) => item.date !== null);
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
        console.error("Failed to fetch Swiss PRs", error.message);
        res.status(502).json({
            error: "Unable to load Swiss personal records right now.",
            details: error.message
        });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
