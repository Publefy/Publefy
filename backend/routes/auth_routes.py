
from flask import Blueprint, request, jsonify, redirect, session, current_app
from werkzeug.exceptions import BadRequest, Unauthorized
from models.user import UserCreate
from auth.auth_handler import hash_password, verify_password, create_access_token
from auth.dependencies import login_required
from database import db
import sentry_sdk

# ==== OAUTH START ====
import os, secrets, time, json, base64, requests
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from datetime import datetime, timezone

# Facebook
# Support both legacy and common env var names
FB_APP_ID_Client = os.getenv("FB_APP_ID", "25266816979636362")
FB_APP_SECRET_Client = os.getenv("FB_APP_SECRET", "bfc276034da82f0f60ac7112163d809a")
FB_LOGIN_REDIRECT_URI = os.getenv("FB_LOGIN_REDIRECT_URI")
GRAPH_API_URL = "https://graph.facebook.com/v23.0"

# Google
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_LOGIN_REDIRECT_URI = "https://publefy-1020068343725.us-central1.run.app/auth/google/callback"
GOOGLE_LOGIN_REDIRECT_URI_LOCAL = "http://127.0.0.1:8000/auth/google/callback"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
APP_WEB_REDIRECT_URI = os.getenv("APP_WEB_REDIRECT_URI", "https://publefy.com/")
APP_WEB_REDIRECT_URI_LOCAL = os.getenv("APP_WEB_REDIRECT_URI_LOCAL")
APP_WEB_DEFAULT_PATH = os.getenv("APP_WEB_DEFAULT_PATH", "/")
APP_WEB_FORCE_LOCAL = os.getenv("APP_WEB_FORCE_LOCAL", "0").lower() in ("1", "true", "yes", "on")
OAUTH_RETURN_JSON_ALWAYS = os.getenv("OAUTH_RETURN_JSON_ALWAYS", "0").lower() in ("1", "true", "yes", "on")
OAUTH_ALLOW_STATELESS_FACEBOOK = os.getenv("OAUTH_ALLOW_STATELESS_FACEBOOK", "0").lower() in ("1", "true", "yes", "on")

STATE_KEY = "oauth_state"
STATE_TS = "oauth_state_ts"

def _now_iso():
    return datetime.now(timezone.utc).isoformat()

def _set_state():
    s = secrets.token_urlsafe(24)
    session[STATE_KEY] = s
    session[STATE_TS] = int(time.time())
    return s

def _verify_state(in_state: str, max_age=600):
    try:
        expected = session.get(STATE_KEY)
        ts = session.get(STATE_TS, 0)
        ok = expected and in_state and (expected == in_state) and (int(time.time()) - ts) <= max_age
    finally:
        session.pop(STATE_KEY, None)
        session.pop(STATE_TS, None)
    return ok

def _issue_login_response(user: dict):
    token = create_access_token({"sub": user["_id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "subscription": user.get("subscription", {"plan": "free", "status": "active"}),
        },
    }

def _select_redirect_uri_for_facebook(default_env_value: str | None) -> str:
    """
    Host-aware Facebook redirect_uri selection:
    - If env provides a single or comma-separated list, try to match current host
    - Otherwise fall back to {current_host}/auth/facebook/callback
    """
    host = request.host.lower()
    if default_env_value:
        parts = [u.strip() for u in default_env_value.split(",") if u.strip()]
        for uri in parts:
            try:
                p = urlparse(uri)
                if p.netloc.lower() == host:
                    return uri
            except Exception:
                continue
        if parts:
            return parts[0]
    base = request.host_url.rstrip("/")
    return f"{base}/auth/facebook/callback"

def _select_redirect_uri_for_google(default_env_value: str | None) -> str:
    """
    Host-aware Google redirect_uri selection:
    - If running on localhost/127.0.0.1 and GOOGLE_LOGIN_REDIRECT_URI_LOCAL set → use it
    - Else if GOOGLE_LOGIN_REDIRECT_URI is list → pick entry matching current host
    - Else if single GOOGLE_LOGIN_REDIRECT_URI → use it
    - Else fallback to {current_host}/auth/google/callback
    """
    host = request.host.lower()
    if host.startswith("127.0.0.1") or host.startswith("localhost"):
        if GOOGLE_LOGIN_REDIRECT_URI_LOCAL:
            return GOOGLE_LOGIN_REDIRECT_URI_LOCAL.strip()
    if default_env_value:
        parts = [u.strip() for u in default_env_value.split(",") if u.strip()]
        for uri in parts:
            try:
                p = urlparse(uri)
                if p.netloc.lower() == host:
                    return uri
            except Exception:
                continue
        if parts:
            return parts[0]
    base = request.host_url.rstrip("/")
    return f"{base}/auth/google/callback"

def _select_app_return_uri() -> str:
    """
    Decide where to redirect SPA after successful OAuth callback.
    Priority:
      1) explicit redirect_uri query param (if provided by caller)
      2) local base from APP_WEB_REDIRECT_URI_LOCAL when host is localhost/127.*
      3) APP_WEB_REDIRECT_URI (prod or first-listed)
    If the chosen base has no path, append APP_WEB_DEFAULT_PATH (defaults to /admin).
    """
    explicit = request.args.get("redirect_uri")
    if explicit:
        return explicit

    host = request.host.lower()
    base = None
    is_local_host = host.startswith("127.0.0.1") or host.startswith("localhost")
    if APP_WEB_FORCE_LOCAL or is_local_host:
        if APP_WEB_REDIRECT_URI_LOCAL and APP_WEB_REDIRECT_URI_LOCAL.strip():
            base = APP_WEB_REDIRECT_URI_LOCAL.strip()
        else:
            base = "http://localhost:3000"
    else:
        base = APP_WEB_REDIRECT_URI.split(",")[0].strip() if APP_WEB_REDIRECT_URI else ""

    try:
        parts = urlparse(base)
        path = parts.path or "/"
        default_path = APP_WEB_DEFAULT_PATH if APP_WEB_DEFAULT_PATH.startswith("/") else f"/{APP_WEB_DEFAULT_PATH}"
        if path in (None, "", "/"):
            path = default_path
        rebuilt = urlunparse((parts.scheme, parts.netloc, path, "", "", ""))
        return rebuilt
    except Exception:
        # fallback to computed from current host
        current_base = request.host_url.rstrip("/")
        return f"{current_base}{APP_WEB_DEFAULT_PATH if APP_WEB_DEFAULT_PATH.startswith('/') else '/' + APP_WEB_DEFAULT_PATH}"

def _upsert_user(provider: str, pid: str, name: str, email: str | None, picture: str | None, provider_extra: dict | None=None):
    if not pid:
        raise BadRequest(f"{provider} profile missing id")

    # Normalize email
    if email:
        email = email.strip().lower()

    user = None
    if email:
        user = db.users.find_one({"email": email})
    if not user:
        user = db.users.find_one({f"providers.{provider}.id": pid})

    set_payload = {
        f"providers.{provider}": {"id": pid, "picture": picture or ""},
        "updated_at": _now_iso(),
    }
    if provider_extra:
        set_payload[f"providers.{provider}"].update(provider_extra)

    if user:
        db.users.update_one({"_id": user["_id"]}, {"$set": set_payload})
        user = db.users.find_one({"_id": user["_id"]})
    else:
        if not email:
            email = f"{provider}_{pid}@example.invalid"
        doc = {
            "name": name or f"{provider.title()} User",
            "email": email,
            "providers": {provider: {"id": pid, "picture": picture or "", **(provider_extra or {})}},
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        result = db.users.insert_one(doc)
        user = db.users.find_one({"_id": result.inserted_id})

    user["_id"] = str(user["_id"])
    return user

def _redirect_back(jwt: str, user: dict, return_to: str | None):
    safe_user = {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "subscription": user.get("subscription", {"plan": "free", "status": "active"})
    }
    b64_user = base64.urlsafe_b64encode(json.dumps(safe_user).encode()).decode()
    target = (return_to or APP_WEB_REDIRECT_URI or "/").strip()
    params = urlencode({"access_token": jwt, "user": b64_user})
    return redirect(f"{target}?{params}", code=302)
# ==== OAUTH END ====


auth_blueprint = Blueprint("auth", __name__, url_prefix="/auth")


@auth_blueprint.route("/register", methods=["POST"])
@auth_blueprint.route("/register/", methods=["POST"])
def register():
    """
    Register a new user
    ---
    tags:
      - Auth
    consumes:
      - application/x-www-form-urlencoded
    parameters:
      - name: name
        in: formData
        type: string
        required: true
      - name: email
        in: formData
        type: string
        required: true
      - name: password
        in: formData
        type: string
        required: true
    responses:
      200:
        description: Token & user profile
        schema:
          type: object
          properties:
            access_token:
              type: string
            token_type:
              type: string
              example: bearer
            user:
              type: object
              properties:
                id: { type: string }
                name: { type: string }
                email: { type: string }
      400:
        description: Email already registered or invalid data
        schema:
          type: object
          properties:
            message: { type: string }
    """
    # Accept both form-encoded and JSON bodies
    payload = None
    try:
        if request.is_json:
            payload = request.get_json(silent=True) or {}
            name = (payload.get("name") or "").strip() or None
            email = (payload.get("email") or "").strip().lower() or None
            password = payload.get("password")
        else:
            name = request.form.get("name")
            email = (request.form.get("email") or "").strip().lower()
            password = request.form.get("password")

        user = UserCreate(
            name=name,
            email=email,
            password=password,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise BadRequest("Invalid registration data")

    if user.email:
        sentry_sdk.set_user({"email": user.email})

    try:
        existing = db.users.find_one({"email": user.email})
        if existing:
            sentry_sdk.capture_message(f"Register: Email {user.email} already registered", level="warning")
            raise BadRequest("Email already registered")

        user_dict = user.dict()
        user_dict["password"] = hash_password(user.password)
        result = db.users.insert_one(user_dict)

        user_dict["_id"] = str(result.inserted_id)
        return jsonify(_issue_login_response(user_dict))
    except BadRequest:
        # Forward 400 as-is
        raise
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise


@auth_blueprint.route("/login", methods=["POST"])
@auth_blueprint.route("/login/", methods=["POST"])
def login():
    """
    Login with email/password
    ---
    tags:
      - Auth
    consumes:
      - application/x-www-form-urlencoded
    parameters:
      - name: username
        in: formData
        type: string
        required: true
        description: Email address
      - name: password
        in: formData
        type: string
        required: true
    responses:
      200:
        description: Token & user profile
        schema:
          type: object
          properties:
            access_token:
              type: string
            token_type:
              type: string
              example: bearer
            user:
              type: object
              properties:
                id: { type: string }
                name: { type: string }
                email: { type: string }
      400:
        description: Missing username or password
        schema:
          type: object
          properties:
            message: { type: string }
      401:
        description: Invalid credentials
        schema:
          type: object
          properties:
            message: { type: string }
    """
    # Accept JSON or form: allow { email, password } or { username, password }
    if request.is_json:
        body = request.get_json(silent=True) or {}
        username = (body.get("email") or body.get("username") or "").strip().lower()
        password = body.get("password")
    else:
        form = request.form
        username = (form.get("email") or form.get("username") or "").strip().lower()
        password = form.get("password")

    if username:
        sentry_sdk.set_user({"email": username})

    try:
        if not username or not password:
            sentry_sdk.capture_message("Login: Missing username or password", level="warning")
            raise BadRequest("Username and password are required")

        user = db.users.find_one({"email": username})
        if not user or not verify_password(password, user["password"]):
            sentry_sdk.capture_message(f"Login: Invalid credentials for {username}", level="warning")
            raise Unauthorized("Invalid credentials")

        user["_id"] = str(user["_id"])
        return jsonify(_issue_login_response(user))
    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise


# ===== Facebook OAuth =====
@auth_blueprint.route("/facebook/login", methods=["GET"])
@auth_blueprint.route("/facebook/login/", methods=["GET"])
def facebook_login():
    """
    Start Facebook OAuth
    ---
    tags:
      - OAuth
    parameters:
      - name: redirect_uri
        in: query
        type: string
        required: false
        description: Where to redirect your SPA after successful callback (defaults to APP_WEB_REDIRECT_URI)
    responses:
      302:
        description: Redirect to Facebook OAuth
      400:
        description: OAuth misconfiguration
        schema:
          type: object
          properties:
            message: { type: string }
    """
    chosen_redirect_uri = _select_redirect_uri_for_facebook(FB_LOGIN_REDIRECT_URI)
    session["facebook_chosen_redirect_uri"] = chosen_redirect_uri

    if not all([FB_APP_ID_Client, chosen_redirect_uri]):
        sentry_sdk.capture_message("FB OAuth misconfigured", level="error")
        raise BadRequest("Facebook OAuth is not configured")

    state = _set_state()

    # Remember where to send the user back in YOUR app after callback
    return_to = request.args.get("redirect_uri") or APP_WEB_REDIRECT_URI
    session["fb_return_to"] = return_to

    # Optional inspect mode to debug redirect uri without following Facebook
    if request.args.get("inspect"):
        fb_params = {
            "client_id": FB_APP_ID_Client,
            "redirect_uri": chosen_redirect_uri,
            "response_type": "code",
            # "scope": "pages_show_list,public_profile,email",
            "scope": "public_profile,email",
            "state": session.get(STATE_KEY),
        }
        return jsonify({
            "chosen_redirect_uri": chosen_redirect_uri,
            "facebook_auth_url": f"https://www.facebook.com/v23.0/dialog/oauth?{urlencode(fb_params)}",
        })

    params = {
        "client_id": FB_APP_ID_Client,
        "redirect_uri": chosen_redirect_uri,
#        "scope": "pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_engagement,business_management,pages_read_user_content",
        # "scope": "pages_show_list,public_profile,email",
        "scope": "public_profile,email",
        "response_type": "code",
        "state": state,
    }
    return redirect(f"https://www.facebook.com/v23.0/dialog/oauth?{urlencode(params)}")


@auth_blueprint.route("/facebook/callback", methods=["GET"])
@auth_blueprint.route("/facebook/callback/", methods=["GET"])
def facebook_callback():
    """
    Facebook OAuth callback
    ---
    tags:
      - OAuth
    parameters:
      - name: code
        in: query
        type: string
        required: true
      - name: state
        in: query
        type: string
        required: true
    responses:
      302:
        description: Redirect back to SPA with access_token & user in querystring
      400:
        description: Missing/invalid state or token exchange failure
        schema:
          type: object
          properties:
            message: { type: string }
    """
    code = request.args.get("code")
    state = request.args.get("state")

    if not code:
        raise BadRequest("Missing 'code'")
    if not _verify_state(state):
        # Allow fallback when explicitly enabled to survive direct Facebook dialog hits
        if OAUTH_ALLOW_STATELESS_FACEBOOK:
            try:
                current_app.logger.warning("FB OAuth state invalid, proceeding due to OAUTH_ALLOW_STATELESS_FACEBOOK")
            except Exception:
                pass
        else:
            sentry_sdk.capture_message("FB OAuth state invalid", level="warning")
            raise BadRequest("Invalid state")
    chosen_redirect_uri = session.pop("facebook_chosen_redirect_uri", None) or _select_redirect_uri_for_facebook(FB_LOGIN_REDIRECT_URI)

    token_json = requests.get(
        f"{GRAPH_API_URL}/oauth/access_token",
        params={
            "client_id": FB_APP_ID_Client,
            "client_secret": FB_APP_SECRET_Client,
            "redirect_uri": chosen_redirect_uri,
            "code": code,
        },
        timeout=20,
    ).json()
    access_token = token_json.get("access_token")
    if not access_token:
        sentry_sdk.capture_message(f"FB token exchange failed: {token_json}", level="warning")
        raise BadRequest("Failed to get Facebook access token")

    # Fetch profile
    profile = requests.get(
        f"{GRAPH_API_URL}/me",
        params={
            "fields": "id,name,email,picture.width(256).height(256)",
            "access_token": access_token,
        },
        timeout=20,
    ).json()
    if not profile.get("id"):
        sentry_sdk.capture_message(f"FB /me failed: {profile}", level="warning")
        raise BadRequest("Failed to fetch Facebook profile")

    if profile.get("email"):
        sentry_sdk.set_user({"email": profile["email"]})

    user = _upsert_user(
        provider="facebook",
        pid=profile.get("id"),
        name=profile.get("name"),
        email=profile.get("email"),
        picture=((profile.get("picture") or {}).get("data") or {}).get("url"),
        provider_extra={"access_token": access_token},
    )
    jwt = _issue_login_response(user)["access_token"]

    return_to = session.pop("fb_return_to", None) or APP_WEB_REDIRECT_URI
    return _redirect_back(jwt, user, return_to)


# ===== Google OAuth (OIDC) =====
@auth_blueprint.route("/google/login", methods=["GET"])
@auth_blueprint.route("/google/login/", methods=["GET"])
def google_login():
    """
    Start Google OAuth
    ---
    tags:
      - OAuth
    parameters:
      - name: redirect_uri
        in: query
        type: string
        required: false
        description: Where to redirect your SPA after successful callback (defaults to APP_WEB_REDIRECT_URI)
    responses:
      302:
        description: Redirect to Google OAuth
      400:
        description: OAuth misconfiguration
        schema:
          type: object
          properties:
            message: { type: string }
    """
    if not all([GOOGLE_CLIENT_ID, GOOGLE_LOGIN_REDIRECT_URI]):
        sentry_sdk.capture_message("Google OAuth misconfigured", level="error")
        raise BadRequest("Google OAuth is not configured")

    state = _set_state()

    # Optional: Response mode
    if request.args.get("json") in ("1", "true", "yes", "on"):
        session["google_resp_json"] = True

    # Remember SPA return URL too (smart selection)
    return_to = _select_app_return_uri()
    session["google_return_to"] = return_to

    # Determine which redirect_uri to use for Google
    passed_redirect_uri = request.args.get("redirect_uri")
    if passed_redirect_uri:
        chosen_redirect_uri = passed_redirect_uri
    else:
        chosen_redirect_uri = _select_redirect_uri_for_google(GOOGLE_LOGIN_REDIRECT_URI)
        
    session["google_chosen_redirect_uri"] = chosen_redirect_uri
    try:
        current_app.logger.info(f"Google OAuth chosen redirect_uri: {chosen_redirect_uri}")
    except Exception:
        pass

    # Optional inspect mode to debug redirect uri without following Google
    if request.args.get("inspect"):
        google_params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": chosen_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "include_granted_scopes": "true",
            "state": session.get(STATE_KEY),
            "prompt": "consent",
        }
        return jsonify({
            "chosen_redirect_uri": chosen_redirect_uri,
            "google_auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(google_params)}",
        })

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": chosen_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
        "prompt": "consent",
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@auth_blueprint.route("/google/callback", methods=["GET"])
@auth_blueprint.route("/google/callback/", methods=["GET"])
def google_callback():
    """
    Google OAuth callback
    ---
    tags:
      - OAuth
    parameters:
      - name: code
        in: query
        type: string
        required: true
      - name: state
        in: query
        type: string
        required: true
    responses:
      302:
        description: Redirect back to SPA with access_token & user in querystring
      400:
        description: Missing/invalid state or token exchange failure
        schema:
          type: object
          properties:
            message: { type: string }
    """
    code = request.args.get("code")
    state = request.args.get("state")
    # Allow frontend to specify which redirect_uri it used with Google
    explicit_redirect_uri = request.args.get("redirect_uri")

    if not code:
        raise BadRequest("Missing 'code'")
    
    # Verify state if present
    if state and not _verify_state(state):
        sentry_sdk.capture_message("Google OAuth state invalid", level="warning")
        # Log it but don't strictly block JSON requests yet to avoid cross-site session issues
        # raise BadRequest("Invalid state")
        pass

    # Determine which redirect_uri to use for the token exchange
    if explicit_redirect_uri:
        chosen_redirect_uri = explicit_redirect_uri
    else:
        chosen_redirect_uri = session.pop("google_chosen_redirect_uri", None) or _select_redirect_uri_for_google(GOOGLE_LOGIN_REDIRECT_URI)

    token_res = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": chosen_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=20,
    ).json()

    access_token = token_res.get("access_token")
    id_token = token_res.get("id_token")
    if not (access_token or id_token):
        sentry_sdk.capture_message(f"Google token exchange failed: {token_res}", level="warning")
        raise BadRequest("Failed to get Google tokens")

    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    ui = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=20).json()

    sub = ui.get("sub")
    email = ui.get("email")
    name = ui.get("name") or ""
    picture = ui.get("picture") or ""

    if email:
        sentry_sdk.set_user({"email": email})

    user = _upsert_user(
        provider="google",
        pid=sub,
        name=name,
        email=email,
        picture=picture,
        provider_extra={"id_token": id_token} if id_token else None,
    )
    login_payload = _issue_login_response(user)
    jwt = login_payload["access_token"]

    # If JSON requested – return token & user directly instead of redirect
    if OAUTH_RETURN_JSON_ALWAYS or session.pop("google_resp_json", None) or request.args.get("json") in ("1", "true", "yes", "on"):
        return jsonify(login_payload)

    return_to = session.pop("google_return_to", None) or _select_app_return_uri()
    return _redirect_back(jwt, user, return_to)


# ===== Instagram helper (linking, not login) =====
@auth_blueprint.route("/instagram/connect", methods=["GET"])
def instagram_connect():
    """
    Connect Instagram (linking only)
    ---
    tags:
      - OAuth
    parameters:
      - name: token
        in: query
        type: string
        required: true
        description: Current user JWT; user must be signed in already
    responses:
      302:
        description: Redirects to /instagram/login with state=token
      400:
        description: Missing token
        schema:
          type: object
          properties:
            error: { type: string }
    """
    """
    This does NOT sign in with Instagram.
    It forwards the user to your existing /instagram/login flow (Facebook OAuth for IG Business),
    passing the current JWT in `state`. The SPA should already have JWT (logged-in).
    """
    token = request.args.get("token")
    if not token:
        return jsonify({"error": "Missing token. Sign in first, then connect Instagram."}), 400

    api_origin = request.host_url.rstrip("/")
    return redirect(f"{api_origin}/instagram/login?state={token}", code=302)

@auth_blueprint.route("/me", methods=["GET"])
@login_required
def get_me():
    """
    Get current user profile including subscription info
    """
    user = g.current_user
    return jsonify({
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "subscription": user.get("subscription", {"plan": "free", "status": "active"})
    })
