export const INVITE_CODE_LENGTH = 8
export const INVITE_CODE_REGEX = /^[0-9]{8}$/

export function normalizeInviteCode(input: string) {
  return input.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH)
}

export function isValidInviteCode(input: string) {
  return INVITE_CODE_REGEX.test(input)
}

export function generateInviteCode() {
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint32Array(1)
    cryptoApi.getRandomValues(buffer)
    return String(buffer[0] % 100_000_000).padStart(INVITE_CODE_LENGTH, '0')
  }

  return String(Math.floor(Math.random() * 100_000_000)).padStart(INVITE_CODE_LENGTH, '0')
}
