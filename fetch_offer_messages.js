// fetch_offer_messages.js
const fetch = require("node-fetch");
const fs = require("fs");
const { loadConfig, validateConfig, getDomain } = require("./utils");

// --- Load Configuration ---
const config = loadConfig();

// Check for command line argument overrides
const cmdInputFile = process.argv[2];
const cmdOutputFile = process.argv[3];

// Extract configuration values
const COOKIE = config.cookie;
const CSRF_TOKEN = config.csrfToken;
const COUNTRY_CODE = (config.countryCode || "SG").toUpperCase();
const SESSION_KEY = config.sessionKey;
const USER_AGENT = config.userAgent;

// Determine input and output files (command line args override config)
const INPUT_FILE = cmdInputFile || config.outputOffers;
const OUTPUT_FILE = cmdOutputFile || config.outputMessages;

// Get domain based on country code
const DOMAIN = getDomain(COUNTRY_CODE);

// Function to get SendBird access token
async function getSendbirdToken() {
  const tokenUrl = `https://${DOMAIN}/ds/api/1.0/chat/token/?_path=%2F1.0%2Fchat%2Ftoken%2F&l=en`;

  const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    Cookie: COOKIE,
    "csrf-token": CSRF_TOKEN,
    Host: DOMAIN,
    Priority: "u=3, i",
    Referer: `https://${DOMAIN}/inbox/`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": USER_AGENT,
  };

  console.log("Requesting SendBird token from:", tokenUrl);

  try {
    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      console.error(
        `Token request failed with status: ${response.status} ${response.statusText}`,
      );
      const errorText = await response.text();
      console.error("Error response:", errorText.substring(0, 500));
      throw new Error(
        `Failed to get token: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (data && data.data && data.data.token) {
      console.log("Token retrieved successfully");
      return data.data.token;
    } else {
      console.error(
        "Unexpected token response structure:",
        JSON.stringify(data).substring(0, 500),
      );
      throw new Error("Token not found in response");
    }
  } catch (error) {
    console.error("Error getting SendBird token:", error);
    throw error;
  }
}

// Function to fetch messages for a given channel
async function fetchChannelMessages(channelUrl, accessToken) {
  // Extract the app ID from the channel URL (first 5 segments)
  const urlParts = channelUrl.split("-");
  const appId = urlParts.slice(0, 5).join("-");

  // Construct API URL
  const currentTimestamp = Date.now();
  const apiUrl = `https://api-${appId.toLowerCase()}.sendbird.com/v3/group_channels/${channelUrl}/messages?is_sdk=true&include=true&reverse=true&message_ts=${currentTimestamp}&message_type&include_reply_type=none&with_sorted_meta_array=true&include_reactions_summary=true&include_thread_info=true&include_parent_message_info=true&show_subchannel_message_only=false&include_poll_details=true&checking_has_next=true&checking_continuous_messages=false&sdk_source=external_collection`;

  console.log(`Fetching messages for channel: ${channelUrl}`);

  const headers = {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Access-Token": accessToken,
    "App-Id": appId,
    "Content-Type": "application/json; charset=utf-8",
    Host: `api-${appId.toLowerCase()}.sendbird.com`,
    Origin: `https://${DOMAIN}`,
    Referer: `https://${DOMAIN}/`,
    "Request-Sent-Timestamp": currentTimestamp.toString(),
    "SB-SDK-User-Agent": `main_sdk_info=chat/js/4.17.3&device_os_platform=web&os_version=${USER_AGENT}`,
    "SB-User-Agent": "JS/c4.17.3///oweb",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    SendBird: `JS,${USER_AGENT},4.17.3,${appId}`,
    "Session-Key": SESSION_KEY,
    "User-Agent": USER_AGENT,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText.substring(0, 500));
      throw new Error(
        `Failed to fetch messages: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(
      `Successfully retrieved ${data.messages ? data.messages.length : 0} messages`,
    );
    return data;
  } catch (error) {
    console.error(`Error fetching messages for channel ${channelUrl}:`, error);
    return null;
  }
}

// Main function to process all offers
async function processOffers() {
  console.log(`Processing offers from: ${INPUT_FILE}`);
  console.log(`Output will be saved to: ${OUTPUT_FILE}`);

  // Load offers from the input file
  let offers;
  try {
    const offerData = fs.readFileSync(INPUT_FILE, "utf8");
    offers = JSON.parse(offerData);
    console.log(`Loaded ${offers.length} offers from ${INPUT_FILE}`);
  } catch (error) {
    console.error(`Error loading offers from ${INPUT_FILE}:`, error);
    process.exit(1);
  }

  // Get the SendBird access token
  let accessToken;
  try {
    console.log("Getting SendBird access token...");
    accessToken = await getSendbirdToken();
    console.log("Successfully obtained access token");
  } catch (error) {
    console.error("Failed to get access token, exiting");
    process.exit(1);
  }

  // Process each offer to fetch messages
  const results = [];
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    console.log(
      `\nProcessing offer ${i + 1}/${offers.length} (ID: ${offer.id})...`,
    );

    if (!offer.channel_url) {
      console.warn(`Offer ID ${offer.id} has no channel_url, skipping`);
      continue;
    }

    try {
      const messagesData = await fetchChannelMessages(
        offer.channel_url,
        accessToken,
      );

      // Extract just the messages array and has_next flag for the output
      results.push({
        offer_id: offer.id,
        messages: messagesData?.messages || [],
        has_next: messagesData?.has_next || false,
      });

      console.log(`Successfully fetched messages for offer ID ${offer.id}`);
    } catch (error) {
      console.error(`Error processing offer ID ${offer.id}:`, error);
    }

    // Add a small delay between requests to avoid rate limiting
    if (i < offers.length - 1) {
      const minDelay = 800; // Minimum delay in milliseconds
      const maxDelay = 1900; // Maximum delay in milliseconds
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      console.log(`Waiting ${delay.toFixed(0)}ms before next request...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Save results to output file
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(
      `\nSuccessfully saved messages data for ${results.length} offers to ${OUTPUT_FILE}`,
    );
  } catch (error) {
    console.error(`Error writing data to ${OUTPUT_FILE}:`, error);
  }
}

// Validate credentials before running (with sessionKey requirement)
if (validateConfig(config, true)) {
  // Run the main function
  processOffers().catch((error) => {
    console.error("Unhandled error in main process:", error);
    process.exit(1);
  });
}
