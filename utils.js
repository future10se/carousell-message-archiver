const fs = require("fs");
const path = require("path");

// Country code to domain mapping
const COUNTRY_DOMAIN_MAP = {
  AU: "au.carousell.com",
  CA: "ca.carousell.com",
  HK: "www.carousell.com.hk",
  ID: "id.carousell.com",
  MY: "www.carousell.com.my",
  NZ: "nz.carousell.com",
  PH: "www.carousell.ph",
  SG: "www.carousell.sg",
  TW: "tw.carousell.com",
};

// Load configuration from the config file
function loadConfig() {
  try {
    const configPath = path.resolve(__dirname, "config.json");
    const configData = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);
    console.log("Configuration loaded successfully");
    return config;
  } catch (error) {
    console.error("Error loading configuration file:", error);
    console.error("Please make sure config.json exists in the script directory");
    process.exit(1);
  }
}

// Validate configuration
function validateConfig(config, requireSessionKey = false) {
  if (
    config.cookie === "[YOUR_COOKIE_HERE]" ||
    config.csrfToken === "[YOUR_CSRF_TOKEN_HERE]"
  ) {
    console.error(
      "--------------------------------------------------------------------"
    );
    console.error(
      "ERROR: Please update the cookie and csrfToken values in config.json!"
    );
    console.error(
      "--------------------------------------------------------------------"
    );
    return false;
  }

  if (requireSessionKey && !config.sessionKey) {
    console.error(
      "--------------------------------------------------------------------"
    );
    console.error(
      "ERROR: Session-Key is required in config.json for fetching messages!"
    );
    console.error(
      "--------------------------------------------------------------------"
    );
    return false;
  }

  return true;
}

// Get domain based on country code
function getDomain(countryCode) {
  const code = (countryCode || "SG").toUpperCase();
  const domain = COUNTRY_DOMAIN_MAP[code];
  
  if (!domain) {
    console.error(`Error: Invalid country code "${code}"`);
    console.error(
      "Valid country codes are:",
      Object.keys(COUNTRY_DOMAIN_MAP).join(", ")
    );
    process.exit(1);
  }
  
  console.log(`Using domain for ${code}: ${domain}`);
  return domain;
}

module.exports = {
  loadConfig,
  validateConfig,
  getDomain,
  COUNTRY_DOMAIN_MAP
};