export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("userToken") || getCookie("userToken") || "";
}

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : "";
}
