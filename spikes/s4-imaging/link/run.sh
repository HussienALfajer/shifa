#!/bin/sh
# Keeps HAProxy in the foreground and restarts it when it dies: a link "reset" kills it, every
# connection through the link drops, and new connections work again a moment later. The qdiscs
# live on the interfaces, so shaping survives the restart.
config="${LINK_CONFIG:-/etc/link/haproxy.cfg}"
while true; do
  haproxy -db -f "$config"
  sleep 0.2
done
