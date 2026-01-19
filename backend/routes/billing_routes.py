import os
import stripe
import logging
from flask import Blueprint, request, jsonify, g
from database import db
from bson import ObjectId
from auth.dependencies import login_required
from datetime import datetime

logger = logging.getLogger(__name__)

billing_blueprint = Blueprint("billing", __name__, url_prefix="/billing")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

@billing_blueprint.route("/create-checkout-session", methods=["POST"])
@login_required
def create_checkout_session():
    """
    Create a Stripe Checkout session for a subscription.
    """
    data = request.get_json()
    plan_name = data.get("plan")
    price_id = data.get("priceId")
    
    if not plan_name or not price_id:
        return jsonify({"error": "Plan name and priceId are required"}), 400
        
    user = g.current_user
    
    # Safely check if user already has a Stripe Customer ID
    sub_info = user.get("subscription") or {}
    stripe_customer_id = sub_info.get("stripe_customer_id")
    
    if not stripe.api_key:
        logger.error("STRIPE_SECRET_KEY is not set in environment variables")
        return jsonify({"error": "Billing service misconfigured (missing API key)"}), 500

    try:
        checkout_params = {
            'payment_method_types': ['card'],
            'line_items': [{
                'price': price_id,
                'quantity': 1,
            }],
            'mode': 'subscription',
            'success_url': os.getenv("APP_WEB_REDIRECT_URI", "https://publefy.com/") + "?success=true",
            'cancel_url': os.getenv("APP_WEB_REDIRECT_URI", "https://publefy.com/") + "?canceled=true",
            'client_reference_id': str(user["_id"]),
            'metadata': {
                "plan": plan_name,
                "user_id": str(user["_id"])
            }
        }
        
        # If we have a customer ID, use it. Otherwise, use email.
        if stripe_customer_id:
            checkout_params['customer'] = stripe_customer_id
        else:
            checkout_params['customer_email'] = user.get("email")

        session = stripe.checkout.Session.create(**checkout_params)
        return jsonify({"url": session.url})
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        # Return the actual error message so we can debug in the browser
        return jsonify({"error": str(e)}), 500

@billing_blueprint.route("/create-portal-session", methods=["POST"])
@login_required
def create_portal_session():
    """
    Create a Stripe Customer Portal session.
    """
    user = g.current_user
    sub_info = user.get("subscription", {})
    stripe_customer_id = sub_info.get("stripe_customer_id")
    
    if not stripe_customer_id:
        # If user doesn't have a customer ID yet, they haven't subscribed
        return jsonify({"error": "No stripe customer found. Please subscribe first."}), 400
        
    try:
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            configuration=os.getenv("STRIPE_PORTAL_CONFIG_ID"),
            return_url=os.getenv("APP_WEB_REDIRECT_URI", "https://publefy.com/"),
        )
        return jsonify({"url": session.url})
    except Exception as e:
        logger.error(f"Error creating portal session: {str(e)}")
        return jsonify({"error": "Could not create billing portal session"}), 500

@billing_blueprint.route("/webhook", methods=["POST"])
def stripe_webhook():
    """
    Handle Stripe webhooks.
    """
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")

    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET not set")
        return jsonify({"error": "Webhook secret not configured"}), 500

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({"error": "Invalid signature"}), 400

    event_type = event['type']
    data_object = event['data']['object']

    logger.info(f"Handling Stripe event: {event_type}")

    if event_type == 'checkout.session.completed':
        _handle_checkout_session(data_object)
    elif event_type == 'customer.subscription.updated':
        _handle_subscription_updated(data_object)
    elif event_type == 'customer.subscription.deleted':
        _handle_subscription_deleted(data_object)
    elif event_type == 'invoice.paid':
        _handle_invoice_paid(data_object)

    return jsonify({"status": "success"}), 200

def _handle_checkout_session(session):
    user_id = session.get('client_reference_id')
    customer_id = session.get('customer')
    subscription_id = session.get('subscription')
    
    # Plan info from metadata (you should send this when creating checkout session)
    plan = session.get('metadata', {}).get('plan', 'entry')

    if not user_id:
        # Fallback to email lookup if client_reference_id is missing
        email = session.get('customer_details', {}).get('email')
        if email:
            user = db.users.find_one({"email": email})
            if user:
                user_id = str(user["_id"])

    if user_id:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "subscription.stripe_customer_id": customer_id,
                "subscription.stripe_subscription_id": subscription_id,
                "subscription.plan": plan,
                "subscription.status": "active",
                "subscription.last_updated": datetime.utcnow()
            }}
        )
        logger.info(f"Updated user {user_id} with subscription {subscription_id}")

def _handle_subscription_updated(subscription):
    customer_id = subscription.get('customer')
    status = subscription.get('status')
    cancel_at_period_end = subscription.get('cancel_at_period_end')
    current_period_end = datetime.fromtimestamp(subscription.get('current_period_end'))
    
    # Try to get plan from metadata of subscription or items
    plan = subscription.get('metadata', {}).get('plan')
    
    update_data = {
        "subscription.status": status,
        "subscription.cancel_at_period_end": cancel_at_period_end,
        "subscription.current_period_end": current_period_end,
        "subscription.last_updated": datetime.utcnow()
    }
    
    if plan:
        update_data["subscription.plan"] = plan

    db.users.update_one(
        {"subscription.stripe_customer_id": customer_id},
        {"$set": update_data}
    )
    logger.info(f"Updated subscription status for customer {customer_id} to {status}")

def _handle_subscription_deleted(subscription):
    customer_id = subscription.get('customer')
    db.users.update_one(
        {"subscription.stripe_customer_id": customer_id},
        {"$set": {
            "subscription.plan": "free",
            "subscription.status": "canceled",
            "subscription.stripe_subscription_id": None,
            "subscription.last_updated": datetime.utcnow()
        }}
    )
    logger.info(f"Canceled subscription for customer {customer_id}")

def _handle_invoice_paid(invoice):
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    
    if subscription_id:
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            current_period_end = datetime.fromtimestamp(subscription.current_period_end)
            
            db.users.update_one(
                {"subscription.stripe_customer_id": customer_id},
                {"$set": {
                    "subscription.current_period_end": current_period_end,
                    "subscription.status": "active",
                    "subscription.last_updated": datetime.utcnow()
                }}
            )
            logger.info(f"Invoice paid: Updated period end for customer {customer_id}")
        except Exception as e:
            logger.error(f"Error updating period end on invoice.paid: {str(e)}")

