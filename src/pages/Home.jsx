import { useMemo, useState } from "react";

const WHATSAPP_NUMBER = "61400000000";

const PRICING = {
  BASE_FEE: 10,
  PER_KM: 2.4,
  PER_MIN: 0.55,
  MINIMUM: 45,
  AIRPORT_SURCHARGE: 10,
  LATE_MULTIPLIER: 1.1,
  ROUND_TO: 5,
};

const ROUTES = [
  { keys: ["st kilda", "airport"], km: 29, min: 40 },
  { keys: ["city", "airport"], km: 23, min: 32 },
  { keys: ["cbd", "airport"], km: 23, min: 32 },
  { keys: ["southbank", "airport"], km: 25, min: 34 },
  { keys: ["south yarra", "airport"], km: 29, min: 40 },
  { keys: ["toorak", "airport"], km: 31, min: 41 },
  { keys: ["brighton", "airport"], km: 35, min: 46 },
  { keys: ["airport", "st kilda"], km: 29, min: 40 },
  { keys: ["airport", "city"], km: 23, min: 32 },
  { keys: ["airport", "cbd"], km: 23, min: 32 },
];

const DEMO_SUGGESTIONS = [
  "Melbourne Airport (Tullamarine)",
  "Melbourne CBD",
  "St Kilda",
  "South Yarra",
  "Southbank",
  "Toorak",
  "Brighton",
  "Crown Melbourne",
  "Langham Melbourne",
  "Park Hyatt Melbourne",
  "Avalon Airport",
];

function roundFare(n) {
  return Math.round(n / PRICING.ROUND_TO) * PRICING.ROUND_TO;
}

function isLateNight() {
  const h = new Date().getHours();
  return h >= 22 || h < 5;
}

function isAirport(text) {
  const t = text.toLowerCase();
  return (
    t.includes("airport") ||
    t.includes("tullamarine") ||
    t.includes("avalon") ||
    t.includes("terminal")
  );
}

function lookupRoute(from, to) {
  const combined = `${from} ${to}`.toLowerCase();
  return ROUTES.find((r) => r.keys.every((k) => combined.includes(k))) || null;
}

function estimateFare(from, to) {
  if (!from || !to) return null;
  const route = lookupRoute(from, to);
  if (!route) return null;

  let fare =
    PRICING.BASE_FEE +
    route.km * PRICING.PER_KM +
    route.min * PRICING.PER_MIN;

  if (fare < PRICING.MINIMUM) fare = PRICING.MINIMUM;
  if (isAirport(`${from} ${to}`)) fare += PRICING.AIRPORT_SURCHARGE;
  if (isLateNight()) fare *= PRICING.LATE_MULTIPLIER;

  return roundFare(fare);
}

function AddressInput({ label, value, onChange }) {
  const filtered = useMemo(() => {
    if (!value) return DEMO_SUGGESTIONS;
    return DEMO_SUGGESTIONS.filter((s) =>
      s.toLowerCase().includes(value.toLowerCase())
    );
  }, [value]);

  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label === "Pickup" ? "Enter pickup location" : "Enter destination"}
      />
      {value && filtered.length > 0 && (
        <div className="suggestions">
          {filtered.slice(0, 5).map((item) => (
            <button key={item} type="button" onClick={() => onChange(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [luggage, setLuggage] = useState("1");

  const fare = useMemo(() => estimateFare(pickup, dropoff), [pickup, dropoff]);

  const waHref = useMemo(() => {
    const text = `Hello, I would like to arrange a transfer with VERNO.

Pickup:
${pickup || "-"}

Drop-off:
${dropoff || "-"}

Date:
${date || "-"}

Time:
${time || "-"}

Passengers:
${passengers}

Luggage:
${luggage}

Estimated Fare:
${fare ? `$${fare}` : "-"}

Please confirm availability.`;

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }, [pickup, dropoff, date, time, passengers, luggage, fare]);

  return (
    <div>
      <header className="hero">
        <div className="nav">
          <div className="brand">VERNO</div>
          <a className="nav-link" href="#booking">
            Reserve
          </a>
        </div>

        <div className="hero-inner">
          <p className="eyebrow">Private Chauffeur — Melbourne</p>
          <h1>Arrive in complete confidence.</h1>
          <p className="sub">
            Airport Transfers • Corporate Travel • Direct Service
          </p>
          <a className="primary-btn" href="#booking">
            Reserve Your Transfer
          </a>
          <p className="hero-note">
            Melbourne-based chauffeur. Direct service. No third-party platforms.
          </p>
        </div>
      </header>

      <section className="trust-strip">
        <span>Private Chauffeur Service</span>
        <span>Fixed Pricing</span>
        <span>Airport Specialist</span>
        <span>Fast WhatsApp Confirmation</span>
      </section>

      <section className="booking" id="booking">
        <div className="booking-copy">
          <p className="eyebrow dark">Arrange Your Transfer</p>
          <h2>Fixed fare. Direct confirmation. Quiet luxury.</h2>
          <p>
            Select pickup and destination to receive an instant fare estimate.
          </p>
          <ul className="steps">
            <li>1. Send request</li>
            <li>2. We confirm details</li>
            <li>3. Your driver is assigned</li>
          </ul>
        </div>

        <div className="card">
          <AddressInput label="Pickup" value={pickup} onChange={setPickup} />
          <AddressInput label="Destination" value={dropoff} onChange={setDropoff} />

          <div className="row">
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Passengers</label>
              <select value={passengers} onChange={(e) => setPassengers(e.target.value)}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Luggage</label>
              <select value={luggage} onChange={(e) => setLuggage(e.target.value)}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fare-box">
            <div>
              <p className="fare-label">Estimated Fixed Fare</p>
              <div className="fare-price">{fare ? `$${fare}` : "—"}</div>
              <p className="fare-note">No surge pricing • Confirmed before pickup</p>
            </div>
          </div>

          <a className="wa-btn" href={waHref} target="_blank" rel="noreferrer">
            Reserve via WhatsApp
          </a>
          <p className="wa-note">You will receive a confirmation within minutes.</p>
        </div>
      </section>

      <section className="fleet">
        <p className="eyebrow dark">Fleet</p>
        <h2>100% Electric Luxury Fleet</h2>
        <p>Multiple BMW i5 vehicles available.</p>
      </section>

      <footer className="footer">
        <div>VERNO</div>
        <div>book@vernochauffeur.com.au</div>
      </footer>

      <a className="floating-wa" href={waHref} target="_blank" rel="noreferrer">
        Reserve
      </a>
    </div>
  );
}
