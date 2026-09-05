const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const maptilerClient = require("@maptiler/client");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MAP_TOKEN = process.env.MAP_TOKEN || "t2vmvt25NmBUtc469a1a";
maptilerClient.config.apiKey = MAP_TOKEN;
const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
const categoriesArrayList = ["Trending","Rooms","Iconic Cities","Mountains","Castles","Amazing Pools","Camping","Farms","Arctic"];

async function main() {
  await mongoose.connect(MONGO_URL);
}

main()
  .then(async () => {
    console.log("Connected to DB successfully");
    await initDB();
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("DB connection error:", err);
  });

const initDB = async () => {
  try {
    // 1. Ensure a demo user exists
    let demoUser = await User.findOne({ username: "wanderlust_host" });
    if (!demoUser) {
      demoUser = new User({ email: "host@wanderlust.com", username: "wanderlust_host" });
      demoUser = await User.register(demoUser, "password123");
      console.log("Created demo host user:", demoUser.username);
    }

    await Listing.deleteMany({});
    console.log("Cleared existing listings...");

    const locationCoords = {
      "Malibu": [-118.7798, 34.0259],
      "New York City": [-74.0060, 40.7128],
      "Aspen": [-106.8175, 39.1911],
      "Florence": [11.2558, 43.7696],
      "Banff": [-115.5708, 51.1784],
      "Serengeti": [34.8333, -2.3333],
      "Santorini": [25.4615, 36.3932],
      "Kyoto": [135.7681, 35.0116],
      "Zermatt": [7.7491, 45.9765],
      "Bali": [115.1889, -8.4095]
    };

    const updatedData = [];
    let index = 0;

    for (let obj of initData.data) {
      let coords = locationCoords[obj.location] || [77.4126, 23.2599];

      updatedData.push({
        ...obj,
        owner: demoUser._id,
        category: obj.category || categoriesArrayList[index % categoriesArrayList.length],
        geometry: {
          type: "Point",
          coordinates: coords
        }
      });
      index++;
    }

    await Listing.insertMany(updatedData);
    console.log(`Successfully initialized ${updatedData.length} listings with verified coordinates and valid owner!`);
  } catch (err) {
    console.error("Error initializing DB:", err);
  }
};