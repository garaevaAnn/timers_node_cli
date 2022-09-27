require("dotenv").config();
const { sessionFileName, description, questions } = require("./data");
const fs = require("fs").promises;
const URL_BASE = process.env.SERVER;
const axios = require("axios");
const inquirer = require("inquirer");
const kleur = require("kleur");
const Table = require("cli-table");

const deleteSessionFile = () => {
  return fs.unlink(`${sessionFileName}.txt`);
};

const updateSessionFile = async (sessionId) => {
  try {
    await deleteSessionFile();
  } catch (error) {
    console.log("");
  }
  await fs.writeFile(`${sessionFileName}.txt`, sessionId, "utf-8");
};

const getSessionId = async () => {
  try {
    return await fs.readFile(`${sessionFileName}.txt`, "utf-8");
  } catch (error) {
    console.log(error);
    return undefined;
  }
};

const signupOfLogin = async (pathname) => {
  try {
    const body = await inquirer.prompt(questions);
    const res = await axios.post(`${URL_BASE}/${pathname}`, body);
    const { sessionId } = res.data;
    if (!sessionId) {
      if (pathname === "login") {
        console.log("Wrong username or password!");
      }
      return;
    }
    await updateSessionFile(sessionId);
  } catch (error) {
    console.log(error);
  }
};

const login = async () => {
  await signupOfLogin("login");
  console.log("Logged in successfully!");
};

const signup = async () => {
  await signupOfLogin("signup");
  console.log("Signed up successfully!");
};

const logout = async () => {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return;
    await axios.get(`${URL_BASE}/logout`, {
      headers: {
        "X-SessionId": `${sessionId}`,
      },
    });
    deleteSessionFile();
    console.log("Logged out successfully!");
  } catch (error) {
    console.error(error);
  }
};

const start = async () => {
  if (!description) {
    console.log(
      `To start the timer you must input its name as 3rd argument. \nLike: ${kleur.green(
        `"node index.js start 'First timer'"`
      )} `
    );
  } else {
    try {
      const sessionId = await getSessionId();
      if (!sessionId) return;
      const res = await axios.post(
        `${URL_BASE}/api/timers`,
        { description },
        {
          headers: {
            "X-SessionId": `${sessionId}`,
          },
        }
      );
      console.log(`Started timer "${description}", ID: ${res.data.id}.`);
    } catch (error) {
      console.error(error);
    }
  }
};

const stop = async () => {
  if (!description) {
    console.log(
      `To start the timer you must input its name as 3rd argument. \nLike: ${kleur.green(
        `"node index.js stop 'id timer'"`
      )} `
    );
  } else {
    try {
      const sessionId = await getSessionId();
      if (!sessionId) return;
      const res = await axios.post(`${URL_BASE}/api/timers/${description}/stop`, {
        headers: {
          "X-SessionId": `${sessionId}`,
        },
      });
      if (res.status === 204) console.log(`Timer ${description} stopped`);
      else res.sendStatus(500);
    } catch (error) {
      console.log(`Unknown timer ID ${description}.`);
    }
  }
};

const table = new Table({ head: ["ID", "Task", "Time"], colWidths: [40, 40, 20] });
const showTable = (data) => {
  const arr = data.map((item) => [
    item._id,
    item.description + ` ${item.isActive || description === "old" ? "" : "(stopped)"}`,
    formatTime(!item.isActive ? item.duration : item.progress),
  ]);
  arr.forEach((item) => table.push(item));
  console.log(table.toString());
};

const formatTime = (ts) => {
  const hours = Math.floor(ts / 1000 / 60 / 60);
  const minuts = Math.floor(ts / 1000 / 60);
  const seconds = Math.floor(ts / 1000);

  const timeString = (number) => (number > 0 ? (number < 10 ? "0" + number : String(number)) + ":" : "00:");

  const hoursString = timeString(hours);
  const minutsString = timeString(minuts - hours * 60);
  const secondsString = timeString(seconds - minuts * 60);
  return hoursString + minutsString + secondsString.slice(0, -1);
};

const status = async () => {
  const sessionId = await getSessionId();
  if (!sessionId) return;
  if (description) {
    if (description === "old") {
      const data = await getTimers("false", sessionId);
      if (data.length === 0) return console.log(`You have no old tomers.`);
      showTable(data);
    } else {
      const resActive = await getTimers("true", sessionId);
      const resOld = await getTimers("false", sessionId);
      const arr = [].concat(resActive, resOld);
      const timer = arr.find((el) => el._id === description);
      if (!timer) return console.log(`Unknown timer ID ${description}.`);
      showTable([timer]);
    }
  } else {
    const data = await getTimers("true", sessionId);
    if (!data.length) return console.log("You have no active timers.");
    showTable(data);
  }
};

const getTimers = async (isActiv, sessionId) => {
  const res = await axios.get(`${URL_BASE}/api/timers`, {
    headers: {
      "X-SessionId": `${sessionId}`,
    },
    params: { isActive: isActiv },
  });
  return res.data;
};

module.exports = {
  login,
  signup,
  logout,
  start,
  stop,
  status,
};
