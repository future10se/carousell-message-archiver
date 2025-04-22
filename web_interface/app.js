document.addEventListener("DOMContentLoaded", () => {
  const chatListContainer = document.getElementById("chat-list-container");
  const messagesContainer = document.getElementById("messages-container");
  const itemDetailsContainer = document.getElementById(
    "item-details-container",
  );

  let allOffers = [];
  let messagesMap = new Map();
  let myUserId = null; // Globally store the ID determined to be "me"

  // --- Helper Functions ---

  /**
   * Calculates a relative local path mirroring the web URL's path.
   * Example: https://media.domain.com/media/photos/abc.jpg -> ./media/photos/abc.jpg
   * @param {string} webUrl The original web URL.
   * @returns {string|null} The calculated relative local path, or null if input is invalid.
   */
  function getLocalPathFromUrl(webUrl) {
    if (!webUrl || typeof webUrl !== "string" || !webUrl.startsWith("http")) {
      // Don't attempt conversion for placeholders, data URIs, or invalid URLs
      return null;
    }
    try {
      const url = new URL(webUrl);
      // Create path like ./pathname/ Rmov leading slash from pathname
      const relativePath = "." + url.pathname;
      return relativePath;
    } catch (e) {
      console.error(`Error creating URL object for: ${webUrl}`, e);
      return null; // Return null if URL parsing fails
    }
  }

  /**
   * Sets an image source, trying a local path first and falling back to the web URL.
   * @param {HTMLImageElement} imgElement The <img> element to update.
   * @param {string} webUrl The original web URL (used for fallback).
   * @param {string} placeholderUrl Optional: A placeholder if both local and web fail.
   */
  function setImageWithFallback(
    imgElement,
    webUrl,
    placeholderUrl = "placeholder-image.png",
  ) {
    // Default placeholder
    const localPath = getLocalPathFromUrl(webUrl);

    if (!localPath) {
      // If no valid local path could be derived (e.g., placeholder, invalid URL), just use the webUrl directly.
      imgElement.src = webUrl || placeholderUrl; // Use placeholder if webUrl is also bad
      return;
    }

    // Define the error handler *before* setting the initial src
    imgElement.onerror = function () {
      // Log failure (optional)
      console.log(
        `Local image failed: ${this.src}. Falling back to: ${webUrl}`,
      );

      // Prevent infinite loops if the web URL also fails.
      // Optionally, set to a final placeholder on second failure.
      this.onerror = function () {
        console.error(`Fallback image failed: ${webUrl}. Using placeholder.`);
        this.onerror = null; // Stop trying
        this.src = placeholderUrl; // Use the final placeholder
      };

      // Set the source to the original web URL
      this.src = webUrl;
    };

    // Try setting the local path first
    imgElement.src = localPath;
    console.log(`Attempting local image: ${localPath}`); // Optional: log attempt
  }

  // --- Data Loading and Cross-Offer "Me" Identification ---
  async function loadData() {
    try {
      const [offersResponse, messagesResponse] = await Promise.all([
        fetch("offers.json"),
        fetch("offers_all_messages.json"),
      ]);

      if (!offersResponse.ok)
        throw new Error(`HTTP error! status: ${offersResponse.status}`);
      if (!messagesResponse.ok)
        throw new Error(`HTTP error! status: ${messagesResponse.status}`);

      allOffers = await offersResponse.json();
      const offerMessagesArray = await messagesResponse.json();

      messagesMap = new Map();
      offerMessagesArray.forEach((item) => {
        if (item.offer_id && Array.isArray(item.messages)) {
          messagesMap.set(item.offer_id, item.messages);
        } else {
          console.warn(
            `Skipping invalid entry in offers_all_messages.json:`,
            item,
          );
        }
      });

      // --- Determine "Me" User ID by checking across offers ---
      // Map to store: user_id -> Set<offer_id>
      const userOfferPresence = new Map();

      offerMessagesArray.forEach((item) => {
        const currentOfferId = item.offer_id;
        if (!currentOfferId || !item.messages) return; // Skip if offer_id or messages are missing
        item.messages.forEach((msg) => {
          if (msg && msg.user && typeof msg.user.user_id !== "undefined") {
            const userId = msg.user.user_id;

            // Get the set of offers this user has appeared in
            const offerSet = userOfferPresence.get(userId) || new Set();
            // Add the current offer_id to their set
            offerSet.add(currentOfferId);
            // Update the map
            userOfferPresence.set(userId, offerSet);
          }
        });
      });

      console.log("User presence across offers:", userOfferPresence);

      // Find the first user ID that appears in more than one offer set
      myUserId = null; // Reset before checking
      for (const [userId, offerSet] of userOfferPresence.entries()) {
        if (offerSet.size > 1) {
          myUserId = userId;
          console.log(
            `Determined 'Me' User ID based on presence in multiple offers: ${myUserId} (Present in ${offerSet.size} offers)`,
          );
          break;
        }
      }

      if (myUserId === null) {
        console.log(
          "Could not determine 'Me' User ID (no user appeared in more than one offer). Defaulting all to 'received'.",
        );
      }
      // --- End "Me" Identification ---

      console.log("Offers loaded:", allOffers);
      console.log("Messages Map created:", messagesMap);

      displayChatList();
      if (allOffers.length > 0) {
        selectChat(allOffers[0].id);
      }
    } catch (error) {
      console.error("Failed to load or process data:", error);
      chatListContainer.innerHTML =
        '<p class="error">Could not load chat list.</p>';
      messagesContainer.innerHTML =
        '<p class="error">Could not load messages.</p>';
      itemDetailsContainer.innerHTML = "";
    }
  }

  // --- UI Population ---

  function displayChatList() {
    chatListContainer.innerHTML = '<div class="chat-list-header">Chats</div>';

    if (!allOffers || allOffers.length === 0) {
      chatListContainer.innerHTML += "<p>No chats found.</p>";
      return;
    }

    allOffers.forEach((offer) => {
      const username = offer.user?.username || "Unknown User"; // [3]
      const avatarUrl =
        offer.user?.profile?.image_url || "placeholder-avatar.png"; // [3]
      const lastMessage = offer.latest_price_message || "No messages yet"; // [3]
      const timestamp = offer.latest_price_created
        ? formatTimestamp(offer.latest_price_created)
        : ""; // [3]

      const previewElement = document.createElement("div");
      previewElement.classList.add("chat-preview");
      previewElement.dataset.offerId = offer.id;

      // Create the img element separately to apply the fallback logic
      const avatarImg = document.createElement("img");
      avatarImg.alt = username;
      avatarImg.classList.add("avatar");
      // Use a specific placeholder for avatars if needed
      setImageWithFallback(avatarImg, avatarUrl, "placeholder-avatar.png");

      previewElement.innerHTML = `
                <!-- Avatar will be inserted here -->
                <div class="chat-info">
                    <div class="username">${username}</div>
                    <div class="message-preview">${lastMessage}</div>
                </div>
                <div class="chat-timestamp">${timestamp}</div>
            `;
      // Prepend the avatar image to the preview element
      previewElement.insertBefore(avatarImg, previewElement.firstChild);

      previewElement.addEventListener("click", () => selectChat(offer.id));
      chatListContainer.appendChild(previewElement);
    });
  }

  function displayItemDetails(offer) {
    const product = offer.product; // [3]
    const user = offer.user; // [3]

    if (!product || !user) {
      itemDetailsContainer.innerHTML =
        '<p class="placeholder">Item or user details not available for this offer.</p>';
      return;
    }

    const imageUrl = product.primary_photo_url || "placeholder-image.png"; // [3]
    const title = product.title || "No Title"; // [3]
    const price = product.price_formatted
      ? `${product.currency_symbol || offer.currency_symbol || ""}${product.price_formatted}` // [3]
      : offer.latest_price_formatted
        ? `${offer.currency_symbol || ""}${offer.latest_price_formatted}`
        : "Price not set"; // [3]
    const sellerName = user.username || "Unknown Seller"; // [3]
    const sellerAvatarUrl = user.profile?.image_url || "placeholder-avatar.png"; // [3] Use specific placeholder
    const location = product.smart_attributes?.city || "Location not specified"; // [3]
    const description =
      product.description || product.title || "No description provided."; // [1, 3]

    // --- Use <img> tag for item-image to enable onerror ---
    itemDetailsContainer.innerHTML = `
            <img class="item-image" id="detail-item-image" alt="${title}"> <!-- Changed to img tag with id -->
            <h2>${title}</h2>
            <div class="price">${price}</div>
            <div class="seller-info">
                <img alt="${sellerName}" class="small-avatar" id="detail-seller-avatar"> <!-- Added id -->
                <span class="username">${sellerName}</span>
            </div>
            <div class="location">${location}</div>
            <div class="description">
                <h3>Details</h3>
                <p>${description}</p>
            </div>
        `;

    // --- Apply fallback logic after setting innerHTML ---
    const itemImgElement = document.getElementById("detail-item-image");
    if (itemImgElement) {
      setImageWithFallback(itemImgElement, imageUrl, "placeholder-image.png");
    }

    const sellerAvatarElement = document.getElementById("detail-seller-avatar");
    if (sellerAvatarElement) {
      // Use avatar placeholder for the seller avatar
      setImageWithFallback(
        sellerAvatarElement,
        sellerAvatarUrl,
        "placeholder-avatar.png",
      );
    }
  }

  // displayMessages remains the same (using corrected timestamp logic)
  function displayMessages(offerId) {
    messagesContainer.innerHTML = "";

    const messages = messagesMap.get(offerId);

    if (!messages || messages.length === 0) {
      console.log(`No messages found for offer ID: ${offerId}`);
      messagesContainer.innerHTML =
        '<p class="placeholder">No messages in this chat yet.</p>';
      return;
    }

    let lastDate = "";
    messages.forEach((msg) => {
      if (
        !msg ||
        !msg.user ||
        typeof msg.user.user_id === "undefined" ||
        typeof msg.created_at === "undefined"
      ) {
        console.warn("Skipping malformed or incomplete message object:", msg);
        return;
      }

      const messageDateObj = new Date(msg.created_at); // [2] Assume milliseconds

      // Check if the date is valid after creation
      if (isNaN(messageDateObj.getTime())) {
        console.warn(
          "Skipping message with invalid created_at timestamp:",
          msg,
        );
        return;
      }

      const messageDate = messageDateObj.toLocaleDateString(); // [1]
      if (messageDate !== lastDate) {
        const dateSeparator = document.createElement("div");
        dateSeparator.classList.add("date-separator");
        dateSeparator.textContent = messageDate; // [1]
        messagesContainer.appendChild(dateSeparator);
        lastDate = messageDate;
      }

      const messageElement = document.createElement("div");
      messageElement.classList.add("message");

      const messageUserId = msg.user.user_id; // [2]
      const isSent = myUserId !== null && messageUserId === myUserId;
      messageElement.classList.add(isSent ? "sent" : "received");

      const messageTime = messageDateObj.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }); // [2]

      messageElement.innerHTML = `
                <div class="message-bubble">${msg.message || ""}</div>
                <div class="message-timestamp">${messageTime}</div>
            `;
      messagesContainer.appendChild(messageElement);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // selectChat remains the same
  function selectChat(offerId) {
    const numericOfferId = Number(offerId);
    console.log(`Selecting chat for offer ID: ${numericOfferId}`);

    document.querySelectorAll(".chat-preview").forEach((el) => {
      el.classList.remove("active");
      if (Number(el.dataset.offerId) === numericOfferId) {
        el.classList.add("active");
      }
    });

    const selectedOffer = allOffers.find(
      (offer) => offer.id === numericOfferId,
    );

    if (selectedOffer) {
      displayItemDetails(selectedOffer);
      displayMessages(numericOfferId); // Uses global myUserId
    } else {
      console.error(`Could not find offer details for ID: ${numericOfferId}`);
      messagesContainer.innerHTML =
        '<p class="placeholder error">Could not load chat details.</p>';
      itemDetailsContainer.innerHTML =
        '<p class="placeholder error">Could not load item details.</p>';
    }
  }

  // formatTimestamp remains the same
  function formatTimestamp(isoString) {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const now = new Date();
      if (isNaN(date.getTime())) return "";

      const diffDays = (now - date) / (1000 * 60 * 60 * 24);

      if (diffDays < 1 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } else if (diffDays < 7 && diffDays >= 1) {
        return date.toLocaleDateString([], { weekday: "short" });
      } else {
        return date.toLocaleDateString([], {
          month: "numeric",
          day: "numeric",
        });
      }
    } catch (e) {
      console.error("Error formatting timestamp:", isoString, e);
      return "";
    }
  }

  // --- Initial Load ---
  loadData();
});
