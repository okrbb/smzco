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

function buildContestTeamsJsonUrl(databaseURL, contestId) {
    const baseUrl = String(databaseURL || "").replace(/\/+$/, "");
    const contestPath = buildContestBasePath(contestId)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

    return `${baseUrl}/${contestPath}/druzstva.json`;
}

function parseLimit(settings) {
    const value = settings?.casovy_limit ?? settings?.casovyLimitMinuty ?? settings;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function upsertTeamsMap(teamsMap, teams) {
    teamsMap.clear();
    teams.forEach((team) => {
        const key = Number(team?.startNum);
        if (!Number.isFinite(key)) return;
        teamsMap.set(key, team);
    });
}

function getTeamsSnapshotFromMap(teamsMap) {
    return [...teamsMap.values()].sort((a, b) => (a.startNum || 0) - (b.startNum || 0));
}

function isStatusField(fieldName) {
    return [
        "status",
        "startTimeMillis",
        "cielTimeMillis"
    ].includes(fieldName);
}

function applyTeamFieldPatch(team, fieldPathSegments, value) {
    if (fieldPathSegments.length === 0) {
        if (value && typeof value === "object") {
            return {
                nextTeam: {
                    ...team,
                    ...value
                },
                statusChanged: Object.keys(value).some(isStatusField)
            };
        }

        return {
            nextTeam: team,
            statusChanged: false
        };
    }

    const [head, ...tail] = fieldPathSegments;
    const rootCopy = {
        ...team
    };

    if (tail.length === 0) {
        rootCopy[head] = value;
        return {
            nextTeam: rootCopy,
            statusChanged: isStatusField(head)
        };
    }

    let cursor = rootCopy;
    for (let i = 0; i < tail.length - 1; i += 1) {
        const segment = i === 0 ? head : tail[i - 1];
        if (!cursor[segment] || typeof cursor[segment] !== "object") {
            cursor[segment] = {};
        }
        cursor = cursor[segment];
    }

    const lastSegment = tail[tail.length - 1];
    const branchKey = tail.length === 1 ? head : tail[tail.length - 2];
    if (!cursor[branchKey] || typeof cursor[branchKey] !== "object") {
        cursor[branchKey] = {};
    }
    cursor[branchKey][lastSegment] = value;

    return {
        nextTeam: rootCopy,
        statusChanged: isStatusField(head)
    };
}

function applyStatusEventToTeamsMap(teamsMap, path, data) {
    const normalizedPath = String(path || "/");
    const segments = normalizedPath.split("/").filter(Boolean);

    if (segments.length === 0) {
        const fullTeams = normalizeTeamsSnapshot(data);
        upsertTeamsMap(teamsMap, fullTeams);
        return true;
    }

    const teamId = Number.parseInt(segments[0], 10);
    if (!Number.isFinite(teamId)) return false;

    const team = teamsMap.get(teamId) || { startNum: teamId };
    const fieldPathSegments = segments.slice(1);

    if (data === null && fieldPathSegments.length === 0) {
        teamsMap.delete(teamId);
        return true;
    }

    if (fieldPathSegments.length === 0) {
        if (!data || typeof data !== "object") return false;
        const mergedTeam = {
            ...team,
            ...data,
            startNum: Number.isFinite(Number(data.startNum)) ? Number(data.startNum) : teamId
        };
        teamsMap.set(teamId, mergedTeam);
        return Object.keys(data).some(isStatusField);
    }

    const patched = applyTeamFieldPatch(team, fieldPathSegments, data);
    teamsMap.set(teamId, patched.nextTeam);
    return patched.statusChanged;
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
    const contestTeamsJsonUrl = buildContestTeamsJsonUrl(firebaseConfig.databaseURL, contestId);
    const visiblePollIntervalMs = 180000;
    const hiddenPollIntervalMs = 180000;
    let isPolling = false;
    let isStopped = false;
    let pollTimerId = null;
    let statusStream = null;
    let etag = null;
    const teamsMap = new Map();

    const getNextPollDelay = () => (document.visibilityState === "visible" ? visiblePollIntervalMs : hiddenPollIntervalMs);

    const scheduleNextPoll = () => {
        if (isStopped) return;
        pollTimerId = window.setTimeout(loadContest, getNextPollDelay());
    };

    const loadContest = async () => {
        if (isStopped || isPolling) {
            scheduleNextPoll();
            return;
        }
        isPolling = true;

        try {
            const headers = {
                "X-Firebase-ETag": "true"
            };

            if (etag) {
                headers["If-None-Match"] = etag;
            }

            const response = await fetch(contestJsonUrl, {
                cache: "no-store",
                headers
            });

            if (response.status === 304) {
                if (onConnectionChange) onConnectionChange(true);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            etag = response.headers.get("ETag") || etag;

            const data = await response.json();
            const teams = normalizeTeamsSnapshot(data?.druzstva);
            const limit = parseLimit(data?.nastavenia);

            upsertTeamsMap(teamsMap, teams);

            if (onTeams) onTeams(getTeamsSnapshotFromMap(teamsMap));

            if (typeof limit === "number" && onLimit) onLimit(limit);
            if (onConnectionChange) onConnectionChange(true);
        } catch (error) {
            if (onConnectionChange) onConnectionChange(false);
            if (onError) onError(error);
        } finally {
            isPolling = false;
            scheduleNextPoll();
        }
    };

    const handleStatusStreamEvent = (rawEventData) => {
        if (isStopped) return;

        try {
            const payload = JSON.parse(rawEventData);
            const statusChanged = applyStatusEventToTeamsMap(teamsMap, payload?.path, payload?.data);
            if (statusChanged && onTeams) {
                onTeams(getTeamsSnapshotFromMap(teamsMap));
            }
        } catch (error) {
            if (onError) onError(error);
        }
    };

    const initStatusStream = () => {
        if (typeof window.EventSource !== "function") {
            return;
        }

        statusStream = new window.EventSource(contestTeamsJsonUrl);

        statusStream.addEventListener("put", (event) => {
            handleStatusStreamEvent(event.data);
        });

        statusStream.addEventListener("patch", (event) => {
            handleStatusStreamEvent(event.data);
        });

        statusStream.addEventListener("open", () => {
            if (onConnectionChange) onConnectionChange(true);
        });

        statusStream.addEventListener("error", () => {
            if (onConnectionChange) onConnectionChange(false);
        });
    };

    initStatusStream();
    loadContest();

    const onVisibilityChange = () => {
        if (isStopped || isPolling) return;
        if (pollTimerId) {
            window.clearTimeout(pollTimerId);
            pollTimerId = null;
        }
        scheduleNextPoll();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
        isStopped = true;
        if (pollTimerId) {
            window.clearTimeout(pollTimerId);
        }
        if (statusStream) {
            statusStream.close();
        }
        document.removeEventListener("visibilitychange", onVisibilityChange);
    };
}
