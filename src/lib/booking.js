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

function fareLine(label, fare, lateNight) {
  const value = fare == null ? TO_BE_CONFIRMED : `${formatPrice(fare)}${lateNight ? " (incl. late-night surcharge)" : ""}`;
  return `${label}${value}`;
}

function flightLine(flightNumber) {
  const flight = (flightNumber || "").trim();
  return flight ? [`FLIGHT     : ${flight.toUpperCase()}`] : [];
}

/**
 * Build the plain-text booking request.
 *
 * @param {object} outbound  { pickup, dropoff, date, time, passengers, luggage, flightNumber, fare, lateNight }
 * @param {object|null} returnLeg { pickup, dropoff, date, time, flightNumber, fare, lateNight }
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
    ...flightLine(o.flightNumber),
    fareLine("FARE       : ", o.fare, o.lateNight),
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
      ...flightLine(r.flightNumber),
      fareLine("FARE       : ", r.fare, r.lateNight),
      "",
      `TOTAL      : ${total == null ? TO_BE_CONFIRMED : formatPrice(total)}`,
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
