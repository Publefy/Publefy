import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

# Add the parent directory to sys.path so we can import from database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

def migrate_users():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
    db_name = os.getenv("MONGO_DB_NAME", "publefy_db")
    
    print(f"Connecting to database: {db_name}...")
    client = MongoClient(mongo_uri)
    db = client[db_name]
    
    # 1. Update users to have the new subscription structure if it doesn't exist
    print("Migrating user subscription structures...")
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
    print(f"✅ Modified {result.modified_count} users.")

    # 2. (Optional) Convert old 'plan' field to the new structure
    print("Moving old plan fields to new structure...")
    users_with_old_plan = db.users.find({"plan": {"$exists": True}})
    count = 0
    for user in users_with_old_plan:
        old_plan = user.get("plan", "free")
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"subscription.plan": old_plan.lower()}}
        )
        count += 1
    print(f"✅ Updated {count} users with their old plan names.")

    print("\nMigration complete! Your database is now compatible with the new subscription system.")

if __name__ == "__main__":
    migrate_users()

