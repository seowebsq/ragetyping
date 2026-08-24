// ponytail: date-indexed instead of KV plus cron. The same prompt for everyone on a
// given day, with no storage and no scheduled worker. Swap to KV if it ever needs
// to be edited without a deploy.
const PROMPTS = [
  "reply-all email chains",
  "the self-checkout machine",
  "people who recline their airline seat",
  "software that updates while you are using it",
  "group chats with 40 unread messages",
  "cookie consent banners",
  "the person who microwaves fish at work",
  "printers",
  "meetings that could have been an email",
  "subscription cancellation flows",
  "loud chewing",
  "the phrase 'per my last email'",
  "parking",
  "autocorrect",
  "assembly instructions with no words",
  "the neighbour's leaf blower",
  "call centre hold music",
  "shopping trolleys with one bad wheel",
  "people who stop at the top of escalators",
  "passwords that need a special character",
  "unskippable ads",
  "the last 2% of phone battery",
  "open-plan offices",
  "delivery windows that span nine hours",
  "the word 'circle back'",
  "wet socks",
  "tangled cables",
  "brunch queues",
  "anyone who says 'it is what it is'",
  "public transport at 08:40",
  "smart devices that are not",
];

export function promptOfTheDay(now = new Date()): string {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86_400_000);
  return PROMPTS[day % PROMPTS.length];
}
