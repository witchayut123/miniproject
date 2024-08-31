const express = require("express");
const MQTT = require("mqtt");
const path = require("path");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ path: ".env" });

const app = express();
const PORT = 3000;

const prisma = new PrismaClient();

app.use(express.json());

app.use(cors());

const MQTT_PORT = process.env.MQTT_PORT;
const CONNECTURL = `mqtt://${process.env.MQTT_HOST}:${MQTT_PORT}`;
const ACTION_TOPIC = "action";
const SUBSCRIBE_TOPIC = "status";

const client = MQTT.connect(CONNECTURL, {
  clientId: process.env.CLIENT_ID,
  clean: true,
  connectTimeout: 7200,
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 10000,
});

client.on("error", function (error) {
  console.log("Can't connect: " + error);
});

client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(SUBSCRIBE_TOPIC, (err) => {
    if (err) {
      console.log("Failed to subscribe:", err);
    } else {
      console.log(`Subscribed to topic '${SUBSCRIBE_TOPIC}'`);
    }
  });
});

client.on("message", (topic, message) => {
  if (topic === SUBSCRIBE_TOPIC) {
    console.log(
      `Received message from '${SUBSCRIBE_TOPIC}': ${message.toString()}`
    );
  }
});

// Serve the static HTML file
app.use(express.static(path.join(__dirname, "public")));

// Endpoint to handle the button clicks and other commands
app.post("/publish", (req, res) => {
  const { message } = req.body;

  if (message) {
    publishMessage(ACTION_TOPIC, message, res);
  }
});

function publishMessage(topic, message, res) {
  client.publish(topic, message, { qos: 0, retain: false }, (error) => {
    if (error) {
      console.log("Failed to publish message:", error.message);
      return res.status(500).send("Failed to publish message");
    }
    console.log(`Message '${message}' published to TOPIC '${topic}'`);
    res.send(`Message '${message}' sent to topic`);
  });
}

app.get("/api/data", async (req, res) => {
  try {
    const allData = await prisma.WCY026.findMany({
      select: {
        ldr: true,
        led1: true,
        led2: true,
        potentio: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    const data = allData.slice(1).reverse();

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
  }
});

app.post("/api/insert", async (req, res) => {
  const { ldr, led1, led2, potentio } = req.body;

  try {
    const data = await prisma.WCY026.create({
      data: {
        ldr,
        led1,
        led2,
        potentio,
      },
    });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
  }
});

app.get("/api/power", async (req, res) => {
  try {
    const data = await prisma.WCY026.findFirst({
      where: {
        id: 1,
      },
      select: {
        power: true,
      },
    });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve data" });
  }
});

app.put("/api/power", async (req, res) => {
  const { power } = req.body;

  try {
    const updatedRow = await prisma.WCY026.updateMany({
      where: {
        id: 1, // หรือใช้เงื่อนไขอื่นๆที่เหมาะสม
      },
      data: {
        power: power,
      },
    });

    res
      .status(200)
      .json({ message: "Power status updated successfully.", updatedRow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update power status" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
