const Listing = require("../models/listing");
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAP_TOKEN || "t2vmvt25NmBUtc469a1a";

module.exports.index = async (req, res) => {
    const { category, search } = req.query;
    let query = {};

    // 1. Safe Category Filtering
    if (category && category.trim() !== "") {
        query.category = category;
    }

    // 2. Safe Search Handling
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

    // 4. Render view template safely
    res.render("listings/index.ejs", { 
        allListings, 
        activeCategory: category || "" 
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");
        
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/show.ejs", { 
        listing, 
        mapToken: process.env.MAP_TOKEN || "t2vmvt25NmBUtc469a1a" 
    });
};

module.exports.createListing = async (req, res, next) => {
    let coords = [77.4126, 23.2599];
    try {
        const geoResponse = await maptilerClient.geocoding.forward(req.body.listing.location, { limit: 1 });
        if (geoResponse.features && geoResponse.features.length > 0) {
            coords = geoResponse.features[0].geometry.coordinates;
        }
    } catch (geoErr) {
        console.warn("Geocoding failed, using fallback coordinates:", geoErr.message);
    }

    let url = req.file ? req.file.path : "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=60";
    let filename = req.file ? req.file.filename : "default_listing_image";

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    newListing.geometry = { type: "Point", coordinates: coords };

    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image?.url || "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=60";
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    try {
        const geoResponse = await maptilerClient.geocoding.forward(req.body.listing.location, { limit: 1 });
        if (geoResponse.features && geoResponse.features.length > 0) {
            listing.geometry = geoResponse.features[0].geometry;
        }
    } catch (geoErr) {
        console.warn("Geocoding update error, maintaining current coordinates");
    }

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename };
    }
    await listing.save();
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};  

module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log("Deleted Listing:", deletedListing?._id);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};