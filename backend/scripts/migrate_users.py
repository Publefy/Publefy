import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone

# Add the parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

def migrate_users():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
    db_name = os.getenv("MONGO_DB_NAME", "publefy_db")
    
    print(f"Connecting to database: {db_name}...")
    client = MongoClient(mongo_uri)
    db = client[db_name]
    
    # 1. Update users to have the new subscription structure if it doesn't exist
    print("\n1. Migrating user subscription structures...")
    result = db.users.update_many(
        {"subscription": {"$exists": False}},
        {"$set": {
            "subscription": {
                "plan": "free",
                "status": "active",
                "stripe_customer_id": None,
                "stripe_subscription_id": None,
                "current_period_end": None,
                "cancel_at_period_end": False
            }
        }}
    )
    print(f"[OK] Modified {result.modified_count} users.")

    # 2. (Optional) Convert old 'plan' field to the new structure
    print("\n2. Moving old plan fields to new structure...")
    users_with_old_plan = db.users.find({"plan": {"$exists": True}})
    count = 0
    for user in users_with_old_plan:
        old_plan = user.get("plan", "free")
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"subscription.plan": old_plan.lower()}}
        )
        count += 1
    print(f"[OK] Updated {count} users with their old plan names.")

    # 3. Update users missing the 'usage' tracking field
    print("\n3. Migrating usage tracking fields...")
    result = db.users.update_many(
        {"usage": {"$exists": False}},
        {"$set": {
            "usage": {
                "points_balance": 16,
                "points_total_limit": 16,
                "points_used": 0,
                "total_videos_generated": 0
            }
        }}
    )
    print(f"[OK] Added 'usage' field to {result.modified_count} users.")

    # 4. Fix incomplete usage fields (missing required keys)
    print("\n4. Fixing incomplete 'usage' fields...")
    users_with_incomplete = db.users.find({
        "usage": {"$exists": True},
        "$or": [
            {"usage.points_balance": {"$exists": False}},
            {"usage.points_total_limit": {"$exists": False}},
            {"usage.points_used": {"$exists": False}},
            {"usage.total_videos_generated": {"$exists": False}}
        ]
    })
    
    count = 0
    for user in users_with_incomplete:
        usage = user.get("usage", {})
        updates = {}
        if "points_balance" not in usage:
            updates["usage.points_balance"] = 16
        if "points_total_limit" not in usage:
            updates["usage.points_total_limit"] = 16
        if "points_used" not in usage:
            updates["usage.points_used"] = 0
        if "total_videos_generated" not in usage:
            updates["usage.total_videos_generated"] = 0
        
        if updates:
            db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            count += 1
    print(f"[OK] Fixed incomplete 'usage' fields for {count} users.")

    # 5. Add timestamps if missing
    print("\n5. Adding timestamps to users missing them...")
    now = _now_iso()
    
    result_created = db.users.update_many(
        {"created_at": {"$exists": False}},
        {"$set": {"created_at": now}}
    )
    print(f"[OK] Added 'created_at' to {result_created.modified_count} users.")
    
    result_updated = db.users.update_many(
        {},
        {"$set": {"updated_at": now}}
    )
    print(f"[OK] Updated 'updated_at' for {result_updated.modified_count} users.")

    # 6. Summary
    total_users = db.users.count_documents({})
    users_with_complete_usage = db.users.count_documents({
        "usage": {"$exists": True},
        "usage.points_balance": {"$exists": True},
        "usage.points_total_limit": {"$exists": True},
        "usage.points_used": {"$exists": True},
        "usage.total_videos_generated": {"$exists": True}
    })
    users_with_subscription = db.users.count_documents({
        "subscription": {"$exists": True}
    })
    
    print("\n" + "="*60)
    print("Migration Summary:")
    print(f"  Total users: {total_users}")
    print(f"  Users with complete 'usage' tracking: {users_with_complete_usage}")
    print(f"  Users with 'subscription' field: {users_with_subscription}")
    print("="*60)
    
    if users_with_complete_usage == total_users:
        print("\n[SUCCESS] All users now have the correct tracking schema!")
    else:
        print(f"\n[WARNING] {total_users - users_with_complete_usage} users still need attention.")

    print("\nMigration complete! Your database is now compatible with the new tracking system.")

if __name__ == "__main__":
    migrate_users()

