require("dotenv").config();

const express = require("express");
const { nanoid } = require("nanoid");
const crypto = require("crypto");

const app = express();

const HEADER_SESSION = 'X-SessionId';

const { MongoClient, ObjectId } = require("mongodb");

const clientPromise = MongoClient.connect(process.env.DB_URI, {
  useUnifiedTopology: true,
  maxPoolSize: 10,
});

app.use(async (req, res, next) => {
  try {
    const client = await clientPromise;
    req.db = client.db("users");
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.json());

const hash = (password) => {
  const nh = crypto.createHash("sha256").update(password).digest("hex");
  return nh;
};

const findIsActiv = async (db, isActive, userId) => {

  const activ = isActive === "true" ? true : false;
  const data = await db.collection("timers").find({ userId: userId, isActive: activ }).toArray();
  if (activ) {
    data.forEach((item) => {
      item.progress = Date.now() - item.start;
      item.id = item._id.toString();
    });
  }
  return data;
};

const createTimer = async (db, desc, userId) => {
  const timer = {
    start: Date.now(),
    description: desc,
    isActive: true,
    userId: userId,
  };
  const { insertedId } = await db.collection("timers").insertOne(timer);
  console.log(insertedId);
  return insertedId;
};

const findUserByUserName = async (db, username) => db.collection("users").findOne({ username });

const findUserBySessionId = async (db, sessionId) => {
  const session = await db.collection("sessions").findOne(
    { sessionId },
    {
      projection: { userId: 1 },
    }
  );

  if (!session) return;

  return db.collection("users").findOne({ _id: ObjectId(session.userId) });
};

const createSession = async (db, userId) => {
  const sessionId = nanoid();

  await db.collection("sessions").insertOne({
    userId,
    sessionId,
  });
  return sessionId;
};

const deleteSession = async (db, sessionId) => {
  await db.collection("sessions").deleteOne({ sessionId });
};

const auth = () => async (req, res, next) => {
  const sessionId = req.header(HEADER_SESSION);
  if (!sessionId) return next();

  const user = await findUserBySessionId(req.db, sessionId);
  req.user = user;
  next();
};

app.post("/login",  async (req, res) => {
  const { username, password } = req.body;
  const user = await findUserByUserName(req.db, username);

  if (!user || user.password !== hash(password)) {
    return res.json({  error: 'user or password not found' })
  }
  const sessionId = await createSession(req.db, user._id);
  res.json({ sessionId });
});

app.post("/signup",  async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = req.db;
    const result = await db.collection("users").insertOne({
      username: username,
      password: hash(password),
    });
    const sessionId = await createSession(db, result.insertedId);
    res.json({ sessionId });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.get("/api/timers", auth(), async (req, res) => {
  if (!req.user) return res.sendStatus(401);
  const queryparams = req.query;
  console.log('queryparams',queryparams);
  if (queryparams && queryparams.isActive !== undefined) {
    const finds = await findIsActiv(req.db, queryparams.isActive, req.user._id);
    res.json(finds);
  }
});

app.post("/api/timers", auth(), async (req, res) => {
  if (!req.user) return res.sendStatus(401);
  try {
    const id =  await createTimer(req.db, req.body.description, req.user._id);
    const data = id.toString();
    console.log(data);
    res.status(201).json({ id:data });
  } catch (error) {
    console.log(error);
    res.status(400).send(error);
  }
});

app.post("/api/timers/:id/stop", auth(), async (req, res) => {
 try {
    const db = req.db;
    var col = db.collection("timers");
    const timer = await col
      .findOne({
        _id: ObjectId(req.params.id),
      });
      if(!timer) res.status(404).send("Timer not found");
      const { modifiedCount } = await col.updateOne(
          {
            _id: timer._id,
          },
          {
            $set: {
              end: Date.now(),
              isActive: false,
              duration: Date.now() - timer.start,
            },
          }
        );

    if (modifiedCount === 0) res.status(400).send("Timer not update");
    else res.sendStatus(204);
  } catch (err) {
    console.log('error',err)
    res.status(404).send(err);
  }
});

app.get("/logout", auth(), async (req, res) => {
  if (!req.user) return res.json({  error: 'user  not found' });
  await deleteSession(req.db, req.header(HEADER_SESSION));
  res.json({});
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
