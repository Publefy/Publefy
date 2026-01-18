# utils/time_parse.py
from zoneinfo import ZoneInfo
from dateutil import parser
from datetime import datetime, date, timezone

def _normalize_tz_name(tzname: str) -> str:
    """
    Validate and normalize timezone names.
    Falls back to UTC if invalid.
    """
    tzname = (tzname or "UTC").strip()
    try:
        ZoneInfo(tzname)
        return tzname
    except Exception:
        return "UTC"

def parse_to_utc_dt(value, client_tz: str = "UTC") -> datetime:
    """
    Parse a date/time value and return an aware datetime in UTC.
    Supports:
      - ISO 8601 (e.g., '2025-08-15T05:15:00+02:00', or with 'Z')
      - 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DDTHH:MM' (naive -> interpret in client_tz)
      - 'HH:MM' (assumes today in client_tz)
      - datetime (naive -> interpret in client_tz)
    """
    tz = ZoneInfo(_normalize_tz_name(client_tz))

    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
    else:
        s = str(value).strip()

        # Case: "HH:MM"
        if len(s) in (4, 5) and s.count(":") == 1 and all(p.isdigit() for p in s.split(":")):
            hh, mm = map(int, s.split(":"))
            today_client = datetime.now(tz).date()
            dt = datetime(today_client.year, today_client.month, today_client.day, hh, mm, tzinfo=tz)
        else:
            dt = parser.isoparse(s) if hasattr(parser, "isoparse") else parser.parse(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)

    # Always return in UTC
    return dt.astimezone(timezone.utc)
