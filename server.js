import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAllSwissCompetitors() {
    let page = 1;
    let all = [];
    while (true) {
        const res = await axios.get("https://www.worldcubeassociation.org/api/v0/persons", {
            params: { country_iso2: "CH", page }
        });

        if (!res.data || res.data.length === 0) break;

        all.push(...res.data);
        page++;
        await sleep(120);
    }
    return all;
}

async function fetchPBs(wcaId) {
    const res = await axios.get(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId}`);
    return res.data.personal_records || {};
}

app.get("/swiss-records", async (req, res) => {
    try {
        const competitors = await fetchAllSwissCompetitors();
        const result = [];

        for (const person of competitors) {
            const records = await fetchPBs(person.wca_id);

            for (const [eventId, record] of Object.entries(records)) {
                const date = record.single?.date || record.average?.date;
                if (!date) continue;

                result.push({
                    name: person.name,
                    wca_id: person.wca_id,
                    event: eventId,
                    single: record.single?.best || null,
                    average: record.average?.best || null,
                    date
                });
            }

            await sleep(75);
        }

        const grouped = {};
        for (const entry of result) {
            if (!grouped[entry.date]) grouped[entry.date] = [];
            grouped[entry.date].push(entry);
        }

        res.json(grouped);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
