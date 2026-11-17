#!/bin/sh
# apply-profile.sh <P1|P2|P3|none> <cloud-if> <clinic-if> [cut]
#
# Egress on the cloud-side interface is the clinic's uplink, egress on the clinic-side interface
# its downlink. Each gets tbf (aggregate rate across all connections) with a netem child (half
# the RTT, half the jitter without reordering, the loss rate per direction). "cut" keeps the rates and drops every
# packet (loss 100 %), as on a line drop.
set -eu
profile="$1"
up_if="$2"
down_if="$3"
mode="${4:-}"

for dev in "$up_if" "$down_if"; do
  tc qdisc del dev "$dev" root 2>/dev/null || true
done
[ "$profile" = none ] && exit 0

p="$(jq -c --arg p "$profile" '.[$p]' /etc/link/profiles.json)"
if [ "$p" = null ]; then
  echo "unknown profile $profile" >&2
  exit 2
fi
field() { printf '%s' "$p" | jq -r ".$1"; }
half_rtt=$(($(field rttMs) / 2))
half_jitter=$(($(field jitterMs) / 2))
loss="$(field lossPercent)"
[ "$mode" = cut ] && loss=100

shape() {
  dev="$1"
  rate="$2"
  tc qdisc add dev "$dev" root handle 1: tbf rate "${rate}mbit" burst 32kb latency 400ms
  if [ "$half_jitter" -gt 0 ]; then
    # netem delays each packet independently, so jitter alone sends packets out of order and
    # TCP throughput collapses (0.3-S4b: P3 slower than P2). With `rate`, netem schedules each
    # packet no earlier than the one before it: jitter varies the delay, order is kept.
    tc qdisc add dev "$dev" parent 1:1 handle 10: netem delay "${half_rtt}ms" "${half_jitter}ms" distribution normal rate "${rate}mbit" loss "${loss}%"
  else
    tc qdisc add dev "$dev" parent 1:1 handle 10: netem delay "${half_rtt}ms" loss "${loss}%"
  fi
}
shape "$up_if" "$(field upMbit)"
shape "$down_if" "$(field downMbit)"
