// fetch_images.js
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { loadConfig, validateConfig, getDomain } = require("./utils");

// --- Load Configuration ---
const config = loadConfig();

// Extract configuration values
const COUNTRY_CODE = (config.countryCode || "SG").toUpperCase();
const USER_AGENT = config.userAgent;

// Get domain based on country code (for referer header)
const DOMAIN = getDomain(COUNTRY_CODE);
const REFERER = `https://${DOMAIN}/`;

// Check for command line argument overrides
const cmdOffersFile = process.argv[2];
const cmdMessagesFile = process.argv[3];

// Determine input files (command line args override config)
const OFFERS_FILE = cmdOffersFile || config.outputOffers;
const MESSAGES_FILE = cmdMessagesFile || config.outputMessages;

// Stats for reporting
const stats = {
  totalImages: 0,
  downloadedImages: 0,
  skippedImages: 0,
  failedImages: 0,
  uniqueUrls: new Set(),
};

// Function to ensure directory exists
async function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// Function to extract path from URL
function extractPathFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Remove any query parameters
    return url.pathname;
  } catch (error) {
    console.error(`Error parsing URL ${urlString}:`, error.message);
    return null;
  }
}

// Function to download an image
async function downloadImage(url, localPath) {
  // Don't download if we've already processed this URL
  if (stats.uniqueUrls.has(url)) {
    return "already_processed";
  }
  stats.uniqueUrls.add(url);

  // Normalize URL by removing query parameters
  const cleanUrl = url.split("?")[0];

  // Check if file already exists
  if (fs.existsSync(localPath)) {
    console.log(`File already exists: ${localPath}`);
    stats.skippedImages++;
    return "exists";
  }

  // Extract hostname from URL for the Host header
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;

  // Setup headers
  const headers = {
    Accept:
      "image/webp,image/avif,image/jxl,image/heic,image/heic-sequence,video/*;q=0.8,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
    Host: hostname,
    Priority: "u=5, i",
    Referer: REFERER,
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
    "User-Agent": USER_AGENT,
  };

  try {
    // Ensure directory exists before downloading
    await ensureDirectoryExists(localPath);

    // Fetch the image
    console.log(`Downloading: ${url}`);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(
        `Failed to fetch image ${url}: ${response.status} ${response.statusText}`,
      );
      stats.failedImages++;
      return "error";
    }

    // Get the image data as a buffer
    const buffer = await response.buffer();

    // Save the image to the local file system
    fs.writeFileSync(localPath, buffer);
    console.log(`Saved: ${localPath}`);
    stats.downloadedImages++;

    // Add a random delay after successful download
    const delay = Math.random() * 600 + 200; // 200-800ms
    await new Promise((resolve) => setTimeout(resolve, delay));

    return "downloaded";
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error.message);
    stats.failedImages++;
    return "error";
  }
}

// Process offer user profile images and product images
async function processOffers(offersData) {
  console.log(`\nProcessing ${offersData.length} offers for images...`);

  for (const offer of offersData) {
    // Process user profile image
    if (offer.user && offer.user.profile && offer.user.profile.image_url) {
      const url = offer.user.profile.image_url;
      stats.totalImages++;

      const imagePath = extractPathFromUrl(url);
      if (imagePath) {
        const localPath = path.join(".", imagePath);
        await downloadImage(url, localPath);
      }
    }

    // Process product primary photo
    if (offer.product && offer.product.primary_photo_url) {
      const url = offer.product.primary_photo_url;
      stats.totalImages++;

      const imagePath = extractPathFromUrl(url);
      if (imagePath) {
        const localPath = path.join(".", imagePath);
        await downloadImage(url, localPath);
      }
    }
  }
}

// Process message user profile images and file URLs
async function processMessages(messagesData) {
  console.log(
    `\nProcessing ${messagesData.length} message threads for images...`,
  );

  for (const thread of messagesData) {
    if (!thread.messages || !Array.isArray(thread.messages)) {
      continue;
    }

    for (const message of thread.messages) {
      // Process user profile image
      if (
        message.user &&
        message.user.profile_url &&
        !message.user.profile_url.includes("default.png")
      ) {
        // Skip default images
        const url = message.user.profile_url;
        stats.totalImages++;

        const imagePath = extractPathFromUrl(url);
        if (imagePath) {
          const localPath = path.join(".", imagePath);
          await downloadImage(url, localPath);
        }
      }

      // Process file URLs (images in messages)
      if (message.type === "FILE" && message.file && message.file.url) {
        const url = message.file.url;
        stats.totalImages++;

        const imagePath = extractPathFromUrl(url);
        if (imagePath) {
          const localPath = path.join(".", imagePath);
          await downloadImage(url, localPath);
        }
      }

      // Process file URLs from the 'files' array if present
      if (message.files && Array.isArray(message.files)) {
        for (const file of message.files) {
          if (file.url) {
            const url = file.url;
            stats.totalImages++;

            const imagePath = extractPathFromUrl(url);
            if (imagePath) {
              const localPath = path.join(".", imagePath);
              await downloadImage(url, localPath);
            }
          }
        }
      }
    }
  }
}

// Main function to orchestrate the image downloading
async function main() {
  console.log("Starting image archive process...");

  try {
    // Load and parse offers data
    if (fs.existsSync(OFFERS_FILE)) {
      console.log(`Reading offers from: ${OFFERS_FILE}`);
      const offersData = JSON.parse(fs.readFileSync(OFFERS_FILE, "utf8"));
      console.log(`Loaded ${offersData.length} offers`);

      // Process offers for images
      await processOffers(offersData);
    } else {
      console.warn(`Offers file not found: ${OFFERS_FILE}`);
      console.warn("Skipping offer image processing.");
    }

    // Load and parse messages data (if file exists)
    if (fs.existsSync(MESSAGES_FILE)) {
      console.log(`Reading messages from: ${MESSAGES_FILE}`);
      const messagesData = JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
      console.log(`Loaded ${messagesData.length} message threads`);

      // Process messages for images
      await processMessages(messagesData);
    } else {
      console.warn(`Messages file not found: ${MESSAGES_FILE}`);
      console.warn(
        "Skipping message image processing - this is normal if you haven't fetched messages yet.",
      );
    }

    // Print final statistics
    console.log("\n=== Image Download Summary ===");
    console.log(`Total unique image URLs found: ${stats.uniqueUrls.size}`);
    console.log(`Total images processed: ${stats.totalImages}`);
    console.log(`Successfully downloaded: ${stats.downloadedImages}`);
    console.log(`Skipped (already exists): ${stats.skippedImages}`);
    console.log(`Failed downloads: ${stats.failedImages}`);
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

// Make sure we have the necessary configuration before running
if (validateConfig(config)) {
  main().catch((error) => {
    console.error("Unhandled error in main process:", error);
    process.exit(1);
  });
}
