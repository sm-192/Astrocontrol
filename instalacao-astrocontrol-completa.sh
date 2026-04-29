#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  AstroControl — Instalação Completa (Xpra edition)
#  Raspberry Pi OS Bookworm 64-bit (ou Debian 12)
#
#  O que este script instala:
#   ✓ Dependências do sistema (Node.js 20, Python 3, git, etc.)
#   ✓ INDI + KStars + PHD2
#   ✓ Xpra (substitui noVNC + x11vnc) com HTML5 client integrado
#   ✓ Desktop XFCE no display :3 (backup via Xpra com auth PAM)
#   ✓ KStars no display :1, PHD2 no display :2
#   ✓ ttyd (terminal web)
#   ✓ gpsd (GPS M8N)
#   ✓ Node.js + AstroControl PWA
#
#  Portas:
#   3000  → AstroControl PWA (Node.js)
#   6080  → Xpra HTML5 · KStars  (display :1)
#   6081  → Xpra HTML5 · PHD2    (display :2)
#   6082  → Xpra HTML5 · Desktop (display :3, auth Linux PAM)
#   7624  → indiserver
#   7681  → ttyd (terminal web)
#   8624  → INDI Web Manager
#   8765  → Python bridge (sensores IMU/GPS)
#   2947  → gpsd
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

ASTRO_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
ASTRO_DIR="/home/${ASTRO_USER}/AstroControl"
TTYD_PASS="ls100619"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

print_header()  { echo -e "\n${BLUE}═══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════${NC}"; }
print_step()    { echo -e "${YELLOW}  → $1${NC}"; }
print_success() { echo -e "${GREEN}  ✓ $1${NC}"; }
print_error()   { echo -e "${RED}  ✗ $1${NC}"; }

[[ $EUID -ne 0 ]] && { print_error "Execute como root: sudo bash $0"; exit 1; }

echo -e "${GREEN}  AstroControl Xpra Edition — Iniciando instalação${NC}"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 1: Atualização do sistema"
apt update -qq && apt upgrade -y -qq
mkdir -p /etc/astrocontrol
print_success "Sistema atualizado"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 2: Dependências base"
apt install -y -qq \
    curl wget git build-essential \
    python3 python3-pip python3-venv python3-websockets python3-serial \
    xfce4 xfce4-terminal dbus-x11 x11-xserver-utils
print_success "Dependências base OK"

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    print_step "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -qq
    apt install -y -qq nodejs
fi
print_success "Node.js $(node -v)"

# ═══════════════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 4: Xpra (substitui VNC + noVNC)"

print_step "Xpra já detectado: $(xpra --version 2>&1 | head -1)"

# Configuração global do Xpra
mkdir -p /etc/xpra /var/log/xpra
chown "${ASTRO_USER}:${ASTRO_USER}" /var/log/xpra

cat > /etc/xpra/xpra.conf << 'EOF'
# AstroControl — Xpra global config
encoding = auto
dpi = auto
cursor-size = 0
compress = 1
notifications = no
bell = no
sharing = yes
html = on
bind-tcp = 0.0.0.0
log-dir = /var/log/xpra
EOF

# ─── xpra-html5: configuração para funcionar em iframe ─────────────────────
# O Xpra HTML5 pode servir headers X-Frame-Options que bloqueiam iframes.
# Precisamos remover isso para o AstroControl PWA poder embutir as sessões.

# Detecta onde o xpra-html5 instala os arquivos web
XPRA_HTML5_DIR=""
for DIR in /usr/share/xpra/www /usr/share/xpra-html5 \
           /usr/lib/python3/dist-packages/xpra/client/html5/www \
           /opt/xpra/www; do
    if [ -f "${DIR}/index.html" ]; then
        XPRA_HTML5_DIR="${DIR}"
        break
    fi
done

if [ -n "${XPRA_HTML5_DIR}" ]; then
    print_step "Configurando xpra-html5 em ${XPRA_HTML5_DIR}..."

    # Remove X-Frame-Options do index.html se presente como meta tag
    sed -i '/X-Frame-Options/d' "${XPRA_HTML5_DIR}/index.html" 2>/dev/null || true

    # Patch no servidor Python do Xpra para remover o header X-Frame-Options
    # O arquivo que serve os headers HTTP do cliente HTML5
    for PYFILE in \
        /usr/lib/python3/dist-packages/xpra/server/websocket.py \
        /usr/lib/python3/dist-packages/xpra/net/websockets/handler.py \
        /usr/lib/python3/dist-packages/xpra/server/http_handler.py; do
        if [ -f "${PYFILE}" ]; then
            sed -i 's/X-Frame-Options.*SAMEORIGIN/X-Frame-Options: ALLOWALL/g' "${PYFILE}" 2>/dev/null || true
            sed -i 's/"X-Frame-Options".*"SAMEORIGIN"/"X-Frame-Options": "ALLOWALL"/g' "${PYFILE}" 2>/dev/null || true
            print_success "Patched: $(basename ${PYFILE})"
        fi
    done

    # Cria settings.js com defaults para o cliente HTML5
    cat > "${XPRA_HTML5_DIR}/settings.js" << 'EOF'
// AstroControl — xpra-html5 default settings
(function() {
  var defaults = {
    "server"        : window.location.hostname,
    "ssl"           : false,
    "encoding"      : "auto",
    "autoreconnect" : true,
    "clipboard"     : true,
    "notifications" : false,
    "bell"          : false,
    "language"      : "pt-br",
    "sharing"       : false,
    "floating_menu" : false,
    "toolbar"       : false,
  };
  // Aplica defaults apenas se não definidos via hash
  if (typeof XPRA_SETTINGS === "undefined") window.XPRA_SETTINGS = {};
  Object.keys(defaults).forEach(function(k) {
    if (!(k in window.XPRA_SETTINGS)) window.XPRA_SETTINGS[k] = defaults[k];
  });
})();
EOF
    print_success "xpra-html5 configurado em ${XPRA_HTML5_DIR}"
else
    print_error "xpra-html5 dir não encontrado — configure manualmente"
fi

# ─── xpra-kstars.service ────────────────────────────────────────────────────
cat > /etc/systemd/system/xpra-kstars.service << EOF
[Unit]
Description=Xpra session for KStars (display :1, port 6080)
After=network.target

[Service]
Type=simple
User=${ASTRO_USER}
Environment=HOME=/home/${ASTRO_USER}
ExecStart=/usr/bin/xpra start :1 \
    --bind-tcp=0.0.0.0:6080 \
    --html=on \
    --tcp-auth=none \
    --encoding=auto \
    --dpi=auto \
    --start-child=kstars \
    --exit-with-children=no \
    --sharing=yes \
    --daemon=no \
    --notifications=no \
    --bell=no \
    --systemd-run=no \
    --log-file=/var/log/xpra/kstars.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# ─── xpra-phd2.service ──────────────────────────────────────────────────────
cat > /etc/systemd/system/xpra-phd2.service << EOF
[Unit]
Description=Xpra session for PHD2 (display :2, port 6081)
After=network.target

[Service]
Type=simple
User=${ASTRO_USER}
Environment=HOME=/home/${ASTRO_USER}
ExecStart=/usr/bin/xpra start :2 \
    --bind-tcp=0.0.0.0:6081 \
    --html=on \
    --tcp-auth=none \
    --encoding=auto \
    --dpi=auto \
    --start-child=phd2 \
    --exit-with-children=no \
    --sharing=yes \
    --daemon=no \
    --notifications=no \
    --bell=no \
    --systemd-run=no \
    --log-file=/var/log/xpra/phd2.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# ─── xpra-desktop.service (XFCE, auth PAM) ──────────────────────────────────
cat > /etc/systemd/system/xpra-desktop.service << EOF
[Unit]
Description=Xpra XFCE desktop (display :3, port 6082, PAM auth)
After=network.target

[Service]
Type=simple
User=${ASTRO_USER}
Environment=HOME=/home/${ASTRO_USER}
ExecStart=/usr/bin/xpra start-desktop :3 \
    --bind-tcp=0.0.0.0:6082 \
    --html=on \
    --tcp-auth=pam \
    --encoding=auto \
    --dpi=auto \
    --start-child=xfce4-session \
    --exit-with-children=no \
    --sharing=no \
    --daemon=no \
    --notifications=no \
    --bell=no \
    --systemd-run=no \
    --log-file=/var/log/xpra/desktop.log
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_success "Serviços Xpra: :6080 (KStars), :6081 (PHD2), :6082 (Desktop+auth)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 5: ttyd (terminal web)"
if ! command -v ttyd &>/dev/null; then
    ARCH=$(uname -m)
    case "$ARCH" in aarch64) TA="aarch64";; armv7l) TA="arm";; *) TA="x86_64";; esac
    TVER=$(curl -s https://api.github.com/repos/tsl0922/ttyd/releases/latest | grep tag_name | cut -d'"' -f4)
    wget -qO /usr/local/bin/ttyd \
        "https://github.com/tsl0922/ttyd/releases/download/${TVER}/ttyd.${TA}"
    chmod +x /usr/local/bin/ttyd
fi
cat > /etc/systemd/system/ttyd.service << EOF
[Unit]
Description=ttyd Web Terminal
After=network.target
[Service]
Type=simple
User=${ASTRO_USER}
ExecStart=/usr/local/bin/ttyd \
    --port 7681 \
    --credential ${ASTRO_USER}:${TTYD_PASS} \
    --interface 0.0.0.0 \
    --no-check-origin \
    bash
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
print_success "ttyd configurado (:7681)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 6: gpsd"
apt install -y -qq gpsd gpsd-clients
cat > /etc/default/gpsd << 'EOF'
START_DAEMON="true"
USBAUTO="true"
DEVICES="/dev/ttyACM0 /dev/ttyUSB0"
GPSD_OPTIONS="-n"
GPSD_SOCKET="/var/run/gpsd.sock"
EOF
print_success "gpsd configurado (:2947)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 7: AstroControl PWA"
mkdir -p "${ASTRO_DIR}"
cp -r "$(dirname "$0")/." "${ASTRO_DIR}/"
chown -R "${ASTRO_USER}:${ASTRO_USER}" "${ASTRO_DIR}"
cd "${ASTRO_DIR}" && sudo -u "${ASTRO_USER}" npm install --production --silent

cat > /etc/systemd/system/astrocontrol.service << EOF
[Unit]
Description=AstroControl PWA (Node.js)
After=network.target
[Service]
Type=simple
User=${ASTRO_USER}
WorkingDirectory=${ASTRO_DIR}
ExecStart=/usr/bin/node ${ASTRO_DIR}/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
print_success "AstroControl PWA configurado (:3000)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 8: Python bridge (IMU/GPS)"
pip3 install --break-system-packages websockets pyserial smbus2 2>/dev/null || true
cat > /etc/systemd/system/astro-bridge.service << EOF
[Unit]
Description=AstroControl Python Bridge
After=network.target
[Service]
Type=simple
User=${ASTRO_USER}
WorkingDirectory=${ASTRO_DIR}
ExecStart=/usr/bin/python3 ${ASTRO_DIR}/bridge.py
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF
print_success "Python bridge configurado (:8765)"

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 9: Ativando serviços"
systemctl daemon-reload
for SVC in gpsd ttyd astrocontrol astro-bridge xpra-kstars xpra-phd2 xpra-desktop; do
    systemctl enable "$SVC" 2>/dev/null && systemctl restart "$SVC" 2>/dev/null \
        && print_success "$SVC OK" \
        || print_error "$SVC falhou — verifique: journalctl -u $SVC"
done

# ═══════════════════════════════════════════════════════════════════════════
print_header "PASSO 10: Firewall"
if command -v ufw &>/dev/null; then
    for PORT_DESC in "3000/tcp:AstroControl PWA" "6080/tcp:Xpra KStars" "6081/tcp:Xpra PHD2" \
                     "6082/tcp:Xpra Desktop" "7624/tcp:indiserver" "7681/tcp:ttyd" \
                     "8624/tcp:INDI Web Manager" "8765/tcp:Python bridge" "2947/tcp:gpsd"; do
        PORT="${PORT_DESC%%:*}"; DESC="${PORT_DESC##*:}"
        ufw allow "$PORT" comment "$DESC" &>/dev/null
    done
    print_success "Portas liberadas no ufw"
fi

# ═══════════════════════════════════════════════════════════════════════════
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       INSTALAÇÃO CONCLUÍDA — AstroControl Xpra       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
printf "${GREEN}║  %-52s║${NC}\n" "PWA:          http://${IP}:3000"
printf "${GREEN}║  %-52s║${NC}\n" "KStars Xpra:  http://${IP}:6080"
printf "${GREEN}║  %-52s║${NC}\n" "PHD2 Xpra:    http://${IP}:6081"
printf "${GREEN}║  %-52s║${NC}\n" "Desktop Xpra: http://${IP}:6082  (auth Linux)"
printf "${GREEN}║  %-52s║${NC}\n" "Terminal web: http://${IP}:7681"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  DPI e resolução: detectados automaticamente pelo PWA ║${NC}"
echo -e "${GREEN}║  Desktop auth: usuário + senha Linux (PAM)            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}  Nota: se xpra-kstars/phd2 não iniciarem de imediato,${NC}"
echo -e "${YELLOW}  reinicie após o primeiro login gráfico do usuário:${NC}"
echo -e "${YELLOW}  sudo systemctl restart xpra-kstars xpra-phd2 xpra-desktop${NC}"
echo ""
