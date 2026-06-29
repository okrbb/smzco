function normalizeTeamsSnapshot(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .map((team, index) => {
                if (!team) return null;
                const startNum = typeof team.startNum === "number" && Number.isFinite(team.startNum)
                    ? team.startNum
                    : index;
                return {
                    startNum,
                    ...team
                };
            })
            .filter(Boolean);
    }

    if (typeof value === "object") {
        return Object.entries(value)
            .map(([key, team]) => {
                if (!team) return null;
                const parsedKey = Number.parseInt(key, 10);
                const startNum = typeof team.startNum === "number" && Number.isFinite(team.startNum)
                    ? team.startNum
                    : (Number.isFinite(parsedKey) ? parsedKey : 0);
                return {
                    startNum,
                    ...team
                };
            })
            .filter(Boolean);
    }

    return [];
}

function buildContestBasePath(contestId) {
    const trimmed = String(contestId || "").replace(/^\/+|\/+$/g, "");
    if (!trimmed) return "sutaze";
    return trimmed.startsWith("sutaze/") ? trimmed : `sutaze/${trimmed}`;
}

function buildContestJsonUrl(databaseURL, contestId) {
    const baseUrl = String(databaseURL || "").replace(/\/+$/, "");
    const contestPath = buildContestBasePath(contestId)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

    return `${baseUrl}/${contestPath}.json`;
}

function parseLimit(settings) {
    const value = settings?.casovy_limit ?? settings?.casovyLimitMinuty ?? settings;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export function initFirebaseLive({
    firebaseConfig,
    contestId,
    onConnectionChange,
    onTeams,
    onLimit,
    onConfigError,
    onError
}) {
    if (!firebaseConfig.databaseURL || !firebaseConfig.projectId) {
        if (onConfigError) onConfigError("Chýba Firebase databaseURL alebo projectId.");
        return;
    }

    const contestJsonUrl = buildContestJsonUrl(firebaseConfig.databaseURL, contestId);
    const pollIntervalMs = 60000;
    let isPolling = false;
    let isStopped = false;

    const loadContest = async () => {
        if (isStopped || isPolling) return;
        isPolling = true;

        try {
            const response = await fetch(contestJsonUrl, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const teams = normalizeTeamsSnapshot(data?.druzstva);
            const limit = parseLimit(data?.nastavenia);

            if (onTeams) onTeams(teams);
            if (typeof limit === "number" && onLimit) onLimit(limit);
            if (onConnectionChange) onConnectionChange(true);
        } catch (error) {
            if (onConnectionChange) onConnectionChange(false);
            if (onError) onError(error);
        } finally {
            isPolling = false;
        }
    };

    loadContest();
    const timerId = window.setInterval(loadContest, pollIntervalMs);

    return () => {
        isStopped = true;
        window.clearInterval(timerId);
    };
}
