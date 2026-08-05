import { useGoogleDriveAuth } from "@/hooks/use-google-drive-auth"
import { GOOGLE_SHEETS_SCOPE } from "@/utils/google-drive/auth"

const GOOGLE_SHEETS_SCOPES = [GOOGLE_SHEETS_SCOPE] as const

export function useGoogleSheetsAuth() {
  return useGoogleDriveAuth(GOOGLE_SHEETS_SCOPES)
}
