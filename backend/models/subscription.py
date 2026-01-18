from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SubscriptionInfo(BaseModel):
    plan: str = "free"  # "free", "entry", "Pro"
    status: str = "active"  # "active", "canceled", "past_due", "trialing", "incomplete"
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False

