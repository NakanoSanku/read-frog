import type { GoogleUserInfo } from "@/utils/google-drive/auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect } from "react"
import { storage } from "#imports"
import { GOOGLE_DRIVE_TOKEN_STORAGE_KEY } from "@/utils/constants/config"
import {
  getGoogleUserInfo,
  getIsAuthenticated,
  getValidAccessToken,
} from "@/utils/google-drive/auth"

interface GoogleDriveAuthData {
  isAuthenticated: boolean
  userInfo: GoogleUserInfo | null
}

const QUERY_KEY = ["google-drive-auth"]
const NO_REQUIRED_SCOPES: readonly string[] = []

export function useGoogleDriveAuth(requiredScopes: readonly string[] = NO_REQUIRED_SCOPES) {
  const queryClient = useQueryClient()
  const queryKey = [...QUERY_KEY, requiredScopes]

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<GoogleDriveAuthData> => {
      const authenticated = await getIsAuthenticated(requiredScopes)
      if (!authenticated) {
        return { isAuthenticated: false, userInfo: null }
      }
      const accessToken = await getValidAccessToken(requiredScopes)
      const userInfo = await getGoogleUserInfo(accessToken)
      return { isAuthenticated: true, userInfo }
    },
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, requiredScopes] }),
    [queryClient, requiredScopes],
  )

  // Auto-invalidate when token changes in storage
  useEffect(() => {
    return storage.watch(`local:${GOOGLE_DRIVE_TOKEN_STORAGE_KEY}`, () => {
      void invalidate()
    })
  }, [invalidate])

  return { query, invalidate }
}
