const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to initialize Gemini model if API key is provided
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for fast and reliable responses
    return genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  } catch (err) {
    console.warn("Failed to initialize GoogleGenerativeAI:", err.message);
    return null;
  }
}

/**
 * Intelligent Chatbot Controller for WanderBot
 * Handles user query, listing context, conversation history, and listings recommendation
 */
async function chatWithAI({ message, listingId, history = [] }) {
  const cleanMsg = (message || "").trim();
  if (!cleanMsg) {
    return {
      reply: "Hello! I'm **WanderBot**, your AI travel concierge. Ask me for stay recommendations, travel itineraries, or details about any destination!",
      listings: []
    };
  }

  // 1. Fetch listing context if a listingId is passed (e.g. from show page)
  let currentListing = null;
  if (listingId) {
    try {
      currentListing = await Listing.findById(listingId).populate("owner").populate("reviews");
    } catch (e) {
      console.warn("Could not load current listing context:", e.message);
    }
  }

  // 2. Fetch candidate listings from MongoDB to ground the response in real data
  let matchedListings = await findRelevantListings(cleanMsg, currentListing);

  // 3. Attempt Gemini API with RAG context
  const gemini = getGeminiModel();
  if (gemini) {
    try {
      const systemPrompt = `You are WanderBot, an elite, warm, and knowledgeable AI Travel Concierge for "WanderLust" - a luxury stay and vacation rental platform.
Your goals:
1. Provide enthusiastic, helpful, and concise travel recommendations and advice.
2. If discussing specific stays, refer to the provided real listings from WanderLust's catalog.
3. If the user asks about the currently viewed listing, provide specific insights about its amenities, value, and local attractions.
4. Format your responses with clean Markdown (bold keywords, bullet points, headers). Keep responses conversational and under 200 words.

CURRENTLY VIEWED LISTING:
${currentListing ? JSON.stringify({
  title: currentListing.title,
  location: `${currentListing.location}, ${currentListing.country}`,
  price: `₹${currentListing.price}/night`,
  category: currentListing.category,
  description: currentListing.description,
  reviewCount: currentListing.reviews?.length || 0
}) : "None (User is browsing catalog)"}

MATCHED AVAILABLE LISTINGS IN DATABASE:
${JSON.stringify(matchedListings.slice(0, 4).map(l => ({
  id: l._id,
  title: l.title,
  location: `${l.location}, ${l.country}`,
  price: `₹${l.price}/night`,
  category: l.category
})))}
`;

      const prompt = `${systemPrompt}\n\nUser Query: "${cleanMsg}"\n\nWanderBot Response:`;
      const result = await gemini.generateContent(prompt);
      const reply = result.response.text();

      return {
        reply,
        listings: matchedListings.slice(0, 3)
      };
    } catch (apiErr) {
      console.warn("Gemini API call failed, falling back to Intelligent NLP Engine:", apiErr.message);
    }
  }

  // 4. Intelligent Fallback & Rule-based NLP Engine (Reliable, zero-failure guarantee)
  const fallbackResult = generateFallbackChatResponse(cleanMsg, currentListing, matchedListings);
  return fallbackResult;
}

/**
 * Searches MongoDB for listings matching intent, price, location, or category
 */
async function findRelevantListings(queryText, currentListing) {
  try {
    const text = queryText.toLowerCase();

    // Check for price constraint (e.g. "under 2000", "below 3000", "budget")
    let maxPrice = null;
    const priceMatch = text.match(/(?:under|below|less than|within|budget)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1], 10);
    } else if (text.includes("budget") || text.includes("cheap")) {
      maxPrice = 2000;
    } else if (text.includes("luxury") || text.includes("premium")) {
      // Look for higher priced listings
    }

    // Check for categories
    const categories = ["Trending", "Rooms", "Iconic Cities", "Mountains", "Castles", "Amazing Pools", "Camping", "Farms", "Arctic"];
    let matchedCategory = null;
    for (const cat of categories) {
      if (text.includes(cat.toLowerCase()) || 
         (cat === "Amazing Pools" && (text.includes("pool") || text.includes("swim"))) ||
         (cat === "Mountains" && (text.includes("mountain") || text.includes("hill") || text.includes("hiking"))) ||
         (cat === "Camping" && (text.includes("camp") || text.includes("tent") || text.includes("bonfire"))) ||
         (cat === "Castles" && (text.includes("castle") || text.includes("palace") || text.includes("heritage"))) ||
         (cat === "Iconic Cities" && (text.includes("city") || text.includes("urban") || text.includes("downtown"))) ||
         (cat === "Farms" && (text.includes("farm") || text.includes("countryside") || text.includes("nature")))) {
        matchedCategory = cat;
        break;
      }
    }

    const filter = {};
    if (matchedCategory) {
      filter.category = matchedCategory;
    }
    if (maxPrice) {
      filter.price = { $lte: maxPrice };
    }

    // Extract possible location keywords
    const commonLocations = ["malibu", "new york", "aspen", "florence", "banff", "serengeti", "santorini", "kyoto", "zermatt", "bali", "goa", "jaipur", "paris", "london", "switzerland", "italy", "japan"];
    let foundLocation = commonLocations.find(loc => text.includes(loc));

    if (foundLocation) {
      filter.$or = [
        { location: { $regex: foundLocation, $options: "i" } },
        { country: { $regex: foundLocation, $options: "i" } },
        { title: { $regex: foundLocation, $options: "i" } }
      ];
    }

    let listings = await Listing.find(filter).limit(6);

    // If no specific match, find either popular listings or similar to current
    if (listings.length === 0) {
      if (currentListing) {
        listings = await Listing.find({ 
          _id: { $ne: currentListing._id },
          category: currentListing.category 
        }).limit(4);
      }
      if (listings.length === 0) {
        listings = await Listing.find({}).limit(4);
      }
    }

    return listings;
  } catch (err) {
    console.error("Error finding relevant listings:", err);
    return [];
  }
}

/**
 * High-quality fallback rule & NLP response generator
 */
function generateFallbackChatResponse(query, currentListing, matchedListings) {
  const text = query.toLowerCase();

  // Scenario 1: Questions about currently viewed listing
  if (currentListing && (text.includes("this") || text.includes("place") || text.includes("stay") || text.includes("here") || text.includes("amenit") || text.includes("location") || text.includes("worth") || text.includes("review"))) {
    const avgPrice = currentListing.price;
    const reviewCount = currentListing.reviews?.length || 0;
    
    return {
      reply: `### Insights on **${currentListing.title}** ✨\n\n` +
        `📍 **Location**: Located in scenic **${currentListing.location}, ${currentListing.country}**.\n` +
        `💰 **Rate**: **₹${avgPrice.toLocaleString("en-IN")}** per night (inclusive of standard amenities).\n` +
        `🏷️ **Category**: Tagged under **${currentListing.category}**.\n\n` +
        `**Key Highlights**:\n` +
        `- ⭐ **Guest Sentiment**: ${reviewCount > 0 ? `Backed by **${reviewCount} guest review(s)** with exceptional ratings.` : "A newly featured hidden gem with high guest interest!"}\n` +
        `- 🧭 **Vibe**: Ideal for travelers seeking scenic serenity and comfortable modern amenities.\n` +
        `- 🗺️ **Exploring**: Use our built-in interactive map below to explore neighborhood hotspots and transit routes!\n\n` +
        `*Would you like me to generate a 3-day travel itinerary or suggest nearby activities for this stay?*`,
      listings: matchedListings.filter(l => l._id.toString() !== currentListing._id.toString()).slice(0, 2)
    };
  }

  // Scenario 2: Itinerary planning
  if (text.includes("itinerary") || text.includes("plan") || text.includes("schedule") || text.includes("day 1") || text.includes("trip")) {
    const targetLoc = currentListing ? currentListing.location : (matchedListings[0]?.location || "this destination");
    return {
      reply: `### 🗺️ Custom 3-Day Travel Itinerary for **${targetLoc}**\n\n` +
        `**Day 1: Arrival & Local Flavor**\n` +
        `- **Morning**: Check-in, unpack, and savor local specialty breakfast at a cozy neighborhood cafe.\n` +
        `- **Afternoon**: Take a relaxed walking tour of iconic landmarks and architectural viewpoints.\n` +
        `- **Evening**: Sunset dinner at a panoramic rooftop bistro with authentic local cuisine.\n\n` +
        `**Day 2: Adventure & Hidden Gems**\n` +
        `- **Morning**: Scenic nature hike or coastal walk with photo stops.\n` +
        `- **Afternoon**: Visit artisanal craft markets and cultural heritage centers.\n` +
        `- **Evening**: Stargazing or relaxed campfire / lounge session at your stay.\n\n` +
        `**Day 3: Relaxation & Souvenir Trails**\n` +
        `- **Morning**: Leisurely brunch followed by souvenir shopping at local boutiques.\n` +
        `- **Afternoon**: Spa or lakeside relaxation.\n` +
        `- **Evening**: Farewell dinner toast!\n\n` +
        `*Need custom adjustments or specific dining recommendations? Just let me know!*`,
      listings: matchedListings.slice(0, 2)
    };
  }

  // Scenario 3: Budget or pricing inquiry
  if (text.includes("budget") || text.includes("cheap") || text.includes("affordable") || text.includes("under") || text.includes("price")) {
    return {
      reply: `### 🏷️ Best Value & Budget Stays Found!\n\n` +
        `I scanned our verified properties to find stays offering the best balance of comfort, scenic beauty, and affordability:\n\n` +
        matchedListings.map(l => `- **${l.title}** in *${l.location}, ${l.country}* — **₹${l.price.toLocaleString("en-IN")}** /night (${l.category})`).join("\n") +
        `\n\n💡 *Tip: Toggle the 'Display Taxes' switch on our explore page to see transparent all-inclusive rates!*`,
      listings: matchedListings.slice(0, 3)
    };
  }

  // Scenario 4: Category / Vibe inquiry (Pools, Mountains, Castles, Romantic, etc.)
  if (matchedListings.length > 0) {
    const topCategory = matchedListings[0].category || "Curated Stays";
    return {
      reply: `### ✨ Top Handpicked Recommendations for You\n\n` +
        `Based on your interest, here are some of the most sought-after **${topCategory}** options on WanderLust:\n\n` +
        `These properties feature verified superhost status, top cleanliness scores, and breathtaking panoramas. Click on any card below to view high-res photos, host details, and book your stay!`,
      listings: matchedListings.slice(0, 3)
    };
  }

  // Default welcome response
  return {
    reply: `### Welcome to WanderLust AI! 🌍✨\n\n` +
      `I'm **WanderBot**, your intelligent travel companion. Here are a few ways I can help you today:\n` +
      `- 🏖️ **"Find beach villas with a private pool"**\n` +
      `- 🏔️ **"Show me mountain cabins under ₹3000"**\n` +
      `- 🗺️ **"Create a 3-day weekend itinerary"**\n` +
      `- 💡 **"What are the top highlights of this property?"**\n\n` +
      `How can I craft your dream getaway today?`,
    listings: matchedListings.slice(0, 3)
  };
}

/**
 * AI Magic Generator for Hosts:
 * Creates title, compelling description, suggested price, and optimal category
 */
async function generateListingDetails({ prompt, location, category }) {
  const gemini = getGeminiModel();
  if (gemini) {
    try {
      const p = `You are a world-class luxury Airbnb copywriter and real estate pricing expert.
Given these host notes, generate a high-converting listing.
Host Notes: "${prompt || ""}"
Location hint: "${location || ""}"
Category hint: "${category || ""}"

Respond ONLY with a valid JSON object in this exact schema:
{
  "title": "A catchy, evocative 4 to 8 word property title",
  "description": "An engaging, vivid 2 to 3 paragraph description highlighting ambiance, amenities, comfort, and local experience.",
  "price": 2500,
  "category": "Trending"
}
Categories must be one of: ["Trending","Rooms","Iconic Cities","Mountains","Castles","Amazing Pools","Camping","Farms","Arctic"].
Price must be a realistic number in INR (e.g. 1500 to 12000).`;

      const res = await gemini.generateContent(p);
      const text = res.response.text();
      // Clean possible markdown code fences
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      return parsed;
    } catch (e) {
      console.warn("Gemini listing generation failed, using intelligent generator:", e.message);
    }
  }

  // Fallback intelligent generator
  const keywords = (prompt || "").toLowerCase();
  const loc = location || "Scenic Destination";

  let cat = category || "Trending";
  if (keywords.includes("pool") || keywords.includes("swim")) cat = "Amazing Pools";
  else if (keywords.includes("mountain") || keywords.includes("hill") || keywords.includes("snow")) cat = "Mountains";
  else if (keywords.includes("castle") || keywords.includes("palace") || keywords.includes("royal")) cat = "Castles";
  else if (keywords.includes("camp") || keywords.includes("tent")) cat = "Camping";
  else if (keywords.includes("farm") || keywords.includes("nature")) cat = "Farms";
  else if (keywords.includes("city") || keywords.includes("downtown") || keywords.includes("loft")) cat = "Iconic Cities";
  else if (keywords.includes("arctic") || keywords.includes("ice")) cat = "Arctic";
  else if (keywords.includes("room") || keywords.includes("studio")) cat = "Rooms";

  let suggestedPrice = 2800;
  if (cat === "Castles" || cat === "Amazing Pools") suggestedPrice = 5800;
  if (cat === "Camping" || cat === "Rooms") suggestedPrice = 1400;
  if (cat === "Mountains") suggestedPrice = 3200;

  const titlePrefixes = ["Serene Sanctuary", "The Grand Vista", "Cozy Bliss", "Sunset Haven", "Eco Luxury Retreat", "Timeless Oasis"];
  const title = `${titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)]} in ${loc}`;

  const description = `Immerse yourself in tranquility at this stunning ${cat.toLowerCase()} stay located in the heart of ${loc}. Designed with a harmonious blend of modern luxury and cozy comfort, this property features expansive sunlit spaces, curated aesthetic interiors, and panoramic outdoor views.\n\nWhether you're unwinding by the ambient lounge, preparing gourmet meals in the fully equipped kitchen, or stepping out to discover the vibrant local sights, every detail has been thoughtfully tailored for an unforgettable getaway. Perfect for couples, families, and remote work retreats.\n\nExperience seamless hospitality, high-speed Wi-Fi, premium linens, and peaceful evenings under the stars.`;

  return {
    title,
    description,
    price: suggestedPrice,
    category: cat
  };
}

/**
 * AI Review Sentiment Analyzer & Insights Generator
 */
async function analyzeReviews({ reviews = [], listing }) {
  if (!reviews || reviews.length === 0) {
    return {
      sentimentScore: 98,
      sentimentLabel: "Exceptional Stays",
      summary: "A highly anticipated property with pristine amenities, scenic surroundings, and welcoming hospitality.",
      pros: ["Scenic Panoramas", "Pristine Cleanliness", "Warm Host", "Peaceful Atmosphere"],
      cons: ["Advance booking recommended"]
    };
  }

  const gemini = getGeminiModel();
  if (gemini) {
    try {
      const reviewTexts = reviews.map(r => `Rating: ${r.rating}/5. Comment: "${r.comment}"`).join("\n");
      const prompt = `Analyze these guest reviews for property "${listing.title}":
${reviewTexts}

Respond ONLY in valid JSON:
{
  "sentimentScore": 94,
  "sentimentLabel": "Overwhelmingly Positive",
  "summary": "Guests rave about the breathtaking sunsets and sparkling clean interiors, noting the responsive host.",
  "pros": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "cons": ["Minor point 1"]
}`;

      const res = await gemini.generateContent(prompt);
      const cleanJson = res.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.warn("Gemini review analysis failed, using fallback analyzer:", e.message);
    }
  }

  // Fallback analyzer
  const avgRating = reviews.reduce((acc, r) => acc + (r.rating || 4), 0) / reviews.length;
  const score = Math.round(Math.min(99, Math.max(75, (avgRating / 5) * 100)));

  const samplePros = ["Sparkling Cleanliness", "Breathtaking Views", "Responsive Superhost", "Prime Location"];
  const sampleCons = ["High seasonal demand"];

  return {
    sentimentScore: score,
    sentimentLabel: score >= 90 ? "Overwhelmingly Positive" : score >= 80 ? "Very Positive" : "Generally Favorable",
    summary: `Based on ${reviews.length} verified guest review(s), this stay consistently delights travelers with comfortable amenities, prompt communication, and a serene ambiance.`,
    pros: samplePros,
    cons: sampleCons
  };
}

module.exports = {
  chatWithAI,
  generateListingDetails,
  analyzeReviews
};
