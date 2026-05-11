/** Store: +919876543210 — Display: +91 98765 43210 */
export const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    const num = digits.slice(2)
    return `+91 ${num.slice(0, 5)} ${num.slice(5)}`
  }
  return phone
}

/** Normalize to +91XXXXXXXXXX for storage */
export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return phone
}
