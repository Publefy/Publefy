import { format, addDays, isToday, isBefore, parseISO, startOfWeek, endOfWeek, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import {toZonedTime, fromZonedTime } from "date-fns-tz"

export interface TimeSlot {
    hour: number
    minute: number
    hourFormatted: string
    period: string
    timeString: string
    date: Date
    isPast: boolean
    stepMinutes?: number
}

export interface WeekDay {
    date: Date
    dayName: string
    dayNumber: number
    isToday: boolean
    month: string
}

/**
 * Gets the days of the week for the given date, showing 1 day behind and 6 days ahead
 */
export function getDaysOfWeek(currentDate: Date, weekStartsOn: 0 | 1 = 1): WeekDay[] {
    const days = []
    // Start from 1 day behind the current date
    const startDate = addDays(currentDate, -1)

    for (let i = 0; i < 7; i++) {
        const date = addDays(startDate, i)
        days.push({
            date,
            dayName: format(date, "EEE").toUpperCase(),
            dayNumber: date.getDate(),
            isToday: isToday(date),
            month: format(date, "MMM"),
        })
    }

    return days
}

/**
 * Format a date range for display (e.g., "May 1 - May 7, 2023")
 */
export function formatDateRange(date: Date, weekStartsOn: 0 | 1 = 1): string {
    // Show range from 1 day behind to 6 days ahead
    const start = addDays(date, -1)
    const end = addDays(date, 6)

    const startMonth = format(start, "MMM")
    const startDay = format(start, "d")
    const endMonth = format(end, "MMM")
    const endDay = format(end, "d")
    const year = format(end, "yyyy")

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
}

/**
 * Convert a UTC date to the user's local time zone
 */
export function convertToLocalTime(date: Date | string, timeZone: string): Date {
    if (typeof date === "string") {
        return toZonedTime(parseISO(date), timeZone)
    }
    return toZonedTime(date, timeZone)
}

/**
 * Convert a local date to UTC
 */
export function convertToUTC(date: Date, timeZone: string): Date {
    return fromZonedTime(date, timeZone)
}

/**
 * Check if a date is in the past
 */
export function isDateInPast(date: Date): boolean {
    return isBefore(date, new Date())
}

/**
 * Create a date for a specific day and hour
 */
export function createDateForSlot(
    day: WeekDay,
    hour: number,
    timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Date {
    const date = new Date(day.date)
    date.setHours(hour, 0, 0, 0)
    return fromZonedTime(date, timeZone)
}

/**
 * Generate time slots for a day
 */
export function generateTimeSlots(
    startHour = 0,
    endHour = 24,
    date: Date = new Date(),
    stepMinutes = 60,
): TimeSlot[] {
    const now = new Date()
    const slots: TimeSlot[] = []
    const startMinutes = Math.max(0, startHour * 60)
    const endMinutes = Math.min(24 * 60, endHour * 60)

    for (let minutes = startMinutes; minutes < endMinutes; minutes += stepMinutes) {
        const hour = Math.floor(minutes / 60)
        const minute = minutes % 60
        const hourFormatted = hour % 12 || 12
        const period = hour < 12 ? "AM" : "PM"

        const slotDate = new Date(date)
        slotDate.setHours(hour, minute, 0, 0)

        slots.push({
            hour,
            minute,
            hourFormatted: hourFormatted.toString(),
            period,
            timeString: minute === 0 ? `${hourFormatted}${period}` : `${hourFormatted}:${minute.toString().padStart(2, "0")}${period}`,
            date: slotDate,
            isPast: isBefore(slotDate, now),
            stepMinutes,
        })
    }

    return slots
}
/**
 * Check if a post belongs in a specific time slot
 */
export function doesPostBelongInSlot(post: { scheduled_time: Date | string }, day: WeekDay, timeSlot: TimeSlot): boolean {
    const postDate = typeof post.scheduled_time === 'string' ? new Date(post.scheduled_time) : post.scheduled_time
    if (!isSameDay(postDate, day.date)) return false

    const step = timeSlot.stepMinutes ?? 5
    const postMinutes = postDate.getHours() * 60 + postDate.getMinutes()
    const slotMinutes = timeSlot.hour * 60 + (timeSlot.minute ?? 0)
    const normalized = Math.floor(postMinutes / step) * step
    return normalized === slotMinutes
}

/**
 * Gets the days of the month for the given date
 */
export function getDaysOfMonth(currentDate: Date, weekStartsOn: 0 | 1 = 1): WeekDay[][] {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn })
    
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    
    const weeks: WeekDay[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
        const week = allDays.slice(i, i + 7).map(date => ({
            date,
            dayName: format(date, "EEE").toUpperCase(),
            dayNumber: date.getDate(),
            isToday: isToday(date),
            month: format(date, "MMM"),
        }))
        weeks.push(week)
    }
    
    return weeks
}

/**
 * Format a month range for display (e.g., "May 2023")
 */
export function formatMonthRange(date: Date): string {
    return format(date, "MMMM yyyy")
}

/**
 * Check if a post belongs to a specific day (for month view)
 */
export function doesPostBelongToDay(post: { scheduled_time: Date | string }, day: WeekDay): boolean {
    const postDate = typeof post.scheduled_time === 'string' ? new Date(post.scheduled_time) : post.scheduled_time
    return isSameDay(postDate, day.date)
}
