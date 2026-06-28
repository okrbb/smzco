import { initFirebaseLive } from "./firebase-client.js";
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

const SUTAZ_ID = "sutaz_smzco_2026";

const state = {
    teams: [],
    limitMin: 30,
    previousScores: {},
    renderedOrder: [],
    hasReceivedTeams: false,
    hasReceivedTeamsPayload: false,
    filters: {
        query: "",
        status: "all"
    }
};

const RENDER_THROTTLE_MS = 200;
let renderThrottleTimer = null;
let pendingRender = false;

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

function initFilters() {
    const searchInput = document.getElementById("teamSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (event) => {
            state.filters.query = event.target.value || "";
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
    initFirebaseLive({
        firebaseConfig,
        contestId: SUTAZ_ID,
        onConnectionChange: (isConnected) => {
            const hasDataSignal = state.hasReceivedTeamsPayload;
            setConnectionStatus(isConnected || hasDataSignal ? "connected" : "offline");
        },
        onTeams: (teams) => {
            state.teams = teams;
            state.hasReceivedTeams = true;
            state.hasReceivedTeamsPayload = true;
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
    initFirebase();
});
