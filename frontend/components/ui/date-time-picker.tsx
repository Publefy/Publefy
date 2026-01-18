"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"

interface DateTimePickerProps {
  date: Date | null
  setDate: (date: Date) => void
  className?: string
}

export function DateTimePicker({ date, setDate, className }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(date)
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)

  // keep local in sync when parent changes
  React.useEffect(() => {
    setSelectedDate(date)
  }, [date])

  const commit = (d: Date) => {
    setSelectedDate(d)
    setDate(d) // parent always gets a real Date
  }

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return
    const newDate = new Date(d)
    // Preserve time if we already had one selected
    if (selectedDate) {
      newDate.setHours(
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        selectedDate.getSeconds(),
        selectedDate.getMilliseconds()
      )
    }
    commit(newDate)
  }

  const handleTimeChange = (type: "hours" | "minutes", value: string) => {
    const base = selectedDate ?? new Date()
    const newDate = new Date(base)
    if (type === "hours") newDate.setHours(Number.parseInt(value))
    else newDate.setMinutes(Number.parseInt(value))
    commit(newDate)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "PPP p") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="border-t p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <Select
                value={(selectedDate?.getHours() ?? 0).toString()}
                onValueChange={(value) => handleTimeChange("hours", value)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="Hours" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">:</span>
              <Select
                value={(selectedDate?.getMinutes() ?? 0).toString()}
                onValueChange={(value) => handleTimeChange("minutes", value)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="Minutes" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 60 }).map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="ml-auto" size="sm" onClick={() => setIsCalendarOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
