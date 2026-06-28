import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

    try {
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        onValue(ref(db, ".info/connected"), (snapshot) => {
            if (onConnectionChange) onConnectionChange(Boolean(snapshot.val()));
        });

        const teamsRef = ref(db, `${contestId}/druzstva`);
        onValue(teamsRef, (snapshot) => {
            const val = snapshot.val();
            const teams = val
                ? Object.keys(val).map((key) => ({
                    startNum: parseInt(key, 10),
                    ...val[key]
                }))
                : [];

            if (onTeams) onTeams(teams);
        }, (error) => {
            if (onError) onError(error);
        });

        const settingsRef = ref(db, `${contestId}/nastavenia/casovyLimitMinuty`);
        onValue(settingsRef, (snapshot) => {
            const val = snapshot.val();
            if (val !== undefined && val !== null && onLimit) {
                onLimit(parseInt(val, 10));
            }
        });
    } catch (error) {
        if (onError) onError(error);
    }
}
