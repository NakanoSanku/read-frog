import { z } from "zod"
import { browser, storage } from "#imports"
import { env } from "@/env"
import { GOOGLE_DRIVE_TOKEN_STORAGE_KEY } from "../constants/config"
import { logger } from "../logger"

const GOOGLE_CLIENT_ID = env.WXT_GOOGLE_CLIENT_ID ?? "YOUR_CLIENT_ID"
const GOOGLE_BASE_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.email",
]
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
const TOKEN_EXPIRY_BUFFER_MS = 60000

const googleAuthTokenSchema = z.object({
  access_token: z.string(),
  expires_at: z.number(),
  token_type: z.string().default("Bearer"),
  scopes: z.array(z.string()).optional(),
})

const googleUserInfoSchema = z.object({
  id: z.string(),
  email: z.email(),
  verified_email: z.boolean(),
  picture: z.url().optional(),
})

export type GoogleAuthToken = z.infer<typeof googleAuthTokenSchema>
export type GoogleUserInfo = z.infer<typeof googleUserInfoSchema>

function getRequestedScopes(requiredScopes: readonly string[]) {
  return Array.from(new Set([...GOOGLE_BASE_SCOPES, ...requiredScopes]))
}

function hasRequiredScopes(token: GoogleAuthToken, requiredScopes: readonly string[]) {
  return (
    requiredScopes.length === 0 ||
    (!!token.scopes && requiredScopes.every((scope) => token.scopes?.includes(scope)))
  )
}

/**
 * Get token from storage with validation
 */
async function getTokenFromStorage(): Promise<GoogleAuthToken | null> {
  try {
    const tokenData = await storage.getItem<GoogleAuthToken>(
      `local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`,
    )
    if (!tokenData) {
      return null
    }

    const parsed = googleAuthTokenSchema.safeParse(tokenData)
    if (!parsed.success) {
      logger.warn("Invalid token data in storage", parsed.error)
      return null
    }

    return parsed.data
  } catch (error) {
    logger.error("Failed to get token from storage", error)
    return null
  }
}

/**
 * Authenticate with Google Drive using OAuth 2.0
 */
export async function authenticateGoogleDriveAndSaveTokenToStorage(
  requiredScopes: readonly string[] = [],
): Promise<string> {
  try {
    const requestedScopes = getRequestedScopes(requiredScopes)
    const redirectUri = browser.identity.getRedirectURL()
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("response_type", "token")
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("scope", requestedScopes.join(" "))
    authUrl.searchParams.set("prompt", "select_account")
    authUrl.searchParams.set("include_granted_scopes", "true")

    const responseUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    })

    if (!responseUrl) {
      throw new Error("No response URL from Google OAuth")
    }

    const url = new URL(responseUrl)
    const params = new URLSearchParams(url.hash.slice(1))
    const accessToken = params.get("access_token")
    const expiresIn = params.get("expires_in")
    const grantedScopes = params.get("scope")?.split(" ").filter(Boolean) ?? requestedScopes

    if (!accessToken) {
      throw new Error("No access token in OAuth response")
    }

    const expiresAt = Date.now() + (expiresIn ? Number.parseInt(expiresIn, 10) * 1000 : 3600 * 1000)

    const tokenData: GoogleAuthToken = {
      access_token: accessToken,
      expires_at: expiresAt,
      token_type: "Bearer",
      scopes: grantedScopes,
    }

    // Validate before storing
    const validatedToken = googleAuthTokenSchema.parse(tokenData)
    await storage.setItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`, validatedToken)

    return accessToken
  } catch (error) {
    logger.error("Google OAuth authentication failed", error)
    throw error
  }
}

/**
 * Get valid access token, re-authenticate if expired
 */
export async function getValidAccessToken(requiredScopes: readonly string[] = []): Promise<string> {
  try {
    const tokenData = await getTokenFromStorage()

    // Re-authenticate if the token is missing, expiring soon, or lacks a feature scope.
    if (
      !tokenData ||
      Date.now() >= tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS ||
      !hasRequiredScopes(tokenData, requiredScopes)
    ) {
      return await authenticateGoogleDriveAndSaveTokenToStorage(requiredScopes)
    }

    // Trust local expiry check - validate only on API 401 errors
    return tokenData.access_token
  } catch (error) {
    logger.error("Failed to get valid access token", error)
    throw error
  }
}

export async function clearAccessToken(): Promise<void> {
  try {
    await storage.removeItem(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`)
  } catch (error) {
    logger.error("Failed to clear access token", error)
    throw error
  }
}

/**
 * Check if user is authenticated with valid token
 */
export async function getIsAuthenticated(requiredScopes: readonly string[] = []): Promise<boolean> {
  try {
    const tokenData = await getTokenFromStorage()

    if (!tokenData) {
      return false
    }

    return (
      Date.now() < tokenData.expires_at - TOKEN_EXPIRY_BUFFER_MS &&
      hasRequiredScopes(tokenData, requiredScopes)
    )
  } catch (error) {
    logger.error("Failed to check authentication status", error)
    return false
  }
}

/**
 * Fetch Google user info using access token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status}`)
  }

  const data = await res.json()
  const parsed = googleUserInfoSchema.safeParse(data)

  if (!parsed.success) {
    logger.error("Invalid user info response", parsed.error)
    throw new Error("Invalid user info response")
  }

  return parsed.data
}
