import { AgentConfig } from '@ministryofjustice/hmpps-rest-client'

const production = process.env.NODE_ENV === 'production'

function get<T>(name: string, fallback: T, requireInProduction = false): T | string {
  if (process.env[name]) {
    return process.env[name]
  }
  if (fallback !== undefined && (!production || !requireInProduction)) {
    return fallback
  }
  throw new Error(`Missing required env var: ${name}`)
}

const requiredInProduction = true

export const apiConfig = {
  auth: {
    url: get('HMPPS_AUTH_URL', 'https://sign-in-dev.hmpps.service.justice.gov.uk/auth'),
    timeout: {
      response: 10000,
      deadline: 10000,
    },
    agent: new AgentConfig(10000),
    systemClientId: get('CLIENT_ID', 'clientid', requiredInProduction),
    systemClientSecret: get('CLIENT_SECRET', 'clientsecret', requiredInProduction),
  },

  apis: {
    hmpps_pin_phone_api: {
      url: get('HMPPS_PIN_PHONE_API', 'https://pin-phone-dev.prison.service.justice.gov.uk'),
      timeout: {
        response: 10000,
        deadline: 10000,
      },
      agent: new AgentConfig(10000),
      systemClientId: get('CLIENT_ID', 'clientid', requiredInProduction),
      systemClientSecret: get('CLIENT_SECRET', 'clientsecret', requiredInProduction),
    },
  },
}
