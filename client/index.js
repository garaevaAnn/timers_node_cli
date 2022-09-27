const { command, sessionFileName } = require("./js/data");
const timer = require("./js/timer");
require("draftlog").into(console);
console.log("File to keep the session ID:", sessionFileName);
timer[command]();
