const Listing = require("../models/Listing");
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAP_TOKEN;

module.exports.index = async (req, res) => {
    const { category, search } = req.query;
    let query = {};

    // 1. Safe Category Filtering
    if (category && category.trim() !== "") {
        query.category = category;
    }

    // 2. Safe Search Handling (Ensures search isn't undefined or empty)
    if (search && search.trim() !== "") {
        const cleanSearch = search.trim();
        const searchRegex = new RegExp(cleanSearch, "i"); 
        
        let searchConditions = [
            { title: { $regex: searchRegex } },
            { location: { $regex: searchRegex } },
            { country: { $regex: searchRegex } }
        ];

        const parsedPrice = Number(cleanSearch);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
            searchConditions.push({ price: { $lte: parsedPrice } });
        }

        query.$or = searchConditions;
    }

    // 3. Database Query execution
    let allListings = await Listing.find(query);

    // 4. Safe Flash & Redirection check
    if (search && search.trim() !== "" && allListings.length === 0) {
        if (typeof req.flash === "function") {
            req.flash("error", `No listings found matching "${search}"`);
        }
        return res.redirect("/listings");
    }

    // 5. Render view template safely
    res.render("listings/index.ejs", { 
        allListings, 
        activeCategory: category || "" 
    });
};

module.exports.renderNewForm = (req,res)=>{
  res.render("listings/new.ejs")
};

module.exports.showListing = async(req,res)=>{
  let {id}=req.params;
  const listing= await Listing.findById(id)
  .populate({path:"reviews",populate:{path:"author"},})
  .populate("owner");
  if(!listing){
    req.flash("error","Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/show.ejs",{listing , mapToken : process.env.MAP_TOKEN});
};

module.exports.createListing = async(req,res,next)=>{
  const geoResponse = await maptilerClient.geocoding.forward(req.body.listing.location,{limit:1});
  let url= req.file.path;
  let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url,filename};

    if(geoResponse.features && geoResponse.features.length > 0){
      newListing.geometry = geoResponse.features[0].geometry;
    }
    else{
      newListing.geometry = {type: "Point",coordinates: [77.4126,23.2599]};
    }

    await newListing.save();
    req.flash("success","New Listing Created!");
    res.redirect("/listings");
};

module.exports.renderEditForm = async(req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    if(!listing){
      req.flash("error","Listing you requested for does not exist!");
      return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs",{listing , originalImageUrl});
};

module.exports.updateListing = async(req,res)=>{
  let {id}= req.params;
  let listing = await Listing.findByIdAndUpdate(id,{...req.body.listing});

  const geoResponse = await maptilerClient.geocoding.forward(req.body.listing.location,{limit : 1});
  if(geoResponse.features && geoResponse.features.length > 0){
    listing.geometry = geoResponse.features[0].geometry;
  }
  if(typeof req.file != "undefined"){
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = {url,filename};
  }
  await listing.save();
  req.flash("success","Listing Updated!");
  res.redirect(`/listings/${id}`);
};  

module.exports.destroyListing = async(req,res)=>{
  let {id}=req.params;
  let deletedListing= await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success","Listing Deleted!");
  res.redirect("/listings");
};