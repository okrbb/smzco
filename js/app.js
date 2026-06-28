import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
    previousScores: {}
};

const mockTeams = [
    {
        startNum: 1, name: "ZŠ Tulipánová, Nitra", status: "V cieli",
        testyZiak1: 78, testyZiak2: 80, testyZiak3: 75, testyZiak4: 80,
        zdravieOsetrenie: 95, zdravie112: 20,
        hasenieDzberovka: 28, hasenieRhp: 20,
        coMaska: 80, coPio: 80, coBatozina: 95, coSignaly: 80,
        pohybOrientacia: 10, pohybMeranie: 8, pohybOdhad: 9, pohybSvetoveStrany: 20,
        strelbaZiak1: 28, strelbaZiak2: 30, strelbaZiak3: 25, strelbaZiak4: 29,
        startTimeMillis: Date.now() - 3600000, cielTimeMillis: Date.now() - 3600000 + (28 * 60 * 1000), zdrznyCasMillis: 0
    },
    {
        startNum: 2, name: "ZŠ Hradná, Banská Bystrica", status: "V cieli",
        testyZiak1: 70, testyZiak2: 72, testyZiak3: 68, testyZiak4: 75,
        zdravieOsetrenie: 85, zdravie112: 20,
        hasenieDzberovka: 25, hasenieRhp: 15,
        coMaska: 75, coPio: 70, coBatozina: 85, coSignaly: 70,
        pohybOrientacia: 8, pohybMeranie: 7, pohybOdhad: 8, pohybSvetoveStrany: 15,
        strelbaZiak1: 22, strelbaZiak2: 25, strelbaZiak3: 20, strelbaZiak4: 24,
        startTimeMillis: Date.now() - 4200000, cielTimeMillis: Date.now() - 4200000 + (32 * 60 * 1000) + 12000, zdrznyCasMillis: 60000
    },
    {
        startNum: 3, name: "Gymnázium Golianova, Nitra", status: "Na trati",
        testyZiak1: 80, testyZiak2: 80, testyZiak3: 79, testyZiak4: 80,
        zdravieOsetrenie: 100, zdravie112: 20,
        hasenieDzberovka: 30, hasenieRhp: 20,
        coMaska: 80, coPio: 80, coBatozina: 100, coSignaly: 80,
        pohybOrientacia: 10, pohybMeranie: 10, pohybOdhad: 10, pohybSvetoveStrany: 20,
        strelbaZiak1: 30, strelbaZiak2: 30, strelbaZiak3: 28, strelbaZiak4: 30,
        startTimeMillis: Date.now() - 1500000, cielTimeMillis: 0, zdrznyCasMillis: 0
    },
    {
        startNum: 4, name: "ZŠ P. O. Hviezdoslava, Trnava", status: "Na trati",
        testyZiak1: 65, testyZiak2: 60, testyZiak3: 70, testyZiak4: 68,
        zdravieOsetrenie: 80, zdravie112: 15,
        hasenieDzberovka: 20, hasenieRhp: 10,
        coMaska: 70, coPio: 65, coBatozina: 75, coSignaly: 60,
        pohybOrientacia: 7, pohybMeranie: 6, pohybOdhad: 7, pohybSvetoveStrany: 15,
        strelbaZiak1: 18, strelbaZiak2: 20, strelbaZiak3: 15, strelbaZiak4: 22,
        startTimeMillis: Date.now() - 800000, cielTimeMillis: 0, zdrznyCasMillis: 15000
    },
    {
        startNum: 5, name: "ZŠ Testovacia 5", status: "Pripravený",
        testyZiak1: 0, testyZiak2: 0, testyZiak3: 0, testyZiak4: 0,
        zdravieOsetrenie: 0, zdravie112: 0,
        hasenieDzberovka: 0, hasenieRhp: 0,
        coMaska: 0, coPio: 0, coBatozina: 0, coSignaly: 0,
        pohybOrientacia: 0, pohybMeranie: 0, pohybOdhad: 0, pohybSvetoveStrany: 0,
        strelbaZiak1: 0, strelbaZiak2: 0, strelbaZiak3: 0, strelbaZiak4: 0,
        startTimeMillis: 0, cielTimeMillis: 0, zdrznyCasMillis: 0
    }
];

let simulatorInterval = null;

function calculateAllStationsPoints(tim) {
    const testy = (tim.testyZiak1 || 0) + (tim.testyZiak2 || 0) + (tim.testyZiak3 || 0) + (tim.testyZiak4 || 0);
    const zdravie = (tim.zdravieOsetrenie || 0) + (tim.zdravie112 || 0);
    const hasenie = (tim.hasenieDzberovka || 0) + (tim.hasenieRhp || 0);
    const co = (tim.coMaska || 0) + (tim.coPio || 0) + (tim.coBatozina || 0) + (tim.coSignaly || 0);
    const pohyb = (tim.pohybOrientacia || 0) + (tim.pohybMeranie || 0) + (tim.pohybOdhad || 0) + (tim.pohybSvetoveStrany || 0);
    const strelba = (tim.strelbaZiak1 || 0) + (tim.strelbaZiak2 || 0) + (tim.strelbaZiak3 || 0) + (tim.strelbaZiak4 || 0);
    return testy + zdravie + hasenie + co + pohyb + strelba;
}

function calculatePenalty(tim, limitMin) {
    if (tim.status !== "V cieli" && tim.status !== "FINISHED") return 0;
    if (!tim.startTimeMillis || !tim.cielTimeMillis) return 0;

    const pureTimeSeconds = Math.floor((tim.cielTimeMillis - tim.startTimeMillis - (tim.zdrznyCasMillis || 0)) / 1000);
    const limitSeconds = limitMin * 60;
    const overtimeSeconds = pureTimeSeconds - limitSeconds;
    if (overtimeSeconds <= 0) return 0;

    const overtimeMinutes = overtimeSeconds / 60.0;
    if (overtimeMinutes <= 1.0) return 2;
    if (overtimeMinutes <= 2.0) return 4;
    if (overtimeMinutes <= 3.0) return 6;
    if (overtimeMinutes <= 4.0) return 8;
    if (overtimeMinutes <= 5.0) return 10;
    if (overtimeMinutes <= 10.0) return 12;
    return 14;
}

function calculateTotalPoints(tim, limitMin) {
    const base = calculateAllStationsPoints(tim);
    const penalty = calculatePenalty(tim, limitMin);
    return Math.max(0, base - penalty);
}

function getPureTimeFormatted(tim) {
    if (!tim.startTimeMillis) return "--:--:--";

    let rawDiff = 0;
    if (tim.status === "V cieli" || tim.status === "FINISHED") {
        if (!tim.cielTimeMillis) return "--:--:--";
        rawDiff = tim.cielTimeMillis - tim.startTimeMillis - (tim.zdrznyCasMillis || 0);
    } else if (tim.status === "Na trati" || tim.status === "ON_TRACK") {
        rawDiff = Date.now() - tim.startTimeMillis - (tim.zdrznyCasMillis || 0);
    } else {
        return "--:--:--";
    }

    if (rawDiff < 0) rawDiff = 0;
    const seconds = Math.floor(rawDiff / 1000) % 60;
    const minutes = Math.floor(rawDiff / (1000 * 60)) % 60;
    const hours = Math.floor(rawDiff / (1000 * 60 * 60));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sortTeams(teams, limitMin) {
    return [...teams].sort((a, b) => {
        const totalA = calculateTotalPoints(a, limitMin);
        const totalB = calculateTotalPoints(b, limitMin);
        if (totalA !== totalB) return totalB - totalA;

        const testyA = (a.testyZiak1 || 0) + (a.testyZiak2 || 0) + (a.testyZiak3 || 0) + (a.testyZiak4 || 0);
        const testyB = (b.testyZiak1 || 0) + (b.testyZiak2 || 0) + (b.testyZiak3 || 0) + (b.testyZiak4 || 0);
        if (testyA !== testyB) return testyB - testyA;

        const coA = (a.coMaska || 0) + (a.coPio || 0) + (a.coBatozina || 0) + (a.coSignaly || 0);
        const coB = (b.coMaska || 0) + (b.coPio || 0) + (b.coBatozina || 0) + (b.coSignaly || 0);
        if (coA !== coB) return coB - coA;

        const timeA = a.cielTimeMillis ? (a.cielTimeMillis - a.startTimeMillis - (a.zdrznyCasMillis || 0)) : Number.MAX_SAFE_INTEGER;
        const timeB = b.cielTimeMillis ? (b.cielTimeMillis - b.startTimeMillis - (b.zdrznyCasMillis || 0)) : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
    });
}

function getScoreSnapshot(team) {
    return {
        total: calculateTotalPoints(team, state.limitMin),
        testy: (team.testyZiak1 || 0) + (team.testyZiak2 || 0) + (team.testyZiak3 || 0) + (team.testyZiak4 || 0),
        zdravie: (team.zdravieOsetrenie || 0) + (team.zdravie112 || 0),
        hasenie: (team.hasenieDzberovka || 0) + (team.hasenieRhp || 0),
        co: (team.coMaska || 0) + (team.coPio || 0) + (team.coBatozina || 0) + (team.coSignaly || 0),
        pohyb: (team.pohybOrientacia || 0) + (team.pohybMeranie || 0) + (team.pohybOdhad || 0) + (team.pohybSvetoveStrany || 0),
        strelba: (team.strelbaZiak1 || 0) + (team.strelbaZiak2 || 0) + (team.strelbaZiak3 || 0) + (team.strelbaZiak4 || 0),
        penalty: calculatePenalty(team, state.limitMin)
    };
}

function checkPulse(val, prevVal) {
    if (prevVal !== undefined && val !== prevVal) {
        return val > prevVal ? "flash-up" : "flash-down";
    }
    return "";
}

function renderLeaderboard() {
    const sorted = sortTeams(state.teams, state.limitMin);
    const tbody = document.getElementById("leaderboardBody");
    const mobileContainer = document.getElementById("mobileContainer");
    const emptyState = document.getElementById("emptyState");

    document.getElementById("statLimit").innerText = `${state.limitMin} minút`;
    document.getElementById("statTotalTeams").innerText = state.teams.length;
    document.getElementById("statOnTrack").innerText = state.teams.filter((team) => team.status === "Na trati" || team.status === "ON_TRACK").length;
    document.getElementById("statFinished").innerText = state.teams.filter((team) => team.status === "V cieli" || team.status === "FINISHED").length;
    const topLeader = sorted[0];
    document.getElementById("statLeader").innerText = (topLeader && calculateTotalPoints(topLeader, state.limitMin) > 0) ? topLeader.name : "-";

    if (sorted.length === 0) {
        tbody.innerHTML = "";
        mobileContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
        return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");

    const oldPositions = {};
    sorted.forEach((team) => {
        const element = document.getElementById(`team-row-${team.startNum}`);
        if (element) {
            oldPositions[team.startNum] = element.getBoundingClientRect().top;
        }
    });

    let desktopHtml = "";
    sorted.forEach((team, index) => {
        const scores = getScoreSnapshot(team);
        const prev = state.previousScores[team.startNum] || {};
        const isFinished = team.status === "V cieli" || team.status === "FINISHED";
        const isOnTrack = team.status === "Na trati" || team.status === "ON_TRACK";

        let rankDisplay = `<span class="text-lg font-bold">${index + 1}.</span>`;
        if (index === 0) rankDisplay = '<div class="inline-flex items-center justify-center bg-amber-500 text-white w-9 h-9 rounded-full font-black shadow-lg shadow-amber-500/20"><i data-lucide="crown" class="w-5 h-5"></i></div>';
        else if (index === 1) rankDisplay = '<div class="inline-flex items-center justify-center bg-stone-300 text-stone-800 w-8 h-8 rounded-full font-black">2</div>';
        else if (index === 2) rankDisplay = '<div class="inline-flex items-center justify-center bg-amber-700 text-white w-8 h-8 rounded-full font-black">3</div>';

        let statusChip = '<span class="px-3 py-1 text-xs font-bold rounded-full bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">Pripravený</span>';
        if (isFinished) statusChip = '<span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">V cieli</span>';
        else if (isOnTrack) statusChip = '<span class="px-3 py-1 text-xs font-bold rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 animate-pulse">Na trati</span>';

        desktopHtml += `
            <tr id="team-row-${team.startNum}" class="team-row hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onclick="showTeamDetail(${team.startNum})">
                <td class="py-4 px-6 text-center">${rankDisplay}</td>
                <td class="py-4 px-3 text-center text-stone-400 font-bold">#${team.startNum}</td>
                <td class="py-4 px-6">
                    <p class="font-bold text-stone-800 dark:text-white text-base leading-tight">${team.name}</p>
                    <p class="text-xs text-stone-400 mt-0.5">SMZ CO Družstvo</p>
                </td>
                <td class="py-4 px-4 text-center">${statusChip}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.testy, prev.testy)}">${scores.testy}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.zdravie, prev.zdravie)}">${scores.zdravie}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.hasenie, prev.hasenie)}">${scores.hasenie}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.co, prev.co)}">${scores.co}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.pohyb, prev.pohyb)}">${scores.pohyb}</td>
                <td class="py-4 px-4 text-center font-semibold ${checkPulse(scores.strelba, prev.strelba)}">${scores.strelba}</td>
                <td class="py-4 px-4 text-center font-mono text-sm">${getPureTimeFormatted(team)}</td>
                <td class="py-4 px-4 text-center text-red-500 font-bold ${checkPulse(scores.penalty, prev.penalty)}">${scores.penalty > 0 ? `-${scores.penalty} b.` : "0"}</td>
                <td class="py-4 px-6 text-center font-black bg-stone-50 dark:bg-zinc-800/20 text-lg text-amber-600 dark:text-amber-400 ${checkPulse(scores.total, prev.total)}">${scores.total} b.</td>
            </tr>
        `;
    });
    tbody.innerHTML = desktopHtml;

    let mobileHtml = "";
    sorted.forEach((team, index) => {
        const scores = getScoreSnapshot(team);

        let badgeColor = "bg-stone-100 text-stone-500 dark:bg-zinc-800";
        if (index === 0) badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
        else if (index === 1) badgeColor = "bg-stone-200 text-stone-700 dark:bg-zinc-700 dark:text-zinc-300";
        else if (index === 2) badgeColor = "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400";

        mobileHtml += `
            <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm p-4 overflow-hidden transition-all">
                <div class="flex items-center justify-between gap-2" onclick="toggleAccordion('acc-${team.startNum}')">
                    <div class="flex items-center gap-3">
                        <span class="px-3 py-1.5 rounded-xl font-black text-sm ${badgeColor}">
                            ${index + 1}.
                        </span>
                        <div>
                            <h4 class="font-bold text-stone-800 dark:text-white leading-tight text-base">${team.name}</h4>
                            <span class="text-xs font-mono text-stone-400">Čas: ${getPureTimeFormatted(team)}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-black text-amber-600 dark:text-amber-400 block">${scores.total} b.</span>
                        <span class="text-[10px] text-stone-400 block uppercase font-bold">Zobraziť</span>
                    </div>
                </div>
                <div id="acc-${team.startNum}" class="hidden mt-4 pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-2.5">
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">1. Testy</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.testy} / 320 b.</span>
                        </div>
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">2. Zdravotná</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.zdravie} / 120 b.</span>
                        </div>
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">3. Hasenie</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.hasenie} / 50 b.</span>
                        </div>
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">4. Civilná ochr.</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.co} / 340 b.</span>
                        </div>
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">5. Pohyb</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.pohyb} / 50 b.</span>
                        </div>
                        <div class="bg-stone-50 dark:bg-zinc-800/40 p-2.5 rounded-xl">
                            <span class="text-[10px] text-stone-400 font-bold block uppercase">6. Streľba</span>
                            <span class="font-black text-stone-700 dark:text-stone-300">${scores.strelba} / 120 b.</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-xs">
                        <span class="font-bold text-amber-800 dark:text-amber-300">Zdržanie na trati:</span>
                        <span class="font-mono">${Math.floor((team.zdrznyCasMillis || 0) / 1000)}s</span>
                    </div>
                </div>
            </div>
        `;
    });
    mobileContainer.innerHTML = mobileHtml;

    window.lucide.createIcons();

    sorted.forEach((team) => {
        const element = document.getElementById(`team-row-${team.startNum}`);
        if (element && oldPositions[team.startNum] !== undefined) {
            const newPos = element.getBoundingClientRect().top;
            const diff = oldPositions[team.startNum] - newPos;
            if (diff !== 0) {
                element.style.transform = `translateY(${diff}px)`;
                element.style.transition = "none";
                requestAnimationFrame(() => {
                    element.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
                    element.style.transform = "translateY(0)";
                });
            }
        }
    });

    state.teams.forEach((team) => {
        state.previousScores[team.startNum] = getScoreSnapshot(team);
    });
}

function showTeamDetail(startNum) {
    const team = state.teams.find((item) => item.startNum === startNum);
    if (!team) return;

    const total = calculateTotalPoints(team, state.limitMin);
    const penalty = calculatePenalty(team, state.limitMin);
    const base = calculateAllStationsPoints(team);

    document.getElementById("modalTeamNum").innerText = `Št. č. ${team.startNum}`;
    document.getElementById("modalTeamName").innerText = team.name;
    document.getElementById("modalSumBase").innerText = `${base} b.`;
    document.getElementById("modalSumPenalty").innerText = `-${penalty} b.`;
    document.getElementById("modalSumTotal").innerText = `${total} b.`;

    const grid = document.getElementById("modalDetailsGrid");
    grid.innerHTML = `
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <i data-lucide="file-text" class="w-4 h-4"></i> 1. Písomné testy (všeobecne)
                </span>
                <span class="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-bold">Max 320 bodov</span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">1. Žiak</p><p class="font-black mt-0.5">${team.testyZiak1 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">2. Žiak</p><p class="font-black mt-0.5">${team.testyZiak2 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">3. Žiak</p><p class="font-black mt-0.5">${team.testyZiak3 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">4. Žiak</p><p class="font-black mt-0.5">${team.testyZiak4 || 0} b.</p></div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                    <i data-lucide="heart-pulse" class="w-4 h-4"></i> 2. Zdravotnícka príprava
                </span>
                <span class="text-xs bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 px-2.5 py-0.5 rounded-full font-bold">Max 120 bodov</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="p-3 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center">
                    <span>Praktické ošetrenie</span>
                    <span class="font-black">${team.zdravieOsetrenie || 0} / 100 b.</span>
                </div>
                <div class="p-3 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center">
                    <span>Volanie na linku 112</span>
                    <span class="font-black">${team.zdravie112 || 0} / 20 b.</span>
                </div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                    <i data-lucide="flame" class="w-4 h-4"></i> 3. Hasenie malých požiarov
                </span>
                <span class="text-xs bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-400 px-2.5 py-0.5 rounded-full font-bold">Max 50 bodov</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="p-3 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center">
                    <span>Džberovka (streľba na terč)</span>
                    <span class="font-black">${team.hasenieDzberovka || 0} / 30 b.</span>
                </div>
                <div class="p-3 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center">
                    <span>Príprava PHP (druh, použitie)</span>
                    <span class="font-black">${team.hasenieRhp || 0} / 20 b.</span>
                </div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <i data-lucide="shield" class="w-4 h-4"></i> 4. Civilná ochrana
                </span>
                <span class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-bold">Max 340 bodov</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Ochranná maska</span><span class="font-black">${team.coMaska || 0} / 80 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Použitie PIO</span><span class="font-black">${team.coPio || 0} / 80 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Evakuačná batožina</span><span class="font-black">${team.coBatozina || 0} / 100 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Varovné signály</span><span class="font-black">${team.coSignaly || 0} / 80 b.</span></div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <i data-lucide="compass" class="w-4 h-4"></i> 5. Pohyb a pobyt v prírode
                </span>
                <span class="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">Max 50 bodov</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Orientácia & topografia</span><span class="font-black">${team.pohybOrientacia || 0} / 10 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Meranie na mape</span><span class="font-black">${team.pohybMeranie || 0} / 10 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Odhad vzdialenosti</span><span class="font-black">${team.pohybOdhad || 0} / 10 b.</span></div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center"><span>Svetové strany</span><span class="font-black">${team.pohybSvetoveStrany || 0} / 20 b.</span></div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <i data-lucide="target" class="w-4 h-4"></i> 6. Streľba zo vzduchovky
                </span>
                <span class="text-xs bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-400 px-2.5 py-0.5 rounded-full font-bold">Max 120 bodov</span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">1. Žiak</p><p class="font-black mt-0.5">${team.strelbaZiak1 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">2. Žiak</p><p class="font-black mt-0.5">${team.strelbaZiak2 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">3. Žiak</p><p class="font-black mt-0.5">${team.strelbaZiak3 || 0} b.</p></div>
                <div class="text-center p-2 bg-white dark:bg-zinc-800 rounded-lg"><p class="text-stone-400">4. Žiak</p><p class="font-black mt-0.5">${team.strelbaZiak4 || 0} b.</p></div>
            </div>
        </div>
    `;

    window.lucide.createIcons();
    document.getElementById("detailModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("detailModal").classList.add("hidden");
}

function toggleAccordion(id) {
    const acc = document.getElementById(id);
    if (acc) {
        acc.classList.toggle("hidden");
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("smzco-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
}

function initTheme() {
    const saved = localStorage.getItem("smzco-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

function initYearBadge() {
    const yearBadge = document.getElementById("currentYearBadge");
    if (yearBadge) {
        yearBadge.innerText = String(new Date().getFullYear());
    }
}

function initFirebase() {
    if (!firebaseConfig.databaseURL || !firebaseConfig.projectId) {
        console.log("Chýba Firebase databaseURL alebo projectId.");
        document.getElementById("dbAlert").classList.remove("hidden");
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        const druzstvaRef = ref(db, `${SUTAZ_ID}/druzstva`);
        onValue(druzstvaRef, (snapshot) => {
            const val = snapshot.val();
            state.teams = val
                ? Object.keys(val).map((key) => ({
                    startNum: parseInt(key, 10),
                    ...val[key]
                }))
                : [];
            renderLeaderboard();
        }, (error) => {
            console.error("Firebase chyby pri čítaní tímov:", error);
        });

        const nastaveniaRef = ref(db, `${SUTAZ_ID}/nastavenia/casovyLimitMinuty`);
        onValue(nastaveniaRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                state.limitMin = parseInt(val, 10);
                renderLeaderboard();
            }
        });

        console.log("Firebase pripojenie úspešne inicializované.");
    } catch (error) {
        console.error("Zlyhala inicializácia Firebase:", error);
        document.getElementById("dbAlert").classList.remove("hidden");
    }
}

initYearBadge();

window.showTeamDetail = showTeamDetail;
window.closeModal = closeModal;
window.toggleAccordion = toggleAccordion;
window.toggleTheme = toggleTheme;

window.setInterval(() => {
    const activeOnTrack = state.teams.some((team) => team.status === "Na trati" || team.status === "ON_TRACK");
    if (activeOnTrack) {
        renderLeaderboard();
    }
}, 1000);

window.addEventListener("load", () => {
    initTheme();
    window.lucide.createIcons();
    initFirebase();
});
