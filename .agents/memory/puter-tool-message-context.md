---
name: Puter tool-message context
description: Durable rule for keeping Puter function-calling conversations valid across turns.
---

Internal assistant tool-call and tool-result messages should stay scoped to the active request loop; persist only plain user/assistant turns for the next request.

**Why:** Puter validates every message in the next chat request, and retaining incomplete or provider-specific tool messages across turns can trigger a missing `content` error even when saved history looks valid.

**How to apply:** Build a temporary working message list for each tool loop, normalize every outgoing message with `role` and `content`, and make assistant tool-call IDs match the corresponding tool-result IDs.