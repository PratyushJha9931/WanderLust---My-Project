const aiService = require("../utils/aiService.js");
const Listing = require("../models/listing.js");

module.exports.handleChat = async (req, res) => {
  try {
    const { message, listingId, history } = req.body;
    const result = await aiService.chatWithAI({ message, listingId, history });
    res.json({
      success: true,
      reply: result.reply,
      listings: result.listings || []
    });
  } catch (err) {
    console.error("Error in AI chat controller:", err);
    res.status(500).json({
      success: false,
      reply: "I encountered a minor glitch while processing your request. Please try again!",
      listings: []
    });
  }
};

module.exports.generateListing = async (req, res) => {
  try {
    const { prompt, location, category } = req.body;
    const generated = await aiService.generateListingDetails({ prompt, location, category });
    res.json({
      success: true,
      data: generated
    });
  } catch (err) {
    console.error("Error generating listing with AI:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate listing details. Please try again."
    });
  }
};

module.exports.getReviewInsights = async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await Listing.findById(listingId).populate("reviews");
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const insights = await aiService.analyzeReviews({
      reviews: listing.reviews || [],
      listing
    });

    res.json({
      success: true,
      insights
    });
  } catch (err) {
    console.error("Error getting review insights:", err);
    res.status(500).json({
      success: false,
      message: "Could not generate review insights at this time."
    });
  }
};
