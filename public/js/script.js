/**
 * WanderLust AI - Client Controller
 * Handles Theme Switching, Bootstrap Form Validation, WanderBot AI Chatbot,
 * AI Magic Listing Generator, Category Filters, and Interactive Micro-animations.
 */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // =========================================================================
  // 1. Bootstrap Form Validation (Fixed IIFE)
  // =========================================================================
  const forms = document.querySelectorAll(".needs-validation");
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add("was-validated");
      },
      false
    );
  });

  // =========================================================================
  // 2. Dark / Light Mode Theme Toggle with Persistence
  // =========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const htmlRoot = document.documentElement;
  const moonIcon = document.querySelector(".theme-icon-moon");
  const sunIcon = document.querySelector(".theme-icon-sun");

  function applyTheme(theme) {
    htmlRoot.setAttribute("data-theme", theme);
    localStorage.setItem("wanderlust-theme", theme);
    if (theme === "dark") {
      moonIcon?.classList.add("d-none");
      sunIcon?.classList.remove("d-none");
    } else {
      sunIcon?.classList.add("d-none");
      moonIcon?.classList.remove("d-none");
    }
  }

  // Initialize theme from storage or system preference
  const savedTheme = localStorage.getItem("wanderlust-theme") || 
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(savedTheme);

  themeToggleBtn?.addEventListener("click", () => {
    const currentTheme = htmlRoot.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  // =========================================================================
  // 3. Category Filter Ribbon Horizontal Scroll
  // =========================================================================
  const filterTrack = document.getElementById("filters");
  const scrollLeftBtn = document.getElementById("filter-scroll-left");
  const scrollRightBtn = document.getElementById("filter-scroll-right");

  scrollLeftBtn?.addEventListener("click", () => {
    filterTrack?.scrollBy({ left: -260, behavior: "smooth" });
  });

  scrollRightBtn?.addEventListener("click", () => {
    filterTrack?.scrollBy({ left: 260, behavior: "smooth" });
  });

  // =========================================================================
  // 4. Tax Display Switch Toggle
  // =========================================================================
  const taxSwitch = document.getElementById("taxSwitchCheck");
  taxSwitch?.addEventListener("change", () => {
    const taxBadges = document.querySelectorAll(".tax-info-badge");
    taxBadges.forEach((badge) => {
      if (taxSwitch.checked) {
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    });
  });

  // =========================================================================
  // 5. Wishlist Heart Pop Interaction
  // =========================================================================
  const wishlistButtons = document.querySelectorAll(".btn-wishlist-heart, .btn-wishlist-detail");
  wishlistButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const unfilled = btn.querySelector(".fa-regular.fa-heart, .heart-unfilled");
      const filled = btn.querySelector(".fa-solid.fa-heart, .heart-filled");

      if (unfilled && filled) {
        unfilled.classList.toggle("d-none");
        filled.classList.toggle("d-none");
      } else {
        btn.classList.toggle("active-saved");
      }

      btn.classList.add("pop-animation");
      setTimeout(() => btn.classList.remove("pop-animation"), 400);
    });
  });

  // =========================================================================
  // 6. Password Visibility Toggle
  // =========================================================================
  const togglePassBtns = document.querySelectorAll(".toggle-password-btn");
  togglePassBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.getAttribute("data-target");
      const targetInput = document.querySelector(targetSelector);
      const icon = btn.querySelector("i");
      if (targetInput) {
        if (targetInput.type === "password") {
          targetInput.type = "text";
          icon?.classList.replace("fa-eye", "fa-eye-slash");
        } else {
          targetInput.type = "password";
          icon?.classList.replace("fa-eye-slash", "fa-eye");
        }
      }
    });
  });

  // =========================================================================
  // 7. Live Image Upload Preview
  // =========================================================================
  const imageInput = document.getElementById("image");
  const imagePreview = document.getElementById("image-preview");
  const imagePreviewWrapper = document.getElementById("image-preview-wrapper");

  imageInput?.addEventListener("change", function () {
    const file = this.files && this.files[0];
    if (file && imagePreview && imagePreviewWrapper) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreviewWrapper.classList.remove("d-none");
      };
      reader.readAsDataURL(file);
    }
  });

  // =========================================================================
  // 8. AI Magic Listing Generator (Host Forms)
  // =========================================================================
  const btnAiGenerate = document.getElementById("btn-ai-generate");
  const aiPromptInput = document.getElementById("ai-prompt-input");
  const aiGenStatus = document.getElementById("ai-gen-status");

  btnAiGenerate?.addEventListener("click", async () => {
    const prompt = aiPromptInput?.value.trim() || "";
    const locationVal = document.getElementById("location")?.value.trim() || "";
    const categoryVal = document.getElementById("category")?.value || "";

    if (!prompt && !locationVal) {
      alert("Please enter a few keywords in the AI box (e.g. 'Cozy mountain cabin in Manali with fireplace') to generate details!");
      aiPromptInput?.focus();
      return;
    }

    if (aiGenStatus) aiGenStatus.classList.remove("d-none");
    btnAiGenerate.disabled = true;

    try {
      const response = await fetch("/ai/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          location: locationVal,
          category: categoryVal
        })
      });

      const result = await response.json();
      if (result.success && result.data) {
        const titleInput = document.getElementById("title");
        const descInput = document.getElementById("description");
        const priceInput = document.getElementById("price");
        const catSelect = document.getElementById("category");

        if (titleInput && result.data.title) {
          titleInput.value = result.data.title;
          highlightField(titleInput);
        }
        if (descInput && result.data.description) {
          descInput.value = result.data.description;
          highlightField(descInput);
        }
        if (priceInput && result.data.price) {
          priceInput.value = result.data.price;
          highlightField(priceInput);
        }
        if (catSelect && result.data.category) {
          catSelect.value = result.data.category;
          highlightField(catSelect);
        }
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      alert("Could not generate listing details right now. Please fill manually.");
    } finally {
      if (aiGenStatus) aiGenStatus.classList.add("d-none");
      btnAiGenerate.disabled = false;
    }
  });

  function highlightField(el) {
    el.style.transition = "background-color 0.4s ease, border-color 0.4s ease";
    el.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
    el.style.borderColor = "var(--brand-indigo)";
    setTimeout(() => {
      el.style.backgroundColor = "";
      el.style.borderColor = "";
    }, 1200);
  }

  // =========================================================================
  // 9. WanderBot AI Chatbot Controller
  // =========================================================================
  const wanderbotToggleBtn = document.getElementById("wanderbot-toggle-btn");
  const wanderbotModal = document.getElementById("wanderbot-modal");
  const wanderbotCloseBtn = document.getElementById("wanderbot-close-btn");
  const wanderbotClearBtn = document.getElementById("wanderbot-clear-btn");
  const wanderbotForm = document.getElementById("wanderbot-form");
  const wanderbotInput = document.getElementById("wanderbot-input");
  const wanderbotMessages = document.getElementById("wanderbot-messages");
  const wanderbotTyping = document.getElementById("wanderbot-typing");
  const wanderbotContextBar = document.getElementById("wanderbot-context-bar");
  const wanderbotContextText = document.getElementById("wanderbot-context-text");
  const fabAiIcon = document.querySelector(".fab-ai-icon");
  const fabCloseIcon = document.querySelector(".fab-close-icon");

  let activeListingId = null;
  let conversationHistory = [];

  // Detect if user is on a listing show page
  const insightsBox = document.getElementById("ai-insights-box");
  if (insightsBox && insightsBox.dataset.listingId) {
    activeListingId = insightsBox.dataset.listingId;
    if (wanderbotContextBar && wanderbotContextText) {
      wanderbotContextBar.classList.remove("d-none");
      const pageTitle = document.querySelector(".listing-main-title")?.textContent.trim();
      wanderbotContextText.textContent = pageTitle ? `Viewing: ${pageTitle}` : "Active property context connected";
    }
  }

  function openWanderBot(prefillPrompt = null) {
    wanderbotModal?.classList.remove("d-none");
    fabAiIcon?.classList.add("d-none");
    fabCloseIcon?.classList.remove("d-none");
    wanderbotInput?.focus();

    if (prefillPrompt) {
      if (wanderbotInput) wanderbotInput.value = prefillPrompt;
      handleSendMessage(prefillPrompt);
    }
  }

  function closeWanderBot() {
    wanderbotModal?.classList.add("d-none");
    fabCloseIcon?.classList.add("d-none");
    fabAiIcon?.classList.remove("d-none");
  }

  wanderbotToggleBtn?.addEventListener("click", () => {
    if (wanderbotModal?.classList.contains("d-none")) {
      openWanderBot();
    } else {
      closeWanderBot();
    }
  });

  wanderbotCloseBtn?.addEventListener("click", closeWanderBot);

  // Connect external buttons to open WanderBot
  document.getElementById("hero-ask-ai-btn")?.addEventListener("click", () => openWanderBot());
  document.getElementById("nav-ai-search-btn")?.addEventListener("click", () => openWanderBot("Suggest top trending stays in beautiful locations"));
  document.getElementById("empty-state-ai-btn")?.addEventListener("click", () => openWanderBot("Recommend budget vacation stays with great views"));
  document.getElementById("trigger-wanderbot-menu")?.addEventListener("click", () => openWanderBot());

  const askStayBtn = document.getElementById("ask-ai-about-this-stay");
  askStayBtn?.addEventListener("click", () => {
    const stayTitle = askStayBtn.dataset.listingTitle || "this stay";
    openWanderBot(`What are the key highlights and guest impressions of ${stayTitle}?`);
  });

  // Clear chat
  wanderbotClearBtn?.addEventListener("click", () => {
    if (wanderbotMessages) {
      wanderbotMessages.innerHTML = `
        <div class="chat-msg bot-msg">
          <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
          <div class="msg-bubble">
            <p class="greeting-intro">
              Conversation reset! 🌟 How can I help you discover your next dream stay?
            </p>
          </div>
        </div>
      `;
      conversationHistory = [];
    }
  });

  // Handle Quick Prompts
  document.querySelectorAll(".quick-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const promptText = pill.dataset.prompt;
      if (promptText) {
        handleSendMessage(promptText);
      }
    });
  });

  // Handle Message Submission
  wanderbotForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = wanderbotInput?.value.trim();
    if (query) {
      handleSendMessage(query);
    }
  });

  async function handleSendMessage(text) {
    if (!text) return;
    if (wanderbotInput) wanderbotInput.value = "";

    // 1. Render user message bubble
    appendChatBubble("user", text);

    // 2. Show typing indicator & scroll
    if (wanderbotTyping) wanderbotTyping.classList.remove("d-none");
    scrollToBottom();

    // 3. Dispatch to AI service
    try {
      const res = await fetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          listingId: activeListingId,
          history: conversationHistory
        })
      });

      const data = await res.json();
      if (wanderbotTyping) wanderbotTyping.classList.add("d-none");

      if (data.success) {
        appendChatBubble("bot", data.reply, data.listings);
        conversationHistory.push({ role: "user", content: text });
        conversationHistory.push({ role: "assistant", content: data.reply });
      } else {
        appendChatBubble("bot", data.reply || "Sorry, I had trouble processing that. Please ask again!");
      }
    } catch (err) {
      console.error("WanderBot fetch error:", err);
      if (wanderbotTyping) wanderbotTyping.classList.add("d-none");
      appendChatBubble("bot", "Network glitch detected. WanderLust AI is reconnecting—please try your prompt once more!");
    }

    scrollToBottom();
  }

  function appendChatBubble(sender, messageText, listings = []) {
    if (!wanderbotMessages) return;

    const msgWrapper = document.createElement("div");
    msgWrapper.className = `chat-msg ${sender}-msg`;

    const avatarHtml = sender === "bot" 
      ? `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>`
      : `<div class="msg-avatar"><i class="fa-solid fa-user"></i></div>`;

    // Render formatted markdown safely using marked or fallback
    let formattedHtml = messageText;
    if (window.marked && typeof window.marked.parse === "function") {
      formattedHtml = window.marked.parse(messageText);
    } else {
      // Basic bold and list parser fallback
      formattedHtml = messageText
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.*?)\*/g, "<i>$1</i>")
        .replace(/\n/g, "<br>");
    }

    // Build embedded listing cards if returned
    let listingsHtml = "";
    if (listings && listings.length > 0) {
      listingsHtml = `<div class="chat-listing-cards">`;
      listings.forEach((item) => {
        const imgUrl = item.image && item.image.url ? item.image.url : "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b";
        const priceStr = item.price ? `₹${item.price.toLocaleString("en-IN")}` : "";
        listingsHtml += `
          <a href="/listings/${item._id}" class="chat-listing-card">
            <img src="${imgUrl}" class="chat-listing-thumb" alt="${item.title}" />
            <div class="chat-listing-info">
              <div class="chat-listing-title text-truncate">${item.title}</div>
              <div class="chat-listing-meta text-truncate">${item.location || ''}, ${item.country || ''}</div>
              <div class="chat-listing-price">${priceStr} <span style="font-size: 0.7rem; color: #94a3b8; font-weight: normal;">/night</span></div>
            </div>
            <i class="fa-solid fa-chevron-right text-muted small me-1"></i>
          </a>
        `;
      });
      listingsHtml += `</div>`;
    }

    msgWrapper.innerHTML = `
      ${avatarHtml}
      <div class="msg-bubble">
        ${formattedHtml}
        ${listingsHtml}
      </div>
    `;

    wanderbotMessages.appendChild(msgWrapper);
  }

  function scrollToBottom() {
    if (wanderbotMessages) {
      wanderbotMessages.scrollTop = wanderbotMessages.scrollHeight;
    }
  }

  // =========================================================================
  // 10. Listing Show Page AI Insights Live Loader
  // =========================================================================
  if (insightsBox && activeListingId) {
    (async () => {
      try {
        const res = await fetch(`/ai/review-insights/${activeListingId}`);
        const data = await res.json();
        if (data.success && data.insights) {
          const scoreNum = document.getElementById("ai-score-num");
          const summaryText = document.getElementById("ai-summary-text");
          const prosContainer = document.getElementById("ai-pros-container");

          if (scoreNum && data.insights.sentimentScore) {
            scoreNum.textContent = `${data.insights.sentimentScore}%`;
          }
          if (summaryText && data.insights.summary) {
            summaryText.textContent = data.insights.summary;
          }
          if (prosContainer && data.insights.pros) {
            let tagsHtml = data.insights.pros.map(p => 
              `<span class="ai-tag tag-pro"><i class="fa-solid fa-circle-check me-1"></i> ${p}</span>`
            ).join("");

            if (data.insights.cons && data.insights.cons.length > 0) {
              tagsHtml += data.insights.cons.map(c => 
                `<span class="ai-tag tag-con"><i class="fa-solid fa-circle-info me-1"></i> ${c}</span>`
              ).join("");
            }
            prosContainer.innerHTML = tagsHtml;
          }
        }
      } catch (err) {
        console.warn("Could not fetch async AI insights:", err);
      }
    })();
  }
});