// fetch_offers.js
const fetch = require("node-fetch");
const fs = require("fs");
const { URL, URLSearchParams } = require("url");
const { loadConfig, validateConfig, getDomain } = require("./utils");

// --- Load Configuration from External File ---
const config = loadConfig();

// Check for command line argument override for output file
const cmdOutputFile = process.argv[2];
if (cmdOutputFile) {
  console.log(`Command line output file specified: ${cmdOutputFile}`);
}

// Extract configuration values
const COOKIE = config.cookie;
const CSRF_TOKEN = config.csrfToken;
const COUNTRY_CODE = (config.countryCode || "SG").toUpperCase();
const OUTPUT_FILE = cmdOutputFile || config.outputOffers;
const PAGE_COUNT = config.pageCount;
const USER_AGENT = config.userAgent;

// Get domain based on country code
const DOMAIN = getDomain(COUNTRY_CODE);

// Base URL endpoint (using domain from config)
const BASE_URL = `https://${DOMAIN}/ds/offer/1.0/me/`;

// Default query parameters
const BASE_PARAMS = {
  _path: "/1.0/me/",
  l: "en",
  type: "all",
};

// --- Helper Function to Fetch All Offers with Pagination ---
async function fetchAllOffers() {
  let allOffers = []; // Array to accumulate offers from all pages
  let keepFetching = true;
  let currentTimestamp = new Date().toISOString(); // Start with current time in UTC ISO 8601 format

  // Print the initial timestamp being used
  console.log(`Starting fetch with initial timestamp: ${currentTimestamp}`);
  console.log(`Will save offers to: ${OUTPUT_FILE}`);

  // Define the request headers (remain constant for all requests)
  const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    Cookie: COOKIE,
    "csrf-token": CSRF_TOKEN,
    Priority: "u=3, i",
    Referer: `https://${DOMAIN}/inbox/`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": USER_AGENT,
  };

  let pageNum = 1; // Counter for logging pages

  while (keepFetching) {
    // Construct URL with current parameters for this page
    const fetchUrl = new URL(BASE_URL);
    const params = new URLSearchParams({
      ...BASE_PARAMS,
      count: PAGE_COUNT.toString(), // Add count for this request
      latest_price_created: currentTimestamp, // Add timestamp for this request
    });
    fetchUrl.search = params.toString();
    const urlString = fetchUrl.toString();

    console.log(`\nFetching page ${pageNum} using URL: ${urlString}`);

    try {
      // Make the GET request using fetch
      const response = await fetch(urlString, {
        method: "GET",
        headers: headers,
      });

      console.log(`Page ${pageNum} - Status Code: ${response.status}`);

      // Check if the request was successful (status code 2xx)
      if (!response.ok) {
        console.error(
          `Request failed: ${response.status} ${response.statusText}`,
        );
        try {
          const errorBody = await response.text();
          console.error("Error response body:", errorBody.substring(0, 500));
        } catch (bodyError) {
          console.error("Could not read error response body:", bodyError);
        }
        keepFetching = false; // Stop fetching on error
        break; // Exit the loop
      }

      // Parse the JSON response
      const parsedData = await response.json();

      // Check if the expected structure and offers array exist
      if (
        parsedData &&
        parsedData.data &&
        Array.isArray(parsedData.data.offers)
      ) {
        const fetchedOffers = parsedData.data.offers;
        const numFetched = fetchedOffers.length;
        console.log(
          `Page ${pageNum} - Successfully fetched ${numFetched} offers.`,
        );

        if (numFetched > 0) {
          // Add the fetched offers to our main list
          allOffers = allOffers.concat(fetchedOffers);

          // Get the timestamp from the *last* offer in this batch for the next request
          const lastOffer = fetchedOffers[numFetched - 1];
          if (lastOffer && lastOffer.latest_price_created) {
            currentTimestamp = lastOffer.latest_price_created;
            console.log(`Next request will use timestamp: ${currentTimestamp}`);
          } else {
            console.warn(
              "Last offer in batch missing 'latest_price_created'. Stopping pagination.",
            );
            keepFetching = false; // Stop if data is malformed
          }
        } else {
          // If 0 offers were returned, we are done
          console.log("Received 0 offers, stopping pagination.");
          keepFetching = false;
        }

        // Check stopping condition: if we received fewer offers than requested
        if (numFetched < PAGE_COUNT) {
          console.log(
            `Received ${numFetched} offers (less than requested ${PAGE_COUNT}), stopping pagination.`,
          );
          keepFetching = false;
        }
      } else {
        console.error("Error: Unexpected JSON structure received.");
        console.log(
          "Received data structure snippet:",
          JSON.stringify(parsedData, null, 2).substring(0, 500),
        );
        keepFetching = false; // Stop if structure is wrong
      }
    } catch (error) {
      console.error(
        `An error occurred during fetch or processing for page ${pageNum}:`,
        error,
      );
      keepFetching = false; // Stop fetching on error
      if (error instanceof fetch.FetchError) {
        console.error("This looks like a network or fetch-related error.");
      } else if (error instanceof SyntaxError) {
        console.error(
          "This looks like a JSON parsing error. The response body might not be valid JSON.",
        );
      }
    }
    pageNum++; // Increment page counter for logging
  } // End while loop

  // After the loop (or if fetching stopped), save the accumulated offers
  if (allOffers.length > 0) {
    console.log(
      `\nFinished fetching. Total offers collected: ${allOffers.length}`,
    );
    try {
      await fs.promises.writeFile(
        OUTPUT_FILE,
        JSON.stringify(allOffers, null, 2),
      );
      console.log(
        `Successfully saved ${allOffers.length} offers to ${OUTPUT_FILE}`,
      );
    } catch (writeError) {
      console.error(`Error writing final data to ${OUTPUT_FILE}:`, writeError);
    }
  } else {
    console.log("\nNo offers were collected or saved.");
  }
}

// --- Script Execution ---
// Validate credentials before running
if (validateConfig(config)) {
  // Run the main async function that handles pagination
  fetchAllOffers();
}
