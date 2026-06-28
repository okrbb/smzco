import {
    calculateAllStationsPoints,
    calculatePenalty,
    calculateTotalPoints,
    formatClockTime,
    getCompletedStationsCount,
    getPureTimeFormatted,
    getScoreSnapshot,
    getTeamStatusKey
} from "./scoring.js";

function getExternalRank(team) {
    const candidates = [team.rank, team.poradie, team.rankPosition, team.poradieAktualne];
    const rank = candidates.find((value) => typeof value === "number" && Number.isFinite(value));
    return rank;
}

function getExternalRunTimeMillis(team) {
    const candidates = [team.runTimeMillis, team.runningTimeMillis, team.bezeckyCasMillis, team.bezeciCasMillis, team.pureTimeMillis];
    const value = candidates.find((item) => typeof item === "number" && Number.isFinite(item));
    return value;
}

function sortTeams(teams, limitMin) {
    return [...teams].sort((a, b) => {
        const rankA = getExternalRank(a);
        const rankB = getExternalRank(b);
        if (rankA !== undefined && rankB !== undefined && rankA !== rankB) {
            return rankA - rankB;
        }

        const totalA = calculateTotalPoints(a, limitMin);
        const totalB = calculateTotalPoints(b, limitMin);
        if (totalA !== totalB) return totalB - totalA;

        const externalTimeA = getExternalRunTimeMillis(a);
        const externalTimeB = getExternalRunTimeMillis(b);
        if (externalTimeA !== undefined && externalTimeB !== undefined && externalTimeA !== externalTimeB) {
            return externalTimeA - externalTimeB;
        }

        return (a.startNum || 0) - (b.startNum || 0);
    });
}

function checkPulse(val, prevVal) {
    if (prevVal !== undefined && val !== prevVal) {
        return val > prevVal ? "flash-up" : "flash-down";
    }
    return "";
}

function captureItemRects(containerSelector, itemSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return new Map();

    const rects = new Map();
    container.querySelectorAll(itemSelector).forEach((element) => {
        const teamId = element.dataset.teamId;
        if (teamId) {
            rects.set(teamId, element.getBoundingClientRect());
        }
    });
    return rects;
}

function animateItemReorder(containerSelector, itemSelector, firstRects) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.querySelectorAll(itemSelector).forEach((element) => {
        const teamId = element.dataset.teamId;
        const firstRect = firstRects.get(teamId);
        if (!firstRect) return;

        const lastRect = element.getBoundingClientRect();
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;
        if (deltaX === 0 && deltaY === 0) return;

        element.style.transition = "none";
        element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        element.style.zIndex = "1";

        requestAnimationFrame(() => {
            element.style.transition = "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)";
            element.style.transform = "translate(0, 0)";
        });

        window.setTimeout(() => {
            element.style.transition = "";
            element.style.transform = "";
            element.style.zIndex = "";
        }, 750);
    });
}

function getRankDisplay(index) {
    if (index === 0) {
        return '<div class="inline-flex items-center justify-center bg-amber-500 text-white w-9 h-9 rounded-full font-black shadow-lg shadow-amber-500/20"><i data-lucide="crown" class="w-5 h-5"></i></div>';
    }
    if (index === 1) {
        return '<div class="inline-flex items-center justify-center bg-stone-300 text-stone-800 w-8 h-8 rounded-full font-black">2</div>';
    }
    if (index === 2) {
        return '<div class="inline-flex items-center justify-center bg-amber-700 text-white w-8 h-8 rounded-full font-black">3</div>';
    }
    return `<span class="text-lg font-bold">${index + 1}.</span>`;
}

function getStatusChip(team) {
    const isFinished = team.status === "V cieli" || team.status === "FINISHED";
    const isOnTrack = team.status === "Na trati" || team.status === "ON_TRACK";

    if (isFinished) {
        return '<span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">V cieli</span>';
    }
    if (isOnTrack) {
        return '<span class="px-3 py-1 text-xs font-bold rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 animate-pulse">Na trati</span>';
    }
    return '<span class="px-3 py-1 text-xs font-bold rounded-full bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">Pripravený</span>';
}

function getMobileBadgeColor(index) {
    if (index === 0) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    if (index === 1) return "bg-stone-200 text-stone-700 dark:bg-zinc-700 dark:text-zinc-300";
    if (index === 2) return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-stone-100 text-stone-500 dark:bg-zinc-800";
}

function normalizeForSearch(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function applyTeamFilters(teams, filters) {
    const query = normalizeForSearch(filters.query);
    const activeStatus = filters.status;

    return teams.filter((team) => {
        if (activeStatus !== "all" && getTeamStatusKey(team) !== activeStatus) {
            return false;
        }

        if (!query) return true;

        const nameMatch = normalizeForSearch(team.name).includes(query);
        const startNumMatch = String(team.startNum || "").includes(query);
        return nameMatch || startNumMatch;
    });
}

function getStationProgressHtml(team) {
    const completed = getCompletedStationsCount(team);
    const totalStations = 6;
    const percent = Math.round((completed / totalStations) * 100);

    return `
        <div class="mt-1.5 w-full max-w-[220px]">
            <div class="flex items-center justify-between text-[10px] text-stone-400">
                <span>Postup trate</span>
                <span class="font-bold">${completed}/${totalStations} stanovíšť</span>
            </div>
            <div class="mt-1 h-1.5 w-full rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden">
                <div class="h-full rounded-full bg-amber-500 transition-all duration-500" style="width:${percent}%;"></div>
            </div>
        </div>
    `;
}

function getRenderSignature(team, index, scores) {
    return [
        index,
        team.name,
        team.status || "",
        getCompletedStationsCount(team),
        scores.testy,
        scores.zdravie,
        scores.hasenie,
        scores.co,
        scores.pohyb,
        scores.strelba,
        scores.penalty,
        scores.total,
        team.zdrznyCasMillis || 0,
        getPureTimeFormatted(team)
    ].join("|");
}

function buildDesktopRowHtml(team, index, prev, scores, signature) {
    return `
        <tr id="team-row-${team.startNum}" data-team-id="${team.startNum}" data-signature="${signature}" class="team-row hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onclick="showTeamDetail(${team.startNum})">
            <td class="py-4 px-6 text-center">${getRankDisplay(index)}</td>
            <td class="py-4 px-3 text-center text-stone-400 font-bold">#${team.startNum}</td>
            <td class="py-4 px-6">
                <p class="font-bold text-stone-800 dark:text-white text-base leading-tight">${team.name}</p>
                ${getStationProgressHtml(team)}
            </td>
            <td class="py-4 px-4 text-center">${getStatusChip(team)}</td>
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
}

function buildMobileCardHtml(team, index, scores, signature) {
    return `
        <div data-team-id="${team.startNum}" data-signature="${signature}" class="team-card bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm p-4 overflow-hidden transition-all">
            <div class="flex items-center justify-between gap-2" onclick="toggleAccordion('acc-${team.startNum}')">
                <div class="flex items-center gap-3">
                    <span class="px-3 py-1.5 rounded-xl font-black text-sm ${getMobileBadgeColor(index)}">
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
}

function hasSameOrder(sortedTeams, renderedOrder) {
    if (sortedTeams.length !== renderedOrder.length) return false;
    return sortedTeams.every((team, index) => team.startNum === renderedOrder[index]);
}

function buildDesktopLoadingRows(rowCount = 5) {
    let rows = "";
    for (let i = 0; i < rowCount; i += 1) {
        rows += `
            <tr>
                <td class="py-4 px-6"><div class="h-8 w-8 rounded-full skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-3"><div class="h-4 w-10 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-6">
                    <div class="h-4 w-48 rounded skeleton-shimmer mb-2"></div>
                    <div class="h-2 w-36 rounded skeleton-shimmer"></div>
                </td>
                <td class="py-4 px-4"><div class="h-6 w-20 rounded-full skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-8 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-20 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-4"><div class="h-4 w-10 rounded skeleton-shimmer mx-auto"></div></td>
                <td class="py-4 px-6"><div class="h-5 w-16 rounded skeleton-shimmer mx-auto"></div></td>
            </tr>
        `;
    }
    return rows;
}

function buildMobileLoadingCards(cardCount = 3) {
    let cards = "";
    for (let i = 0; i < cardCount; i += 1) {
        cards += `
            <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm p-4">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="h-4 w-36 rounded skeleton-shimmer mb-2"></div>
                        <div class="h-3 w-24 rounded skeleton-shimmer"></div>
                    </div>
                    <div class="h-6 w-16 rounded skeleton-shimmer"></div>
                </div>
            </div>
        `;
    }
    return cards;
}

export function setConnectionStatus(status) {
    const statusText = document.getElementById("liveStatusText");
    const statusDot = document.getElementById("liveStatusDot");
    const statusBadge = document.getElementById("liveStatusBadge");

    if (!statusText || !statusDot || !statusBadge) return;

    if (status === "connected") {
        statusText.innerText = "LIVE REBRÍČEK";
        statusText.className = "text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-wider";
        statusDot.className = "w-2.5 h-2.5 bg-emerald-600 rounded-full live-dot";
        statusBadge.className = "flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-full transition-colors";
        return;
    }

    if (status === "offline") {
        statusText.innerText = "LIVE REBRÍČEK";
        statusText.className = "text-xs font-black text-red-600 dark:text-red-400 tracking-wider";
        statusDot.className = "w-2.5 h-2.5 bg-red-600 rounded-full live-dot";
        statusBadge.className = "flex items-center gap-2 px-3.5 py-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-full transition-colors";
        return;
    }

    statusText.innerText = "LIVE REBRÍČEK";
    statusText.className = "text-xs font-black text-amber-600 dark:text-amber-400 tracking-wider";
    statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
    statusBadge.className = "flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-full transition-colors";
}

export function updateFilterButtonsUI(activeStatus) {
    document.querySelectorAll("button[data-filter]").forEach((button) => {
        const isActive = button.dataset.filter === activeStatus;
        if (isActive) {
            button.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white";
            return;
        }
        button.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300";
    });
}

export function renderLeaderboard(state) {
    const sortedAll = sortTeams(state.teams, state.limitMin);
    const sorted = applyTeamFilters(sortedAll, state.filters);
    const tbody = document.getElementById("leaderboardBody");
    const mobileContainer = document.getElementById("mobileContainer");
    const emptyState = document.getElementById("emptyState");
    const emptyStateTitle = document.getElementById("emptyStateTitle");
    const emptyStateHint = document.getElementById("emptyStateHint");

    if (!state.hasReceivedTeams) {
        tbody.innerHTML = buildDesktopLoadingRows();
        mobileContainer.innerHTML = buildMobileLoadingCards();
        emptyState.classList.add("hidden");
        emptyState.classList.remove("flex");
        state.renderedOrder = [];
        return;
    }

    const orderUnchanged = hasSameOrder(sorted, state.renderedOrder);
    const desktopFirstRects = orderUnchanged ? new Map() : captureItemRects("#leaderboardBody", ".team-row");
    const mobileFirstRects = orderUnchanged ? new Map() : captureItemRects("#mobileContainer", ".team-card");

    document.getElementById("statLimit").innerText = `${state.limitMin} minút`;
    document.getElementById("statTotalTeams").innerText = state.teams.length;
    document.getElementById("statOnTrack").innerText = state.teams.filter((team) => team.status === "Na trati" || team.status === "ON_TRACK").length;
    document.getElementById("statFinished").innerText = state.teams.filter((team) => team.status === "V cieli" || team.status === "FINISHED").length;
    const topLeader = sortedAll[0];
    document.getElementById("statLeader").innerText = (topLeader && calculateTotalPoints(topLeader, state.limitMin) > 0) ? topLeader.name : "-";

    if (sorted.length === 0) {
        tbody.innerHTML = "";
        mobileContainer.innerHTML = "";
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");

        if (state.teams.length === 0) {
            emptyStateTitle.innerText = "Žiadne družstvá nenačítané";
            emptyStateHint.innerText = "Skontrolujte pripojenie k databáze.";
        } else {
            emptyStateTitle.innerText = "Filter nenašiel žiadny tím";
            emptyStateHint.innerText = "Skúste iný názov, štartové číslo alebo stav tímu.";
        }

        state.renderedOrder = [];
        return;
    }

    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");

    let needsFullRender = !orderUnchanged;

    if (!needsFullRender) {
        sorted.forEach((team, index) => {
            const scores = getScoreSnapshot(team, state.limitMin);
            const prev = state.previousScores[team.startNum] || {};
            const signature = getRenderSignature(team, index, scores);
            const desktopRow = tbody.querySelector(`tr[data-team-id="${team.startNum}"]`);
            const mobileCard = mobileContainer.querySelector(`.team-card[data-team-id="${team.startNum}"]`);

            if (!desktopRow || !mobileCard) {
                needsFullRender = true;
                return;
            }

            if (desktopRow.dataset.signature !== signature) {
                desktopRow.outerHTML = buildDesktopRowHtml(team, index, prev, scores, signature);
            }

            if (mobileCard.dataset.signature !== signature) {
                mobileCard.outerHTML = buildMobileCardHtml(team, index, scores, signature);
            }
        });
    }

    if (needsFullRender) {
        let desktopHtml = "";
        let mobileHtml = "";

        sorted.forEach((team, index) => {
            const scores = getScoreSnapshot(team, state.limitMin);
            const prev = state.previousScores[team.startNum] || {};
            const signature = getRenderSignature(team, index, scores);

            desktopHtml += buildDesktopRowHtml(team, index, prev, scores, signature);
            mobileHtml += buildMobileCardHtml(team, index, scores, signature);
        });

        tbody.innerHTML = desktopHtml;
        mobileContainer.innerHTML = mobileHtml;

        animateItemReorder("#leaderboardBody", ".team-row", desktopFirstRects);
        animateItemReorder("#mobileContainer", ".team-card", mobileFirstRects);
    }

    window.lucide.createIcons();
    state.renderedOrder = sorted.map((team) => team.startNum);

    state.teams.forEach((team) => {
        state.previousScores[team.startNum] = getScoreSnapshot(team, state.limitMin);
    });
}

export function showTeamDetail(startNum, state) {
    const team = state.teams.find((item) => item.startNum === startNum);
    if (!team) return;

    const scores = getScoreSnapshot(team, state.limitMin);
    const total = calculateTotalPoints(team, state.limitMin);
    const penalty = calculatePenalty(team, state.limitMin);
    const base = calculateAllStationsPoints(team);
    const startTime = formatClockTime(team.startTimeMillis);
    const finishTime = formatClockTime(team.cielTimeMillis);
    const runTime = getPureTimeFormatted(team);

    document.getElementById("modalTeamNum").innerText = `Št. č. ${team.startNum}`;
    document.getElementById("modalTeamName").innerText = team.name;
    document.getElementById("modalSumBase").innerText = `${base} b.`;
    document.getElementById("modalSumPenalty").innerText = `-${penalty} b.`;
    document.getElementById("modalSumTotal").innerText = `${total} b.`;

    const grid = document.getElementById("modalDetailsGrid");
    grid.innerHTML = `
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-stone-700 dark:text-stone-200 flex items-center gap-2">
                    <i data-lucide="layout-grid" class="w-4 h-4"></i> Sumár disciplín
                </span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-600"></i> Testy</span>
                    <span class="font-black">${scores.testy} / 320</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="heart-pulse" class="w-3.5 h-3.5 text-red-500"></i> Zdravotnícka</span>
                    <span class="font-black">${scores.zdravie} / 120</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="flame" class="w-3.5 h-3.5 text-orange-500"></i> Hasenie</span>
                    <span class="font-black">${scores.hasenie} / 50</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="shield" class="w-3.5 h-3.5 text-blue-500"></i> Civilná ochr.</span>
                    <span class="font-black">${scores.co} / 340</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="compass" class="w-3.5 h-3.5 text-emerald-500"></i> Pohyb</span>
                    <span class="font-black">${scores.pohyb} / 50</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-between gap-2">
                    <span class="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5 text-zinc-500"></i> Streľba</span>
                    <span class="font-black">${scores.strelba} / 120</span>
                </div>
            </div>
        </div>
        <div class="p-4 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/50 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2.5">
                <span class="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <i data-lucide="clock-3" class="w-4 h-4"></i> Časové údaje
                </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center sm:flex-col sm:items-start sm:gap-1">
                    <span class="text-stone-500">Čas na štarte</span>
                    <span class="font-black font-mono">${startTime}</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center sm:flex-col sm:items-start sm:gap-1">
                    <span class="text-stone-500">Čas v cieli</span>
                    <span class="font-black font-mono">${finishTime}</span>
                </div>
                <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl flex justify-between items-center sm:flex-col sm:items-start sm:gap-1">
                    <span class="text-stone-500">Bežecký čas</span>
                    <span class="font-black font-mono">${runTime}</span>
                </div>
            </div>
        </div>
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

export function closeModal() {
    document.getElementById("detailModal").classList.add("hidden");
}

export function toggleAccordion(id) {
    const acc = document.getElementById(id);
    if (acc) {
        acc.classList.toggle("hidden");
    }
}

export function toggleTheme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("smzco-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
}

export function initTheme() {
    const saved = localStorage.getItem("smzco-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

export function initYearBadge() {
    const yearBadge = document.getElementById("currentYearBadge");
    if (yearBadge) {
        yearBadge.innerText = String(new Date().getFullYear());
    }
}
