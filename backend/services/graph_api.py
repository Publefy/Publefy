
import os
import hmac
import hashlib
import requests
from typing import Dict, Any, Optional


FB_APP_ID = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
GRAPH_API_URL = os.getenv("GRAPH_API_URL", "https://graph.facebook.com/v23.0")

def _appsecret_proof(token: str) -> str:
    if not FB_APP_SECRET:
        raise RuntimeError("FB_APP_SECRET is not set")
    return hmac.new(
        FB_APP_SECRET.encode("utf-8"),
        msg=token.encode("utf-8"),
        digestmod=hashlib.sha256
    ).hexdigest()

def graph_get(path: str, access_token: str, **params) -> requests.Response:
    p = {"access_token": access_token, "appsecret_proof": _appsecret_proof(access_token)}
    p.update(params or {})
    return requests.get(f"{GRAPH_API_URL}{path}", params=p, timeout=30)

def graph_post(path: str, access_token: str, **params) -> requests.Response:
    p = {"access_token": access_token, "appsecret_proof": _appsecret_proof(access_token)}
    p.update(params or {})
    return requests.post(f"{GRAPH_API_URL}{path}", params=p, timeout=30)

def debug_token(input_token: str) -> Dict[str, Any]:
    if not (FB_APP_ID and FB_APP_SECRET):
        raise RuntimeError("FB_APP_ID/FB_APP_SECRET are not set")
    r = requests.get(
        f"{GRAPH_API_URL}/debug_token",
        params={
            "input_token": input_token,
            "access_token": f"{FB_APP_ID}|{FB_APP_SECRET}",
        },
        timeout=30,
    )
    return r.json()

def exchange_long_lived_user_token(short_lived_user_token: str) -> Dict[str, Any]:
    if not (FB_APP_ID and FB_APP_SECRET):
        raise RuntimeError("FB_APP_ID/FB_APP_SECRET are not set")
    r = requests.get(
        f"{GRAPH_API_URL}/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": FB_APP_ID,
            "client_secret": FB_APP_SECRET,
            "fb_exchange_token": short_lived_user_token,
        },
        timeout=30,
    )
    return r.json()

def is_token_invalid(graph_json: Dict[str, Any]) -> bool:
    if not isinstance(graph_json, dict):
        return False
    err = graph_json.get("error") or {}
    code = err.get("code")
    subcode = err.get("error_subcode")
    return code == 190 or subcode in (458, 459, 460, 463, 467)
