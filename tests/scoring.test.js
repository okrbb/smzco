import test from "node:test";
import assert from "node:assert/strict";

import {
    calculateAllStationsPoints,
    calculatePenalty,
    calculateTotalPoints,
    getCompletedStationsCount,
    getScoreSnapshot,
    getTeamStatusKey,
    getPureTimeFormatted
} from "../js/scoring.js";

function createBaseTeam(overrides = {}) {
    return {
        status: "Pripraveny",
        ...overrides
    };
}

test("raw fields: totals are derived from realtime station values", () => {
    assert.equal(calculateAllStationsPoints(createBaseTeam({ basePoints: 315 })), 315);
    assert.equal(calculateAllStationsPoints(createBaseTeam({
        testyZiak1: 100,
        testyZiak2: 80,
        testyZiak3: 70,
        testyZiak4: 60,
        zdravieOsetrenie: 80,
        zdravie112: 20,
        hasenieDzberovka: 25,
        hasenieRhp: 15,
        coMaska: 20,
        coPio: 30,
        coBatozina: 40,
        coSignaly: 10,
        pohybOrientacia: 10,
        pohybMeranie: 10,
        pohybOdhad: 10,
        pohybSvetoveStrany: 20,
        strelbaZiak1: 40,
        strelbaZiak2: 30,
        strelbaZiak3: 20,
        strelbaZiak4: 30
    })), 720);

    assert.equal(calculatePenalty(createBaseTeam({ penaltyPoints: 4 }), 30), 4);
    assert.equal(calculatePenalty(createBaseTeam({ status: "V cieli", startTimeMillis: 1, cielTimeMillis: 999999 }), 30), 0);

    assert.equal(calculateTotalPoints(createBaseTeam({ totalPoints: 268 }), 30), 268);
    assert.equal(calculateTotalPoints(createBaseTeam({
        testyZiak1: 100,
        testyZiak2: 80,
        testyZiak3: 70,
        testyZiak4: 60,
        penaltyPoints: 10
    }), 30), 300);
});

test("runtime formatting uses precomputed runtime or computed times", () => {
    assert.equal(getPureTimeFormatted(createBaseTeam({ runTime: "00:09:59" })), "00:09:59");
    assert.equal(getPureTimeFormatted(createBaseTeam({ runTimeMillis: 3723000 })), "01:02:03");
    assert.equal(getPureTimeFormatted(createBaseTeam({ status: "V cieli", startTimeMillis: 1, cielTimeMillis: 3723001 })), "01:02:03");
});

test("completed stations count accepts raw station map", () => {
    assert.equal(getCompletedStationsCount(createBaseTeam({ completedStations: 4 })), 4);
    assert.equal(getCompletedStationsCount(createBaseTeam({ vybaveneStanovista: { Testy: true, Zdravie: false, CO: true } })), 2);
});

test("getTeamStatusKey maps status values", () => {
    assert.equal(getTeamStatusKey(createBaseTeam({ status: "Pripraveny" })), "ready");
    assert.equal(getTeamStatusKey(createBaseTeam({ status: "Na trati" })), "onTrack");
    assert.equal(getTeamStatusKey(createBaseTeam({ status: "V cieli" })), "finished");
    assert.equal(getTeamStatusKey(createBaseTeam({ status: "ON_TRACK" })), "onTrack");
    assert.equal(getTeamStatusKey(createBaseTeam({ status: "FINISHED" })), "finished");
});

test("score snapshot derives component scores from raw fields", () => {
    const snapshot = getScoreSnapshot(createBaseTeam({
        penaltyPoints: 2,
        testyZiak1: 100,
        testyZiak2: 80,
        testyZiak3: 70,
        testyZiak4: 60,
        zdravieOsetrenie: 80,
        zdravie112: 20,
        hasenieDzberovka: 25,
        hasenieRhp: 20,
        coMaska: 80,
        coPio: 80,
        coBatozina: 100,
        coSignaly: 80,
        pohybOrientacia: 10,
        pohybMeranie: 10,
        pohybOdhad: 10,
        pohybSvetoveStrany: 20,
        strelbaZiak1: 40,
        strelbaZiak2: 30,
        strelbaZiak3: 20,
        strelbaZiak4: 30
    }), 30);

    assert.equal(snapshot.total, 963);
    assert.equal(snapshot.penalty, 2);
    assert.equal(snapshot.testy, 310);
    assert.equal(snapshot.zdravie, 100);
    assert.equal(snapshot.hasenie, 45);
    assert.equal(snapshot.co, 340);
    assert.equal(snapshot.pohyb, 50);
    assert.equal(snapshot.strelba, 120);
});
