import { kafka, TOPICS } from "../config/kafka.js";

const MONITORED_TOPICS = [
  TOPICS.LOCATION_UPDATES,
  TOPICS.RIDE_REQUESTED,
  TOPICS.RIDE_ACCEPTED,
  TOPICS.RIDE_COMPLETED,
  TOPICS.PERSISTENCE_RECOVERY,
];

const MAX_MESSAGES_PER_TOPIC = 120;
const streamClients = new Set();
const topicBuffers = new Map(MONITORED_TOPICS.map((topic) => [topic, []]));

function parseMessageValue(value) {
  if (!value) return null;
  const raw = value.toString();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function publishToStreams(entry) {
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of streamClients) {
    res.write(payload);
  }
}

function trackMessage({ topic, partition, message }) {
  const rawTimestamp = Number(message.timestamp);
  const hasKafkaTimestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0;
  if (!hasKafkaTimestamp) {
    console.warn(
      `[Consumer:topic-monitor] Missing/invalid Kafka timestamp on topic ${topic} offset ${message.offset}; using current time fallback`
    );
  }

  const entry = {
    topic,
    partition,
    key: message.key ? message.key.toString() : null,
    offset: message.offset,
    timestamp: new Date(hasKafkaTimestamp ? rawTimestamp : Date.now()).toISOString(),
    payload: parseMessageValue(message.value),
    observed_at: new Date().toISOString(),
  };

  const current = topicBuffers.get(topic) || [];
  current.push(entry);
  if (current.length > MAX_MESSAGES_PER_TOPIC) {
    current.splice(0, current.length - MAX_MESSAGES_PER_TOPIC);
  }
  topicBuffers.set(topic, current);
  publishToStreams(entry);
}

export function getTopicMonitorSnapshot() {
  const topics = MONITORED_TOPICS.map((topic) => {
    const messages = topicBuffers.get(topic) || [];
    return {
      topic,
      count: messages.length,
      latest_message_at: messages.length ? messages[messages.length - 1].observed_at : null,
      messages,
    };
  });

  return {
    monitored_topics: MONITORED_TOPICS,
    max_messages_per_topic: MAX_MESSAGES_PER_TOPIC,
    topics,
  };
}

export function registerTopicMonitorClient(res) {
  streamClients.add(res);
}

export function unregisterTopicMonitorClient(res) {
  streamClients.delete(res);
}

export async function startTopicMonitorConsumer() {
  const consumer = kafka.consumer({ groupId: "trip-service-topic-monitor" });
  await consumer.connect();

  for (const topic of MONITORED_TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        trackMessage({ topic, partition, message });
      } catch (err) {
        console.error("[Consumer:topic-monitor] Error", err.message);
      }
    },
  });

  console.log(`[Consumer:topic-monitor] Subscribed to ${MONITORED_TOPICS.join(", ")}`);
}
