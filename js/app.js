import { initFirebaseLive } from "./firebase-client.js";
import { getTeamDistrict } from "./scoring.js";
import {
    closeModal,
    initTheme,
    initYearBadge,
    renderLeaderboard,
    setConnectionStatus,
    showTeamDetail,
    toggleAccordion,
    toggleTheme,
    updateFilterButtonsUI
} from "./ui-renderer.js";

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "https://smz-co-sutaz-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "smz-co-sutaz",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

const DEFAULT_SUTAZ_ID = "banska_bystrica_2026";
const CONTEST_CATALOG_URL = "https://smz-co-sutaz-default-rtdb.europe-west1.firebasedatabase.app/zoznam_sutazi.json";

function getContestId() {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("contest")
        || searchParams.get("sutaz")
        || localStorage.getItem("smzco-contest-id")
        || DEFAULT_SUTAZ_ID;
}

function encodeContestIdInUrl(contestId) {
    const url = new URL(window.location.href);
    url.searchParams.set("contest", contestId);
    url.searchParams.delete("sutaz");
    window.history.replaceState({}, "", url);
}

function normalizeContestCatalog(rawCatalog) {
    const counts = {
        okresne: 0,
        krajske: 0,
        celoslovenske: 0
    };

    function normalizeContestName(contest) {
        const name = String(contest.nazov || "");
        if (contest.id === "bratislava_i_2026") {
            return name.replace("Bratislava I", "Bratislava");
        }
        if (contest.id === "kosice_i_2026") {
            return name.replace("Košice I", "Košice");
        }
        return name;
    }

    const contests = Object.values(rawCatalog || {})
        .filter((contest) => contest && contest.id && contest.nazov && contest.kategoria)
        .map((contest) => ({
            id: String(contest.id),
            nazov: normalizeContestName(contest),
            kategoria: String(contest.kategoria),
            rok: Number.parseInt(contest.rok, 10) || new Date().getFullYear()
        }))
        .sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));

    contests.forEach((contest) => {
        if (counts[contest.kategoria] !== undefined) {
            counts[contest.kategoria] += 1;
        }
    });

    return { contests, counts };
}

function getContestById(contestId) {
    return state.contestCatalog.find((contest) => contest.id === contestId);
}

function getContestYears() {
    return [...new Set(state.contestCatalog.map((contest) => contest.rok))].sort((a, b) => b - a);
}

function getContestsForYear(year) {
    return state.contestCatalog.filter((contest) => contest.rok === year);
}

function getStoredYear() {
    const value = Number.parseInt(localStorage.getItem("smzco-selected-year") || "", 10);
    return Number.isNaN(value) ? undefined : value;
}

const state = {
    contestId: getContestId(),
    selectedYear: getStoredYear() || new Date().getFullYear(),
    teams: [],
    limitMin: 30,
    previousScores: {},
    renderedOrder: [],
    hasReceivedTeams: false,
    hasReceivedTeamsPayload: false,
    contestCatalog: [],
    contestCounts: {
        okresne: 0,
        krajske: 0,
        celoslovenske: 0
    },
    filters: {
        query: "",
        status: "all",
        district: "all"
    }
};

const RENDER_THROTTLE_MS = 200;
let renderThrottleTimer = null;
let pendingRender = false;
let stopFirebaseLive = null;

function scheduleLeaderboardRender() {
    if (renderThrottleTimer) {
        pendingRender = true;
        return;
    }

    renderLeaderboard(state);

    renderThrottleTimer = window.setTimeout(() => {
        renderThrottleTimer = null;
        if (pendingRender) {
            pendingRender = false;
            scheduleLeaderboardRender();
        }
    }, RENDER_THROTTLE_MS);
}

function updateContestSummaryUI() {
    return;
}

function getContestDistricts() {
    const districts = new Map();

    state.teams.forEach((team) => {
        const district = getTeamDistrict(team);
        if (district) {
            districts.set(district.toLocaleLowerCase("sk"), district);
        }
    });

    return [...districts.values()].sort((a, b) => a.localeCompare(b, "sk"));
}

function renderDistrictSelect() {
    const select = document.getElementById("districtSelect");
    if (!select) return;

    const districts = getContestDistricts();
    const hasDistricts = districts.length > 0;

    if (state.filters.district !== "all" && !districts.includes(state.filters.district)) {
        state.filters.district = "all";
    }

    select.innerHTML = [
        '<option value="all">Všetky súťaže</option>',
        ...districts.map((district) => `<option value="${district}"${district === state.filters.district ? " selected" : ""}>${district}</option>`)
    ].join("");
    select.disabled = !hasDistricts;
    select.value = state.filters.district;

    if (!select.dataset.bound) {
        select.addEventListener("change", (event) => {
            state.filters.district = event.target.value || "all";
            scheduleLeaderboardRender();
        });
        select.dataset.bound = "true";
    }
}

function renderYearSelect() {
    const select = document.getElementById("yearSelect");
    if (!select) return;

    const years = getContestYears();
    if (years.length === 0) {
        select.innerHTML = '<option value="">Rok</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = years
        .map((year) => `<option value="${year}"${year === state.selectedYear ? " selected" : ""}>${year}</option>`)
        .join("");

    select.value = String(state.selectedYear);

    if (!select.dataset.bound) {
        select.addEventListener("change", (event) => {
            const nextYear = Number.parseInt(event.target.value, 10);
            if (!Number.isNaN(nextYear)) {
                switchYear(nextYear);
            }
        });
        select.dataset.bound = "true";
    }
}

function renderContestSelect() {
    const select = document.getElementById("contestSelect");
    if (!select) return;

    const contestsForYear = getContestsForYear(state.selectedYear);

    if (contestsForYear.length === 0) {
        select.innerHTML = '<option value="">Žiadne súťaže pre rok</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;

    const grouped = contestsForYear.reduce((accumulator, contest) => {
        const category = contest.kategoria;
        if (!accumulator[category]) {
            accumulator[category] = [];
        }
        accumulator[category].push(contest);
        return accumulator;
    }, {});

    const categoryLabels = {
        okresne: "Okresné súťaže",
        krajske: "Krajské súťaže",
        celoslovenske: "Celoslovenská súťaž"
    };

    const categoryOrder = ["okresne", "krajske", "celoslovenske"];

    select.innerHTML = categoryOrder.map((category) => {
        const contests = grouped[category] || [];
        if (contests.length === 0) return "";

        const options = contests
            .map((contest) => {
                const selected = contest.id === state.contestId ? " selected" : "";
                return `<option value="${contest.id}"${selected}>${contest.nazov} (${contest.rok})</option>`;
            })
            .join("");

        return `<optgroup label="${categoryLabels[category]}">${options}</optgroup>`;
    }).join("");

    select.value = state.contestId;

    if (!select.dataset.bound) {
        select.addEventListener("change", (event) => {
            const nextContestId = event.target.value;
            if (nextContestId && nextContestId !== state.contestId) {
                switchContest(nextContestId);
            }
        });
        select.dataset.bound = "true";
    }
}

function switchYear(nextYear) {
    const availableContests = getContestsForYear(nextYear);
    if (availableContests.length === 0) {
        state.selectedYear = nextYear;
        localStorage.setItem("smzco-selected-year", String(nextYear));
        renderYearSelect();
        renderContestSelect();
        return;
    }

    state.selectedYear = nextYear;
    localStorage.setItem("smzco-selected-year", String(nextYear));
    const nextContest = availableContests[0];

    renderYearSelect();

    if (nextContest.id !== state.contestId) {
        switchContest(nextContest.id);
        return;
    }

    renderContestSelect();
}

function setContestState(nextContestId) {
    const contest = getContestById(nextContestId);
    state.contestId = nextContestId;
    localStorage.setItem("smzco-contest-id", nextContestId);
    if (contest) {
        state.selectedYear = contest.rok;
        localStorage.setItem("smzco-selected-year", String(contest.rok));
    }
    encodeContestIdInUrl(nextContestId);
    renderYearSelect();
    renderContestSelect();
    updateContestSummaryUI();
}

function switchContest(nextContestId) {
    if (typeof stopFirebaseLive === "function") {
        stopFirebaseLive();
        stopFirebaseLive = null;
    }

    state.teams = [];
    state.previousScores = {};
    state.renderedOrder = [];
    state.hasReceivedTeams = false;
    state.hasReceivedTeamsPayload = false;
    state.filters.district = "all";
    setContestState(nextContestId);
    setConnectionStatus("connecting");
    renderDistrictSelect();
    scheduleLeaderboardRender();
    initFirebase();
}

function initFilters() {
    const searchInput = document.getElementById("teamSearchInput");
    const clearSearchButton = document.getElementById("clearTeamSearchBtn");

    const syncClearSearchButton = (value) => {
        if (!clearSearchButton) return;
        const hasQuery = String(value || "").trim().length > 0;
        clearSearchButton.classList.toggle("hidden", !hasQuery);
    };

    if (searchInput) {
        searchInput.addEventListener("input", (event) => {
            state.filters.query = event.target.value || "";
            syncClearSearchButton(state.filters.query);
            scheduleLeaderboardRender();
        });

        syncClearSearchButton(searchInput.value);
    }

    if (searchInput && clearSearchButton) {
        clearSearchButton.addEventListener("click", () => {
            searchInput.value = "";
            state.filters.query = "";
            syncClearSearchButton("");
            searchInput.focus();
            scheduleLeaderboardRender();
        });
    }

    document.querySelectorAll("button[data-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.filters.status = button.dataset.filter || "all";
            updateFilterButtonsUI(state.filters.status);
            scheduleLeaderboardRender();
        });
    });

    updateFilterButtonsUI(state.filters.status);
}

function initFirebase() {
    stopFirebaseLive = initFirebaseLive({
        firebaseConfig,
        contestId: state.contestId,
        onConnectionChange: (isConnected) => {
            const hasDataSignal = state.hasReceivedTeamsPayload;
            setConnectionStatus(isConnected || hasDataSignal ? "connected" : "offline");
        },
        onTeams: (teams) => {
            state.teams = teams;
            state.hasReceivedTeams = true;
            state.hasReceivedTeamsPayload = true;
            renderDistrictSelect();
            setConnectionStatus("connected");
            scheduleLeaderboardRender();
        },
        onLimit: (limit) => {
            if (!Number.isNaN(limit)) {
                state.limitMin = limit;
                scheduleLeaderboardRender();
            }
        },
        onConfigError: (message) => {
            console.log(message);
            state.hasReceivedTeams = true;
            setConnectionStatus("offline");
            const dbAlert = document.getElementById("dbAlert");
            if (dbAlert) dbAlert.classList.remove("hidden");
            scheduleLeaderboardRender();
        },
        onError: (error) => {
            console.error("Firebase chyba:", error);
            state.hasReceivedTeams = true;
            const dbAlert = document.getElementById("dbAlert");
            if (dbAlert) dbAlert.classList.remove("hidden");
            scheduleLeaderboardRender();
        }
    });
}

async function loadContestCatalog() {
    try {
        const response = await fetch(CONTEST_CATALOG_URL, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const catalogSource = data?.zoznam_sutazi ?? data;
        const catalogData = normalizeContestCatalog(catalogSource);
        state.contestCatalog = catalogData.contests;
        state.contestCounts = catalogData.counts;

        const contestFromState = getContestById(state.contestId);
        const availableYears = getContestYears();
        const storedYear = getStoredYear();
        const initialYear = contestFromState?.rok
            || (storedYear && availableYears.includes(storedYear) ? storedYear : availableYears[0])
            || new Date().getFullYear();

        state.selectedYear = initialYear;

        if (!contestFromState) {
            const firstContestForYear = getContestsForYear(initialYear)[0];
            if (firstContestForYear) {
                state.contestId = firstContestForYear.id;
                localStorage.setItem("smzco-contest-id", state.contestId);
                encodeContestIdInUrl(state.contestId);
            }
        }

        renderYearSelect();
        updateContestSummaryUI();
        renderContestSelect();
        return true;
    } catch (error) {
        console.error("Nepodarilo sa načítať katalóg súťaží:", error);
        return false;
    }
}

window.showTeamDetail = (startNum) => showTeamDetail(startNum, state);
window.closeModal = closeModal;
window.toggleAccordion = toggleAccordion;
window.toggleTheme = toggleTheme;

window.setInterval(() => {
    const activeOnTrack = state.teams.some((team) => team.status === "Na trati" || team.status === "ON_TRACK");
    if (activeOnTrack) {
        scheduleLeaderboardRender();
    }
}, 1000);

window.addEventListener("load", () => {
    initTheme();
    initYearBadge();
    initFilters();
    window.lucide.createIcons();
    setConnectionStatus("connecting");
    scheduleLeaderboardRender();
    renderDistrictSelect();
    loadContestCatalog().finally(() => {
        initFirebase();
    });
});
