// Booking contact details and the WhatsApp / SMS booking message.
// Pure functions — the fares passed in are the same values shown on screen.

import { formatPrice } from "./pricing.js";

export const WA_NUMBER = "61421238894";
export const VERNO_EMAIL = "book@vernochauffeur.com.au";
export const VERNO_PHONE = "+61421238894";
export const VERNO_PHONE_DISPLAY = "0421 238 894";

// BMW i5 sedan capacity.
export const MAX_PASSENGERS = 4;

const TO_BE_CONFIRMED = "To be confirmed";
const REGIONAL_QUOTE = "To be quoted (regional)";
const EVENT_GUIDE = "(guide — final fare to be confirmed)";

function fareValue(leg) {
  if (leg.regional) return REGIONAL_QUOTE;
  if (leg.fare == null) return TO_BE_CONFIRMED;
  const notes = [
    ...(leg.lateNight ? ["(incl. late-night surcharge)"] : []),
    ...(leg.event ? [EVENT_GUIDE] : []),
  ];
  return [formatPrice(leg.fare), ...notes].join(" ");
}

function legLines(leg) {
  const flight = (leg.flightNumber || "").trim();
  return [
    ...(flight ? [`FLIGHT     : ${flight.toUpperCase()}`] : []),
    ...(leg.event ? [`EVENT      : ${leg.event} — pricing to be confirmed`] : []),
    `FARE       : ${fareValue(leg)}`,
  ];
}

function totalValue(legs, total) {
  if (legs.some((leg) => leg.regional)) return REGIONAL_QUOTE;
  if (total == null) return TO_BE_CONFIRMED;
  return legs.some((leg) => leg.event) ? `${formatPrice(total)} ${EVENT_GUIDE}` : formatPrice(total);
}

/**
 * Build the plain-text booking request.
 *
 * Leg fields: { pickup, dropoff, date, time, flightNumber, fare, lateNight, regional, event }
 * where `event` is the major-event name (or empty) and `regional` means no automatic fare.
 * The outbound leg also carries passengers and luggage.
 *
 * @param {object} outbound
 * @param {object|null} returnLeg
 * @param {number|null} total combined fare shown to the customer (return bookings)
 */
export function buildBookingMessage({ outbound, returnLeg = null, total = null }) {
  const o = outbound || {};
  const lines = [
    "VÉRNO — Transfer Request",
    "",
    ...(returnLeg ? ["OUTBOUND"] : []),
    `PICKUP     : ${o.pickup || ""}`,
    `DROP-OFF   : ${o.dropoff || ""}`,
    `DATE       : ${o.date || ""}`,
    `TIME       : ${o.time || ""}`,
    `PASSENGERS : ${o.passengers ?? ""}`,
    `LUGGAGE    : ${o.luggage ?? ""}`,
    ...legLines(o),
  ];

  if (returnLeg) {
    const r = returnLeg;
    lines.push(
      "",
      "RETURN",
      `PICKUP     : ${r.pickup || ""}`,
      `DROP-OFF   : ${r.dropoff || ""}`,
      `DATE       : ${r.date || ""}`,
      `TIME       : ${r.time || ""}`,
      ...legLines(r),
      "",
      `TOTAL      : ${totalValue([o, r], total)}`,
    );
  }

  lines.push("", "Please confirm availability.");
  return lines.join("\n");
}

/** Blank request template used by the general "Reserve via WhatsApp" buttons. */
export function buildBlankBookingMessage() {
  return [
    "VÉRNO — Transfer Request",
    "",
    "PICKUP     : ",
    "DROP-OFF   : ",
    "DATE       : ",
    "TIME       : ",
    "PASSENGERS : ",
    "LUGGAGE    : ",
    "",
    "Please confirm availability.",
  ].join("\n");
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** iPhone / iPad (including iPadOS, which reports itself as a Mac with touch). */
export function isAppleMobile(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

/**
 * sms: URI with a pre-filled body. iOS expects "sms:NUMBER&body=" (the format
 * the site has always used); Android and others use the RFC 5724 "?body=" form.
 */
export function buildSmsUrl(message, { ios = isAppleMobile() } = {}) {
  const separator = ios ? "&" : "?";
  return `sms:${VERNO_PHONE}${separator}body=${encodeURIComponent(message)}`;
}
