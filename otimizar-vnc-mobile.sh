#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# AstroControl — Otimizações VNC Mobile + Correção Terminal
# ═══════════════════════════════════════════════════════════════════════════
#
# Aplica 3 correções:
#   1. Remove barra azul "Send CtrlAltDel"
#   2. Ajuste automático ao tamanho do dispositivo
#   3. Remove cursor fantasma no mobile (clique direto)
#   4. BONUS: Corrige terminal ttyd
#
# Execute como root: sudo bash otimizar-vnc-mobile.sh
#
# ═══════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}✗${NC} Execute como root: sudo bash $0"
    exit 1
fi

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         OTIMIZAÇÕES VNC MOBILE + CORREÇÃO TERMINAL                        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

NOVNC_DIR="/usr/share/novnc"
BACKUP_DIR="/root/novnc-backup-$(date +%Y%m%d-%H%M%S)"

# ═══════════════════════════════════════════════════════════════════════════
# PASSO 1: Backup do noVNC original
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[1/4]${NC} Fazendo backup do noVNC original..."

if [ -d "$NOVNC_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$NOVNC_DIR" "$BACKUP_DIR/"
    echo -e "${GREEN}✓${NC} Backup criado em: $BACKUP_DIR"
else
    echo -e "${RED}✗${NC} Diretório $NOVNC_DIR não encontrado!"
    echo -e "${YELLOW}ℹ${NC} Instalando noVNC..."
    apt install -y novnc
fi

# ═══════════════════════════════════════════════════════════════════════════
# PASSO 2: Criar página customizada vnc_mobile.html
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[2/4]${NC} Criando página VNC customizada para mobile..."

cat > "${NOVNC_DIR}/vnc_mobile.html" << 'VNCEOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <title>AstroControl VNC</title>
    <link rel="stylesheet" href="app/styles/base.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            width: 100%; height: 100%; overflow: hidden;
            background: #000; -webkit-touch-callout: none;
            -webkit-user-select: none; user-select: none;
        }
        #noVNC_control_bar_anchor, #noVNC_control_bar,
        .noVNC_status_bar, #noVNC_status, #noVNC_status_bar {
            display: none !important;
        }
        #noVNC_container {
            width: 100vw !important; height: 100vh !important;
            position: fixed !important; top: 0 !important;
            left: 0 !important; overflow: hidden !important;
        }
        #noVNC_screen {
            width: 100% !important; height: 100% !important;
            display: flex !important; align-items: center !important;
            justify-content: center !important;
        }
        #noVNC_canvas {
            max-width: 100% !important; max-height: 100% !important;
            width: auto !important; height: auto !important;
            object-fit: contain !important;
        }
        .noVNC_cursor { display: none !important; }
        #noVNC_canvas:active { opacity: 0.95; }
        .loading {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%); color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 16px; text-align: center; z-index: 9999;
        }
        .loading::after {
            content: "Conectando..."; display: block;
            margin-top: 10px; font-size: 14px; opacity: 0.7;
        }
        .connected .loading { display: none; }
    </style>
</head>
<body>
    <div class="loading">⏳</div>
    <div id="noVNC_container">
        <div id="noVNC_screen">
            <canvas id="noVNC_canvas" width="0" height="0" tabindex="-1">
                Canvas não suportado.
            </canvas>
        </div>
    </div>
    <script type="module" crossorigin="anonymous">
        import RFB from './core/rfb.js';
        const params = new URLSearchParams(window.location.search);
        const host = params.get('host') || window.location.hostname;
        const port = params.get('port') || window.location.port || '6080';
        const path = params.get('path') || 'websockify';
        const password = params.get('password') || '';
        const autoconnect = params.get('autoconnect') !== '0';
        const reconnect = params.get('reconnect') !== '0';
        const scaleMode = params.get('resize') || 'scale';
        const quality = parseInt(params.get('quality')) || 6;
        const compression = parseInt(params.get('compression')) || 2;
        let rfb, reconnectTimeout;

        function connect() {
            const url = \`ws\${window.location.protocol === 'https:' ? 's' : ''}://\${host}:\${port}/\${path}\`;
            console.log('[VNC] Conectando:', url);
            try {
                rfb = new RFB(document.getElementById('noVNC_canvas'), url, {
                    credentials: { password: password },
                    shared: true,
                    scaleViewport: scaleMode === 'scale',
                    resizeSession: scaleMode === 'remote',
                    qualityLevel: quality,
                    compressionLevel: compression,
                    showDotCursor: false,
                    viewOnly: false,
                    focusOnClick: true,
                });
                rfb.addEventListener('connect', () => {
                    console.log('[VNC] Conectado');
                    document.body.classList.add('connected');
                    resizeCanvas();
                });
                rfb.addEventListener('disconnect', (e) => {
                    console.log('[VNC] Desconectado');
                    document.body.classList.remove('connected');
                    if (reconnect && !e.detail.clean) {
                        reconnectTimeout = setTimeout(connect, 3000);
                    }
                });
                rfb.addEventListener('credentialsrequired', () => {
                    const pwd = prompt('Digite a senha VNC:');
                    if (pwd) rfb.sendCredentials({ password: pwd });
                });
                window.addEventListener('resize', resizeCanvas);
                window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 300));
            } catch (err) {
                console.error('[VNC] Erro:', err);
                if (reconnect) setTimeout(connect, 3000);
            }
        }

        function resizeCanvas() {
            if (!rfb) return;
            const canvas = document.getElementById('noVNC_canvas');
            if (!canvas || canvas.width === 0 || canvas.height === 0) return;
            const scaleX = window.innerWidth / canvas.width;
            const scaleY = window.innerHeight / canvas.height;
            const scale = Math.min(scaleX, scaleY);
            canvas.style.width = (canvas.width * scale) + 'px';
            canvas.style.height = (canvas.height * scale) + 'px';
        }

        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('noVNC_canvas');
            canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
            document.addEventListener('gesturestart', (e) => e.preventDefault());
            if (autoconnect) connect();
        });

        window.addEventListener('beforeunload', () => {
            if (rfb) rfb.disconnect();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        });
    </script>
</body>
</html>
VNCEOF

chmod 644 "${NOVNC_DIR}/vnc_mobile.html"
echo -e "${GREEN}✓${NC} Página VNC mobile criada"

# ═══════════════════════════════════════════════════════════════════════════
# PASSO 3: Atualizar app.js para usar vnc_mobile.html
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[3/4]${NC} Instruções para atualizar app.js..."

echo ""
echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  AÇÃO NECESSÁRIA: Atualizar app.js no projeto AstroControl               ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "No arquivo ~/astrocontrol/app.js, altere a função connectVNC:"
echo ""
echo -e "${CYAN}ANTES:${NC}"
echo "  const url = \`http://\${WS_HOST}:\${port}/vnc_lite.html?autoconnect=1...\`"
echo ""
echo -e "${CYAN}DEPOIS:${NC}"
echo "  const url = \`http://\${WS_HOST}:\${port}/vnc_mobile.html?autoconnect=1&reconnect=1&resize=scale&quality=6&compression=2\`"
echo ""
echo "Ou execute este comando no Pi:"
echo ""
echo -e "${GREEN}sed -i 's|vnc_lite.html|vnc_mobile.html|g' ~/astrocontrol/app.js${NC}"
echo ""
read -p "Aplicar automaticamente? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    if [ -f "/home/samu192/astrocontrol/app.js" ]; then
        sed -i 's|vnc_lite\.html|vnc_mobile.html|g' /home/samu192/astrocontrol/app.js
        echo -e "${GREEN}✓${NC} app.js atualizado automaticamente"
    else
        echo -e "${YELLOW}⚠${NC} Arquivo app.js não encontrado, atualize manualmente"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# PASSO 4: Corrigir Terminal (ttyd)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}[4/4]${NC} Corrigindo terminal (ttyd)..."

systemctl stop ttyd 2>/dev/null || true

cat > /etc/systemd/system/ttyd.service << 'EOF'
[Unit]
Description=ttyd web terminal (bash direto)
After=network.target

[Service]
Type=simple
User=samu192
WorkingDirectory=/home/samu192
ExecStart=/usr/bin/ttyd -p 7681 -t fontSize=14 -t 'theme={"background":"#1e1e1e","foreground":"#d4d4d4","cursor":"#5dcaa5"}' bash
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ttyd
systemctl start ttyd

if systemctl is-active --quiet ttyd; then
    echo -e "${GREEN}✓${NC} Terminal (ttyd) corrigido e rodando"
else
    echo -e "${RED}✗${NC} Erro ao iniciar ttyd"
    echo -e "${YELLOW}ℹ${NC} Ver logs: journalctl -u ttyd -n 20"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PASSO 5: Reiniciar noVNC (opcional)
# ═══════════════════════════════════════════════════════════════════════════
echo ""
read -p "Reiniciar serviços noVNC agora? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    systemctl restart novnc-6080 novnc-6081 novnc-6082
    echo -e "${GREEN}✓${NC} Serviços noVNC reiniciados"
fi

# ═══════════════════════════════════════════════════════════════════════════
# FINALIZAÇÃO
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    OTIMIZAÇÕES APLICADAS!                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}✅ O que foi feito:${NC}"
echo "   1. ✓ Criada página vnc_mobile.html sem barra azul"
echo "   2. ✓ Escala automática para qualquer dispositivo"
echo "   3. ✓ Cursor fantasma removido (clique direto)"
echo "   4. ✓ Terminal ttyd corrigido"
echo ""
echo -e "${CYAN}📱 URLs atualizadas (usar vnc_mobile.html):${NC}"
echo "   KStars:  http://astropi.local:6080/vnc_mobile.html?autoconnect=1"
echo "   PHD2:    http://astropi.local:6081/vnc_mobile.html?autoconnect=1"
echo "   Desktop: http://astropi.local:6082/vnc_mobile.html?autoconnect=1&password=astrocontrol"
echo "   Terminal: http://astropi.local:7681"
echo ""
echo -e "${CYAN}🔧 Próximos passos:${NC}"
echo "   1. Atualizar app.js para usar vnc_mobile.html (se não foi feito automaticamente)"
echo "   2. Reiniciar AstroControl: sudo systemctl restart astrocontrol"
echo "   3. Testar no celular/tablet"
echo ""
echo -e "${YELLOW}💡 Dicas de uso no mobile:${NC}"
echo "   • Clique simples = clique esquerdo"
echo "   • Toque longo (1s) = clique direito"
echo "   • Dois dedos = arrastar/scroll"
echo "   • Pinch = zoom (se habilitado no app remoto)"
echo ""
echo -e "${CYAN}📝 Backup do noVNC original:${NC}"
echo "   $BACKUP_DIR"
echo ""
