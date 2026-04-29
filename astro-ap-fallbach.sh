#!/bin/bash

LOG="[AstroAP]"
TIMEOUT=30   # Aumentei um pouco para dar folga ao DHCP

echo "$LOG Iniciando verificação de rede..."

# Aguarda o hardware do rádio e o NetworkManager estabilizarem
sleep 10

# Loop de verificação
for i in $(seq 1 $TIMEOUT); do
    # Esta é a linha que sugeri: ela checa apenas o estado da wlan0
    WIFI_STATUS=$(nmcli -t -g DEVICE,STATE dev | grep "^wlan0:connected")

    if [ ! -z "$WIFI_STATUS" ]; then
        echo "$LOG Wi-Fi conectado (wlan0:connected) → não precisa de AP"
        exit 0
    fi

    echo "$LOG Aguardando Wi-Fi ($i/$TIMEOUT)..."
    sleep 1
done

echo "$LOG Nenhuma rede encontrada após timeout → ativando AP"

# Ativa o Ponto de Acesso
nmcli con up AstroPi-AP

exit 0