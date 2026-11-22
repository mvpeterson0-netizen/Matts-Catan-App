# Matt's Catan Tracker

Phone-friendly tracker for playing Catan. Each player opens it on their own device.

- **My Spots** – log each settlement/city and the 1–3 hexes (resource + number) touching it. Upgrade to a city (2×). Tap a hex to mark the robber on it.
- **Roll** – tap the rolled number; the app shows what you collect and adds it to your hand. A 7 warns you about discarding.
- **Hand** – running card count with quick-build buttons (road, settlement, city, dev card).
- **Stats** – roll histogram vs. expected, resources gathered, expected cards per roll.

Data is saved in the browser (localStorage); no server. Run tests with `node test.js`.
