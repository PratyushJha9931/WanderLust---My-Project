const mongoose = require("mongoose");
const initData=require("./data.js");
const Listing = require("../models/listing.js");
const maptilerClient = require("@maptiler/client");


maptilerClient.config.apiKey = "t2vmvt25NmBUtc469a1a";
const MONGO_URL="mongodb://127.0.0.1:27017/wanderlust";
const categoriesArrayList = ["Trending","Rooms","Iconic Cities","Mountains","Castles","Amazing Pools","Camping","Farms","Arctic"];

main()
  .then(()=>{
    console.log("connected to DB");
  })
  .catch((err)=>{
    console.log(err);
  });

  async function main(){
    await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
    await Listing.deleteMany({});
    
    console.log("Fetching coordinates from MapTiler API for all listings... Please wait...");

    const updatedData = [];

    let index=0;
    for (let obj of initData.data) {
        try {
            const geoResponse = await maptilerClient.geocoding.forward(obj.location, { limit: 1 });
            
            let coords = [77.4126, 23.2599];
            
            if (geoResponse.features && geoResponse.features.length > 0) {
                coords = geoResponse.features[0].geometry.coordinates;
            }

            updatedData.push({
                ...obj,
                owner: "6a279106c5bbb2455a7d810d",
                category: categoriesArrayList[index % categoriesArrayList.length],
                geometry: {
                    type: "Point",
                    coordinates: coords
                }
            });
            index++;
        } catch (err) {
            console.error(`Failed to fetch coordinates for: ${obj.location}. Error:`, err);
        }
    }

    await Listing.insertMany(updatedData);
    console.log("data was initialized with dynamic coordinates!");
};

initDB();