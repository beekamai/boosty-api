import { writeFileSync, readFileSync } from "fs";
import { logger } from "./logging";
import { LOGIN_URL, DEFAULT_USER_AGENT } from "./consts";

interface AuthCookies {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

export async function interactiveLogin(
    authFile: string = "auth.json",
    userAgent: string = DEFAULT_USER_AGENT,
    force: boolean = false
): Promise<void> {
    // If not a forced login and auth.json exists, skip
    if (!force) {
        try {
            const authData = JSON.parse(readFileSync(authFile, "utf-8"));
            if (authData.access_token && authData.refresh_token) {
                logger.info("Tokens already present in auth.json, authorization not required.");
                return;
            }
        } catch (e) {
            logger.info("auth.json not found or empty, starting authorization...");
        }
    }

    // Puppeteer is an optional dependency — loaded lazily so the package works without it.
    let puppeteer: typeof import("puppeteer").default;
    try {
        puppeteer = (await import("puppeteer")).default;
    } catch {
        throw new Error(
            "Interactive login requires the optional 'puppeteer' dependency. Install it: `bun add puppeteer` (or `npm i puppeteer`)."
        );
    }

    // Launch the browser
    const browser = await puppeteer.launch({ headless: false }); // headless: false for interactivity
    const page = await browser.newPage();

    // Set the User-Agent
    await page.setUserAgent(userAgent);

    // Navigate to the login page
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

    // Wait for the sign-in button and click it
    const signInButtonSelector = '[data-test-id="COMMON_TOPMENU_TOPMENURIGHTUNAUTHORIZED\\:SIGN_IN"]';
    await page.waitForSelector(signInButtonSelector);
    await page.click(signInButtonSelector);

    // Wait for the user to log in manually
    logger.info("Please log in to Boosty through the browser window that opened...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 0 }); // 0 = wait indefinitely

    // Extract cookies after login
    const cookies = await page.cookies();
    const authCookie = cookies.find((cookie) => cookie.name === "auth");
    const clientIdCookie = cookies.find((cookie) => cookie.name === "_clientId");

    if (!authCookie || !clientIdCookie) {
        throw new Error("Failed to find authorization cookies. Make sure the login completed.");
    }

    // Parse the authorization cookies
    const authData: AuthCookies = JSON.parse(decodeURIComponent(authCookie.value));
    const authJson = {
        access_token: authData.accessToken,
        refresh_token: authData.refreshToken,
        expires_at: authData.expiresAt,
        device_id: clientIdCookie.value,
        user_agent: userAgent,
    };

    // Save to auth.json
    writeFileSync(authFile, JSON.stringify(authJson, null, 2));
    logger.info(`Tokens successfully saved to ${authFile}`);

    // Close the browser
    await browser.close();
}