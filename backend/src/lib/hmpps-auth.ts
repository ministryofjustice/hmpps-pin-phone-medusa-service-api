import { AuthenticationClient, InMemoryTokenStore } from '@ministryofjustice/hmpps-auth-clients'
import { apiConfig } from '../config/api-config'

let authClient: AuthenticationClient | null = null

export function getHmppsAuthClient(): AuthenticationClient {
  authClient ??= new AuthenticationClient(apiConfig.auth, console, new InMemoryTokenStore())
  return authClient
}
