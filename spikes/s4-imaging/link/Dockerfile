# Link shaper (0.3-S4): HAProxy in TCP mode forwards clinic-side connections to the cloud side;
# tc tbf + netem on each interface shape the link (profiles.json, apply-profile.sh). Also used,
# with another HAProxy config, as the tests' ops tunnel. Kept for Phase D.
FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
RUN apk add --no-cache haproxy iproute2 jq
COPY haproxy.cfg profiles.json /etc/link/
COPY apply-profile.sh run.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/apply-profile.sh /usr/local/bin/run.sh
ENTRYPOINT ["/usr/local/bin/run.sh"]
