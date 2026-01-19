#!/usr/bin/env python3
"""
Script to set a user's plan to unlimited.
Usage:
    python set_unlimited_plan.py <user_id_or_email>
    
Example:
    python set_unlimited_plan.py user@example.com
    python set_unlimited_plan.py 507f1f77bcf86cd799439011
"""

import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# Add the parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

def set_unlimited_plan(user_identifier: str):
    """Set a user's plan to unlimited by user ID or email."""
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
    db_name = os.getenv("MONGO_DB_NAME", "publefy_db")
    
    print(f"Connecting to database: {db_name}...")
    client = MongoClient(mongo_uri)
    db = client[db_name]
    
    # Try to find user by ID or email
    query = {}
    try:
        # Try as ObjectId first
        query["_id"] = ObjectId(user_identifier)
    except:
        # If not a valid ObjectId, try as email
        query["email"] = user_identifier
    
    user = db.users.find_one(query)
    
    if not user:
        print(f"❌ User not found: {user_identifier}")
        return False
    
    user_id = user["_id"]
    email = user.get("email", "N/A")
    print(f"Found user: {email} (ID: {user_id})")
    
    # Update subscription to unlimited
    result = db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "subscription.plan": "unlimited",
                "subscription.status": "active",
                "subscription.last_updated": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Successfully set plan to 'unlimited' for user: {email}")
        return True
    elif result.matched_count > 0:
        print(f"⚠️  User found but no changes made (may already be unlimited)")
        return True
    else:
        print(f"❌ Failed to update user")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_unlimited_plan.py <user_id_or_email>")
        print("\nExample:")
        print("  python set_unlimited_plan.py user@example.com")
        print("  python set_unlimited_plan.py 507f1f77bcf86cd799439011")
        sys.exit(1)
    
    user_identifier = sys.argv[1]
    success = set_unlimited_plan(user_identifier)
    sys.exit(0 if success else 1)

