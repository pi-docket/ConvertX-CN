#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
CERT_DIR="$DATA_DIR/certs"
APP_USER="convertx"

validate_numeric_env() {
  name="$1"
  value="$2"
  case "$value" in
    ""|*[!0-9]*)
      echo "[FATAL] $name must be a numeric integer." >&2
      exit 1
      ;;
  esac
}

read_password() {
  if [ -n "${PDF_SIGN_P12_PASSWORD_FILE:-}" ]; then
    [ -r "$PDF_SIGN_P12_PASSWORD_FILE" ] || { echo "[FATAL] PDF_SIGN_P12_PASSWORD_FILE is not readable" >&2; exit 1; }
    cat "$PDF_SIGN_P12_PASSWORD_FILE"
  else
    printf '%s' "${PDF_SIGN_P12_PASSWORD:-}"
  fi
}

generated_signing_is_valid() {
  p12_path="$1"
  password_path="$2"
  certificate_path="$3"
  [ -s "$p12_path" ] && [ -s "$password_path" ] && [ -s "$certificate_path" ] || return 1
  generated_password="$(cat "$password_path")"
  p12_fingerprint="$(
    openssl pkcs12 -in "$p12_path" -passin "pass:$generated_password" -clcerts -nokeys 2>/dev/null |
      openssl x509 -noout -fingerprint -sha256 2>/dev/null
  )" || return 1
  certificate_fingerprint="$(
    openssl x509 -in "$certificate_path" -noout -fingerprint -sha256 2>/dev/null
  )" || return 1
  [ -n "$p12_fingerprint" ] && [ "$p12_fingerprint" = "$certificate_fingerprint" ]
}

prepare_signing() {
  if [ -n "${PDF_SIGN_P12_PATH:-}" ]; then
    export PDF_SIGN_SELF_SIGNED=false
  else
    export PDF_SIGN_SELF_SIGNED=true
    mkdir -p "$CERT_DIR"
    PDF_SIGN_P12_PATH="$CERT_DIR/signing.p12"
    PDF_SIGN_P12_PASSWORD_FILE="$CERT_DIR/signing.password"
    cert_path="$CERT_DIR/signing.crt"
    if ! generated_signing_is_valid "$PDF_SIGN_P12_PATH" "$PDF_SIGN_P12_PASSWORD_FILE" "$cert_path"; then
      umask 077
      trap 'rm -f "$CERT_DIR/signing.key.tmp" "$CERT_DIR/signing.crt.tmp" "$CERT_DIR/signing.p12.tmp" "$CERT_DIR/signing.password.tmp"' EXIT INT TERM
      password="$(openssl rand -hex 32)"
      openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
        -subj "/CN=ConvertX-CN Deployment/O=ConvertX-CN" \
        -keyout "$CERT_DIR/signing.key.tmp" -out "$CERT_DIR/signing.crt.tmp"
      openssl pkcs12 -export -inkey "$CERT_DIR/signing.key.tmp" \
        -in "$CERT_DIR/signing.crt.tmp" -out "$CERT_DIR/signing.p12.tmp" \
        -passout "pass:$password"
      printf '%s' "$password" > "$CERT_DIR/signing.password.tmp"
      mv "$CERT_DIR/signing.crt.tmp" "$cert_path"
      mv "$CERT_DIR/signing.p12.tmp" "$PDF_SIGN_P12_PATH"
      mv "$CERT_DIR/signing.password.tmp" "$PDF_SIGN_P12_PASSWORD_FILE"
      rm -f "$CERT_DIR/signing.key.tmp"
      trap - EXIT INT TERM
    fi
    chmod 600 "$PDF_SIGN_P12_PATH" "$PDF_SIGN_P12_PASSWORD_FILE"
    chmod 644 "$cert_path"
    export PDF_SIGN_P12_PATH PDF_SIGN_P12_PASSWORD_FILE
  fi
}

validate_signing() {
  [ -r "$PDF_SIGN_P12_PATH" ] || { echo "[FATAL] PDF signing certificate is not readable by runtime user" >&2; exit 1; }
  password="$(read_password)"
  if ! openssl pkcs12 -in "$PDF_SIGN_P12_PATH" -passin "pass:$password" -noout >/dev/null 2>&1; then
    echo "[FATAL] PDF signing certificate validation failed" >&2
    exit 1
  fi
  fingerprint="$(openssl pkcs12 -in "$PDF_SIGN_P12_PATH" -passin "pass:$password" -clcerts -nokeys 2>/dev/null | openssl x509 -noout -fingerprint -sha256)"
  echo "[INFO] PDF signing certificate $fingerprint"
  PDF_SIGN_SCRIPT_PATH="${PDF_SIGN_SCRIPT_PATH:-/app/scripts/pdf_sign.py}"
  export PDF_SIGN_SCRIPT_PATH
  if command -v python3 >/dev/null 2>&1 && [ -r "$PDF_SIGN_SCRIPT_PATH" ] && python3 -c "import endesive, cryptography" >/dev/null 2>&1; then
    export PDF_SIGNING_AVAILABLE=true
  else
    export PDF_SIGNING_AVAILABLE=false
    echo "[WARN] PDF signing tool is unavailable; signed formats are hidden."
  fi
  if [ "${PDF_SIGN_SELF_SIGNED:-false}" = true ]; then
    echo "[WARN] PDF signing uses this deployment's self-signed certificate; it is not CA identity verification."
  fi
}

if [ "$(id -u)" = "0" ]; then
  if [ -n "${PGID:-}" ] && [ -z "${PUID:-}" ]; then
    echo "[FATAL] PGID requires PUID to be set." >&2
    exit 1
  fi
  if [ -n "${PUID:-}" ]; then
    validate_numeric_env "PUID" "$PUID"
    runtime_uid="$PUID"
    runtime_gid="${PGID:-$PUID}"
    validate_numeric_env "PGID" "$runtime_gid"
    umask "${UMASK:-002}"
  else
    runtime_uid="$(id -u "$APP_USER")"
    runtime_gid="$(id -g "$APP_USER")"
    if [ -n "${UMASK:-}" ]; then
      umask "$UMASK"
    fi
  fi

  if [ "$runtime_gid" != "$(id -g "$APP_USER")" ]; then
    groupmod -o -g "$runtime_gid" "$APP_USER"
  fi
  if [ "$runtime_uid" != "$(id -u "$APP_USER")" ]; then
    usermod -o -u "$runtime_uid" "$APP_USER"
  fi

  mkdir -p "$DATA_DIR"
  marker="$DATA_DIR/.permissions-v1"
  if [ ! -e "$marker" ]; then
    chown -R "$runtime_uid:$runtime_gid" "$DATA_DIR"
    : > "$marker"
    chown "$runtime_uid:$runtime_gid" "$marker"
  fi
  prepare_signing
  chown -R "$runtime_uid:$runtime_gid" "$CERT_DIR" /home/convertx 2>/dev/null || true
  exec gosu "$APP_USER" "$0" "$@"
fi

export HOME="/home/convertx"
validate_signing
export MINERU_BACKEND="${MINERU_BACKEND:-pipeline}"
export VLM_AVAILABLE="${VLM_AVAILABLE:-false}"
export VLM_FALLBACK="${VLM_FALLBACK:-true}"
exec bun run dist/src/index.js "$@"
