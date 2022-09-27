const os = require("os");
const path = require("path");

const homeDir = os.homedir();
const isWindows = os.type().match(/windows/i);
const sessionFileName = path.join(homeDir, `${isWindows ? "_" : "."}sb-timers-session`);
const [command, description] = process.argv.slice(2);

module.exports = {
  command,
  description,
  sessionFileName,
  questions: [
    { type: "input", name: "username", message: "Usernmame" },
    { type: "password", name: "password", message: "Password" },
  ],
};
