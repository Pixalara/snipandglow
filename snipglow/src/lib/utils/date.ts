import { format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const IST = 'Asia/Kolkata'

/** "10 May 2026" */
export const formatDate = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'dd MMM yyyy')

/** "10 May 2026, 02:30 PM" */
export const formatDateTime = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'dd MMM yyyy, hh:mm a')

/** "02:30 PM" */
export const formatTime = (d: string | Date) =>
  format(toZonedTime(new Date(d), IST), 'hh:mm a')

/** Convert IST input to UTC for DB storage */
export const toUTC = (d: Date) => fromZonedTime(d, IST)
