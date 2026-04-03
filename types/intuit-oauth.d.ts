declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
  }

  interface TokenData {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    x_refresh_token_expires_in?: number
    createdAt?: number
  }

  interface AuthResponse {
    getJson(): TokenData
  }

  class OAuthClient {
    static scopes: {
      Accounting: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
    }

    constructor(config: OAuthClientConfig)

    authorizeUri(params: { scope: string[]; state?: string }): string
    createToken(url: string): Promise<AuthResponse>
    refresh(): Promise<AuthResponse>
    setToken(token: Partial<TokenData>): void
  }

  export = OAuthClient
}
