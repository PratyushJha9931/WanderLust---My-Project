const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.js");
const wrapAsync = require("../utils/wrapAsync.js");

// POST /ai/chat - WanderBot AI conversation endpoint
router.post("/chat", wrapAsync(aiController.handleChat));

// POST /ai/generate-listing - AI Magic Listing Generator for hosts
router.post("/generate-listing", wrapAsync(aiController.generateListing));

// GET /ai/review-insights/:listingId - AI sentiment analysis and review highlights
router.get("/review-insights/:listingId", wrapAsync(aiController.getReviewInsights));

module.exports = router;
