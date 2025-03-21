const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./typing_race.db", (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS race_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            wpm INTEGER NOT NULL,
            accuracy REAL NOT NULL,
            race_time INTEGER NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS race_texts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
            player_name TEXT PRIMARY KEY,
            points INTEGER NOT NULL DEFAULT 0
        )
    `);
});

module.exports = db;
