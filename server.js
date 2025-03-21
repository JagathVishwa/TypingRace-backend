const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const db = require("./database");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});

let players = {};
let raceText = "";
let raceStarted = false;
let raceStartTime = null;
let rankings = [];
let raceFinished = false; // ✅ Prevents multiple winners

// 🔹 Get a random text from the database
function getRandomSentence(callback) {
    const query = "SELECT text FROM race_texts ORDER BY RANDOM() LIMIT 1";
    db.get(query, [], (err, row) => {
        if (err) {
            console.error("Error fetching race text:", err);
            return callback("Typing is fun!");
        }
        callback(row ? row.text : "Typing is fun!");
    });
}

// 🔹 Start a new race
function startNewRace() {
    getRandomSentence((randomText) => {
        raceText = randomText;
        raceStarted = false;
        raceStartTime = null;
        raceFinished = false; // Reset race flag
        rankings = [];
        Object.keys(players).forEach((id) => {
            players[id].progress = 0;
            players[id].typedText = "";
            players[id].completed = false;
        });

        io.emit("newRaceReady", { raceText });
    });
}

// 🔹 Handle Socket Connections
io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Player joins the game
    socket.on("joinGame", ({ name }) => {
        players[socket.id] = { name, progress: 0, typedText: "", completed: false };
        io.emit("updatePlayers", Object.values(players || {})); // ✅ Prevent undefined players
    });

    // Start the race with countdown
    socket.on("startRace", () => {
        if (Object.keys(players).length > 1 && !raceStarted) {
            raceStarted = true;
            let countdownTime = 3;

            const countdownInterval = setInterval(() => {
                io.emit("countdown", countdownTime);
                countdownTime--;

                if (countdownTime < 0) {
                    clearInterval(countdownInterval);
                    raceStartTime = Date.now();
                    io.emit("raceStarted", { raceText });
                }
            }, 1000);
        }
    });

    // 🔹 Update Player Progress
    socket.on("updateProgress", ({ progress, typedText }) => {
        if (raceStarted && !raceFinished) {
            if (players[socket.id]) {
                players[socket.id].progress = progress;
                players[socket.id].typedText = typedText;
            }

            io.emit("progressUpdate", Object.values(players || {}));

            // ✅ Ensure only ONE winner is announced
            if (progress >= 100 && typedText.trim() === raceText.trim() && !raceFinished) {
                if (!players[socket.id].completed) {
                    players[socket.id].completed = true;
                    raceFinished = true; // 🔥 Stop the race immediately

                    rankings.push({ id: socket.id, name: players[socket.id].name, progress: 100 });

                    console.log(`🏆 ${players[socket.id].name} wins the race!`);
                    io.emit("raceFinished", { winner: players[socket.id].name });

                    updateLeaderboard(players[socket.id].name, 1);
                    fetchLeaderboard();

                    // 🔥 Delay next race to let players see results
                    setTimeout(() => startNewRace(), 5000);
                }
            }
        }
    });

    // 🔹 Fetch Leaderboard
    socket.on("getLeaderboard", () => {
        fetchLeaderboard();
    });

    // 🔹 Restart the Race
    socket.on("retryRace", () => {
        setTimeout(startNewRace, 2000); // ✅ Added delay to prevent undefined states
    });

    // 🔹 Handle Player Disconnect
    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("updatePlayers", Object.values(players || {})); // ✅ Prevent undefined players
    });
});

// ✅ Update Leaderboard Function
function updateLeaderboard(playerName, rank) {
    const points = 10 - rank; // Higher rank gets max points (10), lower ranks get fewer
    db.run(
        `INSERT INTO leaderboard (player_name, points) 
         VALUES (?, ?) 
         ON CONFLICT(player_name) 
         DO UPDATE SET points = points + ?`,
        [playerName, points, points],
        (err) => {
            if (err) console.error("Error updating leaderboard:", err);
        }
    );
}

// ✅ Fetch and Send Leaderboard
function fetchLeaderboard() {
    db.all(
        `SELECT player_name, points FROM leaderboard ORDER BY points DESC LIMIT 10`,
        [],
        (err, rows) => {
            if (err) {
                console.error("Error fetching leaderboard:", err);
                io.emit("leaderboardUpdate", []); // ✅ Always send an array to prevent frontend crashes
            } else {
                io.emit("leaderboardUpdate", rows || []);
            }
        }
    );
}

server.listen(4000, () => {
    console.log("Server running on port 4000");
    startNewRace();
});
