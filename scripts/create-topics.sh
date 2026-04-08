#!/usr/bin/env bash
set -euo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-ola-prototype-kafka-1}"
BOOTSTRAP="localhost:9092"

TOPICS=(
  "location-updates"
  "ride-requested"
  "ride-accepted"
  "ride-completed"
  "persistence-recovery"
)

echo "Creating Kafka topics..."
for topic in "${TOPICS[@]}"; do
  docker exec "$KAFKA_CONTAINER" kafka-topics --create \
    --if-not-exists \
    --bootstrap-server "$BOOTSTRAP" \
    --replication-factor 1 \
    --partitions 3 \
    --topic "$topic"
  echo "  ✓ $topic"
done
echo "Done."
