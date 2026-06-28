function getFirstNumber(team, keys) {
    for (const key of keys) {
        const value = team?.[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return undefined;
}

function getFirstString(team, keys) {
    for (const key of keys) {
        const value = team?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
}

function sumNumberFields(team, keys) {
    return keys.reduce((total, key) => {
        const value = team?.[key];
        return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
}

function countTruthyFields(value) {
    if (!value || typeof value !== "object") return 0;
    return Object.values(value).reduce((total, entry) => total + (entry ? 1 : 0), 0);
}

function formatMillisFromParts(startTimeMillis, finishTimeMillis, stoppedMillis) {
    if (![startTimeMillis, finishTimeMillis].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) {
        return undefined;
    }

    const elapsedMillis = Math.max(0, finishTimeMillis - startTimeMillis - (typeof stoppedMillis === "number" && Number.isFinite(stoppedMillis) ? stoppedMillis : 0));
    return formatDurationMillis(elapsedMillis);
}

function formatDurationMillis(milliseconds) {
    if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds) || milliseconds < 0) {
        return "--:--:--";
    }

    const seconds = Math.floor(milliseconds / 1000) % 60;
    const minutes = Math.floor(milliseconds / (1000 * 60)) % 60;
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function calculateAllStationsPoints(team) {
    const precomputed = getFirstNumber(team, ["basePoints", "baseScore", "stationsPoints", "stationPointsTotal"]);
    if (precomputed !== undefined) return precomputed;

    const testy = sumNumberFields(team, ["testyZiak1", "testyZiak2", "testyZiak3", "testyZiak4"]);
    const zdravie = sumNumberFields(team, ["zdravieOsetrenie", "zdravie112"]);
    const hasenie = sumNumberFields(team, ["hasenieDzberovka", "hasenieRhp"]);
    const co = sumNumberFields(team, ["coMaska", "coPio", "coBatozina", "coSignaly"]);
    const pohyb = sumNumberFields(team, ["pohybOrientacia", "pohybMeranie", "pohybOdhad", "pohybSvetoveStrany"]);
    const strelba = sumNumberFields(team, ["strelbaZiak1", "strelbaZiak2", "strelbaZiak3", "strelbaZiak4"]);

    return testy + zdravie + hasenie + co + pohyb + strelba;
}

export function calculatePenalty(team, limitMin) {
    return getFirstNumber(team, ["penaltyPoints", "penalty", "trestneBody"]) ?? 0;
}

export function calculateTotalPoints(team, limitMin) {
    const precomputed = getFirstNumber(team, ["totalPoints", "totalScore", "spoluBody", "scoreTotal"]);
    if (precomputed !== undefined) return precomputed;

    return calculateAllStationsPoints(team) - calculatePenalty(team, limitMin);
}

export function getPureTimeFormatted(team) {
    const precomputedTime = getFirstString(team, ["runTime", "runningTime", "bezeckyCas", "bezeciCas", "pureTimeFormatted"]);
    if (precomputedTime) return precomputedTime;

    const runtimeMillis = getFirstNumber(team, ["runTimeMillis", "runningTimeMillis", "bezeckyCasMillis", "bezeciCasMillis", "pureTimeMillis"]);
    if (runtimeMillis !== undefined) return formatDurationMillis(runtimeMillis);

    const computedFromTimes = formatMillisFromParts(team?.startTimeMillis, team?.cielTimeMillis, team?.zdrznyCasMillis);
    if (computedFromTimes) return computedFromTimes;

    return "--:--:--";
}

export function formatClockTime(timeMillis) {
    if (!timeMillis) return "--:--:--";

    const date = new Date(timeMillis);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

export function getCompletedStationsCount(team) {
    const precomputed = getFirstNumber(team, ["completedStations", "completedStationsCount", "absolvovaneStanovistia"]);
    if (precomputed !== undefined) return precomputed;

    if (team?.vybaveneStanovista) {
        return countTruthyFields(team.vybaveneStanovista);
    }

    return 0;
}

export function getTeamStatusKey(team) {
    if (team.status === "Na trati" || team.status === "ON_TRACK") return "onTrack";
    if (team.status === "V cieli" || team.status === "FINISHED") return "finished";
    return "ready";
}

export function getScoreSnapshot(team, limitMin) {
    return {
        total: calculateTotalPoints(team, limitMin),
        testy: getFirstNumber(team, ["testyPoints", "testyBody"]) ?? sumNumberFields(team, ["testyZiak1", "testyZiak2", "testyZiak3", "testyZiak4"]),
        zdravie: getFirstNumber(team, ["zdraviePoints", "zdravotnaPoints"]) ?? sumNumberFields(team, ["zdravieOsetrenie", "zdravie112"]),
        hasenie: getFirstNumber(team, ["haseniePoints"]) ?? sumNumberFields(team, ["hasenieDzberovka", "hasenieRhp"]),
        co: getFirstNumber(team, ["coPoints", "civilnaOchranaPoints"]) ?? sumNumberFields(team, ["coMaska", "coPio", "coBatozina", "coSignaly"]),
        pohyb: getFirstNumber(team, ["pohybPoints"]) ?? sumNumberFields(team, ["pohybOrientacia", "pohybMeranie", "pohybOdhad", "pohybSvetoveStrany"]),
        strelba: getFirstNumber(team, ["strelbaPoints"]) ?? sumNumberFields(team, ["strelbaZiak1", "strelbaZiak2", "strelbaZiak3", "strelbaZiak4"]),
        penalty: calculatePenalty(team, limitMin)
    };
}
