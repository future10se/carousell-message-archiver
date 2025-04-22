document.addEventListener("DOMContentLoaded", () => {
  const chatListContainer = document.getElementById("chat-list-container");
  const messagesContainer = document.getElementById("messages-container");
  const itemDetailsContainer = document.getElementById(
    "item-details-container",
  );

  let allOffers = [];
  let messagesMap = new Map();
  let myUserId = null; // Globally store the ID determined to be "me"

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

      // Populate messagesMap (remains the same)
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
        if (!currentOfferId || !item.messages) {
          return; // Skip if offer_id or messages are missing
        }

        item.messages.forEach((msg) => {
          // Check if user and user_id exist [2]
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
          break; // Found the first one, stop searching
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

  // displayChatList remains the same
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

      previewElement.innerHTML = `
                <img src="${avatarUrl}" alt="${username}" class="avatar">
                <div class="chat-info">
                    <div class="username">${username}</div>
                    <div class="message-preview">${lastMessage}</div>
                </div>
                <div class="chat-timestamp">${timestamp}</div>
            `;

      previewElement.addEventListener("click", () => selectChat(offer.id));
      chatListContainer.appendChild(previewElement);
    });
  }

  // displayItemDetails remains the same
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
    const sellerAvatar = user.profile?.image_url || "placeholder-avatar.png"; // [3]
    const location = product.smart_attributes?.city || "Location not specified"; // [3]
    const description =
      product.description || product.title || "No description provided."; // [1, 3]

    itemDetailsContainer.innerHTML = `
            <img src="${imageUrl}" alt="${title}" class="item-image">
            <h2>${title}</h2>
            <div class="price">${price}</div>
            <div class="seller-info">
                <img src="${sellerAvatar}" alt="${sellerName}" class="small-avatar">
                <span class="username">${sellerName}</span>
            </div>
            <div class="location">${location}</div>
            <div class="description">
                <h3>Details</h3>
                <p>${description}</p>
            </div>
        `;
  }

  // displayMessages uses the determined myUserId (remains the same as previous version)
  // --- Updated displayMessages to correct timestamp handling ---
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

      // --- CORRECTION: Assume created_at is already in milliseconds ---
      // Remove the "* 1000"
      const messageDateObj = new Date(msg.created_at); // [2] Use the value directly

      // Check if the date is valid after creation
      if (isNaN(messageDateObj.getTime())) {
        console.warn(
          "Skipping message with invalid created_at timestamp:",
          msg,
        );
        return; // Skip if the date couldn't be parsed
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

      // --- CORRECTION: Also use the correct Date object for time ---
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
