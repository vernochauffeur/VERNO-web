import { describe, it, expect } from "vitest";
import {
  buildBookingMessage, buildBlankBookingMessage, buildWhatsAppUrl, buildSmsUrl, isAppleMobile,
  VERNO_PHONE, WA_NUMBER, MAX_PASSENGERS,
} from "./booking.js";

const outbound = {
  pickup: "12 Acland St, St Kilda VIC 3182, Australia",
  dropoff: "Melbourne Airport (MEL), Melbourne Airport VIC 3045, Australia",
  date: "2026-10-01", time: "09:00", passengers: "2", luggage: "3",
  flightNumber: "", fare: 135, lateNight: false,
};

describe("buildBookingMessage — one way", () => {
  it("lists the journey and the displayed fare", () => {
    const msg = buildBookingMessage({ outbound });
    expect(msg).toContain("PICKUP     : 12 Acland St, St Kilda VIC 3182, Australia");
    expect(msg).toContain("PASSENGERS : 2");
    expect(msg).toContain("FARE       : $135");
    expect(msg).not.toContain("OUTBOUND");
    expect(msg).not.toContain("RETURN");
    expect(msg).not.toContain("TOTAL");
    expect(msg).not.toContain("FLIGHT");
  });

  it("includes the flight number only when provided", () => {
    expect(buildBookingMessage({ outbound: { ...outbound, flightNumber: "qf409" } })).toContain("FLIGHT     : QF409");
  });

  it("says 'To be confirmed' when no fare is available", () => {
    expect(buildBookingMessage({ outbound: { ...outbound, fare: null } })).toContain("FARE       : To be confirmed");
  });

  it("flags a late-night fare", () => {
    expect(buildBookingMessage({ outbound: { ...outbound, fare: 155, lateNight: true } }))
      .toContain("FARE       : $155 (incl. late-night surcharge)");
  });
});

describe("buildBookingMessage — return", () => {
  const returnLeg = {
    pickup: outbound.dropoff, dropoff: outbound.pickup,
    date: "2026-10-05", time: "02:00", flightNumber: "EK408", fare: 155, lateNight: true,
  };

  it("uses the actual return fare and the actual total (never fare × 2)", () => {
    const msg = buildBookingMessage({ outbound, returnLeg, total: 290 });
    const [out, ret] = msg.split("RETURN");
    expect(out).toContain("OUTBOUND");
    expect(out).toContain("FARE       : $135");
    expect(ret).toContain("PICKUP     : Melbourne Airport (MEL), Melbourne Airport VIC 3045, Australia");
    expect(ret).toContain("DROP-OFF   : 12 Acland St, St Kilda VIC 3182, Australia");
    expect(ret).toContain("DATE       : 2026-10-05");
    expect(ret).toContain("TIME       : 02:00");
    expect(ret).toContain("FLIGHT     : EK408");
    expect(ret).toContain("FARE       : $155 (incl. late-night surcharge)");
    expect(ret).toContain("TOTAL      : $290");
    expect(msg).not.toContain("$270"); // 135 × 2
  });

  it("uses different return addresses when given", () => {
    const msg = buildBookingMessage({
      outbound,
      returnLeg: { ...returnLeg, pickup: "Crown Melbourne, Southbank VIC 3006", dropoff: "Brighton VIC 3186", fare: 100, lateNight: false },
      total: 235,
    });
    const ret = msg.split("RETURN")[1];
    expect(ret).toContain("PICKUP     : Crown Melbourne, Southbank VIC 3006");
    expect(ret).toContain("DROP-OFF   : Brighton VIC 3186");
    expect(ret).toContain("TOTAL      : $235");
  });

  it("marks the total as 'To be confirmed' until both legs are priced", () => {
    const msg = buildBookingMessage({ outbound, returnLeg: { ...returnLeg, fare: null }, total: null });
    expect(msg.split("RETURN")[1]).toContain("FARE       : To be confirmed");
    expect(msg).toContain("TOTAL      : To be confirmed");
  });
});

describe("buildBookingMessage — regional and event legs", () => {
  const regional = { pickup: "Torquay VIC 3228, Australia", dropoff: "Mount Duneed Estate, Waurn Ponds VIC 3217, Australia", date: "2026-10-03", time: "12:00", passengers: "2", luggage: "0", fare: null, regional: true };

  it("never prices a regional leg", () => {
    const msg = buildBookingMessage({ outbound: regional });
    expect(msg).toContain("FARE       : To be quoted (regional)");
    expect(msg).not.toMatch(/\$\d/);
  });

  it("quotes a regional return leg independently, and the total", () => {
    const msg = buildBookingMessage({
      outbound: { ...outbound, fare: 135 },
      returnLeg: { pickup: "Torquay VIC 3228", dropoff: "St Kilda VIC 3182", date: "2026-10-05", time: "12:00", fare: null, regional: true },
      total: null,
    });
    const [out, ret] = msg.split("RETURN");
    expect(out).toContain("FARE       : $135");
    expect(ret).toContain("FARE       : To be quoted (regional)");
    expect(ret).toContain("TOTAL      : To be quoted (regional)");
  });

  it("names the event and marks the fare as a guide", () => {
    const msg = buildBookingMessage({ outbound: { ...outbound, dropoff: "MCG", fare: 100, event: "AFL Grand Final" } });
    expect(msg).toContain("EVENT      : AFL Grand Final — pricing to be confirmed");
    expect(msg).toContain("FARE       : $100 (guide — final fare to be confirmed)");
  });

  it("marks the total as a guide when any leg is on an event day", () => {
    const msg = buildBookingMessage({
      outbound: { ...outbound, fare: 100, event: "AFL Grand Final" },
      returnLeg: { pickup: "MCG", dropoff: "St Kilda", date: "2026-09-26", time: "18:00", fare: 100, event: "AFL Grand Final" },
      total: 200,
    });
    expect(msg).toContain("TOTAL      : $200 (guide — final fare to be confirmed)");
  });

  it("adds no event line for normal bookings", () => {
    expect(buildBookingMessage({ outbound })).not.toContain("EVENT");
  });
});

describe("links", () => {
  const msg = buildBookingMessage({ outbound });

  it("builds a WhatsApp link", () => {
    const url = buildWhatsAppUrl(msg);
    expect(url.startsWith(`https://wa.me/${WA_NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(msg);
  });

  it("builds the iOS sms: format the site has always used", () => {
    const url = buildSmsUrl(msg, { ios: true });
    expect(url.startsWith(`sms:${VERNO_PHONE}&body=`)).toBe(true);
    expect(decodeURIComponent(url.split("&body=")[1])).toBe(msg);
  });

  it("builds the standard sms: format for Android", () => {
    const url = buildSmsUrl(msg, { ios: false });
    expect(url.startsWith(`sms:${VERNO_PHONE}?body=`)).toBe(true);
    expect(decodeURIComponent(url.split("?body=")[1])).toBe(msg);
  });

  it("detects Apple mobile devices", () => {
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe(true);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true); // iPadOS
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)", platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(false);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isAppleMobile(null)).toBe(false);
  });

  it("keeps the blank template for general WhatsApp buttons", () => {
    expect(buildBlankBookingMessage()).toContain("VÉRNO — Transfer Request");
    expect(buildBlankBookingMessage()).not.toContain("FARE");
  });
});

describe("vehicle capacity", () => {
  it("limits the BMW i5 to 4 passengers", () => {
    expect(MAX_PASSENGERS).toBe(4);
  });
});
